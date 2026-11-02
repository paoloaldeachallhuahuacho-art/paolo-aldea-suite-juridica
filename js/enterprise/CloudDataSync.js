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

  function lwwMergeLists(localList, remoteList) {
    const map = new Map();
    const ts = (r) => Date.parse(r && (r.server_ts || r.updatedAt || r.updated_at || r.createdAt || 0)) || 0;
    (localList || []).forEach((r) => {
      if (r && r.id != null) map.set(String(r.id), r);
    });
    (remoteList || []).forEach((r) => {
      if (!r || r.id == null) return;
      const id = String(r.id);
      const cur = map.get(id);
      if (!cur || ts(r) >= ts(cur)) map.set(id, r);
    });
    return Array.from(map.values());
  }

  async function pullAndMerge() {
    if (!global.__ENTERPRISE_CLOUD__) return null;
    const token = getToken();
    if (!token) return null;
    const res = await fetch("/.netlify/functions/sync-pull", {
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
        const merged = lwwMergeLists(local, remote);
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
    const records = global.db.getRaw(collection) || [];
    const res = await fetch("/.netlify/functions/sync-push", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ syncToken: token, collection, records })
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

  /** Tras login: guardar token, bajar nube y subir lo local. */
  async function afterLogin(syncToken) {
    if (syncToken) setToken(syncToken);
    if (!getToken()) return false;
    try {
      await pullAndMerge();
    } catch (e) {
      console.warn("[CloudDataSync] pull:", e && e.message);
    }
    try {
      await pushAllLocal();
    } catch (e) {
      console.warn("[CloudDataSync] push:", e && e.message);
    }
    if (global.app && typeof global.app.refreshCurrentModuleView === "function") {
      try {
        global.app.refreshCurrentModuleView();
      } catch (_) {}
    }
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
