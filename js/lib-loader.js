/**
 * PAOLO ALDEA — Carga diferida de librerías pesadas (Semana 3 / P2)
 * Chart.js, ExcelJS, FileSaver y html2pdf solo se descargan al usarse.
 */
(function (global) {
  const cache = new Map();

  const LOCAL = {
    chart: "lib/chart.min.js",
    exceljs: "lib/exceljs.min.js",
    filesaver: "lib/FileSaver.min.js",
    html2pdf: "lib/html2pdf.bundle.min.js"
  };

  const CDN = {
    chart: "https://cdn.jsdelivr.net/npm/chart.js",
    exceljs: "https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js",
    filesaver: "https://cdn.jsdelivr.net/npm/file-saver@2.0.5/dist/FileSaver.min.js",
    html2pdf: "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"
  };

  function isReady(name) {
    if (name === "chart") return typeof global.Chart !== "undefined";
    if (name === "exceljs") return typeof global.ExcelJS !== "undefined";
    if (name === "filesaver") return typeof global.saveAs === "function";
    if (name === "html2pdf") return typeof global.html2pdf !== "undefined";
    return false;
  }

  function injectScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-pa-lib="${src}"]`);
      if (existing) {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () => reject(new Error("fail " + src)));
        if (existing.dataset.loaded === "1") resolve();
        return;
      }
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.dataset.paLib = src;
      s.onload = () => {
        s.dataset.loaded = "1";
        resolve();
      };
      s.onerror = () => reject(new Error("No se pudo cargar " + src));
      document.head.appendChild(s);
    });
  }

  async function loadOne(name) {
    if (isReady(name)) return true;
    if (cache.has(name)) return cache.get(name);

    const job = (async () => {
      try {
        await injectScript(LOCAL[name]);
        if (isReady(name)) return true;
      } catch (_) {}
      if (navigator.onLine && CDN[name]) {
        await injectScript(CDN[name]);
      }
      if (!isReady(name)) throw new Error("Librería no disponible: " + name);
      return true;
    })();

    cache.set(name, job);
    try {
      return await job;
    } catch (e) {
      cache.delete(name);
      throw e;
    }
  }

  global.PaoloLibLoader = {
    loadChart: () => loadOne("chart"),
    loadExcel: () => Promise.all([loadOne("exceljs"), loadOne("filesaver")]),
    loadPdf: () => loadOne("html2pdf"),
    load: loadOne
  };
})(typeof window !== "undefined" ? window : globalThis);
