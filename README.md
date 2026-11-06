# Server Architect — Discord-first AI builder

Server Architect is controlled from Discord. There is no web dashboard.

## Workflow

1. Run `/design prompt:<describe your server>` in your Discord server.
2. The bot asks you to upload up to **3 reference screenshots/photos** in the channel. Send the images as attachments within 2 minutes, or send `skip` if you have no references.
3. The bot sends your complete written brief and images to the configured AI model.
4. The bot replies with a structured preview showing roles, categories and channels it proposes to create, plus what will be skipped.
5. Review the preview and press **Approve & implement** or **Cancel**. Only the user who started the design can approve it. Previews expire after 15 minutes.
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

## Render deployment

Deploy this repository as a Node web service using `render.yaml`. Set these environment variables in Render:

- `DISCORD_TOKEN` — bot token
- `CLIENT_ID` — Discord application ID
- `GUILD_ID` — target Discord server ID
- `MANAGER_API_KEY` — long random secret (32+ characters)
- `MANAGER_DISCORD_USER_IDS` — **required** comma-separated Discord user IDs allowed to run `/design`
- `AI_API_KEY` — Gemini API key
- `AI_BASE_URL` — `https://generativelanguage.googleapis.com/v1beta/openai`
- `AI_MODEL` — model available to your Gemini API key (default in `.env.example`)

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