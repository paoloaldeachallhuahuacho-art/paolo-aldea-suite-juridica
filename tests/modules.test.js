/* Simulacion por apartado: crea datos reales, renderiza vistas, edita, elimina y exporta; comprueba cifras y RBAC en la interfaz. */
const { JSDOM, VirtualConsole } = require("jsdom");
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const types = { ".js": "application/javascript", ".html": "text/html", ".css": "text/css", ".json": "application/json" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  const f = path.join(root, p === "/" ? "index.html" : p);
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream" }); res.end(d); } });
}).listen(0);

const out = []; let fails = 0;
const ok = (area, name, cond, extra) => { out.push(`${cond ? "OK   " : "FALLO"} [${area}] ${name}${!cond && extra ? " -> " + extra : ""}`); if (!cond) fails++; };
const errors = [];
const vc = new VirtualConsole(); vc.on("jsdomError", e => errors.push(String(e.detail && e.detail.message || e.message)));

JSDOM.fromURL("http://localhost:" + server.address().port + "/index.html", {
  runScripts: "dangerously", resources: "usable", pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(w) {
    w.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} });
    w.HTMLCanvasElement.prototype.getContext = () => ({});
    const port = server.address().port;
    w.fetch = (input) => {
      const s = String(typeof input === "string" ? input : (input && input.url) || "");
      if (/views\//.test(s) || /lib\//.test(s)) {
        const abs = s.startsWith("http") ? s : `http://localhost:${port}/${s.replace(/^\//, "")}`;
        return globalThis.fetch(abs);
      }
      return Promise.reject(new Error("offline"));
    };
    w.alert = () => {}; w.confirm = () => true; w.prompt = () => "";
    w.URL.createObjectURL = () => "blob:x"; w.URL.revokeObjectURL = () => {};
    w.addEventListener("error", ev => errors.push("onerror: " + ev.message + " @" + (ev.filename || "").split("/").pop() + ":" + ev.lineno));
  }
}).then(dom => setTimeout(async () => {
  const w = dom.window, db = w.db, app = w.app, doc = w.document;
  let current = { id: "WRK-000", rol: "super_admin", sede: "todas", nombre: "Super Admin" };
  db.getCurrentUser = () => current;
  const toasts = []; app.showToast = (m, t) => toasts.push([t, m]);
  const text = id => (doc.getElementById(id) || {}).textContent || "";
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const guard = async (area, fn) => { try { await fn(); } catch (e) { ok(area, "sin excepciones", false, e.stack.split("\n").slice(0, 3).join(" | ")); } };

  // ---------- CAJA CHICA ----------
  await guard("caja_chica", async () => {
    db.add("caja_chica", { id: "CC-1", tipo: "Ingreso", concepto: "Fondo", monto: 1000, categoria: "Fondo", fecha: "2026-11-01", centroCosto: "CC-ADM" });
    db.add("caja_chica", { id: "CC-2", tipo: "Egreso", concepto: "Papeleria", monto: 250.55, categoria: "Oficina", fecha: "2026-11-01", centroCosto: "CC-ADM" });
    db.add("caja_chica", { id: "CC-3", tipo: "Egreso", concepto: "Pasajes", monto: 49.45, categoria: "Movilidad", fecha: "2026-11-01", centroCosto: "CC-LIT" });
    await app.switchTab("caja_chica");
    ok("caja_chica", "saldo = ingresos - egresos (1000 - 300.00 = 700.00)", /700\.00/.test(text("cajaSummarySaldo")), text("cajaSummarySaldo"));
    ok("caja_chica", "tabla muestra 3 movimientos", /3 registros/.test(text("cajaSummaryCount")), text("cajaSummaryCount"));
    db.update("caja_chica", "CC-2", { monto: 100 });
    app.renderCajaChica();
    ok("caja_chica", "editar recalcula saldo (850.00 - 49.45 = 850.55)", /850\.55/.test(text("cajaSummarySaldo")), text("cajaSummarySaldo"));
    app.deleteCajaItem("CC-3"); app.renderCajaChica();
    ok("caja_chica", "eliminar quita el registro", !db.getRaw("caja_chica").some(x => x.id === "CC-3"));
  });

  // ---------- CASOS ----------
  await guard("casos", async () => {
    db.add("casos", { id: "CAS-1", expediente: "00123-2026-0-0101-JR-CI-01", caratula: "Perez vs Lopez", cliente: "Perez", materia: "Civil", estado: "En trÃ¡mite", juzgado: "1er Juzgado", fechaInicio: "2026-10-01" });
    await app.switchTab("casos");
    ok("casos", "expediente visible en la tabla", /00123-2026/.test(doc.getElementById("view-casos").textContent));
    db.update("casos", "CAS-1", { estado: "Archivado" });
    ok("casos", "editar persiste", db.getRaw("casos").find(c => c.id === "CAS-1").estado === "Archivado");
    await app.deleteCaso("CAS-1");
    ok("casos", "eliminar quita el expediente", !db.getRaw("casos").some(c => c.id === "CAS-1"));
  });

  // ---------- CITAS ----------
  await guard("citas", async () => {
    db.add("citas", { id: "CIT-1", cliente: "Maria", motivo: "Audiencia", fechaHora: "2026-11-05T09:00", tipo: "Audiencia", estado: "Programada" });
    await app.switchTab("citas");
    ok("citas", "cita visible", /Maria/.test(doc.getElementById("view-citas").textContent));
    app.deleteCita("CIT-1");
    ok("citas", "eliminar cita", !db.getRaw("citas").some(c => c.id === "CIT-1"));
  });

  // ---------- PRESUPUESTOS ----------
  await guard("presupuestos", async () => {
    db.add("presupuestos", { id: "CH-CC-LIT-63-001", concepto: "Gastos de litigio", categoria: "Litigio", tipo: "Egreso", montoPresupuestado: 5000, centroCosto: "CC-LIT", clasePcge: "63", correlativo: 1 });
    await app.switchTab("presupuestos");
    ok("presupuestos", "partida visible", /litigio/i.test(doc.getElementById("view-presupuestos").textContent));
    app.deletePresupuesto("CH-CC-LIT-63-001");
    ok("presupuestos", "eliminar partida", !db.getRaw("presupuestos").some(p => p.id.startsWith("CH-CC-LIT-63-001")));
  });

  // ---------- INVENTARIO ----------
  await guard("inventario", async () => {
    db.add("inventario", { id: "INV-1", nombre: "Laptop", categoria: "Equipos", cantidad: 2, costoUnitario: 3000, stock: 2 });
    await app.switchTab("inventario");
    ok("inventario", "activo visible", /Laptop/.test(doc.getElementById("view-inventario").textContent));
    app.deleteInventario("INV-1");
    ok("inventario", "eliminar activo", !db.getRaw("inventario").some(i => i.id === "INV-1"));
  });

  // ---------- DOCUMENTOS ----------
  await guard("documentos", async () => {
    db.add("documentos", { id: "DOC-1", titulo: "Demanda", tipo: "Escrito", fecha: "2026-11-01" });
    await app.switchTab("documentos");
    ok("documentos", "documento visible", /Demanda/.test(doc.getElementById("view-documentos").textContent));
    app.deleteDocument("DOC-1");
    ok("documentos", "eliminar documento", !db.getRaw("documentos").some(d => d.id === "DOC-1"));
  });

  // ---------- PERSONAL / ROLES / ASISTENCIA / KPIs / MASTER ----------
  await guard("personal", async () => {
    db.add("workers", { id: "WRK-100", nombre: "Ana Torres", dni: "12345678", rol: "abogado", cargo: "Abogada", sede: "cusco", activo: true, permisos: db.getDefaultPermissionsForRole("abogado") });
    await app.switchTab("personal");
    ok("personal", "colaborador visible", /Ana Torres/.test(doc.getElementById("view-personal").textContent));
    await app.switchTab("roles_permisos");
    ok("roles_permisos", "vista de roles renderiza", doc.getElementById("view-roles_permisos").textContent.length > 200);
  });
  await guard("asistencia", async () => { await app.switchTab("asistencia"); ok("asistencia", "modulo inicializa", !!w.AttendanceModule); });
  await guard("kpis", async () => { await app.switchTab("kpis"); await sleep(200); ok("kpis", "dashboard inicializa", !!w.kpiDashboard); });
  await guard("master_admin", async () => {
    w.sessionStorage.setItem("PAOLO ALDEA_MASTER_UNLOCKED", "true");
    await app.switchTab("master_admin");
    ok("master_admin", "panel accesible solo tras desbloqueo", app.currentTab === "master_admin");
    ok("master_admin", "tablas RBAC/sedes renderizan", doc.getElementById("view-master_admin").textContent.length > 500);
  });

  // ---------- EXPORTACION ----------
  await guard("exportacion", async () => {
    if (w.PaoloLibLoader) {
      try { await w.PaoloLibLoader.loadExcel(); } catch (_) {}
    }
    ok("exportacion", "exportador listo (ExcelJS lazy)", !!w.excelExporter && typeof w.ExcelJS !== "undefined");
    if (w.ExcelJS && w.excelExporter) {
      db.add("caja_chica", { id: "CCX-1", tipo: "Egreso", concepto: "=HYPERLINK(\"http://x\",\"a\")", monto: 12.5, categoria: "Test", fecha: "2026-11-01" });
      const wb = new w.ExcelJS.Workbook();
      w.excelExporter.buildCajaChicaSheet(wb); w.excelExporter.sanitizeWorkbookBeforeExport(wb);
      const ws = wb.worksheets[0];
      let found = null; ws.eachRow(r => r.eachCell(c => { if (typeof c.value === "string" && c.value.includes("HYPERLINK")) found = c.value; }));
      ok("exportacion", "Excel: hoja de caja chica generada", !!ws && ws.rowCount > 1);
      ok("exportacion", "Excel: formulas inyectadas quedan neutralizadas", found === null || found.startsWith("'"), String(found));
    }
  });

  // ---------- RBAC EN INTERFAZ ----------
  await guard("rbac-ui", async () => {
    current = { id: "WRK-AB", rol: "abogado", sede: "challhuahuacho", nombre: "Abg", permisos: db.getDefaultPermissionsForRole("abogado") };
    current = { ...current };
    db.getCurrentUser = () => current;
    const before = toasts.length;
    await app.switchTab("kpis");
    await app.switchTab("master_admin");
    ok("rbac-ui", "abogado no entra al panel Master", app.currentTab !== "master_admin");
    await app.switchTab("roles_permisos");
    ok("rbac-ui", "abogado no entra a Roles y Permisos", app.currentTab !== "roles_permisos");
    await app.exportModule("presupuestos");
    ok("rbac-ui", "abogado no exporta presupuestos", toasts.slice(before).some(t => /exportar/.test(t[1])));
    current = { id: "WRK-AL", rol: "asistente_legal", sede: "challhuahuacho", nombre: "Asist", permisos: db.getDefaultPermissionsForRole("asistente_legal") };
    db.getCurrentUser = () => current;
    // semilla por super admin y render como asistente
    const sa = { id: "WRK-000", rol: "super_admin", sede: "todas" }; const tmp = current; current = sa; db.getCurrentUser = () => current;
    db.add("casos", { id: "CAS-UI", expediente: "777-2026", caratula: "UI", cliente: "UI", sede: "challhuahuacho" });
    current = tmp; db.getCurrentUser = () => current;
    await app.switchTab("casos"); app.applyRbacUI();
    const delBtns = [...doc.querySelectorAll("#view-casos [onclick*='deleteCaso']")];
    ok("rbac-ui", "asistente legal: botones Eliminar caso ocultos", delBtns.length === 0 || delBtns.every(b => b.style.display === "none"), `${delBtns.length} botones`);
    const r = app.deleteCaso("CAS-UI");
    await r;
    ok("rbac-ui", "asistente legal: eliminar por consola bloqueado y expediente intacto", db.getRaw("casos").some(c => c.id === "CAS-UI"));
  });

  const real = [...new Set(errors)].filter(e => !/gstatic|jsdelivr|Could not load/.test(e));
  ok("global", "sin errores JS en toda la simulacion", real.length === 0, real.slice(0, 3).join(" || "));
  console.log(out.join("\n"));
  console.log(`\nSIMULACION: ${out.length - fails}/${out.length} OK`);
  server.close(); process.exit(fails ? 1 : 0);
}, 4000));

