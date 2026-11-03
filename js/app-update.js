/**
 * Actualización de la PWA sin cortar el trabajo en curso.
 * El service worker descarga la versión nueva y espera.
 * El usuario aplica el cambio cuando termina lo que está haciendo.
 */
(function (global) {
  var APP_RELEASE = "2026.11.06";
  var DISMISS_KEY = "PA_UPDATE_DISMISSED";
  var APPLY_KEY = "PA_APPLY_UPDATE";
  var registration = null;
  var reloading = false;

  function banner() {
    return document.getElementById("appUpdateBanner");
  }

  function showBanner() {
    var el = banner();
    if (!el) return;
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") return;
    } catch (_) {}
    el.classList.remove("hidden");
    el.classList.add("flex");
  }

  function hideBanner() {
    var el = banner();
    if (!el) return;
    el.classList.add("hidden");
    el.classList.remove("flex");
  }

  function bindBanner() {
    var apply = document.getElementById("btnApplyAppUpdate");
    var later = document.getElementById("btnDismissAppUpdate");
    if (apply && !apply.dataset.bound) {
      apply.dataset.bound = "1";
      apply.addEventListener("click", applyUpdate);
    }
    if (later && !later.dataset.bound) {
      later.dataset.bound = "1";
      later.addEventListener("click", function () {
        try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch (_) {}
        hideBanner();
      });
    }
  }

  function applyUpdate() {
    try { sessionStorage.setItem(APPLY_KEY, "1"); } catch (_) {}
    hideBanner();
    if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
      return;
    }
    global.location.reload();
  }

  function watchRegistration(reg) {
    registration = reg;
    if (!reg) return;
    if (reg.waiting && navigator.serviceWorker.controller) showBanner();
    reg.addEventListener("updatefound", function () {
      var worker = reg.installing;
      if (!worker) return;
      worker.addEventListener("statechange", function () {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          showBanner();
        }
      });
    });
  }

  function checkRemoteVersion() {
    return fetch("./version.json?ts=" + Date.now(), { cache: "no-store", credentials: "same-origin" })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (data && data.version && data.version !== APP_RELEASE) showBanner();
      })
      .catch(function () {});
  }

  function start() {
    bindBanner();
    if (!("serviceWorker" in navigator)) {
      checkRemoteVersion();
      return;
    }
    if (global.location.protocol !== "http:" && global.location.protocol !== "https:") return;

    navigator.serviceWorker.addEventListener("controllerchange", function () {
      var apply = false;
      try { apply = sessionStorage.getItem(APPLY_KEY) === "1"; } catch (_) {}
      if (!apply || reloading) return;
      reloading = true;
      try { sessionStorage.removeItem(APPLY_KEY); } catch (_) {}
      global.location.reload();
    });

    navigator.serviceWorker.register("./sw.js").then(function (reg) {
      watchRegistration(reg);
      reg.update().catch(function () {});
    }).catch(function (err) {
      console.warn("Service Worker:", err && err.message ? err.message : err);
    });

    checkRemoteVersion();
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState !== "visible") return;
      if (registration && registration.update) registration.update().catch(function () {});
      checkRemoteVersion();
    });
    setInterval(function () {
      if (registration && registration.update) registration.update().catch(function () {});
      checkRemoteVersion();
    }, 15 * 60 * 1000);
  }

  global.PaoloAppUpdate = { start: start, release: APP_RELEASE, applyUpdate: applyUpdate };
})(typeof window !== "undefined" ? window : globalThis);
