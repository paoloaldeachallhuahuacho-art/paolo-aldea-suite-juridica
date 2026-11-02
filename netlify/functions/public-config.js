/**
 * Expone solo configuración pública (anon). Nunca service_role.
 */
exports.handler = async (event) => {
  const allowed = process.env.ALLOWED_ORIGIN || "";
  const origin = event.headers.origin || event.headers.Origin || "";
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    Vary: "Origin"
  };
  if (allowed && origin === allowed) {
    headers["Access-Control-Allow-Origin"] = allowed;
  } else if (!allowed) {
    // Desarrollo sin ALLOWED_ORIGIN: same-origin únicamente (sin ACAO abierto).
  }

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        ...headers,
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      },
      body: ""
    };
  }

  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  const supabaseUrl = process.env.SUPABASE_URL || "";
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";
  const enterpriseEnabled = !!(supabaseUrl && supabaseAnonKey);

  let authBootstrapped = null;
  if (enterpriseEnabled && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { supabaseRest } = require("./_supabaseAdmin");
      const rows = await supabaseRest("firm_settings?key=eq.auth_bootstrapped&select=value");
      if (Array.isArray(rows) && rows[0] && rows[0].value) {
        authBootstrapped = rows[0].value.bootstrapped === true;
      } else {
        const staff = await supabaseRest("staff_directory?select=id&limit=1");
        authBootstrapped = Array.isArray(staff) && staff.length > 0;
      }
    } catch (_) {
      authBootstrapped = null;
    }
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      enterprise: enterpriseEnabled,
      supabaseUrl: enterpriseEnabled ? supabaseUrl : null,
      supabaseAnonKey: enterpriseEnabled ? supabaseAnonKey : null,
      firebaseConfigured: !!(process.env.FIREBASE_API_KEY || process.env.FIREBASE_PROJECT_ID),
      authBootstrapped
    })
  };
};
