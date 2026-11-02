/**
 * PAOLO ALDEA & ABOGADOS - Draft Autosave Engine (Salvaguarda Automática de Formularios)
 * Previene la pérdida involuntaria de demandas, notas reservadas, sustentos y presupuestos
 * Guarda automáticamente en sessionStorage cada 8 segundos y ofrece restauración contextual
 */

class DraftAutosaveManager {
  constructor() {
    this.storagePrefix = "PAOLO_ALDEA_DRAFT_";
    this.registeredForms = new Map();
    this.timer = null;
    this.isDirty = new Map();
  }

  init() {
    // Formularios monitoreados por el sistema
    this.register("modalCaso", {
      inputs: [
        "casoExpediente", "casoCaratula", "casoMateria", "casoTipoProceso",
        "casoCliente", "casoParteContraria", "casoSede", "casoJuzgado",
        "casoJuez", "casoEspecialista", "casoVencimiento", "casoDetalleVencimiento",
        "casoProximaAudiencia", "casoEstado", "casoEtapa", "casoPrioridad",
        "casoCuantia", "casoHonorarios", "casoNotas", "casoAbogado"
      ],
      title: "Expediente Judicial / Caso"
    });

    this.register("modalPresupuesto", {
      inputs: [
        "presSede", "presCentroCosto", "presClasePcge", "presCategoria",
        "presSubcategoria", "presTipo", "presFrecuencia", "presDiasEventual",
        "presCantidad", "presUnidad", "presCostoUnitario", "presPrioridad",
        "presResponsable", "presConcepto", "presNotas"
      ],
      title: "Partida Presupuestal / Gasto"
    });

    this.register("modalCita", {
      inputs: [
        "citaCliente", "citaTelefono", "citaSede", "citaMateria",
        "citaModalidad", "citaAbogado", "citaFechaHora", "citaMotivo",
        "citaNotas", "citaLinkMeet"
      ],
      title: "Cita / Audiencia Judicial"
    });

    this.register("modalCaja", {
      inputs: [
        "cajaSede", "cajaTipo", "cajaCategoria", "cajaMonto",
        "cajaMetodo", "cajaConcepto", "cajaExpediente", "cajaComprobante",
        "cajaResponsable", "cajaCentroCosto"
      ],
      title: "Rendición de Caja Chica"
    });

    this.register("modalGeneradorEscrito", {
      inputs: [
        "escritoExpedienteRef", "escritoEspecialista", "escritoPetitorio",
        "escritoFundamentos", "escritoMediosProbatorios", "escritoAnexos"
      ],
      title: "Escrito Judicial / Minuta"
    });

    this.setupListeners();
    this.startAutoSaveLoop();
  }

  register(modalId, config) {
    this.registeredForms.set(modalId, config);
  }

  setupListeners() {
    this.registeredForms.forEach((cfg, modalId) => {
      const modalEl = document.getElementById(modalId);
      if (!modalEl) return;

      // Escuchar cambios en los inputs configurados
      cfg.inputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
          const markDirty = () => {
            this.isDirty.set(modalId, true);
            this.updateIndicatorState(modalId, "editing");
          };
          input.addEventListener("input", markDirty);
          input.addEventListener("change", markDirty);
        }
      });
    });
  }

  startAutoSaveLoop() {
    if (this.timer) clearInterval(this.timer);
    // Cada 8 segundos evalúa si hay cambios pendientes por guardar
    this.timer = setInterval(() => {
      this.registeredForms.forEach((cfg, modalId) => {
        const modalEl = document.getElementById(modalId);
        // Solo autoguardar si el modal está visible en pantalla y hay cambios pendientes
        if (modalEl && !modalEl.classList.contains("hidden") && this.isDirty.get(modalId)) {
          this.saveDraft(modalId);
        }
      });
    }, 8000);
  }

  saveDraft(modalId) {
    const cfg = this.registeredForms.get(modalId);
    if (!cfg) return;

    const values = {};
    let hasContent = false;

    cfg.inputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        if (el.type === "checkbox") {
          values[id] = el.checked;
        } else {
          const val = el.value.trim();
          values[id] = el.value;
          if (val.length > 0 && id !== "casoSede" && id !== "presSede" && id !== "cajaSede" && id !== "citaSede") {
            hasContent = true;
          }
        }
      }
    });

    // Solo persistir si el usuario redactó algún contenido sustancial
    if (hasContent) {
      const draftObj = {
        timestamp: Date.now(),
        dateStr: new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        modalId: modalId,
        values: values
      };
      try {
        sessionStorage.setItem(this.storagePrefix + modalId, JSON.stringify(draftObj));
        this.isDirty.set(modalId, false);
        this.updateIndicatorState(modalId, "saved", draftObj.dateStr);
      } catch (e) {
        console.warn("DraftAutosave: Error al guardar borrador en sessionStorage:", e);
      }
    }
  }

  getDraft(modalId) {
    try {
      const raw = sessionStorage.getItem(this.storagePrefix + modalId);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  clearDraft(modalId) {
    sessionStorage.removeItem(this.storagePrefix + modalId);
    this.isDirty.set(modalId, false);
    this.removeRestoreBanner(modalId);
    this.updateIndicatorState(modalId, "clear");
  }

  // Notificación visual de estado de autoguardado en la cabecera del modal
  updateIndicatorState(modalId, state, timeStr = "") {
    const modalEl = document.getElementById(modalId);
    if (!modalEl) return;

    let badge = modalEl.querySelector(".draft-autosave-badge");
    if (!badge) {
      const header = modalEl.querySelector(".flex.items-center.justify-between, .bg-slate-950, .bg-gradient-to-r");
      if (header) {
        badge = document.createElement("div");
        badge.className = "draft-autosave-badge flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-semibold transition-all duration-300";
        header.insertBefore(badge, header.lastElementChild);
      }
    }

    if (!badge) return;

    if (state === "editing") {
      badge.className = "draft-autosave-badge flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30";
      badge.innerHTML = `<i class="fa-solid fa-pen-nib text-amber-400 text-xs animate-pulse"></i> <span>Editando...</span>`;
    } else if (state === "saved") {
      badge.className = "draft-autosave-badge flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
      badge.innerHTML = `<i class="fa-solid fa-floppy-disk text-emerald-400 text-xs"></i> <span>Borrador guardado (${timeStr})</span>`;
    } else if (state === "clear") {
      badge.remove();
    }
  }

  // Comprueba si hay un borrador previo y ofrece restaurarlo
  checkAndPromptRestore(modalId, isEditMode = false) {
    if (isEditMode) return; // Si está editando un registro existente con ID, no sobreescribir con borrador

    const draft = this.getDraft(modalId);
    if (!draft || !draft.values) return;

    const modalEl = document.getElementById(modalId);
    if (!modalEl) return;

    this.removeRestoreBanner(modalId);

    const banner = document.createElement("div");
    banner.id = `draft-banner-${modalId}`;
    banner.className = "mx-5 mt-4 p-3 bg-gradient-to-r from-amber-950/80 to-slate-900 border border-amber-500/40 rounded-xl flex items-center justify-between text-xs text-amber-100 shadow-md animate-in fade-in duration-200";
    banner.innerHTML = `
      <div class="flex items-center gap-2.5">
        <div class="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-400/30 flex items-center justify-center shrink-0">
          <i class="fa-solid fa-clock-rotate-left text-sm"></i>
        </div>
        <div>
          <p class="font-bold text-white">Se encontró un borrador previo sin guardar (${draft.dateStr})</p>
          <p class="text-[10px] text-amber-300/90">¿Desea restaurar el contenido que estuvo redactando?</p>
        </div>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <button type="button" onclick="window.draftAutosave.restoreDraft('${modalId}')" class="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs shadow-sm transition flex items-center gap-1">
          <i class="fa-solid fa-arrow-rotate-left"></i> Restaurar
        </button>
        <button type="button" onclick="window.draftAutosave.clearDraft('${modalId}')" class="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg text-xs transition" title="Descartar borrador">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    `;

    const form = modalEl.querySelector("form");
    if (form) {
      form.parentNode.insertBefore(banner, form);
    }
  }

  restoreDraft(modalId) {
    const draft = this.getDraft(modalId);
    if (!draft || !draft.values) return;

    Object.keys(draft.values).forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        if (el.type === "checkbox") {
          el.checked = draft.values[id];
        } else {
          el.value = draft.values[id];
        }
        // Disparar evento de input para actualizar cálculos automáticos (como aranceles o honorarios)
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });

    this.removeRestoreBanner(modalId);
    this.updateIndicatorState(modalId, "saved", draft.dateStr);

    if (window.app && window.app.showToast) {
      window.app.showToast("Borrador restaurado correctamente en el formulario.", "success");
    }
  }

  removeRestoreBanner(modalId) {
    const banner = document.getElementById(`draft-banner-${modalId}`);
    if (banner) banner.remove();
  }
}

// Instanciar singleton global
window.draftAutosave = new DraftAutosaveManager();
document.addEventListener("DOMContentLoaded", () => {
  window.draftAutosave.init();
});
