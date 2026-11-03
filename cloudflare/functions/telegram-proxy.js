/**
 * PAOLO ALDEA & ABOGADOS - Proxy seguro de alertas Telegram (Semana 2)
 * Env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, ALLOWED_ORIGIN, FIREBASE_API_KEY (opcional pero recomendado)
 * - No acepta token/chatId del cliente
 * - Exige Origin permitido
 * - Si FIREBASE_API_KEY está definido, exige Authorization: Bearer <Firebase ID token>
 */
const MAX_LEN = 1000;

async function verifyFirebaseIdToken(idToken, apiKey) {
  if (!idToken || !apiKey) return null;
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken })
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const user = Array.isArray(data.users) && data.users[0] ? data.users[0] : null;
    if (!user || !user.localId) return null;
    // Rechazar cuentas anónimas (providerUserInfo vacío / sin email suele indicar anonymous)
    const providers = Array.isArray(user.providerUserInfo) ? user.providerUserInfo : [];
    if (providers.length === 0 && !user.email) return null;
    return user;
  } catch (_) {
    return null;
  }
}

exports.handler = async (event) => {
  const origin = process.env.ALLOWED_ORIGIN || "";
  const baseHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin"
  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        ...baseHeaders,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
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

  // Zero-trust: Firebase ID token obligatorio en producción (no confiar solo en Origin)
  const firebaseApiKey = process.env.FIREBASE_API_KEY || "";
  if (!firebaseApiKey) {
    return { statusCode: 503, headers: baseHeaders, body: JSON.stringify({ ok: false, error: "FIREBASE_API_KEY requerido." }) };
  }
  const authHeader = event.headers.authorization || event.headers.Authorization || "";
  const m = String(authHeader).match(/^Bearer\s+(.+)$/i);
  if (!m) {
    return { statusCode: 401, headers: baseHeaders, body: JSON.stringify({ ok: false, error: "Bearer Firebase ID token requerido." }) };
  }
  const user = await verifyFirebaseIdToken(m[1].trim(), firebaseApiKey);
  if (!user) {
    return { statusCode: 401, headers: baseHeaders, body: JSON.stringify({ ok: false, error: "Token Firebase inválido o anónimo." }) };
  }

  try {
    const payload = JSON.parse(event.body || "{}");
    // Ignorar cualquier token/chatId que el cliente intente enviar
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
