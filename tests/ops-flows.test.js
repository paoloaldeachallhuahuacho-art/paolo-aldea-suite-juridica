/**
 * Flujos de agenda, caja chica y presupuesto con los controladores reales,
 * más una ráfaga local de cálculo (no golpea el sitio publicado).
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");

function load(file) {
  const code = fs.readFileSync(path.join(root, file), "utf8");
  vm.runInThisContext(code, { filename: file });
}

global.window = global;
global.parseMoney = (v) => {
  const n = parseFloat(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

load("js/controllers/pettycash.controller.js");
load("js/controllers/calendar.controller.js");
load("js/controllers/budget.controller.js");

const caja = global.pettyCashController;
const agenda = global.calendarController;
const presupuesto = global.budgetController;

const movimientos = [
  { id: "CC-1", tipo: "Ingreso", concepto: "Fondo de caja", monto: 1500, sede: "challhuahuacho", categoria: "Fondo" },
  { id: "CC-2", tipo: "Egreso", concepto: "Arancel judicial", monto: 180.5, sede: "challhuahuacho", centroCosto: "recuperable", expediente: "00123-2026" },
  { id: "CC-3", tipo: "Egreso", concepto: "Pasajes Tambobamba", monto: 45, sede: "cusco", categoria: "Movilidad" }
];

const balance = caja.calculateBalance(movimientos);
assert.strictEqual(balance.totalIngresos, 1500);
assert.strictEqual(balance.totalEgresos, 225.5);
assert.strictEqual(balance.saldoNeto, 1274.5);
assert.strictEqual(balance.totalRecuperables, 180.5);

const sede = caja.filterTransactions(movimientos, "arancel", "challhuahuacho", "Egreso", "ALL");
assert.strictEqual(sede.length, 1);
assert.strictEqual(sede[0].id, "CC-2");

assert.strictEqual(caja.canTransitionState("Borrador", "Elevado", "asistente_admin"), true);
assert.strictEqual(caja.canTransitionState("Elevado", "Aprobado", "abogado"), false);
assert.strictEqual(caja.canTransitionState("Elevado", "Aprobado", "socio"), true);

const editado = movimientos.map((m) => (m.id === "CC-2" ? { ...m, monto: 200 } : m));
const trasEdicion = caja.calculateBalance(editado.filter((m) => m.id !== "CC-3"));
assert.strictEqual(trasEdicion.saldoNeto, 1300);

const cita = {
  cliente: "María Quispe",
  motivo: "Audiencia de pruebas",
  fechaHora: "2026-11-05T09:00",
  abogado: "Paolo Aldea",
  modalidad: "Virtual",
  linkMeet: "https://meet.google.com/abc-defg-hij",
  telefono: "987654321",
  documentosRequeridos: ["DNI", "Contrato"]
};
const msg = agenda.buildWhatsAppMessage(cita, { firmName: "PAOLO ALDEA & ABOGADOS" });
assert.ok(msg.includes("María Quispe"));
assert.ok(msg.includes("meet.google.com"));
const url = agenda.getWhatsAppUrl(cita.telefono, msg);
assert.ok(url.startsWith("https://wa.me/51987654321?text="));

const citas = [
  { ...cita, id: "CIT-1", sede: "challhuahuacho", estado: "Programada" },
  { id: "CIT-2", cliente: "Otra", sede: "cusco", modalidad: "Presencial", estado: "Atendida", motivo: "Consulta" }
];
const visibles = agenda.filterCitas(citas, "quispe", "challhuahuacho", "Virtual", "Programada");
assert.strictEqual(visibles.length, 1);

const viernes = agenda.getNextFridayDirectorio();
assert.strictEqual(new Date(viernes.isoDate).getDay(), 5);
assert.ok(viernes.isoDate.endsWith("T15:00"));

assert.strictEqual(presupuesto.classifyPcgeType("63", "Litigio"), "OPEX");
assert.strictEqual(presupuesto.classifyPcgeType("68", "Mobiliario"), "CAPEX");
const viaticos = presupuesto.calculateViaticosSubtotal(3, {
  pasajes: 80,
  alimentacion: 25,
  hospedaje: 40,
  movilidadLocal: 10
});
assert.strictEqual(viaticos.totalViaticos, 305);

const auditoria = presupuesto.auditExecution(5000, 6200);
assert.strictEqual(auditoria.estadoEjecucion, "Sobrecosto / Desvío Excedido");
assert.ok(auditoria.saldoRestante < 0);
const conforme = presupuesto.auditExecution(5000, 4100);
assert.strictEqual(conforme.estadoEjecucion, "Ahorro Financiero Obtenido");

const partidas = [
  { id: "P-1", concepto: "Litigio Cotabambas", tipo: "OPEX", estado: "Aprobado", sede: "challhuahuacho", clasePcge: "63" },
  { id: "P-2", concepto: "Mobiliario", tipo: "CAPEX", estado: "Ejecutado", sede: "cusco" }
];
const filtradas = presupuesto.filterPresupuestos(partidas, "cotabambas", "challhuahuacho", "OPEX", "Aprobado");
assert.strictEqual(filtradas.length, 1);

global.PaoloBudgetAnalytics = {
  localAggregate: () => ({
    presupuestado_centavos: 500000,
    ejecutado_centavos: 250000,
    utilization_bps: 5000,
    projected_month_centavos: 500000,
    remaining_centavos: 250000
  })
};
const runRate = presupuesto.getRunRateSnapshot("challhuahuacho", 2026, 11);
assert.strictEqual(runRate.utilization_bps, 5000);
assert.strictEqual(runRate.remaining_centavos, 250000);

const N = 20000;
const t0 = process.hrtime.bigint();
for (let i = 0; i < N; i++) {
  caja.calculateBalance(movimientos);
  presupuesto.auditExecution(5000 + (i % 7), 4100);
  agenda.filterCitas(citas, i % 2 ? "quispe" : "", "ALL", "ALL", "ALL");
}
const ms = Number(process.hrtime.bigint() - t0) / 1e6;
assert.ok(ms < 3000, "ráfaga local demasiado lenta: " + ms.toFixed(0) + " ms");

console.log("ops-flows.test.js OK (" + N + " ciclos en " + ms.toFixed(0) + " ms)");
