/**
 * POST — Descarga colecciones desde app_records (filtrado por sede/rol).
 * Body: { syncToken }
 */
const { corsHeaders, assertAllowedOrigin, supabaseRest, jsonError } = require("./_supabaseAdmin");
const { verifySyncToken, SYNC_COLLECTIONS, normalizeBranch } = require("./_syncToken");

function parseBody(event) {
  try {
    return JSON.parse(event.body || "{}");
  } catch (_) {
    return null;
  }
}

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
    const body = parseBody(event) || {};
    const token = body.syncToken || body.token || "";
    const claims = verifySyncToken(token);
    const branchFilter = normalizeBranch(claims.sede, claims.role);

    const collections = {};
    for (const col of SYNC_COLLECTIONS) {
      collections[col] = [];
    }

    // PostgREST: traer activos; filtrar sede en servidor si no es global
    let path = "app_records?select=collection,id,branch_id,payload,updated_at,server_ts&deleted_at=is.null&limit=5000";
    if (branchFilter) {
      path += "&branch_id=eq." + encodeURIComponent(branchFilter);
    }
    const rows = await supabaseRest(path);
    if (Array.isArray(rows)) {
      for (const row of rows) {
        const col = row.collection;
        if (!SYNC_COLLECTIONS.includes(col)) continue;
        const payload = row.payload && typeof row.payload === "object" ? { ...row.payload } : {};
        payload.id = payload.id || row.id;
        payload.sede = payload.sede || row.branch_id;
        payload.server_ts = row.server_ts;
        payload.updatedAt = payload.updatedAt || row.updated_at;
        collections[col].push(payload);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        collections,
        claims: { uid: claims.uid, role: claims.role, sede: claims.sede }
      })
    };
  } catch (err) {
    return jsonError(headers, err, 500);
  }
};
