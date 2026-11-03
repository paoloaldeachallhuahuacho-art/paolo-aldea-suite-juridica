/**
 * BudgetAnalytics — run-rate / forecast con aritmética en céntimos (sin float).
 */
(function (global) {
  function safeDiv(num, den) {
    const d = Number(den) || 0;
    if (d === 0) return 0;
    return Math.trunc(Number(num) / d);
  }

  function utilizationBps(ejecutadoCentavos, presupuestadoCentavos) {
    return safeDiv((Number(ejecutadoCentavos) || 0) * 10000, presupuestadoCentavos);
  }

  function projectedMonthCentavos(ejecutadoCentavos, dayOfMonth, daysInMonth) {
    const day = Math.max(Number(dayOfMonth) || 1, 1);
    const days = Math.max(Number(daysInMonth) || 30, 1);
    return safeDiv((Number(ejecutadoCentavos) || 0) * days, day);
  }

  function remainingCentavos(presupuestado, ejecutado) {
    const r = (Number(presupuestado) || 0) - (Number(ejecutado) || 0);
    return r > 0 ? r : 0;
  }

  function localAggregate(branchId, anio, mes) {
    const items = (global.db && global.db.getRaw("presupuestos")) || [];
    let presupuestado = 0;
    let ejecutado = 0;
    items.forEach((p) => {
      if (!p) return;
      const sede = p.sede || p.branch_id;
      if (branchId && sede && sede !== branchId && branchId !== "todas") return;
      const y = Number(p.anio || p.year || anio);
      const m = Number(p.mes || p.month || mes);
      if (y !== anio || m !== mes) return;
      presupuestado += Math.round(Number(p.montoPresupuestado || p.presupuestado || 0) * 100);
      ejecutado += Math.round(Number(p.montoEjecutado || p.ejecutado || 0) * 100);
    });
    const now = new Date();
    const day = now.getFullYear() === anio && now.getMonth() + 1 === mes ? now.getDate() : 15;
    const days = new Date(anio, mes, 0).getDate();
    return {
      presupuestado_centavos: presupuestado,
      ejecutado_centavos: ejecutado,
      utilization_bps: utilizationBps(ejecutado, presupuestado),
      projected_month_centavos: projectedMonthCentavos(ejecutado, day, days),
      remaining_centavos: remainingCentavos(presupuestado, ejecutado)
    };
  }

  async function runRate(branchId, anio, mes) {
    const c = global.PaoloAuthService && global.PaoloAuthService.getClient
      ? global.PaoloAuthService.getClient()
      : null;
    if (!c || !global.PaoloEnterpriseConfig.isEnterprise()) {
      return localAggregate(branchId, anio, mes);
    }
    const { data, error } = await c.rpc("budget_run_rate", {
      p_branch_id: branchId,
      p_anio: anio,
      p_mes: mes
    });
    if (error) {
      console.warn("[BudgetAnalytics] RPC fallback local", error);
      return localAggregate(branchId, anio, mes);
    }
    return data;
  }

  global.PaoloBudgetAnalytics = {
    safeDiv,
    utilizationBps,
    projectedMonthCentavos,
    remainingCentavos,
    localAggregate,
    runRate
  };
})(typeof window !== "undefined" ? window : globalThis);
