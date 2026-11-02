/**
 * CashManager — transiciones de caja vía Edge/RPC; montos en céntimos.
 */
(function (global) {
  function toCentavos(monto) {
    const n = Number(monto);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100);
  }

  function fromCentavos(c) {
    return (Number(c) || 0) / 100;
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
  }

  async function transition(entryId, newState) {
    if (!global.PaoloEnterpriseConfig || !global.PaoloEnterpriseConfig.isEnterprise()) {
      return { ok: true, offline: true, state: newState };
    }
    const headers = { "Content-Type": "application/json" };
    const tok = global.PaoloAuthService && global.PaoloAuthService.getAccessToken();
    if (tok) headers.Authorization = "Bearer " + tok;
    const res = await fetch("/.netlify/functions/petty-cash-transition", {
      method: "POST",
      headers,
      credentials: "same-origin",
      body: JSON.stringify({ entry_id: entryId, new_state: newState })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || "Transición de caja rechazada");
    }
    return data;
  }

  global.PaoloCashManager = { toCentavos, fromCentavos, enqueueLocalEntry, transition };
})(typeof window !== "undefined" ? window : globalThis);
