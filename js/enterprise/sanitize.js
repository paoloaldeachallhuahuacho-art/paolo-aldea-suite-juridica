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

  /** Para literales JS dentro de atributos HTML onclick="..." */
  function jsStr(val) {
    return JSON.stringify(String(val ?? ""))
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;");
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
  // Siempre sobrescribe: evita que un app.js cacheado viejo deje jsStr sin &quot;.
  global.jsStr = jsStr;
})(typeof window !== "undefined" ? window : globalThis);
