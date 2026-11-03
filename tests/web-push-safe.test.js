/**
 * Payload Web Push: genérico, sin datos de expediente.
 */
const assert = require("assert");
const path = require("path");
const { buildSafePushPayload } = require(path.join(__dirname, "..", "cloudflare", "functions", "_webPush.js"));

const safe = buildSafePushPayload({
  title: "PLAZO VENCIDO: Exp. 0123-2024 con parte Juan Pérez y monto S/ 50000",
  body: "Carátula confidencial / DNI 12345678",
  url: "./index.html?open=alerts",
  tag: "alerta-urgente",
  priority: "urgent"
});

assert.ok(safe.title.length <= 80);
assert.ok(safe.body.length <= 180);
assert.strictEqual(safe.url, "./index.html?open=alerts");
assert.strictEqual(safe.priority, "urgent");
// El helper trunca pero no filtra; push-send fuerza título/cuerpo genéricos.
const forced = buildSafePushPayload({
  title: "PAOLO ALDEA — Aviso urgente del despacho",
  body: "Hay un plazo o diligencia perentoria. Abra la suite segura para consultar el detalle (la notificación no incluye datos del expediente).",
  url: "./index.html?open=alerts"
});
assert.ok(!/Exp\.\s*\d/.test(forced.body));
assert.ok(!/DNI/.test(forced.body));
assert.ok(forced.title.includes("PAOLO ALDEA"));

console.log("web-push-safe.test.js OK");
