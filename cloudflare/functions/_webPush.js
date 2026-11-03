/**
 * Web Push (VAPID) helpers — solo en edge. Nunca exponer VAPID_PRIVATE_KEY.
 */
function requireVapidConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || "";
  const privateKey = process.env.VAPID_PRIVATE_KEY || "";
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@paoloaldea.local";
  if (!publicKey || !privateKey) {
    const err = new Error("VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY no configurados.");
    err.status = 503;
    throw err;
  }
  return { publicKey, privateKey, subject };
}

function getWebPush() {
  try {
    return require("web-push");
  } catch (_) {
    const err = new Error("Módulo web-push no disponible en el worker.");
    err.status = 503;
    throw err;
  }
}

function configureWebPush() {
  const cfg = requireVapidConfig();
  const webpush = getWebPush();
  webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey);
  return { webpush, cfg };
}

/**
 * Payload genérico — sin datos de expediente / partes / montos.
 */
function buildSafePushPayload({ title, body, url, tag, priority } = {}) {
  const safeTitle = String(title || "PAOLO ALDEA — Aviso del despacho").slice(0, 80);
  const safeBody = String(
    body ||
      "Hay un aviso perentorio. Abra la suite segura para ver el detalle (sin datos del expediente en la notificación)."
  ).slice(0, 180);
  return {
    title: safeTitle,
    body: safeBody,
    tag: String(tag || "alerta-despacho").slice(0, 64),
    url: String(url || "./index.html?open=alerts").slice(0, 200),
    priority: priority === "urgent" || priority === "high" ? priority : "default"
  };
}

async function sendToSubscription(subscription, payloadObj) {
  const { webpush } = configureWebPush();
  const payload = JSON.stringify(buildSafePushPayload(payloadObj));
  const options = {
    TTL: 60 * 60 * 12,
    urgency: payloadObj && payloadObj.priority === "urgent" ? "high" : "normal"
  };
  try {
    await webpush.sendNotification(subscription, payload, options);
    return { ok: true };
  } catch (err) {
    const statusCode = err && (err.statusCode || err.status);
    return {
      ok: false,
      statusCode: statusCode || 500,
      gone: statusCode === 404 || statusCode === 410,
      message: (err && err.message) || "push failed"
    };
  }
}

module.exports = {
  requireVapidConfig,
  configureWebPush,
  buildSafePushPayload,
  sendToSubscription
};
