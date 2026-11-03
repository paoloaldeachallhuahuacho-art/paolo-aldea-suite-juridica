/**
 * POST — Registra / actualiza una subscription Web Push del usuario autenticado.
 * Body: { syncToken?, endpoint, keys: { p256dh, auth }, userAgent? }
 * Auth: Bearer syncToken | JWT (requireEdgeAuth)
 */
const { corsHeaders, assertAllowedOrigin, supabaseRest, jsonError, clientMeta } = require("./_supabaseAdmin");
const { requireEdgeAuth } = require("./_edgeAuth");
const { requireVapidConfig } = require("./_webPush");

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
    requireVapidConfig();
    const auth = await requireEdgeAuth(event);
    const body = auth.body || {};
    const endpoint = String(body.endpoint || "").trim();
    const p256dh = body.keys && body.keys.p256dh ? String(body.keys.p256dh).trim() : "";
    const authKey = body.keys && body.keys.auth ? String(body.keys.auth).trim() : "";
    if (!endpoint || !endpoint.startsWith("https://") || !p256dh || !authKey) {
      const err = new Error("Subscription inválida (endpoint + keys requeridos).");
      err.status = 400;
      throw err;
    }
    if (endpoint.length > 2048 || p256dh.length > 512 || authKey.length > 256) {
      const err = new Error("Subscription demasiado larga.");
      err.status = 400;
      throw err;
    }

    const userId = String(auth.claims.uid || "");
    const branchId =
      auth.claims.branchFilter ||
      (auth.claims.sede && auth.claims.sede !== "todas" ? auth.claims.sede : "challhuahuacho");
    const meta = clientMeta(event);
    const ua = String(body.userAgent || meta.ua || "").slice(0, 400);
    const now = new Date().toISOString();

    await supabaseRest("push_subscriptions?on_conflict=endpoint", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      body: {
        user_id: userId,
        endpoint,
        p256dh,
        auth: authKey,
        user_agent: ua,
        branch_id: branchId || "challhuahuacho",
        updated_at: now,
        last_seen_at: now
      }
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, subscribed: true })
    };
  } catch (err) {
    return jsonError(headers, err, 500);
  }
};
