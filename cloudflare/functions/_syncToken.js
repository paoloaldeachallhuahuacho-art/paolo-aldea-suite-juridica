/**
 * Token de sync firmado (HMAC) emitido tras login cloud.
 * No es JWT de Supabase Auth; solo autoriza pull/push de app_records.
 */
const crypto = require("crypto");

function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromB64url(str) {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  const s = str.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(s, "base64");
}

function signingSecret() {
  const raw =
    process.env.SYNC_TOKEN_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";
  if (!raw) {
    throw Object.assign(new Error("SYNC_TOKEN_SECRET / SERVICE_ROLE no configurado"), { status: 401 });
  }
  return crypto.createHash("sha256").update(String(raw)).digest();
}

function issueSyncToken(claims, ttlSec = 60 * 60 * 12) {
  const payload = {
    uid: claims.uid || claims.id,
    role: claims.role || claims.rol || "asistente_admin",
    sede: claims.sede || claims.branch_id || "challhuahuacho",
    usuario: claims.usuario || "",
    exp: Math.floor(Date.now() / 1000) + ttlSec
  };
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac("sha256", signingSecret()).update(body).digest());
  return body + "." + sig;
}

function verifySyncToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    const err = new Error("Token de sync inválido.");
    err.status = 401;
    throw err;
  }
  const [body, sig] = token.split(".");
  const expected = b64url(crypto.createHmac("sha256", signingSecret()).update(body).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    const err = new Error("Token de sync no válido.");
    err.status = 401;
    throw err;
  }
  let payload;
  try {
    payload = JSON.parse(fromB64url(body).toString("utf8"));
  } catch (_) {
    const err = new Error("Token de sync corrupto.");
    err.status = 401;
    throw err;
  }
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    const err = new Error("Token de sync expirado. Vuelva a iniciar sesión.");
    err.status = 401;
    throw err;
  }
  return payload;
}

const SYNC_COLLECTIONS = [
  "casos",
  "citas",
  "caja_chica",
  "presupuestos",
  "inventario",
  "documentos",
  "attendance",
  "workers"
];

const SENSITIVE_RECORD_KEYS = [
  "password",
  "pin",
  "passwordHash",
  "pinHash",
  "password_hash",
  "pin_hash"
];

const STAFF_WRITE_ROLES = new Set(["super_admin", "socio", "admin"]);

function stripSensitiveRecord(rec) {
  if (!rec || typeof rec !== "object") return rec;
  const copy = { ...rec };
  for (const key of SENSITIVE_RECORD_KEYS) delete copy[key];
  return copy;
}

/** El padrón no viaja por el bus genérico salvo admin/socio/super_admin. */
function canWriteStaffCollection(claims) {
  return STAFF_WRITE_ROLES.has(String((claims && claims.role) || ""));
}

function normalizeBranch(sede, role) {
  if (role === "super_admin" || role === "socio" || sede === "todas") return null; // null = todas
  return sede && sede !== "todas" ? sede : "challhuahuacho";
}

module.exports = {
  issueSyncToken,
  verifySyncToken,
  SYNC_COLLECTIONS,
  normalizeBranch,
  stripSensitiveRecord,
  canWriteStaffCollection,
  SENSITIVE_RECORD_KEYS,
  STAFF_WRITE_ROLES
};
