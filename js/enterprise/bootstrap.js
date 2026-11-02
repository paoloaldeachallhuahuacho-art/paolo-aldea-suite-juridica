/**
 * Arranque capa enterprise (solo si public-config.enterprise === true).
 */
(function (global) {
  async function bootEnterprise() {
    try {
      if (global.PaoloErrorBoundary) global.PaoloErrorBoundary.install();
      if (!global.PaoloEnterpriseConfig) return false;
      const cfg = await global.PaoloEnterpriseConfig.loadPublicConfig();
      if (!cfg.enterprise) {
        global.__ENTERPRISE_CLOUD__ = false;
        return false;
      }
      global.__ENTERPRISE_CLOUD__ = true;
      if (typeof cfg.authBootstrapped === "boolean") {
        global.__CLOUD_AUTH_BOOTSTRAPPED__ = cfg.authBootstrapped;
      }
      if (global.PaoloAuthService) await global.PaoloAuthService.init();
      if (global.PaoloSyncManager) await global.PaoloSyncManager.start();
      console.info("[PaoloEnterprise] Modo B zero-trust activo");
      return true;
    } catch (e) {
      console.warn("[PaoloEnterprise] No se pudo activar cloud; se mantiene Modo A local.", e);
      global.__ENTERPRISE_CLOUD__ = false;
      return false;
    }
  }

  global.PaoloEnterprise = { boot: bootEnterprise };
})(typeof window !== "undefined" ? window : globalThis);
