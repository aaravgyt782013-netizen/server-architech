# Server Architect — Discord-first AI builder

Server Architect is controlled from Discord. There is no web dashboard.

## Workflow

1. Run `/design` in your Discord server. The bot posts a public Design Studio message.
2. Use **Edit prompt** to enter the server brief in a modal.
3. Optionally use **Add photo links** to paste up to 3 Discord CDN image URLs (one per line).
4. Select **Generate preview**. The bot validates references, sends the brief and images to Groq, and updates the same Design Studio message with progress.
5. Review the structured preview and press **Approve & implement** or **Cancel**. Only the user who started the design can approve it. Previews expire after 15 minutes.
6. The bot reports created, skipped and failed operations.

Reference images are processed for the current request only. Use JPG, PNG or WebP; each image must be 1 MB or smaller. Do not upload sensitive/private information.

## Discord setup

1. Create an application at https://discord.com/developers/applications.
2. Create a bot and copy its token securely.
3. Copy the Application ID and your target Server ID.
4. The bot uses the Guilds and Guild Messages intents; Message Content intent is not required for image uploads.
5. Invite the bot with scopes `bot` and `applications.commands`.
6. Grant **Manage Roles**, **Manage Channels**, and **View Channels** only. Do not grant Administrator.
7. Place the bot's role above the roles it needs to create.

## Groq AI provider

The planner uses Groq through its OpenAI-compatible Chat Completions API. The default model is `qwen/qwen3.8-27b`, which supports image inputs and JSON mode. Groq account quotas and model availability apply; free access is not unlimited. Create a key in the [Groq Console](https://console.groq.com/keys).

## Render deployment

Deploy this repository as a Node web service using `render.yaml`. Set these environment variables in Render:

- `DISCORD_TOKEN` — bot token
- `CLIENT_ID` — Discord application ID
- `GUILD_ID` — target Discord server ID
- `MANAGER_API_KEY` — long random secret (32+ characters)
- `MANAGER_DISCORD_USER_IDS` — **required** comma-separated Discord user IDs allowed to run `/design`
- `AI_API_KEY` — Groq API key (create it at https://console.groq.com/keys)
- `AI_BASE_URL` — `https://api.groq.com/openai/v1`
- `AI_MODEL` — `qwen/qwen3.8-27b` (supports image references and JSON mode)

The service health endpoint is `/health`. The root URL returns service information only; it is not a dashboard.

## Current implementation scope

The executor currently creates roles, categories, text channels and voice channels. It safely skips names that already exist. It does **not** yet configure detailed channel permission overwrites, role positions, onboarding, automod, tickets, webhooks, moderation workflows, role assignment or message content. The AI must not claim unsupported features have been implemented.

The planner uses an allowlist of safe role permissions. It never grants Administrator or moderation powers. It does not delete or edit existing server objects. Every plan requires an explicit button approval before any Discord changes are attempted.

## Local development

Copy `.env.example` to `.env`, fill in the values, then run:

```bash
npm install
npm test
npm start
```

Never commit tokens or API keys. If a secret is exposed, rotate it in the provider immediately.