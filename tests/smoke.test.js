const { JSDOM, VirtualConsole } = require("jsdom");
const path = require("path");
const root = path.join(__dirname, "..");
const http = require("http"), fs = require("fs");
const types = { ".js":"application/javascript", ".html":"text/html", ".css":"text/css", ".json":"application/json" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]); const f = require("path").join(root, p === "/" ? "index.html" : p);
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, { "Content-Type": types[require("path").extname(f)] || "application/octet-stream" }); res.end(d); } });
}).listen(8765);
const errors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", e => errors.push("jsdomError: " + (e.detail && e.detail.message || e.message)));
vc.on("error", (...a) => errors.push("console.error: " + a.map(x => (x && x.stack) ? x.stack.split("\n").slice(0,5).join(" <- ") : String(x)).join(" ").slice(0, 700)));

JSDOM.fromURL("http://localhost:8765/index.html", {
  runScripts: "dangerously",
  resources: "usable",
  pretendToBeVisual: true,
  
  virtualConsole: vc,
  beforeParse(w) {
    w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
        (function(){
      const pepper = "STATIC_TEST_PEPPER_2026";
      const prefix = "PAOLO ALDEA_PAOLO_ALDEA_";
      const sig = "AUTH_SIG_" + require("crypto").createHash("sha256").update("WRK-000:super_admin:" + pepper).digest("hex").slice(0, 40);
      const userObj = JSON.stringify({ id: "WRK-000", rol: "super_admin", sede: "todas", nombre: "Super Administrador (Root Master)", usuario: "admin" });
      // Evitar que initSessionLifecycle trate el arranque de prueba como F5/reload
      if (w.performance) {
        w.performance.getEntriesByType = (t) => (t === "navigation" ? [{ type: "navigate" }] : []);
        if (w.performance.navigation) w.performance.navigation.type = 0;
      }
      w.localStorage.setItem("PA_SESSION_PEPPER", pepper);
      // Evitar purgas de arranque (head index.html + DataManager) que vacían la nómina de prueba
      w.localStorage.setItem("PAOLO_ALDEA_ZERO_KM_CLEAN_2026_EMPTY_PRODUCTION_V3", "true");
      w.localStorage.setItem(prefix + "PAOLO_ALDEA_ROOT_MASTER_CLEAN_2026_V2", "true");
      w.localStorage.setItem(prefix + "PROD_CLEAN_DATABASE_V3_100_PERCENT_EMPTY", "true");
      w.localStorage.setItem(prefix + "PAOLO_ALDEA_PURGED_CLEAN_2026_EMPTY_PRODUCTION_V3", "true");
      w.localStorage.setItem(prefix + "AUTH_CLEAN_SLATE_NO_DEFAULTS_V1", "true");
      w.localStorage.setItem(prefix + "workers", JSON.stringify([{
        id: "WRK-000",
        dni: "00000001",
        nombre: "Super Administrador (Root Master)",
        cargo: "Super Administrador",
        rol: "super_admin",
        usuario: "admin",
        username: "admin",
        passwordHash: "pbkdf2$210000$dGVzdA==$dGVzdA==",
        sede: "todas",
        activo: true
      }]));
      w.localStorage.setItem(prefix + "settings", JSON.stringify({
        authBootstrapped: true,
        adminUser: "admin",
        adminPasswordHash: "pbkdf2$210000$dGVzdA==$dGVzdA==",
        requireLogin: true
      }));
      ["localStorage", "sessionStorage"].forEach((store) => {
        w[store].setItem("PAOLO ALDEA_AUTH_LOGGED_IN", "true");
        w[store].setItem("PAOLO ALDEA_AUTH_USER", "Super Administrador (Root Master)");
        w[store].setItem("PAOLO ALDEA_AUTH_USER_OBJ", userObj);
        w[store].setItem("PAOLO ALDEA_AUTH_SIG", sig);
      });
      w.localStorage.setItem("PAOLO ALDEA_MASTER_UNLOCKED", "true");
    })();    w.scrollTo = () => {};
    w.HTMLCanvasElement.prototype.getContext = () => ({});
    w.fetch = (input) => {
      const s = String(typeof input === "string" ? input : (input && input.url) || "");
      if (/views\//.test(s) || /lib\//.test(s) || /js\/controllers\//.test(s)) {
        const abs = s.startsWith("http") ? s : `http://localhost:8765/${s.replace(/^\//, "")}`;
        return globalThis.fetch(abs);
      }
      return Promise.reject(new Error("offline"));
    };
    w.alert = () => {}; w.confirm = () => true; w.prompt = () => "";
    w.Notification = undefined;
    w.addEventListener("error", ev => errors.push("window.onerror: " + ev.message + " @" + (ev.filename || "").split("/").pop() + ":" + ev.lineno));
    w.addEventListener("unhandledrejection", ev => errors.push("unhandledrejection: " + (ev.reason && ev.reason.message)));
  }
}).then(dom => {
  const w = dom.window;
  setTimeout(async () => {
    if (w.db && w.db.ready) { try { await w.db.ready(); } catch (_) {} }
    if (w.app && w.app.init && !w.app.currentTab) { try { await w.app.init(); } catch (_) {} }
    const app = w.app; console.log("USER:", JSON.stringify(w.db.getCurrentUser()), "| ss keys:", Object.keys(w.sessionStorage).join(",")); console.log("TOASTS:", [...w.document.querySelectorAll("[id*=toast],.toast")].map(e=>e.textContent.trim().slice(0,120)).join(" || "));
    console.log("window.app:", !!app, "| currentTab:", app && app.currentTab);
    const checks = ["switchTab", "toggleMobileSidebar", "setupEventListeners", "compressImageDataUrl", "updateProfilePhotoUI", "handleProfilePhotoUpload", "removeProfilePhoto"];
    checks.forEach(m => console.log(" method", m, app && typeof app[m]));
    // Probar cada boton de navegacion
    const tabs = [...w.document.querySelectorAll(".nav-tab-btn")].map(b => b.dataset.tab);
    console.log("nav tabs:", tabs.join(","));
    const failedTabs = [];
    for (const t of tabs) {
      try {
        await app.switchTab(t);
        if (t !== "master_admin" && app.currentTab !== t) failedTabs.push(t);
        const v = w.document.getElementById("view-" + t);
        console.log(` tab ${t}: current=${app.currentTab} viewVisible=${v ? !v.classList.contains("hidden") : "NO-VIEW"}`);
      } catch (e) { failedTabs.push(t); console.log(` tab ${t}: EXCEPTION ${e.message}`); }
    }
    try { app.toggleMobileSidebar(true); app.toggleMobileSidebar(false); console.log("sidebar toggle ok"); } catch (e) { console.log("sidebar EXC", e.message); }
    console.log("\nERRORES CAPTURADOS (" + errors.length + "):");
    [...new Set(errors)].slice(0, 40).forEach(e => console.log(" - " + e));
    const real = [...new Set(errors)].filter(e => !/gstatic\.com|cdn\.jsdelivr|supabase-js|can't acquire context|Failed to create chart/.test(e));
    const badTabs = failedTabs;
    const missing = checks.filter(m => !app || typeof app[m] !== "function");
    const ok = !!app && real.length === 0 && badTabs.length === 0 && missing.length === 0;
    console.log(ok ? "\\nSMOKE TEST: OK" : "\\nSMOKE TEST: FALLO", { real, badTabs, missing });
    server.close(); process.exit(ok ? 0 : 1);
  }, 6000);
});








