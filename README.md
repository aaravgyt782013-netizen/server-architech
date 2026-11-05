# Server Architect

A Discord server structure assistant with a protected HTTP API designed for ChatGPT Actions.

## Current capabilities

- Connects to one configured Discord server.
- Reports bot/server status.
- Previews a proposed plan before applying it.
- Creates roles, categories, text channels and voice channels.
- Skips names that already exist; does not delete or edit existing server objects.
- Restricts generated role permissions to a small safe allowlist. Administrator and moderation permissions are not allowed.
- Requires an explicit confirmation string for applying a plan.

This is a conservative first version. It is not an unrestricted Discord administrator and does not yet configure detailed per-channel permission overwrites, moderation, tickets, automod or message content.

## 1. Discord application

1. Open https://discord.com/developers/applications and create an application.
2. Open **Bot** and create/reset the bot token. Keep it secret.
3. Copy the **Application ID** from General Information.
4. Enable no privileged intents; this version only needs the Guilds intent.
5. Use OAuth2 URL Generator with scopes `bot` and `applications.commands`.
6. Grant the bot only the permissions it needs: **Manage Roles**, **Manage Channels**, **View Channels**, and **Send Messages** (the status command uses ephemeral interaction responses). Do not grant Administrator.
7. Invite the bot to your existing server. Ensure its bot role is positioned above roles it must create/manage if you later add role assignment features.

To copy your server ID: Discord Settings -> Advanced -> enable Developer Mode, then right-click/tap the server name -> Copy Server ID.

## 2. Deploy to Render

1. Push this repository to GitHub.
2. Open https://dashboard.render.com/ and choose **New -> Blueprint**.
3. Connect GitHub and select this repository. Render reads `render.yaml`.
4. Set these environment variables in the Render service:
   - `DISCORD_TOKEN`: bot token from Discord Developer Portal
   - `CLIENT_ID`: Discord Application ID
   - `GUILD_ID`: target server ID
   - `MANAGER_API_KEY`: a long random secret (at least 32 random characters)
   - `MANAGER_DISCORD_USER_IDS`: optional comma-separated Discord user IDs allowed to use the slash command
5. Deploy and wait for the service to become Live.
6. Open `https://YOUR-SERVICE.onrender.com/health`. It should return JSON with `ok: true` and `discordReady: true`.

Never put real secrets in GitHub, source files, screenshots, or ChatGPT messages. If a token is exposed, reset it in the Developer Portal and update Render.

## 3. Test the API

Use an API client such as Postman or a terminal. Add this header to protected endpoints:

`Authorization: Bearer YOUR_MANAGER_API_KEY`

Check status:

`GET https://YOUR-SERVICE.onrender.com/api/status`

Preview a plan:

`POST https://YOUR-SERVICE.onrender.com/api/plan`

Example JSON:

```json
{
  "operations": [
    { "type": "create_role", "name": "Management", "color": "#E74C3C", "hoist": true },
    { "type": "create_category", "name": "STAFF OPERATIONS" },
    { "type": "create_text_channel", "name": "staff-chat", "category": "STAFF OPERATIONS" },
    { "type": "create_text_channel", "name": "staff-evidence", "category": "STAFF OPERATIONS" },
    { "type": "create_voice_channel", "name": "Staff Voice", "category": "STAFF OPERATIONS" }
  ]
}
```

Review the preview. Only after approval, send the same JSON to `POST /api/apply` with an additional field:

`"confirm": "APPLY_SERVER_PLAN"`

## 4. Connect a ChatGPT custom GPT Action

This API is designed for a custom GPT Action; deploying the bot does not automatically connect every ordinary ChatGPT conversation.

1. In ChatGPT, create a custom GPT (if GPT creation and Actions are available on your account).
2. Open its **Configure -> Actions** area and add an action.
3. Import the contents of `openapi.yaml`.
4. Replace `https://YOUR-RENDER-SERVICE.onrender.com` in the OpenAPI server URL with your real Render service URL.
5. Set Authentication to **API Key**, choose **Bearer**, and enter the same `MANAGER_API_KEY` value you set in Render.
6. Save and test `getServerStatus`.
7. Ask the GPT to prepare a server layout. It should call `previewServerChanges`, show you the proposed changes, and only call `applyApprovedServerChanges` after you explicitly approve.

Keep the Action private. Anyone who can use an exposed API key could control the configured server within the API's supported operations. Rotate the key if it is ever exposed.

## Environment variables

See `.env.example`. Local development: copy it to `.env`, fill in values, run `npm install`, then `npm start`.

## Important limitations

- The bot cannot create a new Discord server; the server owner must create one and invite the bot.
- The API is scoped to one `GUILD_ID`.
- The first release only creates roles and channels. It never deletes anything.
- It does not grant Administrator or dangerous moderation permissions to generated roles.
- Render free services may sleep when idle; the first request after sleeping can take time.
- ChatGPT Actions availability depends on the ChatGPT product/account configuration.
