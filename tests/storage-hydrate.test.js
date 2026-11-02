/**
 * Regresión Semana 4+: stub localStorage + helpers XSS (jsStr / safeImageSrc).
 */
const { JSDOM, VirtualConsole } = require("jsdom");
const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const types = { ".js": "application/javascript", ".html": "text/html", ".css": "text/css", ".json": "application/json" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  const f = path.join(root, p === "/" ? "index.html" : p);
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); res.end(); }
    else { res.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream" }); res.end(d); }
  });
}).listen(0);

const port = () => server.address().port;
const vc = new VirtualConsole();
const fails = [];
const ok = (name, cond, extra) => { if (!cond) fails.push(name + (extra ? " -> " + extra : "")); };

JSDOM.fromURL("http://localhost:" + port() + "/index.html", {
  runScripts: "dangerously",
  resources: "usable",
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(w) {
    w.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} });
    w.HTMLCanvasElement.prototype.getContext = () => ({});
    w.fetch = (input) => {
      const s = String(typeof input === "string" ? input : (input && input.url) || "");
      if (/views\//.test(s) || /lib\//.test(s) || /js\//.test(s)) {
        const abs = s.startsWith("http") ? s : `http://localhost:${port()}/${s.replace(/^\//, "")}`;
        return globalThis.fetch(abs);
      }
      return Promise.reject(new Error("offline"));
    };
    w.alert = () => {};
    w.confirm = () => true;
    const prefix = "PAOLO ALDEA_PAOLO_ALDEA_";
    w.localStorage.setItem(prefix + "workers", JSON.stringify({
      _storedInIndexedDB: true,
      primary: "indexeddb",
      count: 1,
      updatedAt: Date.now()
    }));
    w.localStorage.setItem(prefix + "PAOLO_ALDEA_ROOT_MASTER_CLEAN_2026_V2", "true");
    w.localStorage.setItem(prefix + "PROD_CLEAN_DATABASE_V3_100_PERCENT_EMPTY", "true");
    w.localStorage.setItem(prefix + "AUTH_CLEAN_SLATE_NO_DEFAULTS_V1", "true");
    w.localStorage.setItem(prefix + "settings", JSON.stringify({ authBootstrapped: true, adminUser: "admin" }));
  }
}).then((dom) => setTimeout(async () => {
  const w = dom.window;
  try {
    if (!w.db) {
      console.log("STORAGE HYDRATE: FALLO");
      console.log(" - window.db no disponible");
      server.close();
      process.exit(1);
    }
    if (w.db.ready) await w.db.ready();

    const workers = w.db.getRaw("workers");
    ok("workers es array tras ready", Array.isArray(workers));
    ok("stub no rompe needsAuthBootstrap", typeof w.db.needsAuthBootstrap() === "boolean");
    ok("jsStr escapa comillas peligrosas", w.jsStr("x');alert(1)//") === JSON.stringify("x');alert(1)//"));
    ok("safeImageSrc bloquea onerror", w.safeImageSrc("\" onerror=\"alert(1)") === "");
    ok("safeImageSrc acepta data jpeg", /^data:image\/jpeg/i.test(w.safeImageSrc("data:image/jpeg;base64,abc=")));

    if (fails.length) {
      console.log("STORAGE HYDRATE: FALLO");
      fails.forEach((f) => console.log(" -", f));
      server.close();
      process.exit(1);
    }
    console.log("STORAGE HYDRATE: OK (" + (5 - fails.length) + "/5)");
    server.close();
    process.exit(0);
  } catch (e) {
    console.error(e);
    server.close();
    process.exit(1);
  }
}, 5000)).catch((e) => {
  console.error(e);
  server.close();
  process.exit(1);
});
