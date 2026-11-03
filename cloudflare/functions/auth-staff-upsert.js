/**
 * POST — Upsert colaborador en staff_directory (tras crear/editar Personal).
 * Requiere Origin + syncToken (admin/socio/super_admin). Origin solo NO basta.
 */
const {
  corsHeaders,
  assertAllowedOrigin,
  supabaseRest,
  jsonError,
  isValidPasswordHash
} = require("./_supabaseAdmin");
const { verifySyncToken, normalizeBranch } = require("./_syncToken");

const STAFF_ADMIN_ROLES = new Set(["super_admin", "socio", "admin"]);
const PRIVILEGED_ROLES = new Set(["super_admin", "socio"]);

function parseBody(event) {
  try {
    return JSON.parse(event.body || "{}");
  } catch (_) {
    return null;
  }
}

function requireStaffAdmin(body) {
  const token = (body && (body.syncToken || body.token)) || "";
  const claims = verifySyncToken(token);
  if (!STAFF_ADMIN_ROLES.has(String(claims.role || ""))) {
    const err = new Error("Se requiere rol admin/socio/super_admin para gestionar personal.");
    err.status = 403;
    throw err;
  }
  return claims;
}

exports.handler = async (event) => {
  const headers = { ...corsHeaders(event), "Cache-Control": "no-store" };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        ...headers,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
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

    const claims = requireStaffAdmin(body);
    const actorIsGlobal = PRIVILEGED_ROLES.has(claims.role) || claims.sede === "todas";
    const actorBranch = normalizeBranch(claims.sede, claims.role);

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

    const requestedRole = String(body.rol || body.role || "asistente_admin");
    if (PRIVILEGED_ROLES.has(requestedRole) && !actorIsGlobal) {
      const err = new Error("Sin permiso para asignar rol privilegiado.");
      err.status = 403;
      throw err;
    }

    let branchId =
      body.sede && body.sede !== "todas" ? String(body.sede) : "challhuahuacho";
    if (requestedRole === "super_admin" && body.sede === "todas") {
      branchId = "challhuahuacho";
    }
    if (!actorIsGlobal && actorBranch && branchId !== actorBranch) {
      const err = new Error("Sin permiso para gestionar personal de otra sede.");
      err.status = 403;
      throw err;
    }

    // Evitar que un admin de sede escale un registro existente a super_admin/socio
    try {
      const existing = await supabaseRest(
        "staff_directory?id=eq." + encodeURIComponent(String(body.id)) + "&select=role,branch_id&limit=1"
      );
      const prev = Array.isArray(existing) && existing[0] ? existing[0] : null;
      if (prev) {
        if (PRIVILEGED_ROLES.has(prev.role) && !actorIsGlobal) {
          const err = new Error("Sin permiso para modificar un usuario privilegiado.");
          err.status = 403;
          throw err;
        }
        if (!actorIsGlobal && actorBranch && prev.branch_id && prev.branch_id !== actorBranch) {
          const err = new Error("Sin permiso para modificar personal de otra sede.");
          err.status = 403;
          throw err;
        }
      }
    } catch (e) {
      if (e && e.status) throw e;
    }

    const row = {
      id: String(body.id),
      usuario: String(body.usuario).trim().toLowerCase(),
      email: body.email ? String(body.email).trim().toLowerCase() : null,
      dni: body.dni ? String(body.dni).trim() : null,
      full_name: String(body.nombre || body.full_name || body.usuario),
      cargo: body.cargo || "",
      role: requestedRole,
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
        const existing = await supabaseRest(
          "staff_directory?id=eq." + encodeURIComponent(row.id) + "&select=password_hash,pin_hash"
        );
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
