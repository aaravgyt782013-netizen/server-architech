import { PermissionFlagsBits } from "discord.js";

// Deliberately conservative: generated member roles never receive admin/moderation powers.
export const SAFE_ROLE_PERMISSIONS = new Set([
  "ViewChannel",
  "SendMessages",
  "ReadMessageHistory",
  "Connect",
  "Speak",
  "AddReactions",
  "AttachFiles",
  "EmbedLinks",
  "UseApplicationCommands"
]);

export function parseSafePermissions(input = []) {
  if (!Array.isArray(input)) throw new Error("permissions must be an array");
  const invalid = input.filter((name) => !SAFE_ROLE_PERMISSIONS.has(name));
  if (invalid.length) throw new Error(`Unsupported or privileged permissions: ${invalid.join(", ")}`);
  return input.map((name) => PermissionFlagsBits[name]);
}
