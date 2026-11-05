import test from "node:test";
import assert from "node:assert/strict";
import { validatePlan, previewPlan } from "../src/server-builder.js";

test("accepts a valid role and channel plan", () => {
  const plan = validatePlan({ operations: [
    { type: "create_role", name: "Moderator Helper", color: "#5865F2", permissions: ["ViewChannel", "ReadMessageHistory"] },
    { type: "create_category", name: "Community" },
    { type: "create_text_channel", name: "general chat", category: "Community", topic: "Community discussion" },
    { type: "create_voice_channel", name: "Hangout", category: "Community" }
  ] });
  assert.equal(plan.operations.length, 4);
  assert.equal(plan.operations[2].name, "general-chat");
});

test("rejects administrator and other privileged permissions", () => {
  assert.throws(() => validatePlan({ operations: [
    { type: "create_role", name: "Unsafe", permissions: ["Administrator"] }
  ] }), /Unsupported or privileged permissions/);
});

test("rejects unsupported operation types", () => {
  assert.throws(() => validatePlan({ operations: [
    { type: "delete_channel", name: "general" }
  ] }), /unsupported type/);
});

test("rejects oversized plans", () => {
  assert.throws(() => validatePlan({ operations: Array.from({ length: 31 }, (_, i) => ({
    type: "create_category", name: "Category " + i
  })) }), /between 1 and 30/);
});

test("preview marks existing names as skipped and new names as create", async () => {
  const guild = {
    roles: { cache: [{ name: "@everyone" }, { name: "Member" }] },
    channels: { cache: [{ name: "general" }] }
  };
  const preview = await previewPlan(guild, { operations: [
    { type: "create_role", name: "Member" },
    { type: "create_category", name: "Information" },
    { type: "create_text_channel", name: "general" },
    { type: "create_text_channel", name: "announcements" }
  ] });
  assert.deepEqual(preview.operations.map(x => x.status), [
    "already_exists_or_name_in_use", "will_create",
    "already_exists_or_name_in_use", "will_create"
  ]);
});
