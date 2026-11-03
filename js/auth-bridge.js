/**
 * Puente de acceso. Vive en archivo externo porque el CSP bloquea scripts embebidos.
 * Los formularios se enganchan con addEventListener (no depende de onsubmit).
 */
(function () {
  var submitLock = false;

  window._ensureLegalApp = async function () {
    if (!window.app && typeof LegalApp === "function") {
      try {
        window.app = new LegalApp();
        await window.app.init();
      } catch (e) {
        console.error("Error al arrancar LegalApp bajo demanda:", e);
      }
    } else if (window.db && typeof window.db.ready === "function") {
      try { await window.db.ready(); } catch (_) {}
    }
    return window.app;
  };

  window.ejecutarResetSuperAdmin = async function (event) {
    if (event) event.preventDefault();
    const app = await window._ensureLegalApp();
    if (app && typeof app.resetSuperAdminAccess === "function") {
      await app.resetSuperAdminAccess(event);
    }
  };

  window.ejecutarAccesoDespacho = async function (event) {
    if (event) event.preventDefault();
    if (submitLock) return;
    submitLock = true;
    try {
      const app = await window._ensureLegalApp();
      if (app && typeof app.handleLogin === "function") {
        await app.handleLogin(event);
      } else {
        const errMsg = document.getElementById("loginErrorMessage");
        const errAlert = document.getElementById("loginErrorAlert");
        if (errMsg && errAlert) {
          errMsg.textContent = "Iniciando módulos del despacho. Por favor intente en un instante...";
          errAlert.classList.remove("hidden");
        }
      }
    } finally {
      submitLock = false;
    }
  };

  window.ejecutarBootstrapDespacho = async function (event) {
    if (event) event.preventDefault();
    if (submitLock) return;
    submitLock = true;
    try {
      const app = await window._ensureLegalApp();
      if (app && typeof app.completeAuthBootstrap === "function") {
        await app.completeAuthBootstrap(event);
      }
    } finally {
      submitLock = false;
    }
  };

  function bindAuthForms() {
    var login = document.getElementById("formLogin");
    if (login && !login.dataset.authBound) {
      login.dataset.authBound = "1";
      login.addEventListener("submit", function (event) {
        window.ejecutarAccesoDespacho(event);
      });
    }
    var boot = document.getElementById("formBootstrapAdmin");
    if (boot && !boot.dataset.authBound) {
      boot.dataset.authBound = "1";
      boot.addEventListener("submit", function (event) {
        window.ejecutarBootstrapDespacho(event);
      });
    }
  }

  function paintDate() {
    var dateEl = document.getElementById("currentDateStr");
    if (!dateEl) return;
    var now = new Date();
    var options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
    dateEl.textContent = now.toLocaleDateString("es-ES", options);
  }

  function registerServiceWorker() {
    if (window.PaoloAppUpdate && typeof window.PaoloAppUpdate.start === "function") {
      window.PaoloAppUpdate.start();
      return;
    }
    if (!("serviceWorker" in navigator)) return;
    if (window.location.protocol !== "http:" && window.location.protocol !== "https:") return;
    navigator.serviceWorker.register("sw.js").catch(function (err) {
      console.warn("SW registration skipped:", err);
    });
  }

  function start() {
    bindAuthForms();
    paintDate();
    registerServiceWorker();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
