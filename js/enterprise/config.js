/**
 * Config pública enterprise — fetch /.netlify/functions/public-config
 */
(function (global) {
  let cached = null;

  async function loadPublicConfig() {
    if (cached) return cached;
    try {
      const res = await fetch("/.netlify/functions/public-config", { credentials: "same-origin" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      cached = await res.json();
    } catch (_) {
      cached = { enterprise: false, supabaseUrl: null, supabaseAnonKey: null };
    }
    global.__ENV = cached;
    global.__ENTERPRISE_CLOUD__ = !!cached.enterprise;
    return cached;
  }

  function isEnterprise() {
    return !!(global.__ENTERPRISE_CLOUD__ || (cached && cached.enterprise));
  }

  global.PaoloEnterpriseConfig = { loadPublicConfig, isEnterprise };
})(typeof window !== "undefined" ? window : globalThis);
