/**
 * POST — Elimina la subscription del dispositivo actual.
 * Body: { syncToken?, endpoint }
 */
const { corsHeaders, assertAllowedOrigin, supabaseRest, jsonError } = require("./_supabaseAdmin");
const { requireEdgeAuth } = require("./_edgeAuth");

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
    const auth = await requireEdgeAuth(event);
    const endpoint = String((auth.body && auth.body.endpoint) || "").trim();
    if (!endpoint) {
      const err = new Error("endpoint requerido.");
      err.status = 400;
      throw err;
    }
    const userId = String(auth.claims.uid || "");
    const enc = encodeURIComponent(endpoint);
    await supabaseRest(
      "push_subscriptions?endpoint=eq." + enc + "&user_id=eq." + encodeURIComponent(userId),
      { method: "DELETE", prefer: "return=minimal" }
    );
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, unsubscribed: true })
    };
  } catch (err) {
    return jsonError(headers, err, 500);
  }
};
