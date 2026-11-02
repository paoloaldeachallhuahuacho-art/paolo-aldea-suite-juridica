/**
 * PAOLO ALDEA — Carga diferida de controllers (Semana 4 / P8)
 * Evita parsear los 7 controllers en el cold-start; se inyectan al entrar a la pestaña.
 */
(function (global) {
  const TAB_TO_CONTROLLER = {
    casos: { file: "js/controllers/cases.controller.js", globalName: "casesController", appKey: "cases" },
    caja_chica: { file: "js/controllers/pettycash.controller.js", globalName: "pettyCashController", appKey: "pettyCash" },
    presupuestos: { file: "js/controllers/budget.controller.js", globalName: "budgetController", appKey: "budget" },
    citas: { file: "js/controllers/calendar.controller.js", globalName: "calendarController", appKey: "calendar" },
    inventario: { file: "js/controllers/inventory.controller.js", globalName: "inventoryController", appKey: "inventory" },
    documentos: { file: "js/controllers/documents.controller.js", globalName: "documentsController", appKey: "documents" },
    master_admin: { file: "js/controllers/admin.controller.js", globalName: "adminController", appKey: "admin" },
    roles_permisos: { file: "js/controllers/admin.controller.js", globalName: "adminController", appKey: "admin" },
    personal: { file: "js/controllers/admin.controller.js", globalName: "adminController", appKey: "admin" }
  };

  const cache = new Map();
  const VERSION = "20261101_week4_arch";

  function injectScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-pa-controller="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === "1") return resolve();
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () => reject(new Error("fail " + src)));
        return;
      }
      const s = document.createElement("script");
      s.src = src + (src.includes("?") ? "&" : "?") + "v=" + VERSION;
      s.async = true;
      s.dataset.paController = src;
      s.onload = () => {
        s.dataset.loaded = "1";
        resolve();
      };
      s.onerror = () => reject(new Error("No se pudo cargar " + src));
      document.head.appendChild(s);
    });
  }

  async function ensureController(tabId) {
    const meta = TAB_TO_CONTROLLER[tabId];
    if (!meta) return null;

    if (global[meta.globalName]) {
      bindToApp(meta);
      return global[meta.globalName];
    }

    if (cache.has(meta.file)) {
      await cache.get(meta.file);
      bindToApp(meta);
      return global[meta.globalName] || null;
    }

    const job = injectScript(meta.file);
    cache.set(meta.file, job);
    try {
      await job;
    } catch (err) {
      cache.delete(meta.file);
      console.warn("[ControllerLoader]", err);
      return null;
    }
    bindToApp(meta);
    return global[meta.globalName] || null;
  }

  function bindToApp(meta) {
    const ctrl = global[meta.globalName];
    if (!ctrl || !global.app) return;
    global.app[meta.appKey] = ctrl;
    if (typeof ctrl.setContext === "function") ctrl.setContext(global.app);
  }

  global.PaoloControllerLoader = {
    ensure: ensureController,
    map: TAB_TO_CONTROLLER
  };
})(typeof window !== "undefined" ? window : globalThis);
