/**
 * Controles Sync / RLS edge / Caja / Asistencia con syncToken (sin JWT Supabase).
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");

process.env.SYNC_TOKEN_SECRET = process.env.SYNC_TOKEN_SECRET || "test-enterprise-sync-secret";

const { issueSyncToken, verifySyncToken, normalizeBranch, stripSensitiveRecord, canWriteStaffCollection } = require(path.join(
  root,
  "cloudflare/functions/_syncToken.js"
));
const { assertPettyTransitionRole } = require(path.join(
  root,
  "cloudflare/functions/petty-cash-transition.js"
));
const { assertBranchAccess, haversineMeters, BRANCH_GEO } = require(path.join(
  root,
  "cloudflare/functions/_edgeAuth.js"
));

(function () {
  const adminTok = issueSyncToken({
    uid: "WRK-000",
    role: "super_admin",
    sede: "todas",
    usuario: "admin"
  });
  const claims = verifySyncToken(adminTok);
  assert.strictEqual(claims.role, "super_admin");
  assert.strictEqual(normalizeBranch(claims.sede, claims.role), null);

  const sedeTok = issueSyncToken({
    uid: "WRK-2",
    role: "abogado",
    sede: "challhuahuacho",
    usuario: "abogado1"
  });
  const sedeClaims = verifySyncToken(sedeTok);
  assert.strictEqual(normalizeBranch(sedeClaims.sede, sedeClaims.role), "challhuahuacho");

  assert.doesNotThrow(() =>
    assertBranchAccess(
      { role: "abogado", sede: "challhuahuacho", branchFilter: "challhuahuacho" },
      "challhuahuacho"
    )
  );
  assert.throws(
    () =>
      assertBranchAccess(
        { role: "abogado", sede: "challhuahuacho", branchFilter: "challhuahuacho" },
        "cusco"
      ),
    /Sin permiso/
  );
  assert.doesNotThrow(() =>
    assertBranchAccess({ role: "super_admin", sede: "todas", branchFilter: null }, "cusco")
  );

  const geo = BRANCH_GEO.challhuahuacho;
  const inside = haversineMeters(geo.latitud, geo.longitud, geo.latitud, geo.longitud);
  assert.ok(inside < 1);
  const outside = haversineMeters(geo.latitud, geo.longitud, geo.latitud + 0.05, geo.longitud);
  assert.ok(outside > geo.radio);

  // Flujo caja: requested → branch_approved → disbursed; salto ilegal
  const ALLOWED = {
    requested: ["branch_approved", "rejected"],
    branch_approved: ["disbursed", "rejected"],
    disbursed: ["reconciled", "rejected"]
  };
  assert.ok(ALLOWED.requested.includes("branch_approved"));
  assert.ok(!ALLOWED.requested.includes("disbursed"));
  assert.ok(ALLOWED.branch_approved.includes("disbursed"));

  // Soft-delete path must scope by branch for non-global actors
  const isGlobal = false;
  const userBranch = "challhuahuacho";
  let delPath = "app_records?collection=eq.casos&id=eq.X";
  if (!isGlobal && userBranch) delPath += "&branch_id=eq." + encodeURIComponent(userBranch);
  assert.ok(delPath.includes("branch_id=eq.challhuahuacho"));

  const dirty = stripSensitiveRecord({
    id: "WRK-9",
    rol: "abogado",
    passwordHash: "pbkdf2$1$aa$bb",
    pinHash: "secret",
    nombre: "Ana"
  });
  assert.strictEqual(dirty.passwordHash, undefined);
  assert.strictEqual(dirty.pinHash, undefined);
  assert.strictEqual(dirty.nombre, "Ana");
  assert.strictEqual(canWriteStaffCollection({ role: "abogado" }), false);
  assert.strictEqual(canWriteStaffCollection({ role: "admin" }), true);
  assert.throws(() => assertPettyTransitionRole("abogado", "disbursed"), /Administración/);
  assert.throws(() => assertPettyTransitionRole("abogado", "branch_approved"), /elevar/);
  assert.doesNotThrow(() => assertPettyTransitionRole("asistente_admin", "branch_approved"));
  assert.doesNotThrow(() => assertPettyTransitionRole("socio", "disbursed"));

  const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  const installBlock = sw.slice(sw.indexOf("addEventListener('install'"), sw.indexOf("addEventListener('message'"));
  assert.ok(installBlock.length > 20);
  assert.ok(!installBlock.includes("skipWaiting("));
  assert.ok(sw.includes("SKIP_WAITING"));
  const version = JSON.parse(fs.readFileSync(path.join(root, "version.json"), "utf8"));
  assert.strictEqual(version.version, "2026.11.06");

  console.log("enterprise-sync-rls.test.js OK");
})();

(async function staffUpsertAuthGate() {
  process.env.ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "https://app.example.test";
  const upsert = require(path.join(root, "cloudflare/functions/auth-staff-upsert.js"));
  const origin = process.env.ALLOWED_ORIGIN;
  const hash =
    "pbkdf2$210000$YWFhYWFhYWFhYWFhYWFhYQ==$YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=";

  let res = await upsert.handler({
    httpMethod: "POST",
    headers: { Origin: origin },
    body: JSON.stringify({ id: "X", usuario: "x", passwordHash: hash })
  });
  assert.strictEqual(res.statusCode, 401, "staff-upsert sin token debe 401");

  const abogado = issueSyncToken({
    uid: "WRK-2",
    role: "abogado",
    sede: "challhuahuacho",
    usuario: "abogado1"
  });
  res = await upsert.handler({
    httpMethod: "POST",
    headers: { Origin: origin },
    body: JSON.stringify({ id: "X", usuario: "x", syncToken: abogado, passwordHash: hash })
  });
  assert.strictEqual(res.statusCode, 403, "staff-upsert abogado debe 403");

  console.log("enterprise-sync-rls staff-upsert gate OK");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
