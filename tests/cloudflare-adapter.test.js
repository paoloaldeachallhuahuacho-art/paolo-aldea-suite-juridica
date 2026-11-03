/**
 * Adaptador Cloudflare: /api + alias legacy, bloqueo de paths internos.
 */
const assert = require("assert");
const { handleRequest, isBlockedPath, matchFunctionName } = require("../cloudflare/adapter.js");

const saved = {};
for (const key of ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "ALLOWED_ORIGIN"]) {
  saved[key] = process.env[key];
  delete process.env[key];
}

function req(url, init) {
  return new Request(url, init);
}

(async () => {
  assert.strictEqual(isBlockedPath("/supabase/migrations/20261102d_app_records_sync.sql"), true);
  assert.strictEqual(isBlockedPath("/docs/DEPLOY.md"), true);
  assert.strictEqual(isBlockedPath("/netlify/functions/sync-pull.js"), true);
  assert.strictEqual(isBlockedPath("/cloudflare/functions/auth-login.js"), true);
  assert.strictEqual(isBlockedPath("/js/app.js"), false);
  assert.strictEqual(isBlockedPath("/../.env"), true);

  assert.strictEqual(matchFunctionName("/api/public-config"), "public-config");
  assert.strictEqual(matchFunctionName("/.netlify/functions/sync-pull"), "sync-pull");
  assert.strictEqual(matchFunctionName("/js/app.js"), null);

  const missing = await handleRequest(req("https://paolo.pages.dev/api/no-such"), {});
  assert.strictEqual(missing.status, 404);

  const config = await handleRequest(req("https://paolo.pages.dev/api/public-config"), {});
  assert.strictEqual(config.status, 200);
  const body = await config.json();
  assert.strictEqual(body.enterprise, false);
  assert.strictEqual(body.supabaseAnonKey, null);
  assert.ok(!JSON.stringify(body).includes("service_role"));

  const legacy = await handleRequest(req("https://paolo.pages.dev/.netlify/functions/public-config"), {});
  assert.strictEqual(legacy.status, 200);

  const pull = await handleRequest(
    req("https://paolo.pages.dev/api/sync-pull", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://paolo.pages.dev" },
      body: "{}"
    }),
    {}
  );
  assert.strictEqual(pull.status, 503);
  const pullBody = await pull.json();
  assert.match(pullBody.error, /ALLOWED_ORIGIN/);

  const blocked = await handleRequest(req("https://paolo.pages.dev/supabase/migrations/x.sql"), {
    ASSETS: { fetch: async () => new Response("secret", { status: 200 }) }
  });
  assert.strictEqual(blocked.status, 404);

  console.log("cloudflare-adapter.test.js OK");
})().catch((err) => {
  console.error(err);
  process.exit(1);
}).finally(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
