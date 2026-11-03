/**
 * Pruebas: gate multi-dispositivo + verificación PBKDF2 del edge.
 */
const assert = require("assert");
const path = require("path");
const crypto = require("crypto");

// --- PBKDF2 parity (cliente ↔ Netlify) ---
function hashLikeBrowser(plain, iterations = 210000) {
  const salt = crypto.randomBytes(16);
  const bits = crypto.pbkdf2Sync(String(plain), salt, iterations, 32, "sha256");
  return "pbkdf2$" + iterations + "$" + salt.toString("base64") + "$" + bits.toString("base64");
}

const { verifyPbkdf2Secret, isValidPasswordHash } = require("../cloudflare/functions/_supabaseAdmin");

const pass = "MinaCotabambas#9";
const stored = hashLikeBrowser(pass);
assert.strictEqual(isValidPasswordHash(stored), true);
assert.strictEqual(verifyPbkdf2Secret(pass, stored), true);
assert.strictEqual(verifyPbkdf2Secret("wrong-password-x", stored), false);
console.log("OK    PBKDF2 edge verifica hash estilo navegador");

// --- Gate UI: nube bootstrapped + local vacío ⇒ login, no bootstrap ---
const { JSDOM } = require("jsdom");
const html = `
<!DOCTYPE html><html><body>
<form id="formLogin" class="hidden"></form>
<form id="formBootstrapAdmin" class=""></form>
<div id="authBootstrapBanner" class=""></div>
</body></html>`;
const dom = new JSDOM(html, { runScripts: "outside-only" });
const w = dom.window;
w.__ENTERPRISE_CLOUD__ = true;
w.__CLOUD_AUTH_BOOTSTRAPPED__ = true;
w.db = { needsAuthBootstrap: () => true }; // dispositivo vacío
w.LegalApp = class {
  needsAuthBootstrapUI() {
    const localNeeds = w.db && w.db.needsAuthBootstrap();
    if (!localNeeds) return false;
    if (w.__CLOUD_AUTH_BOOTSTRAPPED__) return false;
    return true;
  }
  updateAuthGateUI() {
    const needsBootstrap = this.needsAuthBootstrapUI();
    w.document.getElementById("formLogin").classList.toggle("hidden", !!needsBootstrap);
    w.document.getElementById("formBootstrapAdmin").classList.toggle("hidden", !needsBootstrap);
    w.document.getElementById("authBootstrapBanner").classList.toggle("hidden", !needsBootstrap);
    return needsBootstrap;
  }
};
const app = new w.LegalApp();
assert.strictEqual(app.needsAuthBootstrapUI(), false, "con nube bootstrapped no debe pedir crear admin");
app.updateAuthGateUI();
assert.ok(!w.document.getElementById("formLogin").classList.contains("hidden"), "login visible");
assert.ok(w.document.getElementById("formBootstrapAdmin").classList.contains("hidden"), "bootstrap oculto");
console.log("OK    Gate UI: dispositivo vacío + nube lista ⇒ formulario de login");

w.__CLOUD_AUTH_BOOTSTRAPPED__ = false;
assert.strictEqual(app.needsAuthBootstrapUI(), true, "sin nube y local vacío ⇒ bootstrap");
console.log("OK    Gate UI: sin nube ⇒ bootstrap local");

console.log("\ncloud-auth-gate: todos OK");
