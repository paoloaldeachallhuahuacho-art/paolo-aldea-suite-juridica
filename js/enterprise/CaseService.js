/**
 * CaseService — CRUD cloud + URLs firmadas Storage
 */
(function (global) {
  function client() {
    return global.PaoloAuthService && global.PaoloAuthService.getClient
      ? global.PaoloAuthService.getClient()
      : null;
  }

  async function upsertCase(caso) {
    const c = client();
    const payload = {
      id: caso.id,
      branch_id: caso.sede || caso.branch_id,
      expediente: caso.expediente,
      caratula: caso.caratula,
      materia: caso.materia || null,
      cliente: caso.cliente || null,
      juzgado: caso.juzgado || null,
      estado: caso.estado || null,
      etapa: caso.etapa || null,
      vencimiento: caso.vencimiento || null,
      abogado_asignado: caso.abogado || caso.abogado_asignado || null,
      notas_confidenciales: caso.notas || caso.notas_confidenciales || null
    };
    if (!c || !global.PaoloEnterpriseConfig.isEnterprise()) {
      if (global.PaoloSyncManager) await global.PaoloSyncManager.enqueue("casos", "upsert", payload);
      return { ok: true, queued: true };
    }
    const { error } = await c.from("cases").upsert(payload);
    if (error) throw error;
    return { ok: true };
  }

  async function signedUrl(storagePath, expiresSec) {
    const c = client();
    if (!c) throw new Error("Supabase no disponible");
    const { data, error } = await c.storage
      .from("case-files")
      .createSignedUrl(storagePath, expiresSec || 300);
    if (error) throw error;
    return data && data.signedUrl;
  }

  async function uploadCaseFile(branchId, caseId, file) {
    const c = client();
    if (!c) throw new Error("Supabase no disponible");
    const path = `${branchId}/${caseId}/${Date.now()}_${file.name.replace(/[^\w.\-]+/g, "_")}`;
    const { error } = await c.storage.from("case-files").upload(path, file, { upsert: false });
    if (error) throw error;
    const doc = {
      id: "DOC-" + Date.now(),
      branch_id: branchId,
      case_id: caseId,
      titulo: file.name,
      storage_path: path,
      mime_type: file.type || null
    };
    await c.from("case_documents").upsert(doc);
    return doc;
  }

  global.PaoloCaseService = { upsertCase, signedUrl, uploadCaseFile };
})(typeof window !== "undefined" ? window : globalThis);
