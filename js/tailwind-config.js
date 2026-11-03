/**
 * Tema Tailwind. Debe cargarse justo después de lib/tailwind.js
 * (asignar tailwind.config antes de que exista el runtime lanza ReferenceError).
 */
tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Source Sans 3"', "Segoe UI", "Helvetica Neue", "Arial", "sans-serif"],
        serif: ['"Libre Baskerville"', "Georgia", "Cambria", "Times New Roman", "serif"],
        mono: ['"IBM Plex Mono"', "Consolas", "Courier New", "monospace"],
        legal: ['"Libre Baskerville"', "Georgia", "serif"]
      },
      colors: {
        legal: {
          navy: "#141518",
          slate: "#1E293B",
          card: "#1E293B",
          gold: "#D97706",
          goldMuted: "#B45309",
          accent: "#334155"
        }
      }
    }
  }
};

(function () {
  var fonts = document.getElementById("paoloFonts");
  if (!fonts) return;
  var activate = function () { fonts.media = "all"; };
  if (fonts.sheet) activate();
  else fonts.addEventListener("load", activate);
})();
