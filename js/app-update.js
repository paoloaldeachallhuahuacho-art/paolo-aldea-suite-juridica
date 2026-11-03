/**
 * Actualización de la PWA sin cortar el trabajo en curso.
 * El service worker descarga la versión nueva y espera.
 * El usuario aplica el cambio cuando termina lo que está haciendo.
 * Poll de version.json + banner institucional resumido.
 */
(function (global) {
  var APP_RELEASE = "2026.11.17";
  var DISMISS_KEY = "PA_UPDATE_DISMISSED";
  var APPLY_KEY = "PA_APPLY_UPDATE";
  var DISMISS_VERSION_KEY = "PA_UPDATE_DISMISS_VER";
  var registration = null;
  var reloading = false;
  var remoteMeta = null;

  function banner() {
    return document.getElementById("appUpdateBanner");
  }

  function bannerText() {
    return document.getElementById("appUpdateBannerText");
  }

  function bannerVersion() {
    return document.getElementById("appUpdateBannerVersion");
  }

  function bannerNotes() {
    return document.getElementById("appUpdateBannerNotes");
  }

  function wasDismissedFor(version) {
    try {
      if (sessionStorage.getItem(DISMISS_KEY) !== "1") return false;
      return sessionStorage.getItem(DISMISS_VERSION_KEY) === String(version || "");
    } catch (_) {
      return false;
    }
  }

  function markDismissed(version) {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
      sessionStorage.setItem(DISMISS_VERSION_KEY, String(version || APP_RELEASE));
    } catch (_) {}
  }

  function shortNote(note) {
    var s = String(note || "").trim();
    if (!s) return "";
    // Quitar jerga técnica para el aviso al usuario del despacho
    s = s
      .replace(/AUTH_SIG[^·]*/gi, "Mayor seguridad de acceso")
      .replace(/jwt_role[^·]*/gi, "Perfiles reforzados")
      .replace(/cases_safe[^·]*/gi, "")
      .replace(/DevTools[^·]*/gi, "")
      .replace(/Migración SQL[^·]*/gi, "Base de datos actualizada")
      .replace(/hashes de terceros/gi, "datos sensibles en login")
      .replace(/\s+/g, " ")
      .replace(/\s*[·|]\s*$/g, "")
      .trim();
    if (s.length > 52) s = s.slice(0, 49).trim() + "…";
    return s;
  }

  function formatBannerCopy(meta) {
    var ver = (meta && meta.version) || "nueva";
    var notes = meta && Array.isArray(meta.notes) ? meta.notes.map(shortNote).filter(Boolean) : [];
    return {
      versionLabel: "v" + ver,
      message: "Se reiniciará la sesión. Guarde su trabajo y actualice.",
      notesLine: notes.length ? notes.slice(0, 2).join(" · ") : ""
    };
  }

  function showBanner(meta) {
    var el = banner();
    if (!el) return;
    var ver = (meta && meta.version) || (remoteMeta && remoteMeta.version) || APP_RELEASE;
    if (wasDismissedFor(ver)) return;
    var copy = formatBannerCopy(meta || remoteMeta);
    var text = bannerText();
    var verEl = bannerVersion();
    var notesEl = bannerNotes();
    if (text) text.textContent = copy.message;
    if (verEl) verEl.textContent = copy.versionLabel;
    if (notesEl) {
      if (copy.notesLine) {
        notesEl.textContent = copy.notesLine;
        notesEl.classList.remove("hidden");
      } else {
        notesEl.textContent = "";
        notesEl.classList.add("hidden");
      }
    }
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
        markDismissed((remoteMeta && remoteMeta.version) || APP_RELEASE);
        hideBanner();
      });
    }
  }

  function applyUpdate() {
    try {
      sessionStorage.setItem(APPLY_KEY, "1");
      sessionStorage.removeItem(DISMISS_KEY);
      sessionStorage.removeItem(DISMISS_VERSION_KEY);
    } catch (_) {}
    hideBanner();
    if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
      return;
    }
    if (registration && typeof registration.update === "function") {
      registration.update().catch(function () {}).finally(function () {
        global.location.reload();
      });
      return;
    }
    global.location.reload();
  }

  function watchRegistration(reg) {
    registration = reg;
    if (!reg) return;
    if (reg.waiting && navigator.serviceWorker.controller) showBanner(remoteMeta);
    reg.addEventListener("updatefound", function () {
      var worker = reg.installing;
      if (!worker) return;
      worker.addEventListener("statechange", function () {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          showBanner(remoteMeta);
        }
      });
    });
  }

  function checkRemoteVersion() {
    return fetch("./version.json?ts=" + Date.now(), { cache: "no-store", credentials: "same-origin" })
      .then(function (res) {
        return res.ok ? res.json() : null;
      })
      .then(function (data) {
        if (!data || !data.version) return;
        remoteMeta = data;
        if (data.version !== APP_RELEASE) showBanner(data);
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
      try {
        apply = sessionStorage.getItem(APPLY_KEY) === "1";
      } catch (_) {}
      if (!apply || reloading) return;
      reloading = true;
      try {
        sessionStorage.removeItem(APPLY_KEY);
      } catch (_) {}
      global.location.reload();
    });

    navigator.serviceWorker
      .register("./sw.js")
      .then(function (reg) {
        watchRegistration(reg);
        reg.update().catch(function () {});
      })
      .catch(function (err) {
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
    }, 10 * 60 * 1000);
  }

  global.PaoloAppUpdate = {
    start: start,
    release: APP_RELEASE,
    applyUpdate: applyUpdate,
    checkRemoteVersion: checkRemoteVersion
  };
})(typeof window !== "undefined" ? window : globalThis);
