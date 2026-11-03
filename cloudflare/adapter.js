/**
 * Adaptador Cloudflare Pages → funciones edge en cloudflare/functions.
 * Rutas canónicas: /api/<nombre>
 * Alias legacy: /.netlify/functions/<nombre> (compatibilidad)
 */
const handlers = {
  "public-config": require("./functions/public-config.js"),
  "auth-firm-status": require("./functions/auth-firm-status.js"),
  "auth-login": require("./functions/auth-login.js"),
  "auth-bootstrap": require("./functions/auth-bootstrap.js"),
  "auth-staff-upsert": require("./functions/auth-staff-upsert.js"),
  "sync-pull": require("./functions/sync-pull.js"),
  "sync-push": require("./functions/sync-push.js"),
  "attendance-validate": require("./functions/attendance-validate.js"),
  "petty-cash-transition": require("./functions/petty-cash-transition.js"),
  "telegram-proxy": require("./functions/telegram-proxy.js"),
  "push-subscribe": require("./functions/push-subscribe.js"),
  "push-unsubscribe": require("./functions/push-unsubscribe.js"),
  "push-send": require("./functions/push-send.js")
};

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "Permissions-Policy": "geolocation=(self), notifications=(self), camera=(), microphone=(), payment=(), usb=(), interest-cohort=()",
  "Content-Security-Policy":
    "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self' https://cdn.jsdelivr.net https://www.gstatic.com; script-src-attr 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://api.telegram.org https://fcm.googleapis.com https://fcmregistrations.googleapis.com https://updates.push.services.mozilla.com https://*.push.services.mozilla.com https://web.push.apple.com; worker-src 'self' blob:; manifest-src 'self'"
};

function applyEnv(env) {
  if (!env || typeof process === "undefined" || !process.env) return;
  for (const [key, value] of Object.entries(env)) {
    if (typeof value !== "string") continue;
    try {
      process.env[key] = value;
    } catch (_) {}
  }
}

async function toNetlifyEvent(request) {
  const headers = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  const method = request.method || "GET";
  let body = null;
  if (method !== "GET" && method !== "HEAD") {
    body = await request.text();
  }
  const url = new URL(request.url);
  return {
    httpMethod: method,
    headers,
    body: body && body.length ? body : null,
    rawUrl: request.url,
    path: url.pathname,
    queryStringParameters: Object.fromEntries(url.searchParams.entries())
  };
}

function withSecurity(response, extra) {
  const headers = new Headers(response.headers || {});
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(key)) headers.set(key, value);
  }
  if (extra) {
    for (const [key, value] of Object.entries(extra)) headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function jsonResponse(status, payload) {
  return withSecurity(
    new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
    })
  );
}

function isBlockedPath(pathname) {
  let path = pathname || "/";
  try {
    path = decodeURIComponent(path);
  } catch (_) {}
  if (path.includes("..") || path.includes("\\")) return true;
  const p = path.toLowerCase();
  if (p === "/_worker.js" || p === "/wrangler.toml" || p === "/package.json" || p === "/package-lock.json") return true;
  if (p === "/readme.md" || p === "/firebase.json" || p === "/firestore.rules" || p === "/firestore.indexes.json") return true;
  if (p === "/central_cloud_data.json" || p === "/alertas_locales.json") return true;
  if (p.startsWith("/.env") || p.startsWith("/.server_") || p.startsWith("/.git")) return true;
  if (/^\/[^/]+\.(ps1|bat|vbs|sql|md)$/i.test(p)) return true;
  const prefixes = [
    "/herramientas/",
    "/supabase/",
    "/docs/",
    "/tests/",
    "/node_modules/",
    "/netlify/",
    "/cloudflare/",
    "/_backups/"
  ];
  return prefixes.some((prefix) => p.startsWith(prefix));
}

function cacheFor(pathname) {
  if (pathname.startsWith("/lib/")) return "public, max-age=31536000, immutable";
  if (pathname.startsWith("/assets/")) return "public, max-age=604800, stale-while-revalidate=86400";
  if (
    pathname.startsWith("/js/") ||
    pathname.startsWith("/css/") ||
    pathname.startsWith("/views/") ||
    pathname === "/sw.js" ||
    pathname === "/manifest.json" ||
    pathname === "/version.json" ||
    pathname === "/" ||
    pathname === "/index.html" ||
    pathname.endsWith(".html")
  ) {
    return "public, max-age=0, must-revalidate";
  }
  return null;
}

function matchFunctionName(pathname) {
  const api = pathname.match(/^\/api\/([a-z0-9-]+)\/?$/i);
  if (api) return api[1];
  const legacy = pathname.match(/^\/\.netlify\/functions\/([a-z0-9-]+)\/?$/i);
  if (legacy) return legacy[1];
  return null;
}

async function dispatchFunction(name, request) {
  const mod = handlers[name];
  if (!mod || typeof mod.handler !== "function") {
    return jsonResponse(404, { ok: false, error: "Not found" });
  }
  try {
    const event = await toNetlifyEvent(request);
    const result = await mod.handler(event);
    const headers = new Headers();
    const raw = (result && result.headers) || {};
    for (const [key, value] of Object.entries(raw)) {
      if (value != null) headers.set(key, String(value));
    }
    if (!headers.has("content-type")) headers.set("content-type", "application/json; charset=utf-8");
    const body = result && result.body != null && result.body !== "" ? result.body : null;
    return withSecurity(new Response(body, { status: (result && result.statusCode) || 200, headers }));
  } catch (err) {
    return jsonResponse(500, { ok: false, error: (err && err.message) || "Error interno" });
  }
}

async function handleRequest(request, env) {
  applyEnv(env);
  const url = new URL(request.url);
  const fnName = matchFunctionName(url.pathname);
  if (fnName) {
    return dispatchFunction(fnName, request);
  }

  if (isBlockedPath(url.pathname)) {
    return withSecurity(new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } }));
  }

  if (!env || !env.ASSETS || typeof env.ASSETS.fetch !== "function") {
    return jsonResponse(404, { ok: false, error: "Asset no disponible" });
  }

  const asset = await env.ASSETS.fetch(request);
  const cache = cacheFor(url.pathname);
  return withSecurity(asset, cache ? { "Cache-Control": cache } : null);
}

module.exports = {
  handlers,
  toNetlifyEvent,
  isBlockedPath,
  matchFunctionName,
  handleRequest
};
