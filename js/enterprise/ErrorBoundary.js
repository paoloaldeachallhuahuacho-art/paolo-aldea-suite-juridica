/**
 * Manejadores globales de error — toasts no bloqueantes + log.
 */
(function (global) {
  const recent = new Set();

  function report(kind, message, detail) {
    const key = kind + ":" + String(message).slice(0, 120);
    if (recent.has(key)) return;
    recent.add(key);
    setTimeout(() => recent.delete(key), 8000);

    console.error("[PaoloErrorBoundary]", kind, message, detail || "");
    if (global.app && typeof global.app.showToast === "function") {
      global.app.showToast("Se produjo un error recuperable. La operación se reintentará o puede continuar.", "warning");
    }
    try {
      const buf = JSON.parse(sessionStorage.getItem("PA_TELEMETRY_ERRORS") || "[]");
      buf.push({ t: Date.now(), kind, message: String(message).slice(0, 300) });
      sessionStorage.setItem("PA_TELEMETRY_ERRORS", JSON.stringify(buf.slice(-40)));
    } catch (_) {}
  }

  function install() {
    if (global.__PA_ERROR_BOUNDARY__) return;
    global.__PA_ERROR_BOUNDARY__ = true;
    global.addEventListener("error", (ev) => {
      report("onerror", ev.message || "Error", (ev.filename || "") + ":" + (ev.lineno || ""));
    });
    global.addEventListener("unhandledrejection", (ev) => {
      const reason = ev.reason;
      const msg = reason && reason.message ? reason.message : String(reason || "rejection");
      report("unhandledrejection", msg);
      if (ev.preventDefault) ev.preventDefault();
    });
  }

  global.PaoloErrorBoundary = { install, report };
  install();
})(typeof window !== "undefined" ? window : globalThis);
