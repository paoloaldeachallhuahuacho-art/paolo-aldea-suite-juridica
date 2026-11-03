/**
 * POST — Sube/actualiza registros a app_records con LWW por timestamp.
 * Body: { syncToken, collection, records: [], deletedIds?: [] }
 */
const { corsHeaders, assertAllowedOrigin, supabaseRest, jsonError } = require("./_supabaseAdmin");
const {
  verifySyncToken,
  SYNC_COLLECTIONS,
  normalizeBranch,
  stripSensitiveRecord,
  canWriteStaffCollection
} = require("./_syncToken");

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

function recordTs(rec) {
  if (!rec) return 0;
  const client = Math.max(
    Date.parse(rec.updatedAt || 0) || 0,
    Date.parse(rec.updated_at || 0) || 0,
    Date.parse(rec.createdAt || 0) || 0
  );
  const server = Date.parse(rec.server_ts || 0) || 0;
  return Math.max(client, server);
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

    // El padrón (hashes, roles) no se escribe desde un abogado o asistente.
    // Respuesta 200 para no romper pushAllLocal del resto de colecciones.
    if (collection === "workers" && !canWriteStaffCollection(claims)) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ok: true,
          upserted: 0,
          skipped: records.length + deletedIds.length,
          deleted: 0,
          ignored: "workers_role"
        })
      };
    }
    const now = new Date().toISOString();
    let upserted = 0;
    let skipped = 0;
    let deleted = 0;

    for (const raw of records) {
      if (!raw || !raw.id) continue;
      let rec = raw;
      if (collection === "workers") {
        rec = stripSensitiveRecord(rec);
        const targetRole = String(rec.rol || rec.role || "");
        if ((targetRole === "super_admin" || targetRole === "socio") && !isGlobal) {
          skipped += 1;
          continue;
        }
      }
      const branchId = branchOf(rec, claims);
      if (!isGlobal && userBranch && branchId !== userBranch) {
        skipped += 1;
        continue;
      }

      const id = String(rec.id);
      let existing = null;
      try {
        const rows = await supabaseRest(
          "app_records?collection=eq." +
            encodeURIComponent(collection) +
            "&id=eq." +
            encodeURIComponent(id) +
            "&select=payload,updated_at,server_ts,deleted_at&limit=1"
        );
        existing = Array.isArray(rows) && rows[0] ? rows[0] : null;
      } catch (_) {
        existing = null;
      }

      if (existing && !existing.deleted_at) {
        const remoteTs = Date.parse(existing.server_ts || existing.updated_at || 0) || 0;
        const localTs = recordTs(rec);
        // Si el remoto es más nuevo, no sobrescribir (LWW).
        if (remoteTs > localTs) {
          skipped += 1;
          continue;
        }
      }

      const row = {
        collection,
        id,
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
      // Soft-delete solo dentro del alcance de sede del actor (anti cross-branch wipe).
      let delPath =
        "app_records?collection=eq." +
        encodeURIComponent(collection) +
        "&id=eq." +
        encodeURIComponent(String(id));
      if (!isGlobal && userBranch) {
        delPath += "&branch_id=eq." + encodeURIComponent(userBranch);
      }
      try {
        await supabaseRest(delPath, {
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
      body: JSON.stringify({ ok: true, upserted, skipped, deleted, lww: true })
    };
  } catch (err) {
    return jsonError(headers, err, 500);
  }
};
