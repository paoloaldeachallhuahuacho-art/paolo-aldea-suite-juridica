/**
 * Validación server-side de marcaje (geocerca + clock skew).
 * Acepta JWT Supabase Auth O syncToken del login de despacho.
 */
const {
  requireUser,
  supabaseRpcAsUser,
  supabaseRest,
  corsHeaders,
  assertAllowedOrigin,
  clientMeta,
  jsonError,
  haversineMeters
} = require("./_supabaseAdmin");
const { requireEdgeAuth, assertBranchAccess, BRANCH_GEO, parseBody } = require("./_edgeAuth");

async function validateWithSyncToken(event, auth) {
  const body = auth.body || {};
  const {
    id,
    branch_id,
    event_type,
    client_ts,
    lat,
    lon,
    accuracy_m,
    spoof_suspected,
    worker_code
  } = body;

  if (!id || !branch_id || !event_type || !client_ts || lat == null || lon == null) {
    const err = new Error("Campos requeridos faltantes.");
    err.status = 400;
    throw err;
  }

  assertBranchAccess(auth.claims, branch_id);

  const skew = Math.abs(Date.now() - new Date(client_ts).getTime()) / 1000;
  if (Number.isNaN(skew) || skew > 60) {
    const err = new Error("Desviación de reloj > 60s.");
    err.status = 400;
    throw err;
  }
  if (spoof_suspected) {
    const err = new Error("Ubicación simulada rechazada.");
    err.status = 403;
    throw err;
  }

  let branch = null;
  try {
    const rows = await supabaseRest(
      "branches?id=eq." + encodeURIComponent(branch_id) + "&activa=eq.true&select=*&limit=1"
    );
    branch = Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch (_) {
    branch = null;
  }

  const fallback = BRANCH_GEO[branch_id] || BRANCH_GEO.challhuahuacho;
  const lat2 = branch ? Number(branch.latitud) : fallback.latitud;
  const lon2 = branch ? Number(branch.longitud) : fallback.longitud;
  const radio = branch ? Number(branch.radio_geocerca_metros || 100) : fallback.radio;

  const dist = haversineMeters(Number(lat), Number(lon), lat2, lon2);
  // Buffer de precisión GPS (celulares en sierra suelen reportar ±30–80 m).
  const accBuf = Math.min(Math.max(Number(accuracy_m) || 0, 0), 80);
  const within = dist <= radio + accBuf;
  let status = within ? "accepted" : "rejected";
  if (String(event_type) === "DILIGENCIA" && !within) status = "external_ok";
  if (status === "rejected") {
    const err = new Error("Outside geofence (" + Math.round(dist) + " m)");
    err.status = 403;
    err.body = { ok: false, validation_status: status, distance_m: dist, within_geofence: false };
    throw err;
  }

  const meta = clientMeta(event);
  const now = new Date().toISOString();
  const payload = {
    id: String(id),
    sede: branch_id,
    branch_id,
    worker_code: worker_code || null,
    event_type,
    client_ts,
    latitud: Number(lat),
    longitud: Number(lon),
    accuracy_m: accuracy_m || null,
    distance_m: dist,
    within_geofence: within,
    validation_status: status,
    spoof_suspected: !!spoof_suspected,
    validated_by: "syncToken",
    uid: auth.claims.uid,
    usuario: auth.claims.usuario,
    ip_address: meta.ip,
    user_agent: meta.ua,
    updatedAt: now,
    server_ts: now
  };

  await supabaseRest("app_records", {
    method: "POST",
    body: {
      collection: "attendance",
      id: String(id),
      branch_id,
      payload,
      deleted_at: null,
      updated_at: now,
      server_ts: now
    },
    prefer: "resolution=merge-duplicates,return=minimal"
  });

  return {
    ok: true,
    validation_status: status,
    distance_m: dist,
    within_geofence: within,
    mode: "sync"
  };
}

exports.handler = async (event) => {
  const headers = corsHeaders(event);
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
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: "Method Not Allowed" }) };
  }

  try {
    assertAllowedOrigin(event);

    // Prefer JWT path when Bearer looks like a Supabase JWT (3 segments).
    const authHeader = ((event.headers || {}).authorization || (event.headers || {}).Authorization || "");
    const bearer = String(authHeader).replace(/^Bearer\s+/i, "").trim();
    const isJwtShape = bearer.split(".").length === 3;

    if (isJwtShape) {
      const { jwt } = await requireUser(event);
      const body = parseBody(event) || {};
      const {
        id, branch_id, event_type, client_ts, lat, lon, accuracy_m,
        spoof_suspected, worker_code
      } = body;

      if (!id || !branch_id || !event_type || !client_ts || lat == null || lon == null) {
        return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "Campos requeridos faltantes." }) };
      }

      const skew = Math.abs(Date.now() - new Date(client_ts).getTime()) / 1000;
      if (Number.isNaN(skew) || skew > 60) {
        return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "Desviación de reloj > 60s." }) };
      }
      if (spoof_suspected) {
        return { statusCode: 403, headers, body: JSON.stringify({ ok: false, error: "Ubicación simulada rechazada." }) };
      }

      const meta = clientMeta(event);
      const rpc = await supabaseRpcAsUser(
        "validate_attendance_punch",
        {
          p_id: id,
          p_branch_id: branch_id,
          p_event_type: event_type,
          p_client_ts: client_ts,
          p_lat: lat,
          p_lon: lon,
          p_accuracy: accuracy_m || null,
          p_spoof: !!spoof_suspected,
          p_ip: meta.ip,
          p_ua: meta.ua,
          p_worker_code: worker_code || null
        },
        jwt
      );
      return { statusCode: 200, headers, body: JSON.stringify(rpc) };
    }

    const auth = await requireEdgeAuth(event, { allowBodyToken: true });
    const result = await validateWithSyncToken(event, auth);
    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (e) {
    if (e && e.body && e.status === 403) {
      return { statusCode: 403, headers, body: JSON.stringify(e.body) };
    }
    if (e instanceof SyntaxError) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "JSON inválido." }) };
    }
    return jsonError(headers, e, 500);
  }
};
