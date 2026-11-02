/**
 * Zero-Trust Edge Functions — auth obligatoria (sin red real a Supabase).
 */
const path = require("path");

const root = path.join(__dirname, "..");
const admin = require(path.join(root, "netlify/functions/_supabaseAdmin.js"));
const attendance = require(path.join(root, "netlify/functions/attendance-validate.js"));
const petty = require(path.join(root, "netlify/functions/petty-cash-transition.js"));

let fails = 0;
const ok = (name, cond, extra) => {
  if (!cond) {
    fails++;
    console.log("FALLO", name, extra || "");
  } else {
    console.log("OK   ", name);
  }
};

ok("extractBearer vacío", admin.extractBearer({ headers: {} }) === "");
ok(
  "extractBearer Authorization",
  admin.extractBearer({ headers: { Authorization: "Bearer tok.abc" } }) === "tok.abc"
);
ok(
  "extractBearer lowercase",
  admin.extractBearer({ headers: { authorization: "Bearer xyz" } }) === "xyz"
);

const prevOrigin = process.env.ALLOWED_ORIGIN;
const prevUrl = process.env.SUPABASE_URL;
const prevAnon = process.env.SUPABASE_ANON_KEY;
process.env.ALLOWED_ORIGIN = "https://app.example.test";
process.env.SUPABASE_URL = "https://proj.supabase.co";
process.env.SUPABASE_ANON_KEY = "anon-test-key";

(async () => {
  // Sin Origin
  let res = await attendance.handler({
    httpMethod: "POST",
    headers: {},
    body: "{}"
  });
  ok("attendance sin Origin → 401/503", res.statusCode === 401 || res.statusCode === 503, res.statusCode);

  // Origin OK, sin Bearer
  res = await attendance.handler({
    httpMethod: "POST",
    headers: { Origin: "https://app.example.test" },
    body: JSON.stringify({
      id: "ATT-1",
      branch_id: "sede-1",
      event_type: "IN",
      client_ts: new Date().toISOString(),
      lat: -14.1,
      lon: -72.2
    })
  });
  ok("attendance sin Bearer → 401", res.statusCode === 401, res.body);

  res = await petty.handler({
    httpMethod: "POST",
    headers: { Origin: "https://app.example.test" },
    body: JSON.stringify({ entry_id: "E1", new_state: "disbursed" })
  });
  ok("petty sin Bearer → 401", res.statusCode === 401, res.body);

  // Origin incorrecto
  res = await attendance.handler({
    httpMethod: "POST",
    headers: {
      Origin: "https://evil.example",
      Authorization: "Bearer fake"
    },
    body: "{}"
  });
  ok("attendance Origin malo → 401", res.statusCode === 401, res.statusCode);

  // Bearer presente pero JWT inválido (mock fetch → 401 de Auth)
  const realFetch = global.fetch;
  global.fetch = async (url) => {
    if (String(url).includes("/auth/v1/user")) {
      return { ok: false, status: 401, json: async () => ({}) };
    }
    throw new Error("fetch inesperado: " + url);
  };
  res = await attendance.handler({
    httpMethod: "POST",
    headers: {
      Origin: "https://app.example.test",
      Authorization: "Bearer bad.jwt"
    },
    body: JSON.stringify({
      id: "ATT-2",
      branch_id: "sede-1",
      event_type: "IN",
      client_ts: new Date().toISOString(),
      lat: -14.1,
      lon: -72.2
    })
  });
  ok("attendance JWT inválido → 401", res.statusCode === 401, res.body);

  // JWT válido: debe llamar RPC con Bearer del usuario (NO service_role)
  let rpcAuth = null;
  let rpcApikey = null;
  let rpcPath = null;
  global.fetch = async (url, opts) => {
    const u = String(url);
    if (u.includes("/auth/v1/user")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: "11111111-1111-1111-1111-111111111111", email: "u@test" })
      };
    }
    if (u.includes("/rest/v1/rpc/")) {
      rpcPath = u;
      rpcAuth = opts && opts.headers && opts.headers.Authorization;
      rpcApikey = opts && opts.headers && opts.headers.apikey;
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({ ok: true, validation_status: "accepted", distance_m: 12, within_geofence: true })
      };
    }
    throw new Error("fetch inesperado: " + u);
  };

  res = await attendance.handler({
    httpMethod: "POST",
    headers: {
      Origin: "https://app.example.test",
      Authorization: "Bearer user.access.token"
    },
    body: JSON.stringify({
      id: "ATT-3",
      branch_id: "sede-1",
      event_type: "IN",
      client_ts: new Date().toISOString(),
      lat: -14.1,
      lon: -72.2
    })
  });
  ok("attendance JWT OK → 200", res.statusCode === 200, res.body);
  ok("RPC usa Bearer del usuario", rpcAuth === "Bearer user.access.token", rpcAuth);
  ok("RPC usa anon apikey (no service_role)", rpcApikey === "anon-test-key", rpcApikey);
  ok("RPC validate_attendance_punch", /validate_attendance_punch/.test(rpcPath || ""), rpcPath);

  // Petty: JWT OK → transition RPC as user
  rpcAuth = null;
  global.fetch = async (url, opts) => {
    const u = String(url);
    if (u.includes("/auth/v1/user")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: "11111111-1111-1111-1111-111111111111" })
      };
    }
    if (u.includes("/rest/v1/rpc/transition_petty_cash")) {
      rpcAuth = opts.headers.Authorization;
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ ok: true, state: "disbursed" })
      };
    }
    throw new Error("fetch inesperado: " + u);
  };
  res = await petty.handler({
    httpMethod: "POST",
    headers: {
      Origin: "https://app.example.test",
      Authorization: "Bearer user.access.token"
    },
    body: JSON.stringify({ entry_id: "E1", new_state: "disbursed" })
  });
  ok("petty JWT OK → 200", res.statusCode === 200, res.body);
  ok("petty RPC Bearer usuario", rpcAuth === "Bearer user.access.token", rpcAuth);

  // CORS: origen no permitido no refleja ACAO
  const cors = admin.corsHeaders({ headers: { Origin: "https://evil.example" } });
  ok("cors no refleja origen ajeno", cors["Access-Control-Allow-Origin"] == null);

  global.fetch = realFetch;
  if (prevOrigin === undefined) delete process.env.ALLOWED_ORIGIN;
  else process.env.ALLOWED_ORIGIN = prevOrigin;
  if (prevUrl === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = prevUrl;
  if (prevAnon === undefined) delete process.env.SUPABASE_ANON_KEY;
  else process.env.SUPABASE_ANON_KEY = prevAnon;

  if (fails) {
    console.error("\n" + fails + " fallo(s) en edge-auth");
    process.exit(1);
  }
  console.log("\nedge-auth: todos OK");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
