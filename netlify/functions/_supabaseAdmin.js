/**
 * Cliente mínimo REST hacia Supabase con service role (solo functions).
 */
function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

async function supabaseRest(path, { method = "GET", body, prefer } = {}) {
  const url = requireEnv("SUPABASE_URL").replace(/\/$/, "") + "/rest/v1/" + path.replace(/^\//, "");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const headers = {
    apikey: key,
    Authorization: "Bearer " + key,
    "Content-Type": "application/json"
  };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
  if (!res.ok) {
    const err = new Error("Supabase REST " + res.status);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

async function supabaseRpc(fnName, args) {
  const url = requireEnv("SUPABASE_URL").replace(/\/$/, "") + "/rest/v1/rpc/" + fnName;
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(args || {})
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
  if (!res.ok) {
    const err = new Error("RPC " + fnName + " failed: " + res.status);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (Number(d) * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function corsHeaders(event) {
  const allowed = process.env.ALLOWED_ORIGIN || "";
  const origin = event.headers.origin || event.headers.Origin || "";
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": allowed && origin === allowed ? allowed : (allowed || "*"),
    Vary: "Origin"
  };
}

function clientMeta(event) {
  const h = event.headers || {};
  return {
    ip: h["x-nf-client-connection-ip"] || h["x-forwarded-for"] || h["client-ip"] || "",
    ua: h["user-agent"] || h["User-Agent"] || ""
  };
}

module.exports = {
  supabaseRest,
  supabaseRpc,
  haversineMeters,
  corsHeaders,
  clientMeta,
  requireEnv
};
