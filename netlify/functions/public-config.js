/**
 * Expone solo configuración pública (anon). Nunca service_role.
 */
exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
    Vary: "Origin"
  };

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

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      enterprise: enterpriseEnabled,
      supabaseUrl: enterpriseEnabled ? supabaseUrl : null,
      supabaseAnonKey: enterpriseEnabled ? supabaseAnonKey : null,
      firebaseConfigured: !!(process.env.FIREBASE_API_KEY || process.env.FIREBASE_PROJECT_ID)
    })
  };
};
