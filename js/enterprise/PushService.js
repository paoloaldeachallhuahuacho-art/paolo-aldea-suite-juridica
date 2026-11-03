/**
 * Web Push (VAPID) — suscripción por usuario/dispositivo.
 * Opt-in explícito; secrets solo en edge.
 */
(function (global) {
  const OPT_IN_KEY = "PA_WEBPUSH_OPT_IN";
  const SNOOZE_KEY = "PA_WEBPUSH_PROMPT_SNOOZE";
  const ACCEPTED_KEY = "PA_WEBPUSH_PROMPT_ACCEPTED";
  const SNOOZE_MS = 1000 * 60 * 60 * 24 * 2; // recordatorio cada ~2 días si rechaza

  function edgeUrl(name) {
    return global.PaoloEnterpriseConfig && typeof global.PaoloEnterpriseConfig.edgeUrl === "function"
      ? global.PaoloEnterpriseConfig.edgeUrl(name)
      : "/api/" + name;
  }

  function getSyncToken() {
    try {
      if (global.PaoloCloudDataSync && typeof global.PaoloCloudDataSync.getToken === "function") {
        const t = global.PaoloCloudDataSync.getToken();
        if (t) return t;
      }
      return sessionStorage.getItem("PA_SYNC_TOKEN") || localStorage.getItem("PA_SYNC_TOKEN") || "";
    } catch (_) {
      return "";
    }
  }

  function isOptedIn() {
    try {
      if (localStorage.getItem(OPT_IN_KEY) === "1") return true;
      const s = global.db && typeof global.db.getSettings === "function" ? global.db.getSettings() : null;
      return !!(s && s.webPushOptIn === true);
    } catch (_) {
      return false;
    }
  }

  function setOptIn(enabled) {
    try {
      localStorage.setItem(OPT_IN_KEY, enabled ? "1" : "0");
    } catch (_) {}
    if (global.db && typeof global.db.getSettings === "function" && typeof global.db.saveSettings === "function") {
      const s = global.db.getSettings() || {};
      s.webPushOptIn = !!enabled;
      global.db.saveSettings(s);
    }
  }

  function permissionState() {
    if (!("Notification" in global)) return "unsupported";
    return Notification.permission;
  }

  function getPermissionBanner() {
    return document.getElementById("webPushPermissionBanner");
  }

  function hidePermissionPrompt() {
    const el = getPermissionBanner();
    if (!el) return;
    el.classList.add("hidden");
    el.classList.remove("flex");
  }

  function showPermissionPrompt() {
    const el = getPermissionBanner();
    if (!el) return false;
    el.classList.remove("hidden");
    el.classList.add("flex");
    return true;
  }

  function wasAcceptedOnDevice() {
    try {
      if (localStorage.getItem(ACCEPTED_KEY) === "1") return true;
      if (permissionState() === "granted" && isOptedIn()) return true;
    } catch (_) {}
    return false;
  }

  function markAcceptedOnDevice() {
    try {
      localStorage.setItem(ACCEPTED_KEY, "1");
      localStorage.removeItem(SNOOZE_KEY);
    } catch (_) {}
    setOptIn(true);
  }

  function isPromptSnoozed() {
    try {
      const raw = localStorage.getItem(SNOOZE_KEY);
      if (!raw) return false;
      const until = Number(raw);
      return Number.isFinite(until) && Date.now() < until;
    } catch (_) {
      return false;
    }
  }

  function snoozePrompt() {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    } catch (_) {}
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  async function getVapidPublicKey() {
    const env = global.__ENV || {};
    if (env.vapidPublicKey) return env.vapidPublicKey;
    if (global.PaoloEnterpriseConfig && typeof global.PaoloEnterpriseConfig.loadPublicConfig === "function") {
      const cfg = await global.PaoloEnterpriseConfig.loadPublicConfig();
      return (cfg && cfg.vapidPublicKey) || "";
    }
    return "";
  }

  async function getRegistration() {
    if (!("serviceWorker" in navigator)) return null;
    try {
      return await navigator.serviceWorker.ready;
    } catch (_) {
      return null;
    }
  }

  async function currentSubscription() {
    const reg = await getRegistration();
    if (!reg || !reg.pushManager) return null;
    try {
      return await reg.pushManager.getSubscription();
    } catch (_) {
      return null;
    }
  }

  async function postJson(name, body) {
    const token = getSyncToken();
    if (!token) {
      const err = new Error("Sesión cloud (syncToken) requerida para Web Push.");
      err.status = 401;
      throw err;
    }
    const res = await fetch(edgeUrl(name), {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ ...body, syncToken: token })
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

  /**
   * Solicita permiso (si hace falta), suscribe PushManager y guarda en Supabase vía edge.
   */
  async function subscribe({ forcePermission = true } = {}) {
    if (!("serviceWorker" in navigator) || !("PushManager" in global)) {
      return { ok: false, reason: "unsupported" };
    }
    const vapidKey = await getVapidPublicKey();
    if (!vapidKey) {
      return { ok: false, reason: "vapid_missing" };
    }
    if (!getSyncToken()) {
      return { ok: false, reason: "no_session" };
    }

    if (Notification.permission === "denied") {
      return { ok: false, reason: "denied" };
    }
    if (Notification.permission !== "granted") {
      if (!forcePermission) return { ok: false, reason: "permission_needed" };
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return { ok: false, reason: perm || "denied" };
    }

    const reg = await getRegistration();
    if (!reg || !reg.pushManager) return { ok: false, reason: "no_sw" };

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey)
      });
    }

    const json = sub.toJSON();
    await postJson("push-subscribe", {
      endpoint: json.endpoint,
      keys: json.keys || {},
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : ""
    });
    markAcceptedOnDevice();
    hidePermissionPrompt();
    return { ok: true, endpoint: json.endpoint };
  }

  async function unsubscribe() {
    const sub = await currentSubscription();
    if (sub) {
      try {
        const json = sub.toJSON();
        if (json.endpoint && getSyncToken()) {
          await postJson("push-unsubscribe", { endpoint: json.endpoint });
        }
      } catch (e) {
        console.warn("[PushService] unsubscribe edge:", e && e.message);
      }
      try {
        await sub.unsubscribe();
      } catch (_) {}
    }
    setOptIn(false);
    return { ok: true };
  }

  function wirePermissionPromptOnce() {
    const accept = document.getElementById("btnAcceptWebPushPermission");
    const dismiss = document.getElementById("btnDismissWebPushPermission");
    if (accept && !accept.dataset.bound) {
      accept.dataset.bound = "1";
      accept.addEventListener("click", async () => {
        accept.disabled = true;
        try {
          const res = await subscribe({ forcePermission: true });
          hidePermissionPrompt();
          if (res && res.ok) {
            markAcceptedOnDevice();
            if (global.app && typeof global.app.showToast === "function") {
              global.app.showToast("Notificaciones activadas en este dispositivo.", "success");
            }
            if (global.app && typeof global.app.refreshWebPushStatus === "function") {
              global.app.refreshWebPushStatus();
            }
          } else {
            // Si el sistema denegó, no insistir en bucle; si solo canceló, recordar después.
            if (res && res.reason === "denied") snoozePrompt();
            if (global.app && typeof global.app.showToast === "function") {
              const map = {
                denied: "Permiso denegado. Actívelo en ajustes del navegador.",
                no_session: "Inicie sesión online primero.",
                unsupported: "Este dispositivo no soporta notificaciones push.",
                vapid_missing: "Servidor sin VAPID configurado."
              };
              global.app.showToast(map[res && res.reason] || "No se pudo activar el permiso.", "error");
            }
          }
        } finally {
          accept.disabled = false;
        }
      });
    }
    if (dismiss && !dismiss.dataset.bound) {
      dismiss.dataset.bound = "1";
      dismiss.addEventListener("click", () => {
        snoozePrompt();
        hidePermissionPrompt();
      });
    }
  }

  /**
   * Muestra una tarjeta tipo notificación in-app para pedir el permiso del sistema.
   * No dispara Notification.requestPermission hasta que el usuario pulse «Permitir».
   */
  async function maybeAskPermissionPrompt({ force = false } = {}) {
    wirePermissionPromptOnce();
    if (!("Notification" in global) || !("serviceWorker" in navigator) || !("PushManager" in global)) {
      hidePermissionPrompt();
      return { shown: false, reason: "unsupported" };
    }
    if (!getSyncToken()) return { shown: false, reason: "no_session" };

    // Ya aceptado en este dispositivo → nunca volver a mostrar
    if (wasAcceptedOnDevice()) {
      hidePermissionPrompt();
      return { shown: false, reason: "accepted" };
    }

    if (permissionState() === "denied") {
      hidePermissionPrompt();
      return { shown: false, reason: "denied" };
    }

    if (permissionState() === "granted") {
      const sub = await currentSubscription();
      if (sub) {
        markAcceptedOnDevice();
        hidePermissionPrompt();
        return { shown: false, reason: "already_subscribed" };
      }
      // Permiso ya dado pero falta registrar: hacerlo en silencio
      try {
        const res = await subscribe({ forcePermission: false });
        if (res && res.ok) {
          markAcceptedOnDevice();
          hidePermissionPrompt();
          return { shown: false, reason: "subscribed_silent" };
        }
      } catch (_) {}
    }

    if (!force && isPromptSnoozed()) {
      hidePermissionPrompt();
      return { shown: false, reason: "snoozed" };
    }

    const env = global.__ENV || {};
    let vapidReady = !!env.webPushReady || !!env.vapidPublicKey;
    if (!vapidReady) {
      try {
        const key = await getVapidPublicKey();
        vapidReady = !!key;
      } catch (_) {}
    }
    if (!vapidReady) return { shown: false, reason: "vapid_missing" };

    const shown = showPermissionPrompt();
    return { shown, reason: shown ? "prompt" : "no_dom" };
  }

  /**
   * Tras login: re-registrar si ya hay permiso; si no, mostrar aviso in-app.
   */
  async function ensureAfterLogin() {
    if (!getSyncToken()) return { ok: false, reason: "no_session" };

    if (wasAcceptedOnDevice() || (permissionState() === "granted" && isOptedIn())) {
      hidePermissionPrompt();
      try {
        const res = await subscribe({ forcePermission: false });
        if (res && res.ok) markAcceptedOnDevice();
        return res;
      } catch (e) {
        console.warn("[PushService] ensureAfterLogin:", e && e.message);
        return { ok: false, reason: "error", error: e && e.message };
      }
    }

    // Pedir permiso con tarjeta tipo notificación (recordatorio si rechazó antes)
    setTimeout(() => {
      maybeAskPermissionPrompt().catch(() => {});
    }, 1200);
    return { ok: false, reason: "prompt_scheduled" };
  }

  /**
   * Dispara envío remoto genérico (sin datos de expediente).
   * scope: self | branch | firm
   */
  async function sendRemote({ scope = "self", priority = "urgent", tag = "alerta-urgente", url } = {}) {
    if (!getSyncToken()) return { ok: false, reason: "no_session" };
    try {
      const data = await postJson("push-send", {
        scope,
        priority,
        tag,
        url: url || "./index.html?open=alerts"
      });
      return { ok: true, ...data };
    } catch (e) {
      return { ok: false, reason: "error", error: e && e.message, status: e && e.status };
    }
  }

  async function status() {
    const sub = await currentSubscription();
    return {
      supported: !!("serviceWorker" in navigator && "PushManager" in global && "Notification" in global),
      permission: permissionState(),
      optedIn: isOptedIn(),
      subscribed: !!sub,
      hasToken: !!getSyncToken(),
      vapidReady: !!(global.__ENV && global.__ENV.webPushReady)
    };
  }

  global.PaoloPushService = {
    isOptedIn,
    setOptIn,
    permissionState,
    subscribe,
    unsubscribe,
    ensureAfterLogin,
    maybeAskPermissionPrompt,
    hidePermissionPrompt,
    wasAcceptedOnDevice,
    markAcceptedOnDevice,
    sendRemote,
    status,
    currentSubscription
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => wirePermissionPromptOnce());
    } else {
      wirePermissionPromptOnce();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
