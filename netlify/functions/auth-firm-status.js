/**
 * GET — ¿El despacho ya tiene Super Admin en la nube?
 * Devuelve diagnóstico seguro (sin secretos) para depurar celular vacío.
 */
const { corsHeaders, supabaseRest, jsonError, requireEnv } = require("./_supabaseAdmin");

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
    try {
      requireEnv("SUPABASE_URL");
      requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    } catch (_) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ok: true,
          bootstrapped: false,
          detail: "missing_service_role",
          hint: "Configure SUPABASE_SERVICE_ROLE_KEY en Netlify Environment variables."
        })
      };
    }

    let bootstrapped = false;
    let registryReady = false;
    let staffCount = 0;
    let detail = "empty";

    try {
      const rows = await supabaseRest("firm_settings?key=eq.auth_bootstrapped&select=value");
      registryReady = true;
      if (Array.isArray(rows) && rows[0] && rows[0].value && rows[0].value.bootstrapped === true) {
        bootstrapped = true;
        detail = "firm_settings";
      }
    } catch (e) {
      const msg = String((e && e.body && (e.body.message || e.body)) || (e && e.message) || "");
      if (/relation|does not exist|42P01|Could not find/i.test(msg) || (e && e.status === 404)) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            ok: true,
            bootstrapped: false,
            detail: "missing_tables",
            hint: "Ejecute en Supabase SQL Editor el archivo 20261102b_firm_auth_registry.sql"
          })
        };
      }
      detail = "firm_settings_error";
    }

    try {
      const staff = await supabaseRest("staff_directory?select=id&activo=eq.true");
      registryReady = true;
      staffCount = Array.isArray(staff) ? staff.length : 0;
      if (!bootstrapped && staffCount > 0) {
        bootstrapped = true;
        detail = "staff_directory";
      }
    } catch (e) {
      const msg = String((e && e.body && (e.body.message || e.body)) || (e && e.message) || "");
      if (/relation|does not exist|42P01|Could not find/i.test(msg) || (e && e.status === 404)) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            ok: true,
            bootstrapped: false,
            detail: "missing_tables",
            hint: "Ejecute en Supabase SQL Editor el archivo 20261102b_firm_auth_registry.sql"
          })
        };
      }
      if (detail === "empty") detail = "staff_error";
    }

    if (bootstrapped) detail = detail || "ok";
    else if (registryReady && staffCount === 0) detail = "empty";

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        bootstrapped,
        registryReady,
        staffCount,
        detail
      })
    };
  } catch (err) {
    return jsonError(headers, err, 500);
  }
};
