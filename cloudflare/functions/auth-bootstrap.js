/**
 * POST — Registra el primer Super Admin en la nube (una sola vez).
 * Body: { id, usuario, email, dni, nombre, cargo, rol, sede, passwordHash, pinHash?, permisos? }
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
    if (!body) {
      const err = new Error("JSON inválido.");
      err.status = 400;
      throw err;
    }

    let already = false;
    try {
      const rows = await supabaseRest("firm_settings?key=eq.auth_bootstrapped&select=value");
      if (Array.isArray(rows) && rows[0] && rows[0].value && rows[0].value.bootstrapped === true) {
        already = true;
      }
    } catch (_) {}
    if (!already) {
      try {
        const staff = await supabaseRest("staff_directory?select=id&limit=1");
        already = Array.isArray(staff) && staff.length > 0;
      } catch (_) {}
    }
    if (already) {
      const err = new Error("El despacho ya tiene administrador en la nube. Use el formulario de acceso.");
      err.status = 409;
      throw err;
    }

    const usuario = String(body.usuario || "").trim().toLowerCase();
    const passwordHash = String(body.passwordHash || "").trim();
    const nombre = String(body.nombre || body.full_name || "").trim();
    const id = String(body.id || "WRK-000").trim() || "WRK-000";

    if (!usuario || usuario.length < 3) {
      const err = new Error("Usuario inválido.");
      err.status = 400;
      throw err;
    }
    if (!nombre || nombre.length < 3) {
      const err = new Error("Nombre inválido.");
      err.status = 400;
      throw err;
    }
    if (!isValidPasswordHash(passwordHash)) {
      const err = new Error("Hash de contraseña inválido.");
      err.status = 400;
      throw err;
    }

    const branchId = body.sede && body.sede !== "todas" ? String(body.sede) : "challhuahuacho";
    const row = {
      id,
      usuario,
      email: body.email ? String(body.email).trim().toLowerCase() : null,
      dni: body.dni ? String(body.dni).trim() : null,
      full_name: nombre,
      cargo: body.cargo || "Super Administrador",
      role: body.rol || body.role || "super_admin",
      branch_id: branchId,
      password_hash: passwordHash,
      pin_hash: body.pinHash || null,
      activo: true,
      permisos: body.permisos || null,
      updated_at: new Date().toISOString()
    };

    await supabaseRest("staff_directory", {
      method: "POST",
      body: row,
      prefer: "resolution=merge-duplicates,return=minimal"
    });

    await supabaseRest("firm_settings?key=eq.auth_bootstrapped", {
      method: "PATCH",
      body: {
        value: {
          bootstrapped: true,
          admin_user: usuario,
          admin_id: id,
          at: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      },
      prefer: "return=minimal"
    });

    // Si no existía la fila de firm_settings, insertar
    try {
      await supabaseRest("firm_settings", {
        method: "POST",
        body: {
          key: "auth_bootstrapped",
          value: {
            bootstrapped: true,
            admin_user: usuario,
            admin_id: id,
            at: new Date().toISOString()
          }
        },
        prefer: "resolution=merge-duplicates,return=minimal"
      });
    } catch (_) {}

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, bootstrapped: true, id, usuario })
    };
  } catch (err) {
    return jsonError(headers, err, 500);
  }
};
