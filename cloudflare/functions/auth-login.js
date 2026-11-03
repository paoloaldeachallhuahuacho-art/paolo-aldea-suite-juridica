/**
 * POST — Login multi-dispositivo contra staff_directory (PBKDF2).
 * Body: { usuario, password }
 * Devuelve el colaborador (con hash) para hidratar IndexedDB local.
 */
const {
  corsHeaders,
  assertAllowedOrigin,
  supabaseRest,
  jsonError,
  verifyPbkdf2Secret,
  isValidPasswordHash,
  clientMeta
} = require("./_supabaseAdmin");
const { issueSyncToken } = require("./_syncToken");
const crypto = require("crypto");

/** Ventana deslizante por IP (challenge + login + reset). */
const RL_WINDOW_SEC = 60;
const RL_MAX_PER_WINDOW = 12;
/** Fallos de login por usuario → bloqueo temporal. */
const RL_FAIL_MAX = 8;
const RL_FAIL_LOCK_SEC = 15 * 60;

function parseBody(event) {
  try {
    return JSON.parse(event.body || "{}");
  } catch (_) {
    return null;
  }
}

function rlKeyIp(ip) {
  const dig = crypto.createHash("sha256").update(String(ip || "unknown")).digest("hex").slice(0, 20);
  return "auth_rl_ip_" + dig;
}

function rlKeyUser(usuario) {
  const dig = crypto.createHash("sha256").update(String(usuario || "")).digest("hex").slice(0, 20);
  return "auth_rl_user_" + dig;
}

async function readRl(key) {
  try {
    const rows = await supabaseRest("firm_settings?key=eq." + encodeURIComponent(key) + "&select=value&limit=1");
    return rows && rows[0] && rows[0].value && typeof rows[0].value === "object" ? rows[0].value : null;
  } catch (_) {
    return null;
  }
}

async function writeRl(key, value) {
  await supabaseRest("firm_settings", {
    method: "POST",
    body: { key, value, updated_at: new Date().toISOString() },
    prefer: "resolution=merge-duplicates,return=minimal"
  });
}

async function assertIpRateLimit(event) {
  const ip = clientMeta(event).ip || "unknown";
  const key = rlKeyIp(ip);
  const now = Math.floor(Date.now() / 1000);
  const cur = (await readRl(key)) || { count: 0, resetAt: now + RL_WINDOW_SEC };
  let count = Number(cur.count) || 0;
  let resetAt = Number(cur.resetAt) || now + RL_WINDOW_SEC;
  if (now >= resetAt) {
    count = 0;
    resetAt = now + RL_WINDOW_SEC;
  }
  count += 1;
  try {
    await writeRl(key, { count, resetAt, ip: String(ip).slice(0, 64) });
  } catch (_) {
    // Si firm_settings falla, no tumbar el login (fail-open controlado).
    return;
  }
  if (count > RL_MAX_PER_WINDOW) {
    const err = new Error("Demasiados intentos. Espere un minuto e intente de nuevo.");
    err.status = 429;
    throw err;
  }
}

async function assertUserNotLocked(usuario) {
  if (!usuario) return;
  const key = rlKeyUser(usuario);
  const cur = await readRl(key);
  if (!cur) return;
  const now = Math.floor(Date.now() / 1000);
  if (cur.lockedUntil && Number(cur.lockedUntil) > now) {
    const wait = Math.max(1, Number(cur.lockedUntil) - now);
    const err = new Error("Usuario bloqueado temporalmente. Reintente en " + wait + "s.");
    err.status = 429;
    throw err;
  }
}

async function recordLoginFailure(usuario) {
  if (!usuario) return;
  const key = rlKeyUser(usuario);
  const now = Math.floor(Date.now() / 1000);
  const cur = (await readRl(key)) || { fails: 0 };
  let fails = (Number(cur.fails) || 0) + 1;
  let lockedUntil = cur.lockedUntil || 0;
  if (fails >= RL_FAIL_MAX) {
    lockedUntil = now + RL_FAIL_LOCK_SEC;
    fails = 0;
  }
  try {
    await writeRl(key, { fails, lockedUntil, updatedAt: now });
  } catch (_) {}
}

async function clearLoginFailures(usuario) {
  if (!usuario) return;
  try {
    await writeRl(rlKeyUser(usuario), { fails: 0, lockedUntil: 0, updatedAt: Math.floor(Date.now() / 1000) });
  } catch (_) {}
}

function safeEqualStr(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (!left.length || left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

async function resetSuperAdmin(body) {
  const expected = process.env.ADMIN_RESET_CODE || "";
  const code = String(body.code || "").trim();
  if (!expected || !safeEqualStr(code, expected)) {
    const err = new Error("Código de restablecimiento inválido.");
    err.status = 401;
    throw err;
  }
  const passwordHash = String(body.passwordHash || "").trim();
  if (!isValidPasswordHash(passwordHash)) {
    const err = new Error("La contraseña nueva no cumple el formato de seguridad.");
    err.status = 400;
    throw err;
  }
  let used = false;
  try {
    const flags = await supabaseRest("firm_settings?key=eq.admin_reset&select=value");
    used = !!(flags && flags[0] && flags[0].value && flags[0].value.used === true);
  } catch (_) {}
  if (used) {
    const err = new Error("Ese código ya fue utilizado. Pida uno nuevo.");
    err.status = 410;
    throw err;
  }
  const rows = await supabaseRest("staff_directory?select=id,usuario&role=eq.super_admin&activo=eq.true&limit=1");
  const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
  if (!row) {
    const err = new Error("No hay Super Administrador en la nube.");
    err.status = 404;
    throw err;
  }
  await supabaseRest("staff_directory?id=eq." + encodeURIComponent(row.id), {
    method: "PATCH",
    body: { password_hash: passwordHash, updated_at: new Date().toISOString() },
    prefer: "return=minimal"
  });
  await supabaseRest("firm_settings", {
    method: "POST",
    body: {
      key: "admin_reset",
      value: { used: true, at: new Date().toISOString() },
      updated_at: new Date().toISOString()
    },
    prefer: "resolution=merge-duplicates,return=minimal"
  });
  return { id: row.id, usuario: row.usuario };
}

function proofsMatch(row, proofs) {
  const matchOne = (stored, proof) => {
    if (!stored || !proof || typeof stored !== "string" || typeof proof !== "string") return false;
    if (stored.startsWith("pbkdf2$")) {
      const parts = stored.split("$");
      if (parts.length !== 4) return false;
      const expected = Buffer.from(parts[3], "base64");
      const got = Buffer.from(proof, "base64");
      if (!expected.length || expected.length !== got.length) return false;
      return crypto.timingSafeEqual(expected, got);
    }
    if (/^[a-f0-9]{64}$/i.test(stored) && /^[a-f0-9]{64}$/i.test(proof)) {
      return crypto.timingSafeEqual(Buffer.from(stored, "hex"), Buffer.from(String(proof).toLowerCase(), "hex"));
    }
    return false;
  };
  return matchOne(row.password_hash, proofs.password) || matchOne(row.pin_hash, proofs.pin);
}

function challengeFor(row) {
  const checks = [];
  const add = (field, stored) => {
    if (!stored || typeof stored !== "string") return;
    if (stored.startsWith("pbkdf2$")) {
      const parts = stored.split("$");
      if (parts.length !== 4) return;
      checks.push({ field, scheme: "pbkdf2", iterations: Number(parts[1]), salt: parts[2] });
    } else if (/^[a-f0-9]{64}$/i.test(stored)) {
      checks.push({ field, scheme: "sha256" });
    }
  };
  if (row) {
    add("password", row.password_hash);
    add("pin", row.pin_hash);
  }
  if (!checks.length) {
    checks.push({
      field: "password",
      scheme: "pbkdf2",
      iterations: 210000,
      salt: crypto.randomBytes(16).toString("base64")
    });
  }
  return checks;
}

async function findStaff(supabaseRest, usuario) {
  let rows = await supabaseRest(
    "staff_directory?select=*&activo=eq.true&usuario=eq." + encodeURIComponent(usuario)
  );
  if (!Array.isArray(rows) || !rows.length) {
    rows = await supabaseRest(
      "staff_directory?select=*&activo=eq.true&email=eq." + encodeURIComponent(usuario)
    );
  }
  if ((!Array.isArray(rows) || !rows.length) && /^\d{8}$/.test(usuario)) {
    rows = await supabaseRest(
      "staff_directory?select=*&activo=eq.true&dni=eq." + encodeURIComponent(usuario)
    );
  }
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

function toWorker(row) {
  return {
    id: row.id,
    dni: row.dni || "",
    nombre: row.full_name,
    cargo: row.cargo || "",
    rol: row.role,
    usuario: row.usuario,
    username: row.usuario,
    email: row.email || "",
    sede: row.branch_id === "challhuahuacho" && row.role === "super_admin" ? "todas" : row.branch_id,
    passwordHash: row.password_hash,
    pinHash: row.pin_hash || "",
    activo: row.activo !== false,
    permisos: row.permisos || null,
    updatedAt: row.updated_at
  };
}

exports.handler = async (event) => {
  const headers = { ...corsHeaders(event), "Cache-Control": "no-store" };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        ...headers,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      },
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    assertAllowedOrigin(event);
    await assertIpRateLimit(event);
    const body = parseBody(event);
    if (!body) {
      const err = new Error("JSON inválido.");
      err.status = 400;
      throw err;
    }

    if (body.phase === "reset-admin") {
      const reset = await resetSuperAdmin(body);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, usuario: reset.usuario, id: reset.id })
      };
    }

    const usuario = String(body.usuario || "").trim().toLowerCase();
    const password = String(body.password || "");
    const proofs = body.proofs && typeof body.proofs === "object" ? body.proofs : null;
    if (!usuario || (!password && !proofs && body.phase !== "challenge")) {
      const err = new Error("Usuario y contraseña requeridos.");
      err.status = 400;
      throw err;
    }

    await assertUserNotLocked(usuario);

    const row = await findStaff(supabaseRest, usuario);
    if (body.phase === "challenge") {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, checks: challengeFor(row) })
      };
    }

    let accepted = false;
    if (proofs) {
      accepted = !!(row && proofsMatch(row, proofs));
    } else if (password) {
      // Cloudflare Workers no soporta PBKDF2 >100k iteraciones.
      // El cliente debe usar phase=challenge + proofs (WebCrypto).
      const err = new Error("Use challenge + proofs (no password en claro).");
      err.status = 400;
      throw err;
    }
    if (!accepted) {
      await recordLoginFailure(usuario);
      const err = new Error("Credenciales incorrectas.");
      err.status = 401;
      throw err;
    }
    await clearLoginFailures(usuario);

    const worker = toWorker(row);

    // Hidratar directorio sin hashes de terceros (ni para admin/socio).
    // Solo el propio usuario recibe passwordHash/pinHash para re-auth offline.
    // Cambios de credenciales de terceros: auth-staff-upsert (service_role).
    let directory = [];
    try {
      const all = await supabaseRest("staff_directory?select=*&activo=eq.true");
      directory = Array.isArray(all)
        ? all.map((r) => {
            const w = toWorker(r);
            if (w.id === worker.id) return w;
            return { ...w, passwordHash: "", pinHash: "" };
          })
        : [worker];
    } catch (_) {
      directory = [worker];
    }

    const syncToken = issueSyncToken({
      uid: worker.id,
      id: worker.id,
      role: worker.rol,
      sede: worker.sede,
      usuario: worker.usuario
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, worker, directory, syncToken })
    };
  } catch (err) {
    const res = jsonError(headers, err, 500);
    if (res.statusCode === 429) {
      res.headers = { ...res.headers, "Retry-After": "60" };
    }
    return res;
  }
};
