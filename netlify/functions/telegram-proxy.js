/**
 * PAOLO ALDEA & ABOGADOS - Proxy seguro de alertas Telegram
 * Credenciales SOLO desde variables de entorno de Netlify:
 *   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, ALLOWED_ORIGIN (https://tu-dominio)
 * El cliente ya no puede enviar token ni chatId propios. Solo se acepta el Origin configurado.
 * TODO: exigir ID token de Firebase (verifyIdToken) para autenticacion real.
 */
const MAX_LEN = 1000;

exports.handler = async (event) => {
  const origin = process.env.ALLOWED_ORIGIN || "";
  const baseHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin"
  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        ...baseHeaders,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      },
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: baseHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId || !origin) {
    return { statusCode: 503, headers: baseHeaders, body: JSON.stringify({ ok: false, error: "Proxy no configurado." }) };
  }

  const reqOrigin = event.headers.origin || event.headers.Origin || "";
  if (reqOrigin !== origin) {
    return { statusCode: 401, headers: baseHeaders, body: JSON.stringify({ ok: false, error: "No autorizado." }) };
  }

  try {
    const payload = JSON.parse(event.body || "{}");
    const text = String(payload.text || "").slice(0, MAX_LEN);
    if (!text) {
      return { statusCode: 400, headers: baseHeaders, body: JSON.stringify({ ok: false, error: "Texto requerido." }) };
    }

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text })
    });

    return {
      statusCode: response.ok ? 200 : 502,
      headers: baseHeaders,
      body: JSON.stringify({ ok: response.ok })
    };
  } catch (err) {
    return { statusCode: 500, headers: baseHeaders, body: JSON.stringify({ ok: false }) };
  }
};
