/**
 * PAOLO ALDEA & ABOGADOS - Budget & Financial Planning Controller
 * Controlador Especializado para la Gestión de Presupuestos, Clasificación PCGE,
 * Auditoría de Partidas CAPEX / OPEX y Desglose Integral de Viáticos Procesales.
 */

class BudgetController {
  constructor(appContext = null) {
    this.app = appContext || window.app;
  }

  setContext(app) {
    this.app = app;
  }

  /**
   * Determina automáticamente el tipo de partida financiera (CAPEX / OPEX / Contingencia)
   * según la clase del Plan Contable General Empresarial (PCGE)
   */
  classifyPcgeType(clasePcge, categoria = "") {
    const clase = String(clasePcge).trim();
    if (clase === "68" || categoria.toLowerCase().includes("infraestructura") || categoria.toLowerCase().includes("mobiliario")) {
      return "CAPEX"; // Gasto de Capital / Activo Fijo
    }
    if (clase === "65" && categoria.toLowerCase().includes("contingencia")) {
      return "Contingencia";
    }
    if (clase === "10" || categoria.toLowerCase().includes("caja")) {
      return "Caja Chica";
    }
    return "OPEX"; // Gasto Operativo Corriente (Cuentas 60, 62, 63)
  }

  /**
   * Cálculo de subtotales para viáticos integrales (Pasajes + Alimentación + Hospedaje)
   */
  calculateViaticosSubtotal(dias, config = {}) {
    const numDias = Math.max(1, parseInt(dias, 10) || 1);
    const pasajes = parseFloat(config.pasajes) || 0;
    const alimentacion = parseFloat(config.alimentacion) || 0;
    const hospedaje = parseFloat(config.hospedaje) || 0;
    const movilidadLocal = parseFloat(config.movilidadLocal) || 0;

    const costoDiario = alimentacion + hospedaje + movilidadLocal;
    const totalViaticos = pasajes + (costoDiario * numDias);

    return {
      numDias,
      costoDiario,
      pasajes,
      totalViaticos: Math.round(totalViaticos * 100) / 100
    };
  }

  /**
   * Auditoría de Ejecución Presupuestal y Control de Desviaciones
   * @param {number} presupuestado Monto proyectado aprobado
   * @param {number} ejecutado Monto real devengado con comprobante
   * @returns {Object} Diagnóstico de variación financiera
   */
  auditExecution(presupuestado, ejecutado) {
    const p = (typeof window.parseMoney === "function") ? window.parseMoney(presupuestado) : (parseFloat(presupuestado) || 0);
    const e = (typeof window.parseMoney === "function") ? window.parseMoney(ejecutado) : (parseFloat(ejecutado) || 0);
    const saldo = p - e;
    const pctUsado = p > 0 ? (e / p) * 100 : 0;
    const pctNoUsado = Math.max(0, 100 - pctUsado);

    let estadoEjecucion = "Conforme";
    let badgeClass = "bg-emerald-950/80 text-emerald-300 border border-emerald-500/40";

    if (saldo < 0) {
      estadoEjecucion = "Sobrecosto / Desvío Excedido";
      badgeClass = "bg-rose-950/80 text-rose-300 border border-rose-500/40 font-bold";
    } else if (saldo > 0) {
      estadoEjecucion = "Ahorro Financiero Obtenido";
      badgeClass = "bg-blue-950/80 text-blue-300 border border-blue-500/40 font-bold";
    }

    return {
      presupuestado: p,
      ejecutado: e,
      saldoRestante: saldo,
      porcentajeUsado: Math.round(pctUsado * 10) / 10,
      porcentajeNoUsado: Math.round(pctNoUsado * 10) / 10,
      estadoEjecucion,
      badgeClass
    };
  }

  /**
   * Run-rate / proyección del mes (céntimos vía PaoloBudgetAnalytics; sin float).
   */
  getRunRateSnapshot(branchId = "todas", anio = null, mes = null) {
    const now = new Date();
    const y = Number(anio) || now.getFullYear();
    const m = Number(mes) || (now.getMonth() + 1);
    if (window.PaoloBudgetAnalytics && typeof window.PaoloBudgetAnalytics.localAggregate === "function") {
      return window.PaoloBudgetAnalytics.localAggregate(branchId, y, m);
    }
    return {
      presupuestado_centavos: 0,
      ejecutado_centavos: 0,
      utilization_bps: 0,
      projected_month_centavos: 0,
      remaining_centavos: 0
    };
  }

  /**
   * Filtrado multi-criterio de partidas presupuestales
   */
  filterPresupuestos(items, searchVal = "", sede = "ALL", tipo = "ALL", estado = "ALL") {
    if (!Array.isArray(items)) return [];
    const q = (searchVal || "").toLowerCase().trim();

    return items.filter(p => {
      if (!p) return false;

      // Filtro Sede
      if (sede !== "ALL" && sede !== "todas") {
        const pSede = window.db ? window.db.normalizeSede(p.sede) : (p.sede || "");
        if (pSede !== sede) return false;
      }

      // Filtro Tipo (CAPEX / OPEX / Contingencia)
      if (tipo !== "ALL" && p.tipo !== tipo) return false;

      // Filtro Estado (Aprobado / Ejecutado / Observado)
      if (estado !== "ALL" && p.estado !== estado) return false;

      // Búsqueda
      if (q) {
        const text = [
          p.id, p.concepto, p.categoria, p.subcategoria,
          p.responsable, p.notas, p.clasePcge, p.centroCosto
        ].filter(Boolean).join(" ").toLowerCase();

        if (!text.includes(q)) return false;
      }

      return true;
    });
  }
}

// Instanciar y acoplar al ecosistema
window.BudgetController = BudgetController;
window.budgetController = new BudgetController();
