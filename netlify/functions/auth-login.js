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
  verifyPbkdf2Secret
} = require("./_supabaseAdmin");
const { issueSyncToken } = require("./_syncToken");

function parseBody(event) {
  try {
    return JSON.parse(event.body || "{}");
  } catch (_) {
    return null;
  }
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
    const body = parseBody(event);
    if (!body) {
      const err = new Error("JSON inválido.");
      err.status = 400;
      throw err;
    }

    const usuario = String(body.usuario || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!usuario || !password) {
      const err = new Error("Usuario y contraseña requeridos.");
      err.status = 400;
      throw err;
    }

    // Buscar por usuario / email / dni (hasta 3 consultas simples; service role)
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

    const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
    if (!row || !verifyPbkdf2Secret(password, row.password_hash)) {
      // Intento con pin_hash
      if (!row || !row.pin_hash || !verifyPbkdf2Secret(password, row.pin_hash)) {
        const err = new Error("Credenciales incorrectas.");
        err.status = 401;
        throw err;
      }
    }

    const worker = toWorker(row);

    // Hidratar también el resto del directorio (sin filtrar hashes: necesario para offline local).
    let directory = [];
    try {
      const all = await supabaseRest("staff_directory?select=*&activo=eq.true");
      directory = Array.isArray(all) ? all.map(toWorker) : [worker];
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
    return jsonError(headers, err, 500);
  }
};
