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

    const describeErr = (e) => {
      const body = e && e.body;
      const msg = String(
        (body && (body.message || body.error || body.hint || body.code)) ||
          (e && e.message) ||
          ""
      );
      const code = (body && body.code) || "";
      const missing =
        /relation|does not exist|42P01|PGRST205|Could not find|schema cache/i.test(msg + " " + code) ||
        (e && e.status === 404);
      return {
        missing,
        code: String(code || "").slice(0, 40),
        message: msg.slice(0, 160),
        status: e && e.status ? e.status : null
      };
    };

    try {
      const rows = await supabaseRest("firm_settings?key=eq.auth_bootstrapped&select=value");
      registryReady = true;
      if (Array.isArray(rows) && rows[0] && rows[0].value && rows[0].value.bootstrapped === true) {
        bootstrapped = true;
        detail = "firm_settings";
      }
    } catch (e) {
      const info = describeErr(e);
      if (info.missing) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            ok: true,
            bootstrapped: false,
            detail: "missing_tables",
            hint: "Ejecute en Supabase SQL Editor el archivo 20261102b_firm_auth_registry.sql",
            debug: info
          })
        };
      }
      detail = "firm_settings_error";
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ok: true,
          bootstrapped: false,
          registryReady: false,
          staffCount: 0,
          detail,
          hint: "Revise SERVICE_ROLE (proyecto correcto) o ejecute el SQL firm_auth_registry.",
          debug: info
        })
      };
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
      const info = describeErr(e);
      if (info.missing) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            ok: true,
            bootstrapped: false,
            detail: "missing_tables",
            hint: "Ejecute en Supabase SQL Editor el archivo 20261102b_firm_auth_registry.sql",
            debug: info
          })
        };
      }
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ok: true,
          bootstrapped: false,
          registryReady,
          staffCount: 0,
          detail: "staff_error",
          hint: "Tabla staff_directory no accesible. Ejecute el SQL o revise SERVICE_ROLE.",
          debug: info
        })
      };
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
