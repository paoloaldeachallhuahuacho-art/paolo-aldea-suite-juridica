/**
 * Auth dual para edge: syncToken (login despacho) o JWT Supabase Auth.
 */
const { extractBearer, verifySupabaseJwt } = require("./_supabaseAdmin");
const { verifySyncToken, normalizeBranch } = require("./_syncToken");

function parseBody(event) {
  try {
    return JSON.parse(event.body || "{}");
  } catch (_) {
    return null;
  }
}

/**
 * @returns {Promise<{ mode: "jwt"|"sync", jwt?: string, user?: object, claims: object, body: object }>}
 */
async function requireEdgeAuth(event, { allowBodyToken = true } = {}) {
  const body = parseBody(event) || {};
  const bearer = extractBearer(event);

  if (bearer) {
    // Preferir syncToken si el Bearer no es JWT de Supabase (nuestro token tiene un solo ".")
    const parts = bearer.split(".");
    if (parts.length === 2) {
      const claims = verifySyncToken(bearer);
      return {
        mode: "sync",
        claims: {
          uid: claims.uid,
          role: claims.role,
          sede: claims.sede,
          usuario: claims.usuario,
          branchFilter: normalizeBranch(claims.sede, claims.role)
        },
        body
      };
    }
    const user = await verifySupabaseJwt(bearer);
    if (user) {
      const meta = user.app_metadata || {};
      const role = meta.role || "abogado";
      const sede = meta.branch_id || "challhuahuacho";
      return {
        mode: "jwt",
        jwt: bearer,
        user,
        claims: {
          uid: user.id,
          role,
          sede,
          usuario: user.email || "",
          branchFilter: normalizeBranch(sede, role)
        },
        body
      };
    }
  }

  if (allowBodyToken && (body.syncToken || body.token)) {
    const claims = verifySyncToken(body.syncToken || body.token);
    return {
      mode: "sync",
      claims: {
        uid: claims.uid,
        role: claims.role,
        sede: claims.sede,
        usuario: claims.usuario,
        branchFilter: normalizeBranch(claims.sede, claims.role)
      },
      body
    };
  }

  const err = new Error("Authorization Bearer (syncToken o JWT) requerido.");
  err.status = 401;
  throw err;
}

function assertBranchAccess(claims, branchId) {
  const role = claims.role;
  if (role === "super_admin" || role === "socio" || claims.sede === "todas") return;
  const allowed = claims.branchFilter || claims.sede;
  if (allowed && branchId && String(branchId) !== String(allowed)) {
    const err = new Error("Sin permiso para la sede " + branchId + ".");
    err.status = 403;
    throw err;
  }
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (Number(d) * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Fallback si la tabla branches aún no está sembrada. */
const BRANCH_GEO = {
  miraflores: { latitud: -12.122628, longitud: -77.011426, radio: 150 },
  abancay: { latitud: -13.635646, longitud: -72.877614, radio: 150 },
  cusco: { latitud: -13.522785, longitud: -71.969963, radio: 150 },
  huaraz: { latitud: -9.5305, longitud: -77.5242, radio: 150 },
  // Alineado a SEDES_CONFIG cliente; radio 300 por GPS de altura / pin aproximado.
  challhuahuacho: { latitud: -14.116667, longitud: -72.245, radio: 300 }
};

module.exports = {
  parseBody,
  requireEdgeAuth,
  assertBranchAccess,
  haversineMeters,
  BRANCH_GEO
};
