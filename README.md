# Server Architect

A mobile-friendly Discord server structure dashboard with an AI command planner and a protected Discord bot API.

## What it does

- Sign in to a private mobile-friendly dashboard.
- Describe the Discord layout you want in ordinary language.
- Ask the AI planner to turn that instruction into a structured plan.
- Preview every proposed role, category and channel before changing Discord.
- Type **APPLY** to confirm the exact preview.
- Creates roles, categories, text channels and voice channels.
- Skips names that already exist; does not delete or edit existing server objects.
- Restricts generated role permissions to a small safe allowlist. Administrator and moderation permissions are not allowed.

This remains a conservative first release. It does not yet configure detailed per-channel permission overwrites, moderation, tickets, automod, role assignment or message content.

## 1. Discord application

1. Create an application at https://discord.com/developers/applications.
2. Open **Bot** and create/reset the bot token. Keep it secret.
3. Copy the **Application ID** from General Information.
4. This version only needs the Guilds intent.
5. Invite the bot using scopes `bot` and `applications.commands`.
6. Grant only **Manage Roles**, **Manage Channels**, and **View Channels**. Do not grant Administrator.
7. Invite it to your existing server. Keep the bot role high enough in the role list for the roles it needs to create.

## 2. Deploy to Render

1. Open https://dashboard.render.com/ and choose **New -> Blueprint**.
2. Connect GitHub and select this repository. Render reads `render.yaml`.
3. Set the following environment variables in the Render service:
   - `DISCORD_TOKEN`: bot token from Discord Developer Portal
   - `CLIENT_ID`: Discord Application ID
   - `GUILD_ID`: target server ID
   - `MANAGER_API_KEY`: a long random secret (at least 32 characters)
   - `DASHBOARD_PASSWORD`: a separate strong password you will use to sign in to the dashboard
   - `AI_API_KEY`: API key from your chosen AI provider
   - `AI_BASE_URL`: API base URL (default is Gemini OpenAI-compatible `https://generativelanguage.googleapis.com/v1beta/openai`)
   - `AI_MODEL`: model name supported by that provider (default `gemini-3.6-flash`)
   - `DASHBOARD_SESSION_SECRET`: optional separate random secret for signing browser sessions
4. Deploy and wait for the service to become Live.
5. Open `https://YOUR-SERVICE.onrender.com/health`. It should return `ok: true` and `discordReady: true`.
6. Open the root service URL on your phone and sign in with `DASHBOARD_PASSWORD`.

The AI settings use an Gemini OpenAI-compatible Chat Completions endpoint. You may configure another compatible provider by changing `AI_BASE_URL`, `AI_MODEL` and `AI_API_KEY`. Provider compatibility varies; test the planner after deployment.

## 3. Use the dashboard

1. Open your Render service URL.
2. Sign in with your dashboard password.
3. Enter an instruction such as: "Create a professional staff section with Management, Trial Staff and Staff roles, a staff information category, staff chat, evidence and a staff voice channel."
4. Tap **Generate preview**.
5. Review the proposed changes carefully.
6. Type `APPLY` and tap **Apply approved changes**.

The browser session is HTTP-only, same-site and signed by the server. The Discord bot token, AI API key and manager API key are never placed in browser code. The API also continues to accept Bearer authentication for trusted integrations.

## Security

- Never put real secrets in GitHub, screenshots, public pages or ChatGPT messages.
- Do not grant the bot Administrator.
- Keep the dashboard password private and different from the API key.
- If a token or key is exposed, rotate it in its provider and update Render.
- The dashboard session expires after 12 hours.
- Applying changes requires a fresh preview and typing APPLY.
- The current release only creates supported objects; it does not delete or edit existing server objects.

## Environment variables

See `.env.example`. For local development, copy it to `.env`, fill in values, run `npm install`, then `npm start`.
