/**
 * Transición de caja chica.
 * - Con JWT Supabase: RPC transition_petty_cash
 * - Con syncToken (login despacho): valida flujo sobre app_records.caja_chica
 */
const {
  requireUser,
  supabaseRpcAsUser,
  supabaseRest,
  corsHeaders,
  assertAllowedOrigin,
  jsonError
} = require("./_supabaseAdmin");
const { requireEdgeAuth, assertBranchAccess, parseBody } = require("./_edgeAuth");

const ALLOWED = {
  requested: ["branch_approved", "rejected"],
  branch_approved: ["disbursed", "rejected"],
  disbursed: ["reconciled", "rejected"]
};

const LEGACY_TO_CLOUD = {
  pendiente_asistente: "requested",
  elevado_admin: "branch_approved",
  aprobado: "disbursed",
  rechazado: "rejected",
  observado: "requested"
};

const CLOUD_TO_LEGACY = {
  requested: "pendiente_asistente",
  branch_approved: "elevado_admin",
  disbursed: "aprobado",
  reconciled: "aprobado",
  rejected: "rechazado"
};

function normalizeState(state) {
  const s = String(state || "").trim();
  return LEGACY_TO_CLOUD[s] || s;
}

const ROLE_ELEVATE = new Set(["super_admin", "asistente_admin", "admin", "socio"]);
const ROLE_RESOLVE = new Set(["super_admin", "admin", "socio"]);

function assertPettyTransitionRole(role, newState) {
  const actor = String(role || "");
  if ((newState === "disbursed" || newState === "rejected" || newState === "reconciled") && !ROLE_RESOLVE.has(actor)) {
    const err = new Error("Solo Administración o Socios pueden aprobar, rechazar o conciliar caja.");
    err.status = 403;
    throw err;
  }
  if (newState === "branch_approved" && !ROLE_ELEVATE.has(actor)) {
    const err = new Error("Solo el Asistente Administrativo o Dirección pueden elevar gastos.");
    err.status = 403;
    throw err;
  }
}

async function transitionWithSyncToken(auth) {
  const body = auth.body || {};
  const entryId = String(body.entry_id || "").trim();
  const newState = normalizeState(body.new_state);
  if (!entryId || !newState) {
    const err = new Error("entry_id y new_state requeridos.");
    err.status = 400;
    throw err;
  }
  if (!ALLOWED[newState] && !Object.values(ALLOWED).some((arr) => arr.includes(newState))) {
    // newState must be a valid target
  }
  const validTargets = new Set([].concat(...Object.values(ALLOWED)));
  if (!validTargets.has(newState)) {
    const err = new Error("Estado destino inválido: " + newState);
    err.status = 400;
    throw err;
  }

  assertPettyTransitionRole(auth.claims && auth.claims.role, newState);

  const path =
    "app_records?collection=eq.caja_chica&id=eq." +
    encodeURIComponent(entryId) +
    "&deleted_at=is.null&select=*&limit=1";
  const rows = await supabaseRest(path);
  const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
  if (!row) {
    const err = new Error("Asiento de caja no encontrado en la nube.");
    err.status = 404;
    throw err;
  }

  assertBranchAccess(auth.claims, row.branch_id);

  const payload = row.payload && typeof row.payload === "object" ? { ...row.payload } : { id: entryId };
  const current =
    normalizeState(payload.workflow_state || payload.estadoFlujo || "requested") || "requested";

  const allowedNext = ALLOWED[current] || [];
  if (!allowedNext.includes(newState)) {
    const err = new Error("Transición inválida: " + current + " → " + newState);
    err.status = 409;
    throw err;
  }

  // Inmutabilidad de monto tras desembolso
  if ((current === "disbursed" || current === "reconciled") && body.monto_centavos != null) {
    const err = new Error("Monto inmutable tras desembolso.");
    err.status = 409;
    throw err;
  }

  const now = new Date().toISOString();
  payload.workflow_state = newState;
  payload.estadoFlujo = CLOUD_TO_LEGACY[newState] || payload.estadoFlujo;
  payload.updatedAt = now;
  payload.server_ts = now;
  if (!payload.historialEstados) payload.historialEstados = [];
  payload.historialEstados.push({
    estado: payload.estadoFlujo,
    workflow_state: newState,
    usuario: auth.claims.usuario || auth.claims.uid,
    rol: auth.claims.role,
    fecha: now,
    comentario: body.comentario || ("Transición cloud → " + newState)
  });

  await supabaseRest(
    "app_records?collection=eq.caja_chica&id=eq." + encodeURIComponent(entryId),
    {
      method: "PATCH",
      body: {
        payload,
        branch_id: row.branch_id,
        updated_at: now,
        server_ts: now,
        deleted_at: null
      },
      prefer: "return=minimal"
    }
  );

  return {
    ok: true,
    entry_id: entryId,
    from: current,
    to: newState,
    estadoFlujo: payload.estadoFlujo,
    mode: "sync"
  };
}

exports.assertPettyTransitionRole = assertPettyTransitionRole;

exports.handler = async (event) => {
  const headers = corsHeaders(event);
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        ...headers,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      },
      body: ""
    };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: "Method Not Allowed" }) };
  }

  try {
    assertAllowedOrigin(event);

    const authHeader = ((event.headers || {}).authorization || (event.headers || {}).Authorization || "");
    const bearer = String(authHeader).replace(/^Bearer\s+/i, "").trim();
    const isJwtShape = bearer.split(".").length === 3;

    if (isJwtShape) {
      const { user, jwt } = await requireUser(event);
      const body = parseBody(event) || {};
      const { entry_id, new_state } = body;
      if (!entry_id || !new_state) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ ok: false, error: "entry_id y new_state requeridos." })
        };
      }
      const meta = (user && user.app_metadata) || {};
      assertPettyTransitionRole(meta.role || "abogado", normalizeState(new_state));
      const result = await supabaseRpcAsUser(
        "transition_petty_cash",
        { p_entry_id: entry_id, p_new_state: normalizeState(new_state) },
        jwt
      );
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    const auth = await requireEdgeAuth(event, { allowBodyToken: true });
    const result = await transitionWithSyncToken(auth);
    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (e) {
    if (e instanceof SyntaxError) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "JSON inválido." }) };
    }
    return jsonError(headers, e, 500);
  }
};
