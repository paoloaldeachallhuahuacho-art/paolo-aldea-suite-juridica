/**
 * Transición de estado de caja chica + asiento de ledger (vía RPC o REST).
 */
const { supabaseRpc, supabaseRest, corsHeaders, clientMeta } = require("./_supabaseAdmin");

const ALLOWED = {
  requested: ["branch_approved", "rejected"],
  branch_approved: ["disbursed", "rejected"],
  disbursed: ["reconciled", "rejected"]
};

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
    const body = JSON.parse(event.body || "{}");
    const { entry_id, new_state } = body;
    if (!entry_id || !new_state) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "entry_id y new_state requeridos." }) };
    }

    try {
      const result = await supabaseRpc("transition_petty_cash", {
        p_entry_id: entry_id,
        p_new_state: new_state
      });
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    } catch (_) {
      const rows = await supabaseRest(`petty_cash_entries?id=eq.${encodeURIComponent(entry_id)}&select=*`);
      const row = Array.isArray(rows) ? rows[0] : null;
      if (!row) {
        return { statusCode: 404, headers, body: JSON.stringify({ ok: false, error: "Asiento no encontrado." }) };
      }
      const from = row.workflow_state;
      if (!(ALLOWED[from] || []).includes(new_state)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ ok: false, error: `Transición inválida ${from} -> ${new_state}` })
        };
      }
      await supabaseRest(`petty_cash_entries?id=eq.${encodeURIComponent(entry_id)}`, {
        method: "PATCH",
        prefer: "return=representation",
        body: { workflow_state: new_state }
      });
      if (new_state === "disbursed") {
        const amt = Number(row.monto_centavos);
        const isEg = row.tipo === "Egreso";
        await supabaseRest("petty_cash_ledger", {
          method: "POST",
          prefer: "return=minimal",
          body: [
            {
              entry_id,
              branch_id: row.branch_id,
              account_code: "1101",
              debit_centavos: isEg ? amt : 0,
              credit_centavos: isEg ? 0 : amt,
              memo: "Disbursement"
            },
            {
              entry_id,
              branch_id: row.branch_id,
              account_code: "2101",
              debit_centavos: isEg ? 0 : amt,
              credit_centavos: isEg ? amt : 0,
              memo: "Disbursement counter"
            }
          ]
        });
      }
      const meta = clientMeta(event);
      await supabaseRest("audit_logs", {
        method: "POST",
        prefer: "return=minimal",
        body: [{
          branch_id: row.branch_id,
          action: "PETTY_TRANSITION",
          table_name: "petty_cash_entries",
          record_id: entry_id,
          after_state: { from, to: new_state },
          ip_address: meta.ip,
          user_agent: meta.ua
        }]
      });
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, state: new_state }) };
    }
  } catch (e) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: e.message || "Error interno" })
    };
  }
};
