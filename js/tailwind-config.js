/**
 * Tema Tailwind. Debe cargarse justo después de lib/tailwind.js
 * (asignar tailwind.config antes de que exista el runtime lanza ReferenceError).
 */
tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        legal: {
          navy: "#0B132B",
          slate: "#1C2541",
          card: "#132247",
          gold: "#C5A059",
          goldMuted: "#997B28",
          accent: "#3A506B"
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
