/**
 * POST — Envía Web Push genérico (sin datos de expediente) a dispositivos suscritos.
 * Body: { syncToken?, scope?: "self"|"branch"|"firm", title?, body?, url?, tag?, priority? }
 * Auth: syncToken / JWT. Payload siempre sanitizado en servidor.
 */
const { corsHeaders, assertAllowedOrigin, supabaseRest, jsonError } = require("./_supabaseAdmin");
const { requireEdgeAuth } = require("./_edgeAuth");
const { buildSafePushPayload, sendToSubscription, requireVapidConfig } = require("./_webPush");

const MAX_TARGETS = 80;

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
    const scope = String(body.scope || "self");
    const role = String(auth.claims.role || "");
    const userId = String(auth.claims.uid || "");
    const branch =
      auth.claims.branchFilter ||
      (auth.claims.sede && auth.claims.sede !== "todas" ? auth.claims.sede : null);

    let rows = [];
    if (scope === "firm" && (role === "super_admin" || role === "socio" || role === "admin")) {
      rows = await supabaseRest(
        "push_subscriptions?select=id,endpoint,p256dh,auth,user_id&limit=" + MAX_TARGETS
      );
    } else if (scope === "branch" && branch) {
      rows = await supabaseRest(
        "push_subscriptions?branch_id=eq." +
          encodeURIComponent(branch) +
          "&select=id,endpoint,p256dh,auth,user_id&limit=" +
          MAX_TARGETS
      );
    } else {
      rows = await supabaseRest(
        "push_subscriptions?user_id=eq." +
          encodeURIComponent(userId) +
          "&select=id,endpoint,p256dh,auth,user_id&limit=" +
          MAX_TARGETS
      );
    }

    if (!Array.isArray(rows) || !rows.length) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, sent: 0, skipped: 0, message: "Sin dispositivos suscritos." })
      };
    }

    // Título/cuerpo del cliente se ignoran parcialmente: siempre genéricos (secreto profesional).
    const safe = buildSafePushPayload({
      title: "PAOLO ALDEA — Aviso urgente del despacho",
      body:
        "Hay un plazo o diligencia perentoria. Abra la suite segura para consultar el detalle (la notificación no incluye datos del expediente).",
      url: body.url || "./index.html?open=alerts",
      tag: body.tag || "alerta-urgente",
      priority: body.priority === "urgent" ? "urgent" : "high"
    });

    let sent = 0;
    let failed = 0;
    const goneIds = [];

    for (const row of rows.slice(0, MAX_TARGETS)) {
      const sub = {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth }
      };
      const result = await sendToSubscription(sub, safe);
      if (result.ok) {
        sent += 1;
      } else {
        failed += 1;
        if (result.gone && row.id != null) goneIds.push(row.id);
      }
    }

    if (goneIds.length) {
      try {
        await supabaseRest("push_subscriptions?id=in.(" + goneIds.join(",") + ")", {
          method: "DELETE",
          prefer: "return=minimal"
        });
      } catch (_) {}
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        sent,
        failed,
        pruned: goneIds.length,
        payload: { title: safe.title, tag: safe.tag }
      })
    };
  } catch (err) {
    return jsonError(headers, err, 500);
  }
};
