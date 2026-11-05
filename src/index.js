import express from "express";
import { timingSafeEqual, createHmac } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  Client,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder
} from "discord.js";
import { config } from "./config.js";
import { applyPlan, checkBotPermissions, previewPlan, validatePlan } from "./server-builder.js";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "64kb" }));

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public");
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
let lastReadyAt = null;

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

function cookieValue(req, name) {
  const raw = req.headers.cookie || "";
  for (const part of raw.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return "";
}

function createSessionToken() {
  const expiresAt = String(Date.now() + 12 * 60 * 60 * 1000);
  const signature = createHmac("sha256", config.sessionSecret).update(expiresAt).digest("hex");
  return `${expiresAt}.${signature}`;
}

function isValidSession(token) {
  if (!token || !config.sessionSecret) return false;
  const [expiresAt, signature] = token.split(".");
  if (!expiresAt || !signature || !/^\d+$/.test(expiresAt) || Number(expiresAt) < Date.now()) return false;
  const expected = createHmac("sha256", config.sessionSecret).update(expiresAt).digest("hex");
  return safeEqual(signature, expected);
}

function requireManager(req, res, next) {
  const header = req.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const session = cookieValue(req, "sa_session");
  if ((bearer && safeEqual(bearer, config.apiKey)) || isValidSession(session)) return next();
  return res.status(401).json({ error: "Please sign in to Server Architect." });
}

function requireSameOrigin(req, res, next) {
  const origin = req.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== req.get("host")) {
        return res.status(403).json({ error: "Cross-origin request blocked." });
      }
    } catch {
      return res.status(403).json({ error: "Invalid request origin." });
    }
  }
  next();
}

async function getGuild() {
  const guild = await client.guilds.fetch(config.guildId);
  await guild.fetch();
  await guild.roles.fetch();
  await guild.channels.fetch();
  await guild.members.fetchMe();
  return guild;
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "server-architect", discordReady: client.isReady(), lastReadyAt });
});

app.get("/openapi.yaml", (_req, res) => {
  res.type("text/yaml").sendFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../openapi.yaml"));
});

app.post("/api/login", requireSameOrigin, (req, res) => {
  if (!config.dashboardPassword) {
    return res.status(503).json({ error: "Dashboard login is not configured. Set DASHBOARD_PASSWORD in Render." });
  }
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!password || !safeEqual(password, config.dashboardPassword)) {
    return res.status(401).json({ error: "Incorrect dashboard password." });
  }
  const secure = config.nodeEnv === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `sa_session=${encodeURIComponent(createSessionToken())}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secure}`);
  res.json({ ok: true });
});

app.use("/api", requireManager);

app.get("/api/session", (_req, res) => res.json({
  ok: true,
  dashboardReady: Boolean(config.dashboardPassword),
  aiReady: Boolean(config.aiApiKey),
  botReady: client.isReady()
}));

app.post("/api/logout", requireSameOrigin, (_req, res) => {
  const secure = config.nodeEnv === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `sa_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`);
  res.json({ ok: true });
});

app.get("/api/status", async (_req, res) => {
  try {
    const guild = await getGuild();
    res.json({
      ok: true,
      botReady: client.isReady(),
      guild: { id: guild.id, name: guild.name, memberCount: guild.memberCount },
      bot: { id: client.user.id, username: client.user.username }
    });
  } catch (error) {
    res.status(503).json({ error: error.message });
  }
});

app.post("/api/command/plan", async (req, res) => {
  try {
    if (!config.aiApiKey) {
      return res.status(503).json({ error: "AI is not configured. Add AI_API_KEY in your Render environment variables." });
    }
    const command = typeof req.body?.command === "string" ? req.body.command.trim() : "";
    if (!command || command.length > 2000) {
      return res.status(400).json({ error: "Enter a command between 1 and 2000 characters." });
    }

    const systemPrompt = [
      "You are the planning engine for Server Architect, a safe Discord server structure assistant.",
      "Convert the user's request into a JSON object with exactly these top-level keys: summary and operations.",
      "operations must be an array of 1 to 30 supported operations.",
      "Supported operations only:",
      "1) create_role: {type, name, color, hoist, mentionable, permissions}",
      "2) create_category: {type, name}",
      "3) create_text_channel: {type, name, category, topic}",
      "4) create_voice_channel: {type, name, category}",
      "Allowed role permissions only: ViewChannel, SendMessages, ReadMessageHistory, Connect, Speak, AddReactions, AttachFiles, EmbedLinks, UseApplicationCommands.",
      "Never include Administrator, moderation permissions, ManageRoles, ManageChannels, or any permission outside that allowlist.",
      "Do not generate deletion, editing, banning, kicking, role assignment, webhook, or message-sending operations.",
      "For text channels use lowercase kebab-case names. For categories and roles use readable names.",
      "When a request is ambiguous, make a conservative sensible layout and explain assumptions in summary.",
      "If the user requests unsupported actions only, return an empty operations array and explain that in summary.",
      "Return JSON only. No markdown fences or extra prose."
    ].join("\n");

    const response = await fetch(`${config.aiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.aiApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: config.aiModel,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: command }
        ]
      }),
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("AI provider error:", response.status, detail.slice(0, 1000));
      return res.status(502).json({ error: "The AI planner could not generate a plan. Check your AI provider settings in Render." });
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("AI provider returned an unexpected response.");
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed.operations) || parsed.operations.length === 0) {
      return res.status(422).json({ error: parsed.summary || "The request did not produce any supported server changes." });
    }

    const plan = validatePlan({ operations: parsed.operations });
    const guild = await getGuild();
    checkBotPermissions(guild);
    const preview = await previewPlan(guild, plan);
    res.json({
      ok: true,
      summary: typeof parsed.summary === "string" ? parsed.summary : "Review the proposed Discord changes below.",
      preview,
      confirmationRequired: "APPLY_SERVER_PLAN"
    });
  } catch (error) {
    console.error("Plan generation error:", error.message);
    res.status(400).json({ error: error.message || "Could not generate a valid plan." });
  }
});

app.post("/api/plan", async (req, res) => {
  try {
    const guild = await getGuild();
    checkBotPermissions(guild);
    const plan = validatePlan(req.body);
    res.json({ ok: true, preview: await previewPlan(guild, plan), confirmationRequired: "APPLY_SERVER_PLAN" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/apply", async (req, res) => {
  try {
    if (req.body?.confirm !== "APPLY_SERVER_PLAN") {
      return res.status(400).json({ error: "Explicit confirmation required. Set confirm to APPLY_SERVER_PLAN after reviewing the preview." });
    }
    const guild = await getGuild();
    checkBotPermissions(guild);
    const plan = validatePlan(req.body);
    const result = await applyPlan(guild, plan);
    res.json({ ok: true, result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.use("/api", (_req, res) => res.status(404).json({ error: "API endpoint not found." }));
app.use(express.static(publicDir));
app.get("*", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));

app.use((error, _req, res, _next) => {
  console.error("HTTP error:", error);
  res.status(500).json({ error: "Internal server error" });
});

const commands = [
  new SlashCommandBuilder()
    .setName("serverarchitect")
    .setDescription("Check Server Architect bot status")
    .toJSON()
];

client.once(Events.ClientReady, async (readyClient) => {
  lastReadyAt = new Date().toISOString();
  console.log(`Discord bot ready as ${readyClient.user.tag}`);
  try {
    const rest = new REST({ version: "10" }).setToken(config.token);
    await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: commands });
    console.log("Registered /serverarchitect command");
  } catch (error) {
    console.error("Could not register slash command:", error.message);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "serverarchitect") return;
  if (config.managerUserIds.length && !config.managerUserIds.includes(interaction.user.id)) {
    return interaction.reply({ content: "You are not allowed to use this command.", ephemeral: true });
  }
  return interaction.reply({
    content: client.isReady()
      ? `Server Architect is online. Connected to **${interaction.guild?.name || "your server"}**. API health: available.`
      : "Server Architect is starting.",
    ephemeral: true
  });
});

const server = app.listen(config.port, "0.0.0.0", () => {
  console.log(`Server Architect API and dashboard listening on port ${config.port}`);
});

async function shutdown() {
  console.log("Shutting down...");
  server.close();
  client.destroy();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

client.login(config.token).catch((error) => {
  console.error("Discord login failed:", error.message);
  process.exit(1);
});
