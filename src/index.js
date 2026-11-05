import express from "express";
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

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
let lastReadyAt = null;

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && cryptoTimingSafeEqual(left, right);
}
import { timingSafeEqual as cryptoTimingSafeEqual } from "node:crypto";

function requireApiKey(req, res, next) {
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || !safeEqual(token, config.apiKey)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

async function getGuild() {
  const guild = await client.guilds.fetch(config.guildId);
  await guild.fetch();
  return guild;
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "server-architect", discordReady: client.isReady(), lastReadyAt });
});

app.get("/openapi.yaml", (_req, res) => {
  res.type("text/yaml").sendFile(new URL("../openapi.yaml", import.meta.url).pathname);
});

app.use("/api", requireApiKey);

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
  console.log(`Server Architect API listening on port ${config.port}`);
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
