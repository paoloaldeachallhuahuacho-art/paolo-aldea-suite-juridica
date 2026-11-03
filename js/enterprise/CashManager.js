/**
 * CashManager — transiciones de caja vía Edge (syncToken o JWT).
 */
(function (global) {
  function edgeUrl(name) {
    return (global.PaoloEnterpriseConfig && global.PaoloEnterpriseConfig.edgeUrl)
      ? global.PaoloEnterpriseConfig.edgeUrl(name)
      : "/api/" + name;
  }

  function toCentavos(monto) {
    const n = Number(monto);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100);
  }

  function fromCentavos(c) {
    return (Number(c) || 0) / 100;
  }

  function authHeaders() {
    const headers = { "Content-Type": "application/json" };
    const jwt = global.PaoloAuthService && global.PaoloAuthService.getAccessToken
      ? global.PaoloAuthService.getAccessToken()
      : null;
    const sync =
      global.PaoloCloudDataSync && typeof global.PaoloCloudDataSync.getToken === "function"
        ? global.PaoloCloudDataSync.getToken()
        : "";
    if (jwt) headers.Authorization = "Bearer " + jwt;
    else if (sync) headers.Authorization = "Bearer " + sync;
    return { headers, syncToken: sync || null, hasAuth: !!(jwt || sync) };
  }

  async function enqueueLocalEntry(entry) {
    if (global.PaoloSyncManager) {
      const remote = {
        id: entry.id,
        branch_id: entry.sede || entry.branch_id,
        concepto: entry.concepto,
        categoria: entry.categoria,
        monto_centavos: toCentavos(entry.monto),
        tipo: entry.tipo,
        workflow_state: global.PaoloSyncManager.mapLegacyWorkflow(entry.estadoFlujo || "pendiente_asistente"),
        expediente: entry.expediente || null,
        comprobante: entry.comprobante || null
      };
      await global.PaoloSyncManager.enqueue("caja_chica", "upsert", remote);
    }
    if (global.PaoloCloudDataSync && typeof global.PaoloCloudDataSync.schedulePush === "function") {
      global.PaoloCloudDataSync.schedulePush("caja_chica");
    }
  }

  async function transition(entryId, newState, comentario) {
    if (!global.PaoloEnterpriseConfig || !global.PaoloEnterpriseConfig.isEnterprise()) {
      return { ok: true, offline: true, state: newState };
    }

    const auth = authHeaders();
    if (!auth.hasAuth) {
      const local = (global.db && global.db.getRaw)
        ? (global.db.getRaw("caja_chica") || []).find((r) => String(r.id) === String(entryId))
        : null;
      if (local) {
        try { await enqueueLocalEntry(local); } catch (_) {}
      }
      return { ok: true, deferred: true, state: newState, reason: "no_session" };
    }

    // Asegurar que el asiento esté en la nube antes de transicionar.
    if (global.PaoloCloudDataSync && typeof global.PaoloCloudDataSync.pushCollection === "function") {
      try { await global.PaoloCloudDataSync.pushCollection("caja_chica"); } catch (_) {}
    }

    const body = { entry_id: entryId, new_state: newState };
    if (comentario) body.comentario = comentario;
    if (auth.syncToken) body.syncToken = auth.syncToken;

    const res = await fetch(edgeUrl("petty-cash-transition"), {
      method: "POST",
      headers: auth.headers,
      credentials: "same-origin",
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || "Transición de caja rechazada");
    }
    return data;
  }

  global.PaoloCashManager = { toCentavos, fromCentavos, enqueueLocalEntry, transition };
})(typeof window !== "undefined" ? window : globalThis);
