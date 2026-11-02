/**
 * PAOLO ALDEA & ABOGADOS - Petty Cash & Cash Flow Controller
 * Controlador Especializado para la Caja Chica, Conciliación de Egresos/Ingresos,
 * Flujo de Aprobación Documentaria y Centros de Costos Judiciales.
 */

class PettyCashController {
  constructor(appContext = null) {
    this.app = appContext || window.app;
  }

  setContext(app) {
    this.app = app;
  }

  /**
   * Cálculo integral de Balance Contable por Sede
   * @param {Array} transacciones Lista de movimientos de caja chica
   * @returns {Object} Resumen de Ingresos, Egresos, Saldo Neto y Gastos Recuperables
   */
  calculateBalance(transacciones) {
    let totalIngresos = 0;
    let totalEgresos = 0;
    let totalRecuperables = 0;
    let gastosFijos = 0;

    if (!Array.isArray(transacciones)) {
      return { totalIngresos: 0, totalEgresos: 0, saldoNeto: 0, totalRecuperables: 0, gastosFijos: 0 };
    }

    transacciones.forEach(t => {
      if (!t) return;
      const monto = (typeof window.parseMoney === "function") ? window.parseMoney(t.monto) : (parseFloat(t.monto) || 0);
      const tipo = String(t.tipo || "").toLowerCase();
      const centro = String(t.centroCosto || "").toLowerCase();

      if (tipo === "ingreso") {
        totalIngresos += monto;
      } else if (tipo === "egreso") {
        totalEgresos += monto;
        if (centro.includes("recuperable") || (t.expediente && t.expediente !== "-" && t.expediente.length > 3)) {
          totalRecuperables += monto;
        }
        if (centro.includes("fijo") || t.categoria?.toLowerCase().includes("fijo") || t.categoria?.toLowerCase().includes("alquiler")) {
          gastosFijos += monto;
        }
      }
    });

    return {
      totalIngresos: Math.round(totalIngresos * 100) / 100,
      totalEgresos: Math.round(totalEgresos * 100) / 100,
      saldoNeto: Math.round((totalIngresos - totalEgresos) * 100) / 100,
      totalRecuperables: Math.round(totalRecuperables * 100) / 100,
      gastosFijos: Math.round(gastosFijos * 100) / 100
    };
  }

  /**
   * Validador de Transición de Estados de Aprobación
   * Estados: 'Borrador' -> 'Elevado' -> 'Aprobado' | 'Observado' | 'Rechazado'
   */
  canTransitionState(currentState, nextState, userRole) {
    const isMasterOrAdmin = (userRole === "super_admin" || userRole === "admin" || userRole === "socio");

    // Asistentes solo pueden crear Borrador o Elevar
    if (!isMasterOrAdmin) {
      if (currentState === "Borrador" && nextState === "Elevado") return true;
      if (!currentState && (nextState === "Borrador" || nextState === "Elevado")) return true;
      return false;
    }

    // Administradores y Socios tienen potestad resolutiva
    return true;
  }

  /**
   * Filtrado multi-criterio de transacciones
   */
  filterTransactions(items, searchVal = "", sede = "ALL", tipo = "ALL", categoria = "ALL") {
    if (!Array.isArray(items)) return [];
    const q = (searchVal || "").toLowerCase().trim();

    return items.filter(t => {
      if (!t) return false;

      // Filtro Sede
      if (sede !== "ALL" && sede !== "todas") {
        const tSede = window.db ? window.db.normalizeSede(t.sede) : (t.sede || "");
        if (tSede !== sede) return false;
      }

      // Filtro Tipo (Ingreso / Egreso)
      if (tipo !== "ALL" && t.tipo?.toLowerCase() !== tipo.toLowerCase()) return false;

      // Filtro Categoría
      if (categoria !== "ALL" && t.categoria !== categoria) return false;

      // Búsqueda
      if (q) {
        const text = [
          t.id, t.concepto, t.comprobante, t.expediente,
          t.responsable, t.centroCosto, t.metodo, t.categoria
        ].filter(Boolean).join(" ").toLowerCase();

        if (!text.includes(q)) return false;
      }

      return true;
    });
  }
}

// Instanciar y acoplar al ecosistema
window.PettyCashController = PettyCashController;
window.pettyCashController = new PettyCashController();
