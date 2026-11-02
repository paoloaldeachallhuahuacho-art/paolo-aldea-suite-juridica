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

  global.PaoloAuthService = {
    init, signIn, signOut, getClient, getAccessToken, getClaims, isSuperAdmin, getSession: () => session
  };
})(typeof window !== "undefined" ? window : globalThis);
