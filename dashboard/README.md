# Server Architect Dashboard (Vercel)

This folder contains the standalone mobile-friendly dashboard. The Discord bot and API stay on Render.

## Deploy on Vercel from Android

1. Open Vercel and choose **Add New → Project**.
2. Import `aaravgyt782013-netizen/server-architech` from GitHub.
3. In the project setup, set **Root Directory** to `dashboard`.
4. Framework preset: **Other**. No build command is required; leave the output directory unset.
5. Add this environment variable before deploying:

   - `RENDER_API_URL` = the base URL of your Render service, for example `https://your-service.onrender.com` (no trailing slash).

6. Deploy. When the Vercel URL is ready, open it and sign in with the dashboard password configured on Render.

## Secret handling

- Set `AI_API_KEY` on **Render only**. Use the Gemini key from Google AI Studio.
- Keep `DISCORD_TOKEN`, `MANAGER_API_KEY`, `DASHBOARD_PASSWORD`, and `DASHBOARD_SESSION_SECRET` on Render.
- Do **not** add a Gemini key as `VITE_*`, `NEXT_PUBLIC_*`, or any variable used by browser JavaScript.
- The Vercel function in `api/[...path].js` proxies same-origin dashboard API requests to Render and forwards the secure login cookie. It does not contain API keys.

## Render environment

Keep these on Render:
- `AI_API_KEY` = your private Gemini API key
- `AI_BASE_URL` = `https://generativelanguage.googleapis.com/v1beta/openai`
- `AI_MODEL` = `gemini-3.6-flash`
- `DASHBOARD_PASSWORD` = a strong password you choose
- `DASHBOARD_SESSION_SECRET` = a separate long random secret (recommended)
