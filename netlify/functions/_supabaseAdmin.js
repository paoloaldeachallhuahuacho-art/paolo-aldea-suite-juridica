/**
 * Helpers Netlify → Supabase.
 * Mutaciones: siempre con JWT de usuario (anon key + Bearer user).
 * Service role: solo utilidades internas explícitas — NUNCA como fallback abierto.
 */
function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function extractBearer(event) {
  const h = (event && event.headers) || {};
  const auth = h.authorization || h.Authorization || "";
  const m = String(auth).match(/^Bearer\s+(\S+)/i);
  return m ? m[1].trim() : "";
}

/**
 * Valida el access token de Supabase Auth.
 * @returns {Promise<object|null>} user de /auth/v1/user
 */
async function verifySupabaseJwt(jwt) {
  if (!jwt || typeof jwt !== "string") return null;
  const base = requireEnv("SUPABASE_URL").replace(/\/$/, "");
  const anon = requireEnv("SUPABASE_ANON_KEY");
  const res = await fetch(base + "/auth/v1/user", {
    method: "GET",
    headers: {
      apikey: anon,
      Authorization: "Bearer " + jwt
    }
  });
  if (!res.ok) return null;
  let user = null;
  try {
    user = await res.json();
  } catch (_) {
    return null;
  }
  if (!user || !user.id) return null;
  return user;
}

/**
 * Exige Authorization: Bearer <supabase access token>.
 * @throws {{ status: number, message: string }}
 */
async function requireUser(event) {
  const jwt = extractBearer(event);
  if (!jwt) {
    const err = new Error("Authorization Bearer JWT requerido.");
    err.status = 401;
    throw err;
  }
  const user = await verifySupabaseJwt(jwt);
  if (!user) {
    const err = new Error("JWT inválido o expirado.");
    err.status = 401;
    throw err;
  }
  return { user, jwt };
}

/**
 * RPC PostgREST con identidad del usuario (auth.uid() / RLS / claims JWT).
 * NO usa service_role.
 */
async function supabaseRpcAsUser(fnName, args, userJwt) {
  if (!userJwt) {
    const err = new Error("JWT requerido para RPC.");
    err.status = 401;
    throw err;
  }
  const url = requireEnv("SUPABASE_URL").replace(/\/$/, "") + "/rest/v1/rpc/" + fnName;
  const anon = requireEnv("SUPABASE_ANON_KEY");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: anon,
      Authorization: "Bearer " + userJwt,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(args || {})
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = text;
  }
  if (!res.ok) {
    const msg =
      (data && (data.message || data.error || data.hint)) ||
      ("RPC " + fnName + " failed: " + res.status);
    const err = new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    err.status = res.status >= 400 && res.status < 600 ? res.status : 502;
    err.body = data;
    throw err;
  }
  return data;
}

/** @deprecated Prefer supabaseRpcAsUser. Service role solo si hay justificación explícita. */
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
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = text;
  }
  if (!res.ok) {
    const err = new Error("Supabase REST " + res.status);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

/** @deprecated Prefer supabaseRpcAsUser — service role no establece auth.uid(). */
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
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = text;
  }
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
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || "";
  const headers = {
    "Content-Type": "application/json",
    Vary: "Origin"
  };
  // Nunca reflejar orígenes arbitrarios; sin ALLOWED_ORIGIN no se emite ACAO abierto.
  if (allowed && origin === allowed) {
    headers["Access-Control-Allow-Origin"] = allowed;
  }
  return headers;
}

/**
 * Si ALLOWED_ORIGIN está definido, Origin debe coincidir (protección CSRF básica).
 */
function assertAllowedOrigin(event) {
  const allowed = process.env.ALLOWED_ORIGIN || "";
  if (!allowed) {
    const err = new Error("ALLOWED_ORIGIN no configurado en el servidor.");
    err.status = 503;
    throw err;
  }
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || "";
  if (origin !== allowed) {
    const err = new Error("Origen no autorizado.");
    err.status = 401;
    throw err;
  }
}

function clientMeta(event) {
  const h = event.headers || {};
  return {
    ip: h["x-nf-client-connection-ip"] || h["x-forwarded-for"] || h["client-ip"] || "",
    ua: h["user-agent"] || h["User-Agent"] || ""
  };
}

function jsonError(headers, err, fallbackStatus) {
  const status = err && err.status ? err.status : fallbackStatus || 500;
  return {
    statusCode: status,
    headers,
    body: JSON.stringify({
      ok: false,
      error: (err && err.message) || "Error interno"
    })
  };
}

module.exports = {
  requireEnv,
  extractBearer,
  verifySupabaseJwt,
  requireUser,
  supabaseRpcAsUser,
  supabaseRest,
  supabaseRpc,
  haversineMeters,
  corsHeaders,
  assertAllowedOrigin,
  clientMeta,
  jsonError
};
