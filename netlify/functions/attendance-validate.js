/**
 * Validación server-side de marcaje (geocerca + clock skew).
 * Obliga JWT Supabase + Origin permitido. Ejecuta RPC como el usuario (auth.uid()).
 * Sin fallback REST con service_role.
 */
const {
  requireUser,
  supabaseRpcAsUser,
  corsHeaders,
  assertAllowedOrigin,
  clientMeta,
  jsonError
} = require("./_supabaseAdmin");

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
    const { jwt } = await requireUser(event);

    const body = JSON.parse(event.body || "{}");
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
  } catch (e) {
    if (e instanceof SyntaxError) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "JSON inválido." }) };
    }
    return jsonError(headers, e, 500);
  }
};
