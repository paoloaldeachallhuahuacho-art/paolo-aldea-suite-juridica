/**
 * AuthService — Supabase Auth + claims role/branch_id
 */
(function (global) {
  let client = null;
  let session = null;

  function getClient() {
    if (client) return client;
    const cfg = global.__ENV || {};
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) return null;
    if (!global.supabase || typeof global.supabase.createClient !== "function") {
      console.warn("[AuthService] supabase-js no cargado");
      return null;
    }
    client = global.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
    return client;
  }

  async function init() {
    const c = getClient();
    if (!c) return null;
    const { data } = await c.auth.getSession();
    session = data && data.session ? data.session : null;
    c.auth.onAuthStateChange((_evt, s) => { session = s; });
    return session;
  }

  async function signIn(email, password) {
    const c = getClient();
    if (!c) throw new Error("Supabase no configurado");
    const { data, error } = await c.auth.signInWithPassword({ email, password });
    if (error) throw error;
    session = data.session;
    return session;
  }

  async function signOut() {
    const c = getClient();
    if (c) await c.auth.signOut();
    session = null;
  }

  function getAccessToken() {
    return session && session.access_token ? session.access_token : null;
  }

  function getClaims() {
    const u = session && session.user;
    if (!u) return null;
    const meta = u.app_metadata || {};
    return {
      uid: u.id,
      email: u.email,
      role: meta.role || "abogado",
      branch_id: meta.branch_id || "challhuahuacho"
    };
  }

  function isSuperAdmin() {
    const c = getClaims();
    return !!(c && c.role === "super_admin");
  }

  /** Consulta si la firma ya tiene Super Admin en la nube (multi-dispositivo). */
  async function fetchFirmBootstrapped() {
    try {
      const res = await fetch("/.netlify/functions/auth-firm-status", { credentials: "same-origin" });
      if (!res.ok) return null;
      const data = await res.json();
      return !!(data && data.bootstrapped);
    } catch (_) {
      return null;
    }
  }

  async function pushCloudBootstrap(workerPayload) {
    const res = await fetch("/.netlify/functions/auth-bootstrap", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(workerPayload || {})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error((data && data.error) || ("HTTP " + res.status));
      err.status = res.status;
      err.body = data;
      throw err;
    }
    return data;
  }

  async function cloudLogin(usuario, password) {
    const res = await fetch("/.netlify/functions/auth-login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario, password })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error((data && data.error) || ("HTTP " + res.status));
      err.status = res.status;
      err.body = data;
      throw err;
    }
    return data;
  }

  async function upsertStaffCloud(workerPayload) {
    const res = await fetch("/.netlify/functions/auth-staff-upsert", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(workerPayload || {})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error((data && data.error) || ("HTTP " + res.status));
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function hydrateLocalWorkers(directory) {
    if (!global.db || !Array.isArray(directory) || !directory.length) return;
    const cleaned = directory.map((w) => global.db.sanitizeWorkerCredentials
      ? global.db.sanitizeWorkerCredentials(w)
      : w);
    global.db._trusted = true;
    try {
      global.db.save("workers", cleaned);
      const s = global.db.getSettings();
      s.authBootstrapped = true;
      const admin = cleaned.find((w) => w && (w.rol === "super_admin" || w.id === "WRK-000"));
      if (admin) {
        s.adminUser = admin.usuario || s.adminUser;
        if (admin.passwordHash) s.adminPasswordHash = admin.passwordHash;
      }
      global.db.saveSettings(s);
    } finally {
      global.db._trusted = false;
    }
  }

  global.PaoloAuthService = {
    init,
    signIn,
    signOut,
    getClient,
    getAccessToken,
    getClaims,
    isSuperAdmin,
    getSession: () => session,
    fetchFirmBootstrapped,
    pushCloudBootstrap,
    cloudLogin,
    upsertStaffCloud,
    hydrateLocalWorkers
  };
})(typeof window !== "undefined" ? window : globalThis);
