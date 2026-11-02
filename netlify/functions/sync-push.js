/**
 * POST — Sube/actualiza registros a app_records (LWW por updatedAt).
 * Body: { syncToken, collection, records: [], deletedIds?: [] }
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

function branchOf(record, claims) {
  const sede = (record && record.sede) || claims.sede || "challhuahuacho";
  if (sede === "todas") return "challhuahuacho";
  return sede;
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
    const body = parseBody(event);
    if (!body) {
      const err = new Error("JSON inválido.");
      err.status = 400;
      throw err;
    }
    const claims = verifySyncToken(body.syncToken || body.token || "");
    const collection = String(body.collection || "");
    if (!SYNC_COLLECTIONS.includes(collection)) {
      const err = new Error("Colección no sincronizable: " + collection);
      err.status = 400;
      throw err;
    }

    const isGlobal = claims.role === "super_admin" || claims.role === "socio" || claims.sede === "todas";
    const userBranch = normalizeBranch(claims.sede, claims.role);
    const records = Array.isArray(body.records) ? body.records : [];
    const deletedIds = Array.isArray(body.deletedIds) ? body.deletedIds : [];
    const now = new Date().toISOString();
    let upserted = 0;
    let deleted = 0;

    for (const rec of records) {
      if (!rec || !rec.id) continue;
      const branchId = branchOf(rec, claims);
      if (!isGlobal && userBranch && branchId !== userBranch) {
        continue; // no publicar fuera de sede
      }
      const row = {
        collection,
        id: String(rec.id),
        branch_id: branchId,
        payload: rec,
        deleted_at: null,
        updated_at: rec.updatedAt || now,
        server_ts: now
      };
      await supabaseRest("app_records", {
        method: "POST",
        body: row,
        prefer: "resolution=merge-duplicates,return=minimal"
      });
      upserted += 1;
    }

    for (const id of deletedIds) {
      if (!id) continue;
      // Soft delete
      const patchPath =
        "app_records?collection=eq." +
        encodeURIComponent(collection) +
        "&id=eq." +
        encodeURIComponent(String(id));
      try {
        await supabaseRest(patchPath, {
          method: "PATCH",
          body: { deleted_at: now, updated_at: now, server_ts: now },
          prefer: "return=minimal"
        });
        deleted += 1;
      } catch (_) {}
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, upserted, deleted })
    };
  } catch (err) {
    return jsonError(headers, err, 500);
  }
};
