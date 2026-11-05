import {
  ChannelType,
  PermissionFlagsBits
} from "discord.js";
import { parseSafePermissions } from "./permissions.js";

const NAME_RE = /^[\p{L}\p{N} _.-]{1,90}$/u;
const TOPIC_RE = /^[\s\S]{0,900}$/;

function cleanName(value, label = "name") {
  if (typeof value !== "string" || !NAME_RE.test(value.trim())) {
    throw new Error(`${label} must be 1-90 characters and use letters, numbers, spaces, dots, dashes or underscores`);
  }
  return value.trim();
}

export function validatePlan(body) {
  if (!body || typeof body !== "object" || !Array.isArray(body.operations)) {
    throw new Error("Send an object containing an operations array");
  }
  if (body.operations.length < 1 || body.operations.length > 30) {
    throw new Error("A plan must contain between 1 and 30 operations");
  }

  const normalized = body.operations.map((op, index) => {
    if (!op || typeof op !== "object") throw new Error(`Operation ${index + 1} is invalid`);
    switch (op.type) {
      case "create_role": {
        const name = cleanName(op.name, "role name");
        const color = op.color || "#5865F2";
        if (typeof color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(color)) {
          throw new Error(`Operation ${index + 1}: color must be a hex value like #5865F2`);
        }
        const permissions = Array.isArray(op.permissions) ? op.permissions : [];
        parseSafePermissions(permissions);
        return { type: op.type, name, color, hoist: Boolean(op.hoist), mentionable: Boolean(op.mentionable), permissions };
      }
      case "create_category":
        return { type: op.type, name: cleanName(op.name, "category name") };
      case "create_text_channel": {
        const name = cleanName(op.name, "channel name").toLowerCase().replace(/\s+/g, "-");
        const topic = op.topic || "";
        if (typeof topic !== "string" || !TOPIC_RE.test(topic)) throw new Error("Channel topic must be at most 900 characters");
        return { type: op.type, name, category: op.category ? cleanName(op.category, "category") : null, topic };
      }
      case "create_voice_channel": {
        const name = cleanName(op.name, "channel name");
        return { type: op.type, name, category: op.category ? cleanName(op.category, "category") : null };
      }
      default:
        throw new Error(`Operation ${index + 1}: unsupported type '${op.type}'. Allowed: create_role, create_category, create_text_channel, create_voice_channel`);
    }
  });
  return { operations: normalized };
}

export async function previewPlan(guild, plan) {
  const normalized = validatePlan(plan);
  const existingRoles = new Set(guild.roles.cache.map((r) => r.name.toLowerCase()));
  const existingChannels = new Set(guild.channels.cache.map((c) => c.name.toLowerCase()));
  const operations = normalized.operations.map((op) => {
    const key = op.name.toLowerCase();
    const names = op.type === "create_role" ? existingRoles : existingChannels;
    const exists = names.has(key);
    if (!exists) names.add(key);
    return { ...op, status: exists ? "already_exists_or_name_in_use" : "will_create" };
  });
  return {
    guild: { id: guild.id, name: guild.name },
    operationCount: operations.length,
    createCount: operations.filter((op) => op.status === "will_create").length,
    skippedCount: operations.filter((op) => op.status !== "will_create").length,
    operations
  };
}

export async function applyPlan(guild, plan) {
  const preview = await previewPlan(guild, plan);
  const results = [];
  for (const op of preview.operations) {
    if (op.status !== "will_create") {
      results.push({ type: op.type, name: op.name, result: "skipped_existing" });
      continue;
    }
    try {
      if (op.type === "create_role") {
        const role = await guild.roles.create({
          name: op.name,
          color: op.color,
          hoist: op.hoist,
          mentionable: op.mentionable,
          permissions: parseSafePermissions(op.permissions),
          reason: "Created by Server Architect after explicit approval"
        });
        results.push({ type: op.type, name: op.name, result: "created", id: role.id });
      } else if (op.type === "create_category") {
        const channel = await guild.channels.create({
          name: op.name,
          type: ChannelType.GuildCategory,
          reason: "Created by Server Architect after explicit approval"
        });
        results.push({ type: op.type, name: op.name, result: "created", id: channel.id });
      } else {
        const parent = op.category
          ? guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === op.category.toLowerCase())
          : null;
        if (op.category && !parent) throw new Error(`Category '${op.category}' was not found. Create it earlier in the plan.`);
        const type = op.type === "create_text_channel" ? ChannelType.GuildText : ChannelType.GuildVoice;
        const channel = await guild.channels.create({
          name: op.name,
          type,
          ...(parent ? { parent: parent.id } : {}),
          ...(type === ChannelType.GuildText && op.topic ? { topic: op.topic } : {}),
          reason: "Created by Server Architect after explicit approval"
        });
        results.push({ type: op.type, name: op.name, result: "created", id: channel.id });
      }
    } catch (error) {
      results.push({ type: op.type, name: op.name, result: "failed", error: error.message });
    }
  }
  return { guild: { id: guild.id, name: guild.name }, results };
}

export function checkBotPermissions(guild) {
  const me = guild.members.me;
  if (!me) throw new Error("Bot member is not available in the target server");
  const required = [PermissionFlagsBits.ManageRoles, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ViewChannel];
  const missing = required.filter((permission) => !me.permissions.has(permission));
  if (missing.length) throw new Error("Bot is missing required server permissions: " + missing.map(String).join(", "));
  return true;
}
