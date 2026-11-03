/**
 * Config pública enterprise — fetch /api/public-config
 */
(function (global) {
  let cached = null;

  /** Ruta canónica Cloudflare. Alias legacy /.netlify/functions se mantiene en el worker. */
  function edgeUrl(name) {
    return "/api/" + String(name || "").replace(/^\//, "");
  }

  async function loadPublicConfig() {
    if (cached) return cached;
    try {
      const res = await fetch(edgeUrl("public-config"), { credentials: "same-origin" });
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

  global.PaoloEnterpriseConfig = { loadPublicConfig, isEnterprise, edgeUrl };
})(typeof window !== "undefined" ? window : globalThis);
