/**
 * Arranque temprano (archivo externo: el CSP de producción bloquea <script> embebidos).
 * Purga residual, tema sin parpadeo y visibilidad de contraseñas.
 */
(function () {
  var CLEAN_TOKEN = "PAOLO_ALDEA_ZERO_KM_CLEAN_2026_EMPTY_PRODUCTION_V3";
  try {
    if (!localStorage.getItem(CLEAN_TOKEN)) {
      var existingCases = localStorage.getItem("PAOLO ALDEA_PAOLO_ALDEA_casos");
      if (existingCases && existingCases.length > 20) {
        localStorage.setItem(CLEAN_TOKEN, "true");
      } else {
        var prefix = "PAOLO ALDEA_PAOLO_ALDEA_";
        var keys = ["caja_chica", "casos", "citas", "inventario", "documentos", "presupuestos", "workers", "attendance", "auditoria"];
        keys.forEach(function (k) {
          localStorage.removeItem(prefix + k);
          localStorage.removeItem(prefix + k + "_BACKUP");
          localStorage.removeItem("PAOLO ALDEA_" + k);
        });
        if (window.indexedDB) {
          window.indexedDB.deleteDatabase("PaoloAldeaJuridicoDB");
        }
        if ("caches" in window) {
          caches.keys().then(function (names) {
            names.forEach(function (n) { caches.delete(n); });
          });
        }
        localStorage.setItem(CLEAN_TOKEN, "true");
        console.info("[Sistema] Despacho Cero Kilómetros inicializado en blanco.");
      }
    }
  } catch (e) {}

  try {
    var savedTheme = localStorage.getItem("PAOLO_ALDEA_THEME");
    var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  } catch (e) {}

  window.togglePasswordVisibility = function (inputId, iconId) {
    try {
      var input = document.getElementById(inputId);
      if (!input) return;
      var icon = document.getElementById(iconId || ("toggleIcon-" + inputId));
      if (input.type === "password") {
        input.type = "text";
        if (icon) {
          icon.classList.remove("fa-eye");
          icon.classList.add("fa-eye-slash");
        }
      } else {
        input.type = "password";
        if (icon) {
          icon.classList.remove("fa-eye-slash");
          icon.classList.add("fa-eye");
        }
      }
    } catch (err) {
      console.error("Error al alternar visibilidad de contraseña:", err);
    }
  };
})();
