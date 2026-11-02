/**
 * GET — ¿El despacho ya tiene Super Admin en la nube?
 * Público (solo booleano). Sin filtrar orígenes estrictos para que el celular
 * pueda consultar antes del login; no expone hashes ni datos personales.
 */
const { corsHeaders, supabaseRest, jsonError } = require("./_supabaseAdmin");

exports.handler = async (event) => {
  const headers = { ...corsHeaders(event), "Cache-Control": "no-store" };

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

  try {
    let bootstrapped = false;
    try {
      const rows = await supabaseRest("firm_settings?key=eq.auth_bootstrapped&select=value");
      if (Array.isArray(rows) && rows[0] && rows[0].value) {
        bootstrapped = rows[0].value.bootstrapped === true;
      }
    } catch (_) {}

    if (!bootstrapped) {
      try {
        const staff = await supabaseRest("staff_directory?select=id&activo=eq.true&limit=1");
        bootstrapped = Array.isArray(staff) && staff.length > 0;
      } catch (_) {}
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, bootstrapped })
    };
  } catch (err) {
    return jsonError(headers, err, 500);
  }
};
