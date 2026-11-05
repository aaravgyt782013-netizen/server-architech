import "dotenv/config";

const required = ["DISCORD_TOKEN", "CLIENT_ID", "GUILD_ID", "MANAGER_API_KEY"];
const missing = required.filter((key) => !process.env[key]?.trim());

if (missing.length) {
  throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
}

export const config = Object.freeze({
  token: process.env.DISCORD_TOKEN.trim(),
  clientId: process.env.CLIENT_ID.trim(),
  guildId: process.env.GUILD_ID.trim(),
  apiKey: process.env.MANAGER_API_KEY.trim(),
  dashboardPassword: (process.env.DASHBOARD_PASSWORD || "").trim(),
  sessionSecret: (process.env.DASHBOARD_SESSION_SECRET || process.env.MANAGER_API_KEY).trim(),
  aiApiKey: (process.env.AI_API_KEY || "").trim(),
  aiBaseUrl: (process.env.AI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai").trim().replace(/\/+$/, ""),
  aiModel: (process.env.AI_MODEL || "gemini-3.6-flash").trim(),
  port: Number(process.env.PORT || 10000),
  nodeEnv: process.env.NODE_ENV || "development",
  managerUserIds: (process.env.MANAGER_DISCORD_USER_IDS || "")
    .split(",").map((id) => id.trim()).filter(Boolean)
});
