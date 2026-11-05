export const config = { api: { bodyParser: { sizeLimit: "5mb" } } };

const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);

export default async function handler(req, res) {
  const base = process.env.RENDER_API_URL;
  if (!base) {
    return res.status(503).json({ error: "Dashboard backend is not configured. Set RENDER_API_URL in Vercel." });
  }

  if (!ALLOWED_METHODS.has(req.method || "GET")) {
    res.setHeader("Allow", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const incomingOrigin = req.headers.origin;
  const host = req.headers.host;
  if (incomingOrigin && host) {
    try {
      const originUrl = new URL(incomingOrigin);
      if (originUrl.host !== host) {
        return res.status(403).json({ error: "Cross-origin request blocked." });
      }
    } catch {
      return res.status(403).json({ error: "Invalid request origin." });
    }
  }

  let target;
  try {
    const backend = new URL(base);
    if (backend.protocol !== "https:" && backend.hostname !== "localhost" && backend.hostname !== "127.0.0.1") {
      return res.status(500).json({ error: "RENDER_API_URL must use HTTPS." });
    }
    const incomingUrl = new URL(req.url, "https://dashboard.invalid");
    target = new URL(incomingUrl.pathname + incomingUrl.search, backend);
    if (target.origin !== backend.origin) {
      return res.status(400).json({ error: "Invalid API path." });
    }
  } catch {
    return res.status(500).json({ error: "RENDER_API_URL is invalid." });
  }

  const headers = {
    accept: req.headers.accept || "application/json",
    origin: new URL(base).origin
  };
  if (req.headers["content-type"]) headers["content-type"] = req.headers["content-type"];
  if (req.headers.cookie) headers.cookie = req.headers.cookie;
  if (req.headers.authorization) headers.authorization = req.headers.authorization;

  let body;
  if (!["GET", "HEAD"].includes(req.method || "GET")) {
    if (req.body !== undefined) {
      body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    } else {
      body = "";
    }
  }

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(30000)
    });

    res.status(upstream.status);
    const contentType = upstream.headers.get("content-type");
    if (contentType) res.setHeader("Content-Type", contentType);
    const cacheControl = upstream.headers.get("cache-control");
    if (cacheControl) res.setHeader("Cache-Control", cacheControl);
    const setCookies = typeof upstream.headers.getSetCookie === "function"
      ? upstream.headers.getSetCookie()
      : (upstream.headers.get("set-cookie") ? [upstream.headers.get("set-cookie")] : []);
    if (setCookies.length) res.setHeader("Set-Cookie", setCookies);
    const responseBody = Buffer.from(await upstream.arrayBuffer());
    return res.send(responseBody);
  } catch (error) {
    console.error("Render API proxy failed:", error.message);
    return res.status(502).json({ error: "Could not connect to the Server Architect backend on Render." });
  }
}
