/**
 * SyncManager — outbox IndexedDB + Realtime + LWW (server_ts) + backoff
 */
(function (global) {
  const DB_NAME = "PaoloAldeaSyncOutbox";
  const STORE = "outbox";
  const TABLE_MAP = {
    casos: "cases",
    caja_chica: "petty_cash_entries",
    attendance: "attendance_punches",
    presupuestos: "budgets",
    documentos: "case_documents"
  };

  let dbp = null;
  let channel = null;
  let flushing = false;
  let backoffMs = 1000;
  let online = typeof navigator !== "undefined" ? navigator.onLine : true;

  function openDb() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }

  async function enqueue(table, op, payload) {
    const db = await openDb();
    const item = {
      id: "obx_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
      table,
      remoteTable: TABLE_MAP[table] || table,
      op,
      payload,
      client_ts: new Date().toISOString(),
      retries: 0
    };
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    scheduleFlush();
    return item.id;
  }

  async function listOutbox() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function removeOutbox(id) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /** Last-Write-Wins: gana el mayor server_ts (o updated_at). */
  function lwwMerge(localRow, remoteRow) {
    if (!localRow) return remoteRow;
    if (!remoteRow) return localRow;
    const lt = Date.parse(localRow.server_ts || localRow.updated_at || localRow.updatedAt || 0);
    const rt = Date.parse(remoteRow.server_ts || remoteRow.updated_at || remoteRow.updatedAt || 0);
    if (rt >= lt) return remoteRow;
    return localRow;
  }

  function scheduleFlush() {
    if (!online || flushing) return;
    setTimeout(() => flush().catch(() => {}), 50);
  }

  async function flush() {
    if (!global.PaoloEnterpriseConfig || !global.PaoloEnterpriseConfig.isEnterprise()) return;
    if (!online || flushing) return;
    flushing = true;
    try {
      const auth = global.PaoloAuthService;
      const client = auth && auth.getClient ? auth.getClient() : null;
      if (!client || !auth.getAccessToken()) {
        backoffMs = Math.min(backoffMs * 2, 60000);
        return;
      }
      const items = await listOutbox();
      for (const item of items) {
        try {
          const table = item.remoteTable;
          if (item.op === "upsert") {
            const { error } = await client.from(table).upsert(item.payload);
            if (error) throw error;
          } else if (item.op === "delete") {
            const { error } = await client.from(table).update({ deleted_at: new Date().toISOString() }).eq("id", item.payload.id);
            if (error) throw error;
          }
          await removeOutbox(item.id);
          backoffMs = 1000;
        } catch (err) {
          item.retries = (item.retries || 0) + 1;
          const db = await openDb();
          await new Promise((resolve) => {
            const tx = db.transaction(STORE, "readwrite");
            tx.objectStore(STORE).put(item);
            tx.oncomplete = () => resolve();
          });
          backoffMs = Math.min(backoffMs * 2, 60000);
          throw err;
        }
      }
    } catch (_) {
      setTimeout(() => flush().catch(() => {}), backoffMs);
    } finally {
      flushing = false;
    }
  }

  function subscribeBranch(branchId) {
    const auth = global.PaoloAuthService;
    const client = auth && auth.getClient ? auth.getClient() : null;
    if (!client || !branchId) return;
    if (channel) {
      try { client.removeChannel(channel); } catch (_) {}
      channel = null;
    }
    channel = client
      .channel("branch:" + branchId)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cases", filter: "branch_id=eq." + branchId },
        (payload) => applyRemote("casos", payload)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "petty_cash_entries", filter: "branch_id=eq." + branchId },
        (payload) => applyRemote("caja_chica", payload)
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setTimeout(() => subscribeBranch(branchId), backoffMs);
          backoffMs = Math.min(backoffMs * 2, 60000);
        } else if (status === "SUBSCRIBED") {
          backoffMs = 1000;
        }
      });
  }

  function applyRemote(localCollection, payload) {
    if (!global.db || !payload) return;
    const row = payload.new || payload.old;
    if (!row) return;
    try {
      const list = global.db.getRaw(localCollection) || [];
      const idx = list.findIndex((x) => x && String(x.id) === String(row.id));
      if (payload.eventType === "DELETE" || row.deleted_at) {
        if (idx >= 0) {
          list.splice(idx, 1);
          global.db.save(localCollection, list);
        }
        return;
      }
      const mapped = mapRemoteToLocal(localCollection, row);
      if (idx >= 0) {
        list[idx] = lwwMerge(list[idx], mapped);
      } else {
        list.push(mapped);
      }
      global.db.save(localCollection, list);
      if (global.app && typeof global.app.refreshCurrentModuleView === "function") {
        global.app.refreshCurrentModuleView();
      }
    } catch (e) {
      console.warn("[SyncManager] applyRemote", e);
    }
  }

  function mapRemoteToLocal(col, row) {
    if (col === "caja_chica") {
      return {
        id: row.id,
        sede: row.branch_id,
        concepto: row.concepto,
        categoria: row.categoria,
        monto: (Number(row.monto_centavos) || 0) / 100,
        tipo: row.tipo,
        estadoFlujo: mapWorkflowToLegacy(row.workflow_state),
        expediente: row.expediente,
        comprobante: row.comprobante,
        server_ts: row.server_ts,
        updated_at: row.updated_at
      };
    }
    if (col === "casos") {
      return {
        id: row.id,
        sede: row.branch_id,
        expediente: row.expediente,
        caratula: row.caratula,
        materia: row.materia,
        cliente: row.cliente,
        juzgado: row.juzgado,
        estado: row.estado,
        etapa: row.etapa,
        vencimiento: row.vencimiento,
        server_ts: row.server_ts,
        updated_at: row.updated_at
      };
    }
    return { ...row, sede: row.branch_id || row.sede };
  }

  function mapWorkflowToLegacy(state) {
    const m = {
      requested: "pendiente_asistente",
      branch_approved: "elevado_admin",
      disbursed: "aprobado",
      reconciled: "aprobado",
      rejected: "rechazado"
    };
    return m[state] || state;
  }

  function mapLegacyWorkflow(estado) {
    const m = {
      pendiente_asistente: "requested",
      elevado_admin: "branch_approved",
      aprobado: "disbursed",
      rechazado: "rejected",
      observado: "requested"
    };
    return m[estado] || "requested";
  }

  function uninstall() {
    const auth = global.PaoloAuthService;
    const client = auth && auth.getClient ? auth.getClient() : null;
    if (channel && client) {
      try { client.removeChannel(channel); } catch (_) {}
    }
    channel = null;
  }

  function bootListeners() {
    global.addEventListener("online", () => {
      online = true;
      backoffMs = 1000;
      scheduleFlush();
    });
    global.addEventListener("offline", () => { online = false; });
    global.addEventListener("beforeunload", uninstall);
  }

  async function start() {
    bootListeners();
    await openDb();
    const claims = global.PaoloAuthService && global.PaoloAuthService.getClaims
      ? global.PaoloAuthService.getClaims()
      : null;
    if (claims && claims.branch_id) subscribeBranch(claims.branch_id);
    scheduleFlush();
  }

  global.PaoloSyncManager = {
    enqueue,
    flush,
    listOutbox,
    lwwMerge,
    subscribeBranch,
    start,
    uninstall,
    mapLegacyWorkflow,
    mapWorkflowToLegacy,
    TABLE_MAP
  };
})(typeof window !== "undefined" ? window : globalThis);
