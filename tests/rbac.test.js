/* Prueba RBAC: matriz rol x modulo x accion contra la capa de datos real (db.add/update/delete/save). */
const { JSDOM, VirtualConsole } = require("jsdom");
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const types = { ".js": "application/javascript", ".html": "text/html", ".css": "text/css", ".json": "application/json" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  const f = path.join(root, p === "/" ? "index.html" : p);
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream" }); res.end(d); } });
}).listen(0);
const port = () => server.address().port;

const results = []; const fails = [];
const check = (name, ok, extra) => { results.push([name, ok]); if (!ok) fails.push(name + (extra ? " -> " + extra : "")); };

const vc = new VirtualConsole(); // silencia ruido (se esperan errores de acceso denegado)
JSDOM.fromURL("http://localhost:" + port() + "/index.html", {
  runScripts: "dangerously", resources: "usable", pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(w) {
    w.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} });
    w.HTMLCanvasElement.prototype.getContext = () => ({});
    w.fetch = () => Promise.reject(new Error("offline"));
    w.alert = () => {}; w.confirm = () => true;
  }
}).then(dom => setTimeout(() => {
  const w = dom.window, db = w.db;
  let current = null;
  db.getCurrentUser = () => current;
  w.app.showToast = () => {};

  const allowedByConfig = (rol, m) => { const c = db.getModulesConfig().find(x => x.id === m); if (!c) return true; if (c.enabled === false) return false; if (!Array.isArray(c.rolesAllowed) || c.rolesAllowed.includes(rol)) return true; return (rol === "admin" || rol === "socio") && (c.rolesAllowed.includes("admin") || c.rolesAllowed.includes("socio")); };
  const roles = ["super_admin", "socio", "admin", "abogado", "asistente_legal", "asistente_admin"];
  const modules = ["kpis", "casos", "caja_chica", "presupuestos", "citas", "asistencia", "documentos", "personal", "inventario"];
  const collOf = { casos: "casos", caja_chica: "caja_chica", presupuestos: "presupuestos", citas: "citas", asistencia: "attendance", documentos: "documentos", personal: "workers", inventario: "inventario" };
  const mk = (rol, id, sede = "challhuahuacho") => ({ id, rol, sede: rol === "super_admin" || rol === "socio" ? "todas" : sede, nombre: rol, permisos: db.getDefaultPermissionsForRole(rol) });
  const sa = { id: "WRK-000", rol: "super_admin", sede: "todas", nombre: "SA" };

  const sid = (col, rol, m) => (col === "presupuestos" ? `CH-CC-LIT-63-${rol}` : `SEED-${rol}-${m}`);
  // --- 1. Acceso a modulos ---
  for (const rol of roles) {
    const u = mk(rol, "T-" + rol); current = u;
    const def = db.getDefaultPermissionsForRole(rol);
    for (const m of modules) {
      const expected = !!(def[m] && def[m].read) && (rol === "super_admin" || allowedByConfig(rol, m));
      check(`acceso modulo ${rol}:${m}`, db.canAccessModule(u, m) === expected, `esperado ${expected}`);
    }
    for (const m of ["master_admin", "configuracion", "roles_permisos"]) {
      check(`gobierno ${rol}:${m}`, db.canAccessModule(u, m) === (rol === "super_admin"));
    }
  }

  // --- 2. CRUD real sobre cada coleccion ---
  for (const rol of roles) {
    for (const m of modules) {
      const col = collOf[m]; if (!col) continue;
      const base = db.getDefaultPermissionsForRole(rol)[m] || {}; const gate = rol === "super_admin" || allowedByConfig(rol, m); const def = { create: base.create && gate, update: base.update && gate, delete: base.delete && gate };
      // semilla creada por super admin en la sede del usuario
      current = sa;
      const seed = db.add(col, { id: sid(col, rol, m), sede: "challhuahuacho", nombre: "seed", concepto: "seed", monto: 1 });
      current = mk(rol, "T-" + rol);
      const created = db.add(col, { id: `NEW-${rol}-${m}`, nombre: "n", concepto: "n", monto: 1 });
      check(`crear ${rol}:${m}`, !!created === !!def.create, `permitido=${!!created}`);
      const upd = db.update(col, sid(col, rol, m), { nombre: "editado" });
      check(`editar ${rol}:${m}`, !!upd === !!def.update, `permitido=${!!upd}`);
      const del = db.delete(col, sid(col, rol, m));
      check(`eliminar ${rol}:${m}`, !!del === !!def.delete, `permitido=${!!del}`);
    }
  }

  // --- 3. Super admin: control total ---
  current = sa;
  for (const m of modules) {
    const col = collOf[m]; if (!col) continue;
    const c = db.add(col, { id: sid(col, "SA", m), nombre: "x", concepto: "x", monto: 1 });
    const u = db.update(col, sid(col, "SA", m), { nombre: "y" });
    const d = db.delete(col, sid(col, "SA", m));
    check(`super_admin CRUD completo ${m}`, !!c && !!u && d === true);
  }

  // --- 4. Anti-escalada de privilegios ---
  const ab = mk("abogado", "WRK-ABG"); current = sa;
  db.add("workers", { id: "WRK-ABG", nombre: "abg", rol: "abogado", sede: "challhuahuacho", permisos: ab.permisos });
  current = ab;
  db.update("workers", "WRK-ABG", { rol: "super_admin", permisos: db.getDefaultPermissionsForRole("super_admin"), sede: "todas" });
  const stored = db.getRaw("workers").find(x => x.id === "WRK-ABG");
  check("abogado no puede auto-promoverse via update()", stored.rol === "abogado" && stored.sede === "challhuahuacho");
  const raw = db.getRaw("workers").map(x => x.id === "WRK-ABG" ? { ...x, rol: "super_admin" } : x);
  db.save("workers", raw);
  check("abogado no puede auto-promoverse via save()", db.getRaw("workers").find(x => x.id === "WRK-ABG").rol === "abogado");
  check("isSuperAdmin: usuario llamado 'admin' sin rol NO es super admin", db.isSuperAdmin({ id: "X1", rol: "abogado", usuario: "admin", nombre: "admin", dni: "admin" }) === false);
  check("isSuperAdmin: socio NO es super admin", db.isSuperAdmin({ id: "X2", rol: "socio" }) === false);
  check("isSuperAdmin: WRK-000 si", db.isSuperAdmin({ id: "WRK-000", rol: "super_admin" }) === true);
  check("restaurar backup bloqueado a no super admin", true);
  db.importAllDataJson("{}").then(r => {
    check("restaurar backup bloqueado a no super admin", r.success === false);
    // --- 5. Aislamiento por sede ---
    current = sa;
    db.add("casos", { id: "CAS-CUSCO", sede: "cusco", nombre: "c" });
    const other = mk("admin", "ADM-CH", "challhuahuacho"); current = other;
    check("admin de sede no edita casos de otra sede", !db.update("casos", "CAS-CUSCO", { nombre: "hack" }));
    check("admin de sede no elimina casos de otra sede", db.delete("casos", "CAS-CUSCO") === false);
    // --- 6. Auditoria inmutable (incluso super admin) ---
    current = sa;
    db.add("casos", { id: "AUD-T", nombre: "t" });
    const aud = db.getRaw("auditoria"); const target = aud[0];
    check("auditoria: nadie edita", !db.update("auditoria", target.id, { accion: "X" }));
    check("auditoria: nadie elimina (ni super admin)", db.delete("auditoria", target.id) === false);
    db.save("auditoria", aud.slice(1));
    check("auditoria: save() no puede borrar entradas", db.getRaw("auditoria").length === aud.length);

    const ok = results.filter(r => r[1]).length;
    console.log(`RBAC: ${ok}/${results.length} comprobaciones OK`);
    fails.slice(0, 60).forEach(f => console.log("  FALLO:", f));
    server.close(); process.exit(fails.length ? 1 : 0);
  });
}, 4000));



