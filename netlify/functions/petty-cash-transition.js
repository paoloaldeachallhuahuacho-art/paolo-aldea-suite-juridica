/**
 * Transición de estado de caja chica vía RPC (usuario autenticado).
 * Obliga JWT Supabase + Origin permitido. Sin fallback REST con service_role.
 */
const {
  requireUser,
  supabaseRpcAsUser,
  corsHeaders,
  assertAllowedOrigin,
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
    const { entry_id, new_state } = body;
    if (!entry_id || !new_state) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "entry_id y new_state requeridos." }) };
    }

    const result = await supabaseRpcAsUser(
      "transition_petty_cash",
      {
        p_entry_id: entry_id,
        p_new_state: new_state
      },
      jwt
    );

    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (e) {
    if (e instanceof SyntaxError) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "JSON inválido." }) };
    }
    return jsonError(headers, e, 500);
  }
};
