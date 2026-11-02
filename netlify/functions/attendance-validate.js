/**
 * Validación server-side de marcaje (Haversine + clock skew ≤60s).
 * Prefiere RPC validate_attendance_punch; fallback REST si RPC no disponible.
 */
const { supabaseRest, supabaseRpc, haversineMeters, corsHeaders, clientMeta } = require("./_supabaseAdmin");

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
    const body = JSON.parse(event.body || "{}");
    const {
      id, branch_id, event_type, client_ts, lat, lon, accuracy_m,
      spoof_suspected, worker_code, user_jwt
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

    try {
      const rpc = await supabaseRpc("validate_attendance_punch", {
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
      });
      return { statusCode: 200, headers, body: JSON.stringify(rpc) };
    } catch (rpcErr) {
      // Fallback: validar en function + insert REST
      const branches = await supabaseRest(`branches?id=eq.${encodeURIComponent(branch_id)}&select=*`);
      const branch = Array.isArray(branches) ? branches[0] : null;
      if (!branch) {
        return { statusCode: 404, headers, body: JSON.stringify({ ok: false, error: "Sede no encontrada." }) };
      }
      const dist = haversineMeters(lat, lon, branch.latitud, branch.longitud);
      const within = dist <= Number(branch.radio_geocerca_metros || 100);
      let status = within ? "accepted" : "rejected";
      if (event_type === "DILIGENCIA" && !within) status = "external_ok";
      if (status === "rejected") {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ ok: false, error: "Fuera de geocerca", distance_m: Math.round(dist) })
        };
      }
      await supabaseRest("attendance_punches", {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=representation",
        body: [{
          id,
          branch_id,
          auth_uid: body.auth_uid || "00000000-0000-0000-0000-000000000000",
          worker_code: worker_code || null,
          event_type,
          client_ts,
          latitud: lat,
          longitud: lon,
          accuracy_m: accuracy_m || null,
          distance_m: Math.round(dist * 100) / 100,
          within_geofence: within,
          validation_status: status,
          spoof_suspected: false,
          ip_address: meta.ip,
          user_agent: meta.ua
        }]
      });
      await supabaseRest("audit_logs", {
        method: "POST",
        prefer: "return=minimal",
        body: [{
          branch_id,
          action: "ATTENDANCE_PUNCH",
          table_name: "attendance_punches",
          record_id: id,
          after_state: { status, distance_m: dist, user_jwt_present: !!user_jwt },
          ip_address: meta.ip,
          user_agent: meta.ua
        }]
      });
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, validation_status: status, distance_m: dist, within_geofence: within })
      };
    }
  } catch (e) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: e.message || "Error interno" })
    };
  }
};
