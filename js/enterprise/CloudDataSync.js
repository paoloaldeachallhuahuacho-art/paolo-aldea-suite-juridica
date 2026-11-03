/**
 * Sync multi-dispositivo de colecciones de negocio vía Edge Functions + app_records.
 */
(function (global) {
  const COLLECTIONS = [
    "casos",
    "citas",
    "caja_chica",
    "presupuestos",
    "inventario",
    "documentos",
    "attendance",
    "workers"
  ];

  const TOKEN_KEY = "PA_SYNC_TOKEN";
  let pushTimer = null;
  let pushing = false;

  function getToken() {
    try {
      return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || "";
    } catch (_) {
      return "";
    }
  }

  function setToken(token) {
    try {
      if (token) {
        sessionStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(TOKEN_KEY, token);
      }
    } catch (_) {}
  }

  function clearToken() {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_KEY);
    } catch (_) {}
  }

  function isEnabled() {
    return !!(global.__ENTERPRISE_CLOUD__ && getToken());
  }

  function getTombstoneIds(collection) {
    try {
      if (global.db && typeof global.db._loadTombstones === "function") {
        const all = global.db._loadTombstones() || {};
        return new Set((all[collection] || []).map(String));
      }
      const raw = localStorage.getItem("PAOLO_ALDEA_TOMBSTONES");
      const all = raw ? JSON.parse(raw) : {};
      return new Set((all[collection] || []).map(String));
    } catch (_) {
      return new Set();
    }
  }

  /** Tiempo lógico: max(updatedAt, server_ts). Nunca preferir un server_ts viejo sobre un updatedAt local reciente. */
  function recordLogicalTs(r) {
    if (!r) return 0;
    const client = Math.max(
      Date.parse(r.updatedAt || 0) || 0,
      Date.parse(r.updated_at || 0) || 0,
      Date.parse(r.createdAt || 0) || 0,
      Date.parse(r.fechaAprobacion || 0) || 0
    );
    const server = Date.parse(r.server_ts || 0) || 0;
    return Math.max(client, server);
  }

  function lwwMergeLists(localList, remoteList, collection) {
    const tombstones = getTombstoneIds(collection || "");
    const map = new Map();
    (localList || []).forEach((r) => {
      if (!r || r.id == null) return;
      if (tombstones.has(String(r.id))) return;
      map.set(String(r.id), r);
    });
    (remoteList || []).forEach((r) => {
      if (!r || r.id == null) return;
      const id = String(r.id);
      if (tombstones.has(id)) return; // No resucitar eliminados locales
      const cur = map.get(id);
      const remoteTs = recordLogicalTs(r);
      const localTs = recordLogicalTs(cur);
      // Empate: conservar local (evita que pull borre una edición recién guardada).
      if (!cur || remoteTs > localTs) {
        if (cur && cur.foto && !r.foto) r = { ...r, foto: cur.foto };
        // El padrón no acepta credenciales ni auto-ascenso llegados por sync.
        if (collection === "workers") {
          r = { ...r };
          delete r.passwordHash;
          delete r.pinHash;
          delete r.password;
          delete r.pin;
          if (cur) {
            if (cur.passwordHash) r.passwordHash = cur.passwordHash;
            if (cur.pinHash) r.pinHash = cur.pinHash;
            if (!r.permisos && cur.permisos) r.permisos = cur.permisos;
            const me = global.db && typeof global.db.getCurrentUser === "function" ? global.db.getCurrentUser() : null;
            if (me && String(me.id) === id) {
              r.rol = cur.rol;
              r.role = cur.role;
              r.permisos = cur.permisos;
              r.sede = cur.sede;
            }
          }
        }
        map.set(id, r);
      } else if (r.foto && !cur.foto) {
        map.set(id, { ...cur, foto: r.foto });
      }
    });
    return Array.from(map.values());
  }

  function edgeUrl(name) {
    return (global.PaoloEnterpriseConfig && global.PaoloEnterpriseConfig.edgeUrl)
      ? global.PaoloEnterpriseConfig.edgeUrl(name)
      : "/api/" + name;
  }

  async function pullAndMerge() {
    if (!global.__ENTERPRISE_CLOUD__) return null;
    const token = getToken();
    if (!token) return null;
    const res = await fetch(edgeUrl("sync-pull"), {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ syncToken: token })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error((data && data.error) || ("sync-pull HTTP " + res.status));
      err.status = res.status;
      throw err;
    }
    if (!global.db || !data.collections) return data;

    global.db._isMergingSync = true;
    try {
      for (const col of COLLECTIONS) {
        const remote = data.collections[col] || [];
        const local = global.db.getRaw(col) || [];
        const merged = lwwMergeLists(local, remote, col);
        global.db._persist ? global.db._persist(col, merged) : global.db.save(col, merged);
      }
    } finally {
      global.db._isMergingSync = false;
    }
    return data;
  }

  async function pushCollection(collection) {
    if (!isEnabled() || !global.db) return;
    if (!COLLECTIONS.includes(collection)) return;
    const token = getToken();
    let records = global.db.getRaw(collection) || [];
    const deletedIds = Array.from(getTombstoneIds(collection));
    if (collection === "workers") {
      const me = typeof global.db.getCurrentUser === "function" ? global.db.getCurrentUser() : null;
      const role = me && (me.rol || me.role);
      if (!["super_admin", "socio", "admin"].includes(role)) {
        return { ok: true, skipped: "workers_role" };
      }
      records = records.map((row) => {
        if (!row || typeof row !== "object") return row;
        const copy = { ...row };
        delete copy.passwordHash;
        delete copy.pinHash;
        delete copy.password;
        delete copy.pin;
        return copy;
      });
    }
    const res = await fetch(edgeUrl("sync-push"), {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ syncToken: token, collection, records, deletedIds })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error((data && data.error) || ("sync-push HTTP " + res.status));
      err.status = res.status;
      throw err;
    }
    return data;
  }

  async function pushAllLocal() {
    if (!isEnabled()) return { ok: false };
    const results = {};
    for (const col of COLLECTIONS) {
      try {
        results[col] = await pushCollection(col);
      } catch (e) {
        results[col] = { ok: false, error: e.message };
      }
    }
    return { ok: true, results };
  }

  function schedulePush(collection) {
    if (!isEnabled()) return;
    if (!global.__cloudDirty) global.__cloudDirty = new Set();
    if (collection) global.__cloudDirty.add(collection);
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      flushDirty().catch((e) => console.warn("[CloudDataSync]", e && e.message));
    }, 600);
  }

  async function flushDirty() {
    if (pushing || !isEnabled()) return;
    const dirty = Array.from(global.__cloudDirty || []);
    if (!dirty.length) return;
    pushing = true;
    try {
      for (const col of dirty) {
        global.__cloudDirty.delete(col);
        await pushCollection(col);
      }
    } finally {
      pushing = false;
      if (global.__cloudDirty && global.__cloudDirty.size) schedulePush();
    }
  }

  /**
   * Tras login: sincronizar con la nube.
   * quick=true (default en login): pull inmediato + push diferido (no bloquea con 8 POSTs).
   * quick=false: push completo y luego pull (modo manual / primera sincronización fuerte).
   */
  async function afterLogin(syncToken, opts = {}) {
    if (syncToken) setToken(syncToken);
    if (!getToken()) return false;
    const quick = opts.quick !== false;
    try {
      await flushDirty();
      if (!quick) await pushAllLocal();
    } catch (e) {
      console.warn("[CloudDataSync] push:", e && e.message);
    }
    try {
      await pullAndMerge();
    } catch (e) {
      console.warn("[CloudDataSync] pull:", e && e.message);
    }
    // En modo rápido: subir el resto en segundo plano (no retrasa la UI)
    if (quick) {
      setTimeout(() => {
        pushAllLocal().catch((e) => console.warn("[CloudDataSync] push bg:", e && e.message));
      }, 1500);
    }
    if (global.app && typeof global.app.refreshCurrentModuleView === "function") {
      try {
        global.app.refreshCurrentModuleView();
      } catch (_) {}
    }
    try {
      if (global.AttendanceModule && typeof global.AttendanceModule.renderWorkerSelectorDropdown === "function") {
        global.AttendanceModule.renderWorkerSelectorDropdown();
      }
      if (global.AttendanceModule && typeof global.AttendanceModule.renderWorkersList === "function") {
        global.AttendanceModule.renderWorkersList();
      }
      if (global.AttendanceModule && typeof global.AttendanceModule.renderAdminAttendanceTable === "function") {
        global.AttendanceModule.renderAdminAttendanceTable();
      }
      if (global.AttendanceModule && typeof global.AttendanceModule.renderAdminKpis === "function") {
        global.AttendanceModule.renderAdminKpis();
      }
      if (global.AttendanceModule && typeof global.AttendanceModule.updateAnchorOfficeVisibility === "function") {
        global.AttendanceModule.updateAnchorOfficeVisibility();
      }
      if (global.AttendanceModule && typeof global.AttendanceModule.ensurePrivilegedSupervision === "function") {
        global.AttendanceModule.ensurePrivilegedSupervision(false);
      }
      if (global.app && typeof global.app.renderPersonal === "function") {
        global.app.renderPersonal();
      }
      if (global.alerts && typeof global.alerts.evaluateAlerts === "function") {
        global.alerts.evaluateAlerts();
      }
      if (global.kpiDashboard && typeof global.kpiDashboard.refresh === "function") {
        global.kpiDashboard.refresh();
      }
      if (global.app && typeof global.app.actualizarIndicadorNube === "function") {
        global.app.actualizarIndicadorNube("online", "Nube sincronizada");
      }
    } catch (_) {}
    return true;
  }

  global.PaoloCloudDataSync = {
    COLLECTIONS,
    getToken,
    setToken,
    clearToken,
    isEnabled,
    pullAndMerge,
    pushCollection,
    pushAllLocal,
    schedulePush,
    flushDirty,
    afterLogin
  };
})(typeof window !== "undefined" ? window : globalThis);
