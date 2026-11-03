/**
 * Zero-Trust dual-mode — tests sin Supabase real.
 * 1) LWW / budget centavos
 * 2) Enterprise off por defecto en smoke DOM
 */
const { JSDOM, VirtualConsole } = require("jsdom");
const http = require("http");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
let fails = 0;
const ok = (name, cond, extra) => {
  if (!cond) {
    fails++;
    console.log("FALLO", name, extra || "");
  } else {
    console.log("OK   ", name);
  }
};

// --- Unit: load BudgetAnalytics + SyncManager lww in vm ---
function loadEnterpriseHelpers() {
  const sandbox = {
    window: {},
    console,
    indexedDB: undefined,
    setTimeout,
    clearTimeout,
    Date,
    Math,
    JSON,
    navigator: { onLine: true },
    addEventListener() {}
  };
  sandbox.global = sandbox;
  sandbox.window = sandbox;
  const files = [
    "js/enterprise/BudgetAnalytics.js",
    "js/enterprise/SyncManager.js",
    "js/enterprise/CloudDataSync.js"
  ];
  for (const f of files) {
    const code = fs.readFileSync(path.join(root, f), "utf8");
    vm.runInNewContext(code, sandbox, { filename: f });
  }
  return sandbox;
}

const g = loadEnterpriseHelpers();
const BA = g.PaoloBudgetAnalytics;
const SM = g.PaoloSyncManager;
const CDS = g.PaoloCloudDataSync;

ok("CloudDataSync expuesto", !!(CDS && Array.isArray(CDS.COLLECTIONS) && CDS.COLLECTIONS.includes("casos")));
ok("BudgetAnalytics.safeDiv /0 → 0", BA.safeDiv(100, 0) === 0);
ok("utilization 50% → 5000 bps", BA.utilizationBps(50, 100) === 5000);
ok("remaining no negativo", BA.remainingCentavos(10, 40) === 0);
ok("projected month centavos", BA.projectedMonthCentavos(100, 10, 30) === 300);

const older = { id: "1", server_ts: "2026-01-01T00:00:00.000Z", v: "old" };
const newer = { id: "1", server_ts: "2026-06-01T00:00:00.000Z", v: "new" };
ok("LWW elige server_ts mayor", SM.lwwMerge(older, newer).v === "new");
ok("LWW conserva local si es más nuevo", SM.lwwMerge(newer, older).v === "new");
ok("mapLegacyWorkflow aprobado→disbursed", SM.mapLegacyWorkflow("aprobado") === "disbursed");

// --- DOM: enterprise off without public-config ---
const types = { ".js": "application/javascript", ".html": "text/html", ".css": "text/css", ".json": "application/json" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  if (p.includes("public-config")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ enterprise: false }));
    return;
  }
  const f = path.join(root, p === "/" ? "index.html" : p);
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); res.end(); }
    else { res.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream" }); res.end(d); }
  });
}).listen(0);

const port = () => server.address().port;
const vc = new VirtualConsole();

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
      if (/public-config/.test(s)) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ enterprise: false })
        });
      }
      if (/views\/|lib\/|js\//.test(s)) {
        const abs = s.startsWith("http") ? s : `http://localhost:${port()}/${s.replace(/^\//, "")}`;
        return globalThis.fetch(abs);
      }
      return Promise.reject(new Error("offline"));
    };
    w.alert = () => {};
    w.confirm = () => true;
  }
}).then((dom) => setTimeout(async () => {
  const w = dom.window;
  try {
    if (w.PaoloEnterprise && w.PaoloEnterprise.boot) {
      const on = await w.PaoloEnterprise.boot();
      ok("enterprise boot → false sin credenciales", on === false);
    } else {
      ok("enterprise bootstrap presente", false, "PaoloEnterprise missing");
    }
    ok("__ENTERPRISE_CLOUD__ false", w.__ENTERPRISE_CLOUD__ === false);
    ok("db local sigue disponible", !!w.db);
  } catch (e) {
    ok("enterprise DOM sin excepción", false, e.message);
  }
  if (fails) {
    console.log("\nENTERPRISE-ZT: FALLO (" + fails + ")");
    server.close();
    process.exit(1);
  }
  console.log("\nENTERPRISE-ZT: OK");
  server.close();
  process.exit(0);
}, 5000)).catch((e) => {
  console.error(e);
  server.close();
  process.exit(1);
});
