/**
 * Arranque capa enterprise (solo si public-config.enterprise === true).
 */
(function (global) {
  function updateLoginModeBadge() {
    const cloud = !!global.__ENTERPRISE_CLOUD__;
    const textEl = document.getElementById("loginModeBadgeText");
    const iconEl = document.getElementById("loginModeBadgeIcon");
    if (textEl) {
      textEl.textContent = cloud
        ? "Modo Nube Multi-Sede (Supabase) — Sincronización activa"
        : "Modo Autónomo Local Offline — Sede Challhuahuacho";
    }
    if (iconEl) {
      iconEl.className = cloud
        ? "fa-solid fa-cloud text-sky-400 mr-1"
        : "fa-solid fa-shield-halved text-emerald-500 mr-1";
    }

    const topText = document.getElementById("topbarModeBadgeText");
    const topIcon = document.getElementById("topbarModeBadgeIcon");
    const topBadge = document.getElementById("topbarModeBadge");
    if (topText) topText.textContent = cloud ? "Nube Sync" : "100% Local";
    if (topIcon) {
      topIcon.className = cloud
        ? "fa-solid fa-cloud text-[8px]"
        : "fa-solid fa-shield-halved text-[8px]";
    }
    if (topBadge) {
      topBadge.title = cloud
        ? "Modo Nube Multi-Sede con sincronización Supabase"
        : "Operando localmente en su máquina sin requerir internet";
      topBadge.className = cloud
        ? "inline-flex items-center gap-1 text-[9px] sm:text-[9.5px] font-bold bg-sky-50 text-sky-800 border border-sky-300 px-1.5 py-0.2 rounded-full shrink-0 whitespace-nowrap"
        : "inline-flex items-center gap-1 text-[9px] sm:text-[9.5px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 px-1.5 py-0.2 rounded-full shrink-0 whitespace-nowrap";
    }
  }

  async function bootEnterprise() {
    try {
      if (global.PaoloErrorBoundary) global.PaoloErrorBoundary.install();
      if (!global.PaoloEnterpriseConfig) {
        updateLoginModeBadge();
        return false;
      }
      const cfg = await global.PaoloEnterpriseConfig.loadPublicConfig();
      if (!cfg.enterprise) {
        global.__ENTERPRISE_CLOUD__ = false;
        updateLoginModeBadge();
        return false;
      }
      global.__ENTERPRISE_CLOUD__ = true;
      if (typeof cfg.authBootstrapped === "boolean") {
        global.__CLOUD_AUTH_BOOTSTRAPPED__ = cfg.authBootstrapped;
      }
      if (global.PaoloAuthService) await global.PaoloAuthService.init();
      if (global.PaoloSyncManager) await global.PaoloSyncManager.start();
      updateLoginModeBadge();
      console.info("[PaoloEnterprise] Modo B zero-trust activo");
      return true;
    } catch (e) {
      console.warn("[PaoloEnterprise] No se pudo activar cloud; se mantiene Modo A local.", e);
      global.__ENTERPRISE_CLOUD__ = false;
      updateLoginModeBadge();
      return false;
    }
  }

  global.updateLoginModeBadge = updateLoginModeBadge;
  global.PaoloEnterprise = { boot: bootEnterprise, updateLoginModeBadge };
})(typeof window !== "undefined" ? window : globalThis);
