/**
 * PAOLO ALDEA & ABOGADOS - Cases & Judicial Records Controller
 * Controlador Especializado para la Gestión de Expedientes Judiciales,
 * Semáforo Perentorio de Plazos, Vistas Kanban / Tabular y Resoluciones PDF.
 */

class CasesController {
  constructor(appContext = null) {
    this.app = appContext || window.app;
  }

  setContext(app) {
    this.app = app;
  }

  /**
   * Cálculo del Semáforo Procesal según días restantes
   * @param {string} vencimientoStr Fecha de vencimiento (YYYY-MM-DD o ISO)
   * @returns {Object} Configuración visual del semáforo procesal
   */
  calculateSemaforoPlazo(vencimientoStr) {
    if (!vencimientoStr) {
      return {
        diasRestantes: 999,
        badgeClass: "bg-slate-100 text-slate-600 border border-slate-300",
        label: "Sin fecha fatal",
        urgente: false,
        icon: "fa-regular fa-clock"
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const parts = vencimientoStr.split("T")[0].split("-");
    const dueDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    dueDate.setHours(0, 0, 0, 0);

    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        diasRestantes: diffDays,
        badgeClass: "bg-rose-950/80 text-rose-300 border border-rose-500/50 font-black animate-pulse",
        label: `VENCIDO hace ${Math.abs(diffDays)}d`,
        urgente: true,
        icon: "fa-solid fa-triangle-exclamation"
      };
    } else if (diffDays <= 3) {
      return {
        diasRestantes: diffDays,
        badgeClass: "bg-rose-900/70 text-rose-200 border border-rose-400 font-extrabold shadow-sm animate-pulse",
        label: diffDays === 0 ? "¡VENCE HOY!" : `FATAL: ${diffDays}d restante${diffDays === 1 ? '' : 's'}`,
        urgente: true,
        icon: "fa-solid fa-bell"
      };
    } else if (diffDays <= 7) {
      return {
        diasRestantes: diffDays,
        badgeClass: "bg-amber-950/80 text-amber-300 border border-amber-500/40 font-bold",
        label: `Próximo: ${diffDays}d`,
        urgente: false,
        icon: "fa-solid fa-hourglass-half"
      };
    } else {
      return {
        diasRestantes: diffDays,
        badgeClass: "bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 font-semibold",
        label: `En plazo (${diffDays}d)`,
        urgente: false,
        icon: "fa-solid fa-check"
      };
    }
  }

  /**
   * Filtrado inteligente de expedientes por múltiples criterios
   */
  filterCasos(casosList, searchVal = "", materia = "ALL", prioridad = "ALL", sede = "ALL") {
    if (!Array.isArray(casosList)) return [];
    const q = (searchVal || "").toLowerCase().trim();

    return casosList.filter(c => {
      if (!c) return false;

      // Filtro de Sede
      if (sede !== "ALL" && sede !== "todas") {
        const cSede = window.db ? window.db.normalizeSede(c.sede) : (c.sede || "");
        if (cSede !== sede) return false;
      }

      // Filtro de Materia
      if (materia !== "ALL" && c.materia !== materia) return false;

      // Filtro de Prioridad
      if (prioridad !== "ALL" && c.prioridad !== prioridad) return false;

      // Filtro de Búsqueda Textual
      if (q) {
        const textToSearch = [
          c.expediente, c.caratula, c.cliente, c.parteContraria,
          c.juzgado, c.juez, c.materia, c.tipoProceso, c.abogadoAsignado
        ].filter(Boolean).join(" ").toLowerCase();

        if (!textToSearch.includes(q)) return false;
      }

      return true;
    });
  }

  /**
   * Agrupación por etapas para vista Kanban (Flujo de Ingeniería de Procesos)
   */
  groupCasosByEtapas(casosList) {
    const columns = {
      postulatoria: [],
      probatoria: [],
      decisoria: [],
      impugnatoria: [],
      ejecucion: []
    };

    if (!Array.isArray(casosList)) return columns;

    casosList.forEach(c => {
      const etapa = (c.etapa || "").toLowerCase();
      if (etapa.includes("postul") || etapa.includes("saneam") || etapa.includes("inicio")) {
        columns.postulatoria.push(c);
      } else if (etapa.includes("prob") || etapa.includes("actuaci") || etapa.includes("audiencia") || etapa.includes("juzga")) {
        columns.probatoria.push(c);
      } else if (etapa.includes("decis") || etapa.includes("sentencia") || etapa.includes("conclus")) {
        columns.decisoria.push(c);
      } else if (etapa.includes("impug") || etapa.includes("apelac") || etapa.includes("casaci")) {
        columns.impugnatoria.push(c);
      } else if (etapa.includes("ejecuc") || etapa.includes("remate") || etapa.includes("forzad") || etapa.includes("archivo")) {
        columns.ejecucion.push(c);
      } else {
        columns.postulatoria.push(c);
      }
    });

    return columns;
  }

  /**
   * Validación formal de campos obligatorios del expediente
   */
  validateCasoData(formData) {
    const errors = [];
    if (!formData.expediente || formData.expediente.trim().length < 4) {
      errors.push("El número de expediente judicial es obligatorio y debe tener formato oficial.");
    }
    if (!formData.caratula || formData.caratula.trim().length < 3) {
      errors.push("La carátula o asunto principal del proceso es obligatoria.");
    }
    if (!formData.cliente || formData.cliente.trim().length < 2) {
      errors.push("Debe consignar el nombre del cliente o patrocinado.");
    }
    if (!formData.vencimiento) {
      errors.push("Debe ingresar la fecha límite o vencimiento del próximo acto procesal.");
    }
    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }
}

// Instanciar y acoplar al ecosistema
window.CasesController = CasesController;
window.casesController = new CasesController();
