/**
 * Sanitización XSS — dual-mode (DOMPurify si está cargado; fallback escapeHtml).
 */
(function (global) {
  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function jsStr(val) {
    return JSON.stringify(String(val ?? ""));
  }

  function sanitizeHtml(dirty) {
    if (dirty == null) return "";
    if (global.DOMPurify && typeof global.DOMPurify.sanitize === "function") {
      return global.DOMPurify.sanitize(String(dirty), {
        USE_PROFILES: { html: true },
        FORBID_TAGS: ["script", "iframe", "object", "embed"],
        FORBID_ATTR: ["onerror", "onclick", "onload"]
      });
    }
    return escapeHtml(dirty);
  }

  global.PaoloSanitize = { escapeHtml, jsStr, sanitizeHtml };
  if (!global.escapeHtml) global.escapeHtml = escapeHtml;
  if (!global.jsStr) global.jsStr = jsStr;
})(typeof window !== "undefined" ? window : globalThis);
