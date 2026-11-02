/**
 * POST — Upsert colaborador en staff_directory (tras crear/editar Personal).
 * Requiere Origin permitido. Protegido por secreto de sesión local opcional:
 * body.passwordHash obligatorio para el registro.
 */
const {
  corsHeaders,
  assertAllowedOrigin,
  supabaseRest,
  jsonError,
  isValidPasswordHash
} = require("./_supabaseAdmin");

function parseBody(event) {
  try {
    return JSON.parse(event.body || "{}");
  } catch (_) {
    return null;
  }
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
    if (!body || !body.id || !body.usuario) {
      const err = new Error("Datos de colaborador incompletos.");
      err.status = 400;
      throw err;
    }

    // Solo permitir upsert si el despacho ya está bootstrapped
    let bootstrapped = false;
    try {
      const rows = await supabaseRest("firm_settings?key=eq.auth_bootstrapped&select=value");
      bootstrapped = !!(rows && rows[0] && rows[0].value && rows[0].value.bootstrapped);
    } catch (_) {}
    if (!bootstrapped) {
      const err = new Error("Despacho no inicializado en la nube.");
      err.status = 409;
      throw err;
    }

    const passwordHash = String(body.passwordHash || "").trim();
    if (passwordHash && !isValidPasswordHash(passwordHash)) {
      const err = new Error("Hash de contraseña inválido.");
      err.status = 400;
      throw err;
    }

    const branchId = body.sede && body.sede !== "todas" ? String(body.sede) : "challhuahuacho";
    const row = {
      id: String(body.id),
      usuario: String(body.usuario).trim().toLowerCase(),
      email: body.email ? String(body.email).trim().toLowerCase() : null,
      dni: body.dni ? String(body.dni).trim() : null,
      full_name: String(body.nombre || body.full_name || body.usuario),
      cargo: body.cargo || "",
      role: body.rol || body.role || "asistente_admin",
      branch_id: branchId,
      activo: body.activo !== false,
      permisos: body.permisos || null,
      updated_at: new Date().toISOString()
    };
    if (passwordHash) row.password_hash = passwordHash;
    if (body.pinHash) row.pin_hash = body.pinHash;

    // Si no hay hash nuevo, conservar el existente con merge parcial vía GET+POST
    if (!passwordHash) {
      try {
        const existing = await supabaseRest("staff_directory?id=eq." + encodeURIComponent(row.id) + "&select=password_hash,pin_hash");
        if (existing && existing[0]) {
          row.password_hash = existing[0].password_hash;
          if (!row.pin_hash) row.pin_hash = existing[0].pin_hash;
        }
      } catch (_) {}
      if (!row.password_hash) {
        const err = new Error("Se requiere contraseña para nuevos colaboradores en la nube.");
        err.status = 400;
        throw err;
      }
    }

    await supabaseRest("staff_directory", {
      method: "POST",
      body: row,
      prefer: "resolution=merge-duplicates,return=minimal"
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, id: row.id })
    };
  } catch (err) {
    return jsonError(headers, err, 500);
  }
};
