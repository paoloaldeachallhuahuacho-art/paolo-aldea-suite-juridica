/**
 * KPIs de asistencia: agregación semana/mes sin DOM Chart.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const code = fs.readFileSync(path.join(root, "js/attendance-kpis.js"), "utf8");

const today = new Date();
const iso = (d) => {
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
};
const todayIso = iso(today);
const lateIso = todayIso + "T10:30:00";
const onTimeIso = todayIso + "T08:45:00";

const workers = [
  { id: "WRK-1", nombre: "Ana", cargo: "Abogada", sede: "challhuahuacho", activo: true },
  { id: "WRK-2", nombre: "Luis", cargo: "Asistente", sede: "challhuahuacho", activo: true }
];
const attendance = [
  {
    id: "A1",
    workerId: "WRK-1",
    nombre: "Ana",
    sede: "challhuahuacho",
    fecha: todayIso,
    ingreso: onTimeIso,
    salida: todayIso + "T18:00:00",
    salidaAlmuerzo: todayIso + "T13:00:00",
    retornoAlmuerzo: todayIso + "T14:00:00",
    enGeocerca: true,
    tipoMarcacion: "ingreso",
    estadoAprobacion: "aprobado"
  },
  {
    id: "A2",
    workerId: "WRK-2",
    nombre: "Luis",
    sede: "challhuahuacho",
    fecha: todayIso,
    ingreso: lateIso,
    salida: todayIso + "T17:30:00",
    enGeocerca: false,
    tipoMarcacion: "comision_oficial",
    estadoAprobacion: "pendiente"
  }
];

const sandbox = {
  window: {},
  console,
  document: {
    getElementById: () => null,
    querySelectorAll: () => []
  },
  Chart: undefined
};
sandbox.window = sandbox;
sandbox.global = sandbox;
sandbox.db = {
  get: (col) => (col === "workers" ? workers : col === "attendance" ? attendance : []),
  normalizeSede: (s) => String(s || "challhuahuacho").toLowerCase()
};
sandbox.SEDES_CONFIG = {
  challhuahuacho: { nombreCorto: "Challhuahuacho" },
  cusco: { nombreCorto: "Cusco" }
};

vm.runInNewContext(code, sandbox);

const AK = sandbox.AttendanceKpis;
assert.ok(AK, "AttendanceKpis expuesto");

AK.setMode("week");
AK.setSede("challhuahuacho");

// refresh sin DOM no debe lanzar
AK.refresh();

const st = AK.getState();
assert.strictEqual(st.mode, "week");
assert.strictEqual(st.sede, "challhuahuacho");

console.log("attendance-kpis.test.js OK");
