/**
 * PAOLO ALDEA & ABOGADOS - Application Core Controller
 * Especializado para: PAOLO ALDEA & ABOGADOS (Sede Challhuahuacho)
 * Control de Gestión Operativa & Administrativa - Enfoque Ingeniería Industrial
 */

// Helpers seguros para obtención de valores de formulario (evitan cualquier error de null pointer)
const getSafeVal = (id, fallback = "") => {
  const el = document.getElementById(id);
  return el ? el.value.trim() : fallback;
};

const getSafeNum = (id, fallback = 0) => {
  const el = document.getElementById(id);
  if (!el || !el.value) return fallback;
  const n = parseFloat(el.value);
  return isNaN(n) ? fallback : n;
};

const getSafeInt = (id, fallback = 0) => {
  const el = document.getElementById(id);
  if (!el || !el.value) return fallback;
  const n = parseInt(el.value, 10);
  return isNaN(n) ? fallback : n;
};

// Sanitizador contra inyección HTML para renderizado seguro en tablas y vistas
const escapeHtml = (str) => {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};
window.escapeHtml = escapeHtml;

/**
 * Serializa un valor para usarlo como literal JS dentro de atributos HTML
 * (onclick="..."). JSON.stringify usa comillas dobles; hay que escaparlas
 * a &quot; o el navegador corta el atributo y dispara SyntaxError.
 */
const jsStr = (val) =>
  JSON.stringify(String(val ?? ""))
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;");
window.jsStr = jsStr;

/** Solo data:image o https/http seguros para fotos de perfil. */
const safeImageSrc = (src) => {
  if (!src || typeof src !== "string") return "";
  const s = src.trim();
  if (/^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(s)) return s;
  if (/^https?:\/\//i.test(s) && !/[\s\"\'<>]/.test(s)) return s;
  return "";
};
window.safeImageSrc = safeImageSrc;

class LegalApp {

  constructor() {
    this.currentTab = "asistencia";
    this.activeModal = null;
    this.editingId = null;
    this.editingPresupuestoId = null;
    this.currentPreviewDoc = null;
    this.casosViewMode = "table"; // 'table' o 'kanban'
    this.pendingCasoPdfFile = null;
    this.pendingExpedientePdfFile = null;
    this.pendingResolucionPdfFile = null;
    this.pendingRapidaPdfFile = null;
    this.currentViewingPdf = null;
    this.removePdfFlag = false;
    this.removeExpedientePdfFlag = false;
    this.removeResolucionPdfFlag = false;
    this.currentWaCitaId = null;

    // Controladores Modulares Especializados
    this.cases = window.casesController || null;
    if (this.cases) this.cases.setContext(this);
    this.budget = window.budgetController || null;
    if (this.budget) this.budget.setContext(this);
    this.pettyCash = window.pettyCashController || null;
    if (this.pettyCash) this.pettyCash.setContext(this);
    this.calendar = window.calendarController || null;
    if (this.calendar) this.calendar.setContext(this);
    this.inventory = window.inventoryController || null;
    if (this.inventory) this.inventory.setContext(this);
    this.documents = window.documentsController || null;
    if (this.documents) this.documents.setContext(this);
    this.admin = window.adminController || null;
    if (this.admin) this.admin.setContext(this);

    // Motor de Autoguardado en Borrador
    this.draftAutosave = window.draftAutosave || null;
  }

  
  updateDynamicTitles() {
    const activeSedeKey = window.db ? window.db.getActiveSede() : "challhuahuacho";
    const branchConfig = (window.SEDES_CONFIG && window.SEDES_CONFIG[activeSedeKey]) ? window.SEDES_CONFIG[activeSedeKey] : null;
    const sedeLabel = branchConfig ? branchConfig.nombre : (activeSedeKey === "todas" ? "Consolidado Nacional" : "Sede Challhuahuacho");
    const juzgadoLabel = (branchConfig && branchConfig.region) ? `Juzgados de ${branchConfig.region}` : (activeSedeKey === "todas" ? "Juzgados Nacionales" : "Juzgados de Cotabambas");

    const titles = {
      kpis: `Tablero de Control Operativo & KPIs Power BI \u2014 ${sedeLabel}`,
      asistencia: `Control de Asistencia \u2014 ${sedeLabel}`,
      caja_chica: `Control de Caja Chica & Centros de Costo \u2014 ${sedeLabel}`,
      presupuestos: `Presupuestos & Proyecciones Financieras \u2014 ${sedeLabel}`,
      casos: `Agendamiento de Casos & Expedientes \u2014 ${juzgadoLabel}`,
      citas: `Agenda de Citas & Audiencias Virtuales / Presenciales \u2014 ${sedeLabel}`,
      inventario: `Inventario Patrimonial & Archivo Central (M\u00E9todo ABC) \u2014 ${sedeLabel}`,
      documentos: `Gesti\u00F3n Documental & Modelos Oficiales de la Firma \u2014 ${sedeLabel}`,
      personal: `Directorio y Gesti\u00F3n Centralizada de Personal Profesional \u2014 ${sedeLabel}`,
      roles_permisos: `Matriz de Roles y Gesti\u00F3n de Permisos (RBAC) \u2014 ${sedeLabel}`,
      master_admin: `Panel de Control Total y Gobierno de la Firma \u2014 ${sedeLabel}`
    };

    const headerTitleEl = document.getElementById("pageHeaderTitle");
    if (headerTitleEl && this.currentTab) {
      headerTitleEl.textContent = titles[this.currentTab] || `PAOLO ALDEA & ABOGADOS \u2014 ${sedeLabel}`;
    }

    const flujoCajaBadge = document.getElementById("flujoCajaSedeBadge");
    if (flujoCajaBadge) flujoCajaBadge.textContent = sedeLabel;

    if (window.AttendanceModule && typeof window.AttendanceModule.paintSedeHero === "function") {
      window.AttendanceModule.paintSedeHero(activeSedeKey === "todas" ? {
        id: "todas",
        nombre: "PAOLO ALDEA & ABOGADOS",
        nombreCorto: "Consolidado Nacional",
        ciudad: "CONSOLIDADO NACIONAL"
      } : (branchConfig ? {
        id: branchConfig.id || activeSedeKey,
        nombre: branchConfig.nombre,
        nombreCorto: branchConfig.nombreCorto,
        ciudad: branchConfig.region || ""
      } : {
        id: "challhuahuacho",
        nombre: sedeLabel,
        nombreCorto: sedeLabel,
        ciudad: ""
      }));
    } else {
      const radarSedeSub = document.getElementById("asistencia-radar-sede-sub");
      if (radarSedeSub) radarSedeSub.textContent = sedeLabel;
    }
  }

  setupAutoSaveSettings() {
    const form = document.getElementById("formSettings");
    if (!form || form.dataset.autosaveBound) return;
    form.dataset.autosaveBound = "true";

    let debounceTimer = null;
    const triggerAutoSave = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.autoSaveCurrentSettings();
      }, 350);
    };

    form.querySelectorAll("input, select, textarea").forEach(el => {
      el.addEventListener("input", triggerAutoSave);
      el.addEventListener("change", triggerAutoSave);
    });

    ["cfgWebPushOptIn", "cfgPushAutoSend", "cfgPushScope", "cfgTelegramToken", "cfgTelegramChatId"].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("input", triggerAutoSave);
        el.addEventListener("change", triggerAutoSave);
      }
    });
  }

  autoSaveCurrentSettings() {
    try {
      const current = window.db.getSettings();
      const activeSedeKey = window.db ? window.db.getActiveSede() : "challhuahuacho";

      const firmName = getSafeVal("cfgFirmName", current.firmName || "PAOLO ALDEA & ABOGADOS");
      const firmBranch = getSafeVal("cfgFirmBranch", current.firmBranch || "Sede Challhuahuacho");
      const managingAttorney = getSafeVal("cfgManagingAttorney", current.managingAttorney || "Dr. Paolo Aldea Quincho");
      const firmLicense = getSafeVal("cfgFirmLicense", current.firmLicense || "CAL / CAA");
      const adminOfficer = getSafeVal("cfgAdminOfficer", current.adminOfficer || "Ing. Yimer Dami\u00E1n Soto");
      const adminTitle = getSafeVal("cfgAdminTitle", current.adminTitle || "Ingenier\u00EDa Industrial");
      const firmAddress = getSafeVal("cfgFirmAddress", current.firmAddress || "");
      const firmPhone = getSafeVal("cfgFirmPhone", current.firmPhone || "+51 943 410 215");
      const currency = getSafeVal("cfgCurrency", current.currency || "S/");

      const autoSend = document.getElementById("cfgPushAutoSend") ? document.getElementById("cfgPushAutoSend").checked : true;
      const webPushOptIn = document.getElementById("cfgWebPushOptIn") ? document.getElementById("cfgWebPushOptIn").checked : !!current.webPushOptIn;
      const pushScopeEl = document.getElementById("cfgPushScope");
      const pushScope = pushScopeEl ? pushScopeEl.value : (current.pushScope || "self");
      const tgToken = getSafeVal("cfgTelegramToken", current.telegramToken || "");
      const tgChat = getSafeVal("cfgTelegramChatId", current.telegramChatId || "");

      const newSettings = {
        ...current,
        firmName,
        firmBranch,
        managingAttorney,
        firmLicense,
        adminOfficer,
        adminTitle,
        firmAddress,
        firmPhone,
        currency,
        pushAutoSend: autoSend,
        webPushOptIn,
        pushScope,
        pushAnonymize: true,
        telegramToken: tgToken,
        telegramChatId: tgChat
      };
      if (window.PaoloPushService) window.PaoloPushService.setOptIn(!!webPushOptIn);

            if (window.SEDES_CONFIG && window.SEDES_CONFIG[activeSedeKey]) {
        window.SEDES_CONFIG[activeSedeKey].nombre = firmBranch;
        window.SEDES_CONFIG[activeSedeKey].direccion = firmAddress;
        window.SEDES_CONFIG[activeSedeKey].telefono = firmPhone;
        try {
          localStorage.setItem("PAOLO_ALDEA_SEDES_CUSTOM", JSON.stringify(window.SEDES_CONFIG));
          if (window.db && typeof window.db.saveCustomSedes === "function") {
            window.db.saveCustomSedes(Object.values(window.SEDES_CONFIG));
          }
        } catch(e) {}
      }

      window.db.saveSettings(newSettings);
      document.querySelectorAll(".firm-name-display").forEach(el => el.textContent = firmName);
      document.querySelectorAll(".firm-branch-display").forEach(el => el.textContent = firmBranch);
      document.querySelectorAll(".firm-attorney-display").forEach(el => el.textContent = managingAttorney);
      document.querySelectorAll(".firm-license-display").forEach(el => el.textContent = firmLicense);
      document.querySelectorAll(".admin-officer-display").forEach(el => el.textContent = adminOfficer);
      document.querySelectorAll(".admin-title-display").forEach(el => el.textContent = adminTitle);

      this.renderMasterSedes();
      if (typeof this.renderSedeSelector === 'function') this.renderSedeSelector();
      if (typeof this.applySedeToHeader === 'function') this.applySedeToHeader();
      this.showAutoSaveIndicator();
      return;
    } catch (err) {
      console.warn("Auto-save settings warning:", err);
    }
  }

  showAutoSaveIndicator() {
    let indicator = document.getElementById("autoSaveIndicator");
    if (!indicator) {
      indicator = document.createElement("div");
      indicator.id = "autoSaveIndicator";
      indicator.className = "fixed bottom-4 right-4 bg-slate-900 text-emerald-400 border border-emerald-500/40 text-[11px] font-bold px-3 py-1.5 rounded-xl shadow-xl flex items-center gap-2 z-50 transition-opacity duration-300 opacity-0 pointer-events-none";
      indicator.innerHTML = '<i class="fa-solid fa-check text-emerald-400 text-xs"></i> Guardado autom\u00E1tico';
      document.body.appendChild(indicator);
    }
    indicator.style.opacity = "1";
    clearTimeout(this._autoSaveTimer);
    this._autoSaveTimer = setTimeout(() => {
      indicator.style.opacity = "0";
    }, 1500);
  }

  // =========================================================================
  // SISTEMA DE TEMA (MODO OSCURO / CLARO) & CONTRASTE VISUAL ÓPTIMO
  // =========================================================================
  initTheme() {
    try {
      const savedTheme = localStorage.getItem("PAOLO_ALDEA_THEME");
      const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      const isDark = savedTheme === "dark" || (!savedTheme && prefersDark);
      
      if (isDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      const metaThemeColor = document.getElementById("metaThemeColor");
      if (metaThemeColor) {
        metaThemeColor.setAttribute("content", isDark ? "#141518" : "#F8FAFC");
      }
      this.updateThemeIcon(isDark);
    } catch (e) {
      console.warn("Theme init error:", e);
    }
  }

  toggleTheme() {
    try {
      const isCurrentlyDark = document.documentElement.classList.contains("dark");
      const newTheme = isCurrentlyDark ? "light" : "dark";
      
      if (newTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      
      localStorage.setItem("PAOLO_ALDEA_THEME", newTheme);
      this.updateThemeIcon(newTheme === "dark");

      const metaThemeColor = document.getElementById("metaThemeColor");
      if (metaThemeColor) {
        metaThemeColor.setAttribute("content", newTheme === "dark" ? "#141518" : "#F8FAFC");
      }

      this.showToast(newTheme === "dark" ? "Modo oscuro activado" : "Modo claro activado", "info");
    } catch (e) {
      console.warn("Toggle theme error:", e);
    }
  }

  updateThemeIcon(isDark) {
    const icon = document.getElementById("themeToggleIcon");
    const btn = document.getElementById("btnToggleTheme");
    if (icon) {
      if (isDark) {
        icon.className = "fa-solid fa-sun text-xs text-amber-400";
        if (btn) btn.title = "Cambiar a Modo Claro";
      } else {
        icon.className = "fa-solid fa-moon text-xs text-slate-700";
        if (btn) btn.title = "Cambiar a Modo Oscuro";
      }
    }
  }

  // =========================================================================
  // PWA (PROGRESSIVE WEB APP) & SERVICE WORKER MÓVIL
  // =========================================================================
  isPwaInstalled() {
    try {
      if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return true;
      if (window.matchMedia && window.matchMedia("(display-mode: minimal-ui)").matches) return true;
      if (typeof navigator !== "undefined" && navigator.standalone === true) return true; // iOS Safari
      if (document.referrer && document.referrer.startsWith("android-app://")) return true;
      if (localStorage.getItem("PA_PWA_INSTALLED") === "1") return true;
    } catch (_) {}
    return false;
  }

  setPwaInstallButtonVisible(visible) {
    const btnInstall = document.getElementById("btnPwaInstall");
    if (!btnInstall) return;
    if (visible && !this.isPwaInstalled()) {
      btnInstall.classList.remove("hidden");
      btnInstall.classList.add("inline-flex");
      btnInstall.setAttribute("aria-hidden", "false");
    } else {
      btnInstall.classList.add("hidden");
      btnInstall.classList.remove("inline-flex");
      btnInstall.setAttribute("aria-hidden", "true");
    }
  }

  initPwa() {
    // El service worker y el aviso de versión nueva viven en js/app-update.js.
    // Si ya está instalada en este dispositivo, nunca mostrar "Instalar App".
    this.setPwaInstallButtonVisible(false);

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      if (this.isPwaInstalled()) {
        this.deferredPwaPrompt = null;
        this.setPwaInstallButtonVisible(false);
        return;
      }
      this.deferredPwaPrompt = e;
      this.setPwaInstallButtonVisible(true);
    });

    window.addEventListener("appinstalled", () => {
      this.deferredPwaPrompt = null;
      try {
        localStorage.setItem("PA_PWA_INSTALLED", "1");
      } catch (_) {}
      this.setPwaInstallButtonVisible(false);
      this.showToast("¡Aplicación Paolo Aldea instalada en su dispositivo!", "success");
    });

    // Revalidar si el usuario abre la PWA ya instalada
    try {
      if (window.matchMedia) {
        const mq = window.matchMedia("(display-mode: standalone)");
        const sync = () => {
          if (mq.matches) {
            try {
              localStorage.setItem("PA_PWA_INSTALLED", "1");
            } catch (_) {}
            this.setPwaInstallButtonVisible(false);
          }
        };
        sync();
        if (typeof mq.addEventListener === "function") mq.addEventListener("change", sync);
        else if (typeof mq.addListener === "function") mq.addListener(sync);
      }
    } catch (_) {}
  }

  async installPwa() {
    if (this.isPwaInstalled()) {
      this.setPwaInstallButtonVisible(false);
      this.showToast("Esta aplicación ya está instalada en este dispositivo.", "info");
      return;
    }
    if (this.deferredPwaPrompt) {
      this.deferredPwaPrompt.prompt();
      const choiceResult = await this.deferredPwaPrompt.userChoice;
      if (choiceResult.outcome === "accepted") {
        try {
          localStorage.setItem("PA_PWA_INSTALLED", "1");
        } catch (_) {}
        this.setPwaInstallButtonVisible(false);
        this.showToast("Instalando aplicaci\u00F3n Paolo Aldea...", "success");
      }
      this.deferredPwaPrompt = null;
    } else {
      this.openModal("modalInstalarPwa");
    }
  }

  async triggerNativePwaInstall() {
    if (this.deferredPwaPrompt) {
      this.deferredPwaPrompt.prompt();
      const choiceResult = await this.deferredPwaPrompt.userChoice;
      if (choiceResult.outcome === "accepted") {
        this.showToast("Instalando aplicaci\u00F3n Paolo Aldea...", "success");
      }
      this.deferredPwaPrompt = null;
      this.closeModal("modalInstalarPwa");
    } else {
      const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      if (isIos) {
        this.showToast("En iPhone/iPad: Toque el ícono Compartir de Safari y elija 'Agregar a pantalla de inicio'", "info");
      } else {
        this.showToast("Abra el men\u00FA del navegador (\u22EE) y elija 'Instalar aplicaci\u00F3n'.", "info");
      }
    }
  }

  async initLocalServerConnection() {
    if (typeof window === "undefined" || !window.location || !window.location.protocol.startsWith("http")) return;
    try {
      const params = new URLSearchParams(window.location.search || "");
      let pairing = (params.get("local_pair") || params.get("pair") || "").trim();
      const storedTok = sessionStorage.getItem("PA_LOCAL_API_TOKEN") || "";
      if (storedTok) window.__LOCAL_SERVER_API_KEY__ = storedTok;

      const body = {};
      if (pairing) body.pairing = pairing;

      const resp = await fetch("/api/session", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          ...(storedTok ? { Authorization: "Bearer " + storedTok } : {})
        },
        body: JSON.stringify(body)
      });

      if (resp.ok) {
        const info = await resp.json();
        if (info && info.token) {
          window.__LOCAL_SERVER_API_KEY__ = info.token;
          sessionStorage.setItem("PA_LOCAL_API_TOKEN", info.token);
          window.__LOCAL_SERVER_PORT__ = info.port || window.location.port || "8080";
          window.__POWER_BI_URL__ = info.powerBiUrl || ("http://localhost:" + window.__LOCAL_SERVER_PORT__ + "/api/powerbi/dataset");
          // No persistir el Bearer en settings/localStorage (evita fuga en backups JSON)
          console.info("[Servidor Local] Sesión emparejada (cookie HttpOnly + Bearer en memoria de pestaña).");
        }
      } else if (resp.status === 401 && storedTok) {
        sessionStorage.removeItem("PA_LOCAL_API_TOKEN");
        window.__LOCAL_SERVER_API_KEY__ = "";
      }

      if (pairing) {
        params.delete("local_pair");
        params.delete("pair");
        const clean = window.location.pathname + (params.toString() ? "?" + params.toString() : "") + (window.location.hash || "");
        try { window.history.replaceState({}, "", clean); } catch (_) {}
      }
    } catch (_) {}
  }

  async init() {
    this.initTheme();
    this.initLocalServerConnection();
    this.initPwa();
    this.initRealtimeMeetSync();

    // Esperar IndexedDB + clean-slate antes de auth/UI (evita bootstrap falso / wipe)
    if (window.db && typeof window.db.ready === "function") {
      try { await window.db.ready(); } catch (_) {}
    }

    // Modo B enterprise (no-op si no hay SUPABASE_* en Netlify)
    if (window.PaoloEnterprise && typeof window.PaoloEnterprise.boot === "function") {
      try { await window.PaoloEnterprise.boot(); } catch (_) {}
    }

    // Multi-dispositivo: sincronizar si ya existe Super Admin en la nube (Supabase)
    try { await this.syncCloudAuthGate(); } catch (_) {}

    // Gestión de Sesiones Senior:
    // 1. Bloquea únicamente si el usuario recarga la página (F5 / Recargar) o si expiró por inactividad (2-3 min).
    // 2. Permite navegación fluida entre múltiples pestañas/ventanas sin bloquear al cambiar de pestaña.
    this.initSessionLifecycle();
    this.checkAuthentication();
    this.setupScreenLockSecurity();
    if (window.alerts) window.alerts.evaluateAlerts();
    this.applySettingsToUI();
    if (typeof this.renderDynamicSidebarModules === "function") this.renderDynamicSidebarModules();
    await this.switchTab("asistencia");
    this.setupEventListeners();
    this.setupAutoSaveSettings();
    if (window.AttendanceModule) {
      if (typeof window.AttendanceModule.init === "function") {
        window.AttendanceModule.init({ forceKiosk: true });
      }
      if (typeof window.AttendanceModule.enterKioskColaborador === "function") {
        window.AttendanceModule.enterKioskColaborador();
      }
    }

    setInterval(() => {
      if (window.alerts) window.alerts.evaluateAlerts();
    }, 300000);

    setTimeout(async () => {
      if (typeof this.actualizarIndicadorNube === "function") {
        this.cargarAjustesFirebaseUI();
        this.actualizarIndicadorNube("online", "Nube Multi-Sede");
      }
      if (window.firebaseService && typeof window.firebaseService.hasCredentials === "function" && window.firebaseService.hasCredentials()) {
        window.firebaseService.init().then((ok) => {
          if (ok) window.firebaseService.fullSync(null, true).catch(() => {});
        });
      }
      const s = window.db ? window.db.getSettings() : {};
      if (s.cloudSyncAuto !== false) {
        this.sincronizarConNube(true);
      }
      this.initHeartbeatNotifier();
      this.setupNetworkSyncListeners();
      this.updateStorageQuotaDisplay();
      setInterval(() => this.updateStorageQuotaDisplay(), 60000);
    }, 800);
  }

  applySettingsToUI() {
    const s = window.db.getSettings();
    const activeSedeKey = this.resolveDisplaySedeKey
      ? this.resolveDisplaySedeKey()
      : (window.db ? window.db.getActiveSede() : "challhuahuacho");
    const branchConfig = (window.SEDES_CONFIG && window.SEDES_CONFIG[activeSedeKey]) ? window.SEDES_CONFIG[activeSedeKey] : null;

    const branchNameDisplay = this.getActiveBranchDisplayLabel
      ? this.getActiveBranchDisplayLabel({ uppercase: false })
      : (branchConfig ? branchConfig.nombre : (activeSedeKey === "todas" ? "Consolidado Nacional" : (s.firmBranch || "Sede Challhuahuacho")));
    document.querySelectorAll(".firm-name-display").forEach(el => el.textContent = s.firmName || "PAOLO ALDEA & ABOGADOS");
    document.querySelectorAll(".firm-branch-display").forEach(el => {
      if (el.classList.contains("firm-branch-login") || el.id === "loginSedeDisplay") {
        el.textContent = this.getActiveBranchDisplayLabel
          ? this.getActiveBranchDisplayLabel({ uppercase: true })
          : String(branchNameDisplay).toUpperCase();
      } else {
        el.textContent = branchNameDisplay;
      }
    });
    if (typeof this.applySedeToHeader === "function") this.applySedeToHeader();
    document.querySelectorAll(".firm-attorney-display").forEach(el => el.textContent = s.managingAttorney || "Dr. Paolo Aldea Quincho");
    document.querySelectorAll(".firm-license-display").forEach(el => el.textContent = s.firmLicense || "CAL / CAA - Registro Profesional");
    const currentUser = window.db ? window.db.getCurrentUser() : null;
    const userName = currentUser ? (currentUser.nombre || currentUser.nombres || s.adminOfficer) : (s.adminOfficer || "Ing. Yimer Dami\u00E1n Soto");
    const userTitle = currentUser ? (currentUser.cargo || s.adminTitle) : (s.adminTitle || "Ingenier\u00EDa Industrial");
    document.querySelectorAll(".admin-officer-display").forEach(el => el.textContent = userName);
    document.querySelectorAll(".admin-title-display").forEach(el => el.textContent = userTitle);

    const userId = currentUser ? (currentUser.id || currentUser.dni || "WRK-000") : "WRK-000";
    const userPhoto = (currentUser && currentUser.foto) 
      || localStorage.getItem("PAOLO_ALDEA_USER_PHOTO_" + userId) 
      || s.userPhoto 
      || "";
    this.updateProfilePhotoUI(userPhoto);

        const inSuperUser = document.getElementById("superAdminNewUser");
    if (inSuperUser) inSuperUser.value = s.adminUser || "admin";
    const inName = document.getElementById("cfgFirmName");
    const inBranch = document.getElementById("cfgFirmBranch");
    const inAtty = document.getElementById("cfgManagingAttorney");
    const inLic = document.getElementById("cfgFirmLicense");
    const inAdmin = document.getElementById("cfgAdminOfficer");
    const inTitle = document.getElementById("cfgAdminTitle");
    const inAddr = document.getElementById("cfgFirmAddress");
    const inPhone = document.getElementById("cfgFirmPhone");
    const inCurr = document.getElementById("cfgCurrency");

    if (inName) inName.value = s.firmName || "PAOLO ALDEA & ABOGADOS";
    if (inBranch) inBranch.value = branchNameDisplay;
    if (inAtty) inAtty.value = s.managingAttorney || "Dr. Paolo Aldea Quincho";
    if (inLic) inLic.value = s.firmLicense || "CAL / CAA - Registro Profesional";
    if (inAdmin) inAdmin.value = s.adminOfficer || "Ing. Yimer Dami\u00E1n Soto";
    if (inTitle) inTitle.value = s.adminTitle || "Ingenier\u00EDa Industrial";
    if (inAddr) {
      inAddr.value = branchConfig ? branchConfig.direccion : (activeSedeKey === "todas" ? "Cobertura Nacional: Lima \u2022 Abancay \u2022 Cusco \u2022 Huaraz \u2022 Challhuahuacho" : (s.firmAddress || ""));
    }
    if (inPhone) {
      inPhone.value = branchConfig ? branchConfig.telefono : (s.firmPhone || "+51 943 410 215");
    }
    if (inCurr) inCurr.value = s.currency || "S/";

    const inPushAuto = document.getElementById("cfgPushAutoSend");
    const inWebPushOpt = document.getElementById("cfgWebPushOptIn");
    const inPushScope = document.getElementById("cfgPushScope");
    const inTgToken = document.getElementById("cfgTelegramToken");
    const inTgChat = document.getElementById("cfgTelegramChatId");

    if (inPushAuto) inPushAuto.checked = s.pushAutoSend !== false;
    if (inWebPushOpt) {
      inWebPushOpt.checked =
        s.webPushOptIn === true || (window.PaoloPushService && window.PaoloPushService.isOptedIn());
    }
    if (inPushScope) inPushScope.value = s.pushScope || "self";
    if (inTgToken) inTgToken.value = s.telegramToken || "";
    if (inTgChat) inTgChat.value = s.telegramChatId || "";
    if (typeof this.refreshWebPushStatus === "function") this.refreshWebPushStatus();

    // Sincronizaci\u00F3n Arquitectura Multi-Sede (RBAC)
    // currentUser already initialized above in applySettingsToUI
    const isGlobal = window.db ? window.db.isGlobalAdmin(currentUser) : true;

    const globalSedeContainer = document.getElementById("globalSedeSelectorContainer");
    const globalSedeSelect = document.getElementById("globalSedeSelect");
    const workerSedeBadge = document.getElementById("workerSedeLockedBadge");
    const workerSedeText = document.getElementById("workerSedeLockedText");

    if (isGlobal) {
      if (globalSedeContainer) globalSedeContainer.classList.remove("hidden");
      if (globalSedeSelect) globalSedeSelect.value = activeSedeKey;
      if (typeof this.syncSedePickerUI === "function") this.syncSedePickerUI(activeSedeKey);
      if (workerSedeBadge) {
        workerSedeBadge.classList.add("hidden");
        workerSedeBadge.classList.remove("flex");
      }
    } else {
      if (globalSedeContainer) globalSedeContainer.classList.add("hidden");
      if (workerSedeBadge) {
        workerSedeBadge.classList.remove("hidden");
        workerSedeBadge.classList.add("flex");
      }
      if (workerSedeText) {
        const userBranchCfg = (window.SEDES_CONFIG && currentUser?.sede) ? window.SEDES_CONFIG[currentUser.sede] : null;
        workerSedeText.textContent = userBranchCfg ? userBranchCfg.nombre : `Sede ${currentUser?.sede || 'Asignada'}`;
      }
    }

    // Configurar selectores de sede en modales de creaci\u00F3n
    const modalSedeSelects = ["casoSede", "cajaSede", "citaSede", "presSede", "invSede", "docSede", "personalSede"];
    modalSedeSelects.forEach(selId => {
      const sel = document.getElementById(selId);
      if (sel) {
        if (!isGlobal && currentUser) {
          sel.value = currentUser.sede;
          sel.disabled = true;
          sel.title = "Sede fijada seg\u00FAn perfil de colaborador asignado";
        } else {
          sel.disabled = false;
          sel.value = activeSedeKey === "todas" ? "challhuahuacho" : activeSedeKey;
        }
      }
    });

    this.updateDynamicTitles();

    // Control de Interfaz basado en Roles (RBAC Multi-Sede)
    const userRole = window.db ? window.db.getUserRole(currentUser) : "asistente";
    const isSuper = (window.db && typeof window.db.isSuperAdmin === "function") ? window.db.isSuperAdmin(currentUser) : (userRole === "super_admin" || userRole === "socio");

    document.querySelectorAll(".nav-tab-btn").forEach(btn => {
      const tab = btn.dataset.tab;
      if (tab && window.db) {
        const canAccess = window.db.canAccessModule(currentUser, tab);
        btn.classList.toggle("hidden", !canAccess);
      }
    });

    // Panel de Control Total & Gobierno: Visibilidad exclusiva para Super Administrador (Oculto para Socios y Admins)
    const navMasterBtn = document.getElementById("nav-btn-master-admin");
    const containerMasterNav = document.getElementById("container-nav-master-admin");
    if (navMasterBtn) navMasterBtn.classList.toggle("hidden", !isSuper);
    if (containerMasterNav) containerMasterNav.classList.toggle("hidden", !isSuper);

    const canManagePersonal = !currentUser || userRole === "super_admin" || userRole === "admin" || userRole === "socio" || (window.db && window.db.isGlobalAdmin(currentUser));
    const btnNuevoPersonal = document.getElementById("btnNuevoPersonal");
    if (btnNuevoPersonal) {
      btnNuevoPersonal.classList.toggle("hidden", !canManagePersonal);
    }
    const btnNuevoPersonalSecondary = document.getElementById("btnNuevoPersonalSecondary");
    if (btnNuevoPersonalSecondary) {
      btnNuevoPersonalSecondary.classList.toggle("hidden", !canManagePersonal);
    }

    this.renderDirectorioBanner();
  }

  /**
   * Sede a mostrar en membretes: prioriza sede del usuario (si no es global),
   * si no la sede activa de la app / última sede usada (también en pantalla de login).
   */
  resolveDisplaySedeKey() {
    const norm = (raw) => (window.db && typeof window.db.normalizeSede === "function")
      ? window.db.normalizeSede(raw)
      : String(raw || "challhuahuacho").toLowerCase();
    const user = window.db && typeof window.db.getCurrentUser === "function"
      ? window.db.getCurrentUser()
      : null;

    // Colaborador de sede fija: siempre su sede asignada
    if (user && window.db && typeof window.db.isGlobalAdmin === "function" && !window.db.isGlobalAdmin(user)) {
      return norm(user.sede || "challhuahuacho");
    }

    // Admin global / socio / super: sede activa del selector
    if (user && window.db && typeof window.db.getActiveSede === "function") {
      return norm(window.db.getActiveSede());
    }

    // Sin sesión (login): última sede de uso de la app
    try {
      const stored = sessionStorage.getItem("PAOLO ALDEA_ACTIVE_SEDE")
        || localStorage.getItem("PAOLO ALDEA_ACTIVE_SEDE");
      if (stored) return norm(stored);
    } catch (_) {}
    return "challhuahuacho";
  }

  /** Etiqueta institucional: «SEDE MIRAFLORES • LIMA METROPOLITANA» */
  getActiveBranchDisplayLabel(opts = {}) {
    const uppercase = opts.uppercase !== false;
    const sedeKey = this.resolveDisplaySedeKey();
    const cfg = (window.SEDES_CONFIG && window.SEDES_CONFIG[sedeKey]) ? window.SEDES_CONFIG[sedeKey] : null;

    let label;
    if (sedeKey === "todas") {
      label = "Consolidado Nacional";
    } else if (cfg) {
      const short = String(cfg.nombreCorto || cfg.nombre || sedeKey).replace(/^Sede\s+/i, "").trim();
      const region = String(cfg.region || "").trim();
      label = region ? `Sede ${short} • ${region}` : `Sede ${short}`;
    } else {
      label = "Sede Challhuahuacho • Cotabambas";
    }

    return uppercase ? label.toUpperCase() : label;
  }

  /** Actualiza login + topbar + sidebar con la sede del usuario / sede activa. */
  applySedeToHeader() {
    const labelUpper = this.getActiveBranchDisplayLabel({ uppercase: true });
    const labelTitle = this.getActiveBranchDisplayLabel({ uppercase: false });
    document.querySelectorAll(".firm-branch-login, #loginSedeDisplay").forEach((el) => {
      el.textContent = labelUpper;
    });
    document.querySelectorAll(".firm-branch-display").forEach((el) => {
      if (el.classList.contains("firm-branch-login") || el.id === "loginSedeDisplay") return;
      el.textContent = labelTitle;
    });
    const locked = document.getElementById("workerSedeLockedText");
    if (locked) locked.textContent = labelTitle;
  }

  /** Iconos institucionales por sede (selector custom / topbar). */
  getSedePickerIcon(sedeId) {
    const map = {
      todas: "fa-globe-americas",
      miraflores: "fa-city",
      abancay: "fa-mountain-sun",
      cusco: "fa-landmark",
      huaraz: "fa-mountain",
      challhuahuacho: "fa-building-flag"
    };
    return map[sedeId] || "fa-building-columns";
  }

  /** Sincroniza botón visible del selector con la sede activa (evita picker nativo Android). */
  syncSedePickerUI(sedeId) {
    const key = sedeId
      || (window.db && typeof window.db.getActiveSede === "function" ? window.db.getActiveSede() : null)
      || "challhuahuacho";
    const select = document.getElementById("globalSedeSelect");
    if (select && [...select.options].some((o) => o.value === key)) {
      select.value = key;
    }
    const cfg = (window.SEDES_CONFIG && window.SEDES_CONFIG[key]) ? window.SEDES_CONFIG[key] : null;
    const labelEl = document.getElementById("globalSedeSelectLabel");
    if (labelEl) {
      labelEl.textContent = key === "todas"
        ? "Consolidado Nacional"
        : (cfg ? (cfg.nombre || ("Sede " + (cfg.nombreCorto || key))) : ("Sede " + key));
    }
    const iconEl = document.getElementById("globalSedeSelectIcon");
    if (iconEl) {
      iconEl.className = "fa-solid " + this.getSedePickerIcon(key) + " text-[11px]";
    }
    const trigger = document.getElementById("btnOpenSedePicker");
    if (trigger) {
      trigger.setAttribute("aria-label", "Sede activa: " + (labelEl ? labelEl.textContent : key));
      trigger.setAttribute("aria-expanded", "false");
    }
  }

  async openSedePicker() {
    const currentUser = window.db && typeof window.db.getCurrentUser === "function" ? window.db.getCurrentUser() : null;
    const isGlobal = window.db ? window.db.isGlobalAdmin(currentUser) : true;
    if (!isGlobal) {
      this.showToast("Su perfil tiene sede fija. No puede cambiar de ubicación.", "info");
      return;
    }
    this.renderSedePickerList();
    const trigger = document.getElementById("btnOpenSedePicker");
    if (trigger) trigger.setAttribute("aria-expanded", "true");
    await this.openModal("modalSedePicker");
    setTimeout(() => {
      const selected = document.querySelector("#sedePickerList .sede-picker-option.is-selected");
      if (selected && typeof selected.focus === "function") selected.focus();
    }, 80);
  }

  closeSedePicker() {
    this.closeModal("modalSedePicker");
    const trigger = document.getElementById("btnOpenSedePicker");
    if (trigger) {
      trigger.setAttribute("aria-expanded", "false");
      if (typeof trigger.focus === "function") trigger.focus();
    }
  }

  renderSedePickerList() {
    const list = document.getElementById("sedePickerList");
    if (!list || !window.SEDES_CONFIG) return;
    const active = (window.db && typeof window.db.getActiveSede === "function")
      ? window.db.getActiveSede()
      : "challhuahuacho";
    const preferred = ["todas", "miraflores", "abancay", "cusco", "huaraz", "challhuahuacho"];
    const keys = preferred
      .filter((k) => window.SEDES_CONFIG[k])
      .concat(Object.keys(window.SEDES_CONFIG).filter((k) => !preferred.includes(k)));

    const esc = (typeof escapeHtml === "function")
      ? escapeHtml
      : (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

    list.innerHTML = keys.map((k) => {
      const s = window.SEDES_CONFIG[k];
      const selected = k === active;
      const title = k === "todas" ? "Consolidado Nacional" : (s.nombre || ("Sede " + (s.nombreCorto || k)));
      const subtitle = s.region || s.direccion || "";
      const code = s.codigo ? String(s.codigo) : "";
      const icon = this.getSedePickerIcon(k);
      const accent = String(s.color || "#D97706").replace(/[^#a-fA-F0-9(),.%\s]/g, "");
      const safeKey = String(k).replace(/[^a-z0-9_]/gi, "");
      return `
        <button type="button" role="option" aria-selected="${selected ? "true" : "false"}"
          class="sede-picker-option ${selected ? "is-selected" : ""}"
          data-sede="${esc(safeKey)}"
          onclick="window.app.pickSede('${safeKey}')">
          <span class="sede-picker-option-icon" style="color:${accent};border-color:${accent}55;background:${accent}18">
            <i class="fa-solid ${icon}"></i>
          </span>
          <span class="sede-picker-option-text">
            <span class="sede-picker-option-title">${esc(title)}</span>
            <span class="sede-picker-option-sub">${esc(subtitle)}</span>
          </span>
          ${code ? `<span class="sede-picker-option-code">${esc(code)}</span>` : ""}
          <span class="sede-picker-option-radio" aria-hidden="true">
            <i class="fa-solid ${selected ? "fa-circle-check" : "fa-circle"}"></i>
          </span>
        </button>`;
    }).join("");
  }

  pickSede(sedeId) {
    this.closeSedePicker();
    if (!sedeId) return;
    const current = (window.db && typeof window.db.getActiveSede === "function")
      ? window.db.getActiveSede()
      : null;
    if (current === sedeId) {
      this.syncSedePickerUI(sedeId);
      return;
    }
    this.switchSede(sedeId);
  }

  // Alternar sede activa (Permiso exclusivo de Administrador Global)
  switchSede(newSedeId) {
    if (!window.db) return;
    const ok = window.db.setActiveSede(newSedeId);
    if (!ok) {
      this.showToast("Acceso denegado: Su usuario no tiene permisos para cambiar de sede.", "error");
      return;
    }

    const norm = window.db.normalizeSede(newSedeId);
    const cfg = window.SEDES_CONFIG ? window.SEDES_CONFIG[norm] : null;
    const label = cfg ? cfg.nombreCorto : "Consolidado Nacional";

    this.syncSedePickerUI(norm);
    this.showToast(`Vista de despacho cambiada a: ${label}`, "info");
    this.applySettingsToUI();
    this.applySedeToHeader();
    if (typeof this.renderDynamicSidebarModules === 'function') this.renderDynamicSidebarModules();

    // Refrescar inmediatamente el m\u00F3dulo actual con los datos de la sede seleccionada
    if (this.currentTab) {
      this.refreshCurrentModuleView();
    }
    if (window.alerts) {
      window.alerts.evaluateAlerts();
    }
    if (window.kpiDashboard) {
      window.kpiDashboard.refresh();
    }
    if (window.AttendanceModule && typeof window.AttendanceModule.refreshOfficeConfig === "function") {
      window.AttendanceModule.refreshOfficeConfig();
    }
  }

  refreshCurrentModuleView() {
    const tabId = this.currentTab;
    this.updateDynamicTitles();

    if (tabId === "kpis") {
      if (window.kpiDashboard) window.kpiDashboard.refresh();
    } else if (tabId === "asistencia") {
      if (window.AttendanceModule) {
        if (typeof window.AttendanceModule.softRefresh === "function") {
          window.AttendanceModule.softRefresh();
        } else if (typeof window.AttendanceModule.init === "function") {
          window.AttendanceModule.init();
        }
      }
    } else if (tabId === "caja_chica") {
      this.renderCajaChica();
    } else if (tabId === "presupuestos") {
      this.renderPresupuestos();
    } else if (tabId === "casos") {
      this.renderCasos();
    } else if (tabId === "citas") {
      this.renderCitas();
    } else if (tabId === "inventario") {
      this.renderInventario();
    } else if (tabId === "documentos") {
      this.renderDocumentos();
    } else if (tabId === "personal") {
      this.renderPersonal();
    } else if (tabId === "roles_permisos") {
      this.renderRolesYPermisos();
    } else if (tabId === "master_admin") {
      this.renderMasterPanel();
    }
  }

  /** Cambia de modulo aplicando control de acceso (RBAC) y refresca la vista. */
  async switchTab(tabId) {
    const currentUser = window.db ? window.db.getCurrentUser() : null;

    if (tabId === "master_admin") {
      const isSuper = window.db && typeof window.db.isSuperAdmin === "function"
        ? window.db.isSuperAdmin(currentUser)
        : (window.db ? (window.db.getUserRole(currentUser) === "super_admin" || window.db.getUserRole(currentUser) === "socio") : false);
      if (!isSuper) {
        this.showToast("Acceso denegado: El Panel de Control Total & Gobierno es exclusivo del rol Super Administrador.", "error");
        return;
      }
      if (!this.isMasterUnlocked()) {
        this.showToast("Acceso restringido: Ingrese la Clave o PIN de Super Administrador para desbloquear este panel.", "warning");
        this.openModal("modalMasterAuth");
        return;
      }
    }

    if (window.db && !window.db.canAccessModule(currentUser, tabId)) {
      const roleLabel = window.db.getRoleLabel(window.db.getUserRole(currentUser));
      this.showToast(`Acceso denegado: El rol de ${roleLabel} no cuenta con permisos para acceder al módulo de ${tabId}.`, "error");
      return;
    }

    if (window.componentLoader && typeof window.componentLoader.ensureViewLoaded === "function") {
      const mounted = await window.componentLoader.ensureViewLoaded(tabId, "main");
      if (!mounted && !document.getElementById("view-" + tabId)) {
        // Fallback: apartado personalizado sin view-*.html
        const modCfg = window.db && typeof window.db.getModulesConfig === "function"
          ? (window.db.getModulesConfig() || []).find((m) => m.id === tabId)
          : null;
        if (modCfg && modCfg.isCustom && typeof this.ensureCustomModuleView === "function") {
          this.ensureCustomModuleView(modCfg);
        } else {
          this.showToast(`No se pudo cargar el módulo «${tabId}». Verifique conexión o recargue.`, "error");
          return;
        }
      }
    }
    if (window.PaoloControllerLoader && typeof window.PaoloControllerLoader.ensure === "function") {
      await window.PaoloControllerLoader.ensure(tabId);
    }

    this.currentTab = tabId;
    if (window.innerWidth < 768) {
      this.toggleMobileSidebar(false);
    }

    document.querySelectorAll(".nav-tab-btn").forEach(btn => {
      const isTarget = btn.dataset.tab === tabId;
      btn.classList.toggle("bg-slate-800", isTarget);
      btn.classList.toggle("text-amber-400", isTarget);
      btn.classList.toggle("border-l-4", isTarget);
      btn.classList.toggle("border-amber-400", isTarget);
      btn.classList.toggle("text-slate-300", !isTarget);
    });

    document.querySelectorAll(".mobile-nav-btn").forEach(btn => {
      if (btn.dataset.tab) {
        btn.classList.toggle("active", btn.dataset.tab === tabId);
      }
    });

    document.querySelectorAll(".tab-view").forEach(view => view.classList.add("hidden"));
    const activeView = document.getElementById(`view-${tabId}`);
    if (activeView) activeView.classList.remove("hidden");

    if (tabId === "kpis") {
      this.updateDynamicTitles();
      setTimeout(() => { if (window.kpiDashboard) window.kpiDashboard.init(); }, 50);
    } else {
      this.refreshCurrentModuleView();
    }
  }

  /** Paginación de tablas principales (casos / caja / asistencia). */
  getTablePageState(key, total, pageSize = 50) {
    if (!this._tablePages) this._tablePages = {};
    const pages = Math.max(1, Math.ceil((total || 0) / pageSize));
    let page = Number(this._tablePages[key]) || 1;
    if (page > pages) page = pages;
    if (page < 1) page = 1;
    this._tablePages[key] = page;
    const start = (page - 1) * pageSize;
    return { page, pages, pageSize, total, start, end: Math.min(start + pageSize, total) };
  }

  setTablePage(key, page) {
    if (!this._tablePages) this._tablePages = {};
    this._tablePages[key] = Math.max(1, Number(page) || 1);
    if (key === "casos") this.renderCasos();
    else if (key === "caja") this.renderCajaChica();
    else if (key === "asistencia" && window.AttendanceModule && typeof window.AttendanceModule.renderAdminAttendanceTable === "function") {
      window.AttendanceModule.renderAdminAttendanceTable();
    }
  }

  renderTablePagerHtml(key, state) {
    if (!state || state.total <= state.pageSize) {
      return state && state.total
        ? `<div class="flex items-center justify-between gap-2 px-1 py-2 text-[11px] text-slate-500"><span>${state.total} registro(s)</span></div>`
        : "";
    }
    const { page, pages, total, start, end } = state;
    const prevDisabled = page <= 1 ? "opacity-40 pointer-events-none" : "";
    const nextDisabled = page >= pages ? "opacity-40 pointer-events-none" : "";
    return `
      <div class="flex flex-wrap items-center justify-between gap-2 px-1 py-2 text-[11px] text-slate-600 border-t border-slate-200 mt-1">
        <span>Mostrando ${start + 1}–${end} de ${total}</span>
        <div class="flex items-center gap-1.5">
          <button type="button" class="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 ${prevDisabled}" onclick="window.app.setTablePage(${jsStr(key)}, ${page - 1})"><i class="fa-solid fa-chevron-left"></i></button>
          <span class="font-semibold text-slate-800">Pág. ${page} / ${pages}</span>
          <button type="button" class="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 ${nextDisabled}" onclick="window.app.setTablePage(${jsStr(key)}, ${page + 1})"><i class="fa-solid fa-chevron-right"></i></button>
        </div>
      </div>`;
  }

  _syncTablePager(pagerId, key, state) {
    const el = document.getElementById(pagerId);
    if (!el) return;
    el.innerHTML = this.renderTablePagerHtml(key, state);
  }

  /** Abre/cierra la barra lateral en movil. Sin argumento alterna el estado. */
  toggleMobileSidebar(forceOpen) {
    const sidebar = document.getElementById("mainAppSidebar");
    const backdrop = document.getElementById("sidebarBackdrop");
    if (!sidebar) return;
    const isOpen = !sidebar.classList.contains("-translate-x-full") && window.innerWidth < 768 && sidebar.dataset.open === "1";
    const open = typeof forceOpen === "boolean" ? forceOpen : !isOpen;
    sidebar.dataset.open = open ? "1" : "0";
    if (window.innerWidth < 768) {
      sidebar.classList.toggle("-translate-x-full", !open);
      sidebar.classList.toggle("translate-x-0", open);
    }
    if (backdrop) backdrop.classList.toggle("hidden", !open);
  }

  /** Oculta controles de editar/eliminar/exportar que el rol del usuario no puede usar (la capa de datos igualmente los bloquea). */
  applyRbacUI(root = document) {
    const db = window.db;
    const user = db && db.getCurrentUser ? db.getCurrentUser() : null;
    if (!user) return;
    const map = {
      deleteCaso: ["casos", "delete"], editCaso: ["casos", "update"],
      deleteCajaItem: ["caja_chica", "delete"], editCajaItem: ["caja_chica", "update"],
      deleteCita: ["citas", "delete"], editCita: ["citas", "update"],
      deleteDocument: ["documentos", "delete"], editDocument: ["documentos", "update"],
      deleteInventario: ["inventario", "delete"], editInventario: ["inventario", "update"],
      deletePresupuesto: ["presupuestos", "delete"], editPresupuesto: ["presupuestos", "update"],
      deleteWorkerRecord: ["personal", "delete"]
    };
    root.querySelectorAll("[onclick]").forEach(el => {
      const m = (el.getAttribute("onclick") || "").match(/window\.app\.(\w+)\(/);
      if (!m || !map[m[1]]) return;
      const allowed = db.canDo(user, map[m[1]][1], map[m[1]][0]);
      el.style.display = allowed ? "" : "none";
    });
  }
  /** Atajos globales: Escape cierra modales/sidebar; al cambiar a escritorio se restablece la barra lateral. */
  setupEventListeners() {
    if (this._listenersBound) return;
    this._listenersBound = true;
    let _rbacTimer = null;
    const _rbacObs = new MutationObserver(() => { clearTimeout(_rbacTimer); _rbacTimer = setTimeout(() => this.applyRbacUI(), 60); });
    _rbacObs.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("keydown", (ev) => {
      if (ev.key !== "Escape") return;
      const sedeModal = document.getElementById("modalSedePicker");
      if (sedeModal && !sedeModal.classList.contains("hidden")) {
        this.closeSedePicker();
        return;
      }
      this.toggleMobileSidebar(false);
    });
    window.addEventListener("resize", () => {
      const sidebar = document.getElementById("mainAppSidebar");
      if (!sidebar) return;
      if (window.innerWidth >= 768) {
        sidebar.classList.remove("-translate-x-full", "translate-x-0");
        const backdrop = document.getElementById("sidebarBackdrop");
        if (backdrop) backdrop.classList.add("hidden");
      } else if (sidebar.dataset.open !== "1") {
        sidebar.classList.add("-translate-x-full");
      }
    });
  }

  /** Redimensiona una imagen (data URL) a un maximo de maxSize px y la devuelve como JPEG. */
  compressImageDataUrl(dataUrl, maxSize = 320, quality = 0.85) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Imagen invalida"));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = dataUrl;
    });
  }
  // =========================================================================
  // 1. MÓDULO CAJA CHICA (Centros de Costo & Flujo de Aprobación 3 Niveles)
  // =========================================================================
  renderCajaChica() {
    const items = window.db.get("caja_chica");
    const container = document.getElementById("cajaChicaTableBody");
    const searchVal = (document.getElementById("searchCajaChica")?.value || "").toLowerCase();
    const filterTipo = document.getElementById("filterTipoCaja")?.value || "ALL";
    const filterCat = document.getElementById("filterCategoriaCaja")?.value || "ALL";
    const filterEstado = document.getElementById("filterEstadoAprobacionCaja")?.value || "ALL";
    const curr = window.db.getSettings().currency;

    if (!container) return;

    const filtered = items.filter(item => {
      const matchSearch =
        (item.concepto || "").toLowerCase().includes(searchVal) ||
        (item.expediente && item.expediente.toLowerCase().includes(searchVal)) ||
        (item.comprobante && item.comprobante.toLowerCase().includes(searchVal)) ||
        (item.centroCosto && item.centroCosto.toLowerCase().includes(searchVal)) ||
        (item.categoria || "").toLowerCase().includes(searchVal);

      const matchTipo = filterTipo === "ALL" || item.tipo === filterTipo;
      const matchCat = filterCat === "ALL" || item.categoria === filterCat;
      const itemEstado = item.estadoFlujo || "pendiente_asistente";
      const matchEstado = filterEstado === "ALL" || itemEstado === filterEstado;
      return matchSearch && matchTipo && matchCat && matchEstado;
    });

    const totalIng = items.filter(i => /^ingreso$/i.test(String(i.tipo || ""))).reduce((s, i) => s + Number(i.monto || 0), 0);
    const totalEg = items.filter(i => !/^ingreso$/i.test(String(i.tipo || ""))).reduce((s, i) => s + Number(i.monto || 0), 0);
    const saldo = totalIng - totalEg;

    const elSaldo = document.getElementById("cajaSummarySaldo");
    const elIng = document.getElementById("cajaSummaryIngresos");
    const elEg = document.getElementById("cajaSummaryEgresos");
    const elCount = document.getElementById("cajaSummaryCount");

    if (elSaldo) elSaldo.textContent = `${curr} ${saldo.toFixed(2)}`;
    if (elIng) elIng.textContent = `+${curr} ${totalIng.toFixed(2)}`;
    if (elEg) elEg.textContent = `-${curr} ${totalEg.toFixed(2)}`;
    if (elCount) elCount.textContent = `${items.length} registros`;

    if (filtered.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="10" class="text-center py-8 text-slate-400">
            <i class="fa-solid fa-receipt text-3xl mb-2 text-slate-300"></i>
            <p>No se encontraron movimientos registrados en la caja chica</p>
          </td>
        </tr>
      `;
      this._syncTablePager("cajaChicaTablePager", "caja", { page: 1, pages: 1, pageSize: 50, total: 0, start: 0, end: 0 });
      return;
    }

    const pageState = this.getTablePageState("caja", filtered.length, 50);
    const pageItems = filtered.slice(pageState.start, pageState.end);

    container.innerHTML = pageItems.map(item => {
      const isIngreso = /^ingreso$/i.test(String(item.tipo || ""));
      const tipoBadge = isIngreso
        ? `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300"><i class="fa-solid fa-arrow-down-left mr-1"></i>Ingreso</span>`
        : `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300"><i class="fa-solid fa-arrow-up-right mr-1"></i>Egreso</span>`;

      const recurrenteBadge = (item.esRecurrente || item.centroCosto === "Gasto Administrativo Fijo")
        ? `<span class="inline-flex items-center gap-1 text-[10px] font-bold text-amber-900 bg-amber-100/90 border border-amber-300 px-1.5 py-0.5 rounded ml-1.5" title="Alerta programada para próximo mes"><i class="fa-regular fa-bell text-amber-700 animate-pulse"></i>Fijo (${item.diaPago ? 'Día ' + item.diaPago : 'Mensual'})</span>`
        : '';

      const estado = item.estadoFlujo || "pendiente_asistente";
      let estadoBadge = "";
      if (estado === "pendiente_asistente") {
        estadoBadge = `<button type="button" onclick="window.app.openFlujoCajaModal(${jsStr(item.id)})" class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 flex items-center gap-1.5 transition mx-auto shadow-xs" title="Clic para revisar / consultar estado">
          <i class="fa-solid fa-hourglass-half text-amber-600 animate-pulse"></i>
          <span>1. Pend. Asistente</span>
        </button>`;
      } else if (estado === "elevado_admin") {
        estadoBadge = `<button type="button" onclick="window.app.openFlujoCajaModal(${jsStr(item.id)})" class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-300 hover:bg-blue-100 flex items-center gap-1.5 transition mx-auto shadow-xs" title="Clic para revisar / consultar estado">
          <i class="fa-solid fa-arrow-up-right-from-square text-blue-600"></i>
          <span>2. Elevado a Socio</span>
        </button>`;
      } else if (estado === "observado") {
        estadoBadge = `<button type="button" onclick="window.app.openFlujoCajaModal(${jsStr(item.id)})" class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-orange-100 text-orange-800 border border-orange-300 hover:bg-orange-200 flex items-center gap-1.5 transition mx-auto shadow-xs" title="Clic para ver observaciones">
          <i class="fa-solid fa-triangle-exclamation text-orange-600 animate-bounce"></i>
          <span>Observado</span>
        </button>`;
      } else if (estado === "aprobado") {
        estadoBadge = `<button type="button" onclick="window.app.openFlujoCajaModal(${jsStr(item.id)})" class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 flex items-center gap-1.5 transition mx-auto shadow-xs" title="Aprobado y desembolsado">
          <i class="fa-solid fa-circle-check text-emerald-600"></i>
          <span>Aprobado</span>
        </button>`;
      } else if (estado === "rechazado") {
        estadoBadge = `<button type="button" onclick="window.app.openFlujoCajaModal(${jsStr(item.id)})" class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-300 hover:bg-rose-100 flex items-center gap-1.5 transition mx-auto shadow-xs" title="Rechazado">
          <i class="fa-solid fa-ban text-rose-600"></i>
          <span>Rechazado</span>
        </button>`;
      }

      return `
        <tr id="caja-row-${escapeHtml(item.id)}" class="hover:bg-slate-50 transition border-b border-slate-200">
          <td class="font-medium text-slate-800 text-xs">
            <div>${escapeHtml(item.fecha)}</div>
            ${window.renderSedeBadge ? window.renderSedeBadge(item.sede) : ''}
          </td>
          <td>${tipoBadge}</td>
          <td class="text-xs font-semibold text-blue-950">
            <span class="bg-blue-50 text-blue-900 border border-blue-200 px-2 py-0.5 rounded text-[11px]">${escapeHtml(item.centroCosto || 'General')}</span>
          </td>
          <td class="text-xs font-medium text-slate-700">${escapeHtml(item.categoria)}</td>
          <td class="text-xs text-slate-800 max-w-xs font-medium leading-snug">
            ${escapeHtml(item.concepto)}
            ${recurrenteBadge}
          </td>
          <td class="text-xs font-mono font-bold text-slate-900">${escapeHtml(item.expediente || '-')}</td>
          <td class="text-xs text-slate-600 font-mono">${escapeHtml(item.comprobante || '-')}</td>
          <td class="text-xs font-bold text-right ${isIngreso ? 'text-emerald-700' : 'text-rose-700'}">
            ${isIngreso ? '+' : '-'}${curr} ${Number(item.monto).toFixed(2)}
          </td>
          <td class="text-center">
            ${estadoBadge}
          </td>
          <td class="text-center whitespace-nowrap">
            <button onclick="window.app.openFlujoCajaModal(${jsStr(item.id)})" class="text-emerald-600 hover:text-emerald-800 p-1.5 transition" title="Ver Trazabilidad & Estado de Flujo"><i class="fa-solid fa-route"></i></button>
            <button onclick="window.app.editCajaItem(${jsStr(item.id)})" class="text-slate-500 hover:text-blue-600 p-1.5 transition" title="Editar"><i class="fa-solid fa-pen-to-square"></i></button>
            <button onclick="window.app.deleteCajaItem(${jsStr(item.id)})" class="text-slate-400 hover:text-red-600 p-1.5 transition" title="Eliminar"><i class="fa-solid fa-trash-can"></i></button>
          </td>
        </tr>
      `;
    }).join("");
    this._syncTablePager("cajaChicaTablePager", "caja", pageState);
  }

  toggleCajaRecurrente() {
    const chk = document.getElementById("cajaEsRecurrente");
    const container = document.getElementById("cajaRecurrenteFields");
    if (!chk || !container) return;

    const isChecked = chk.checked;
    container.classList.toggle("hidden", !isChecked);

    if (isChecked) {
      const inDia = document.getElementById("cajaDiaPago");
      const inFecha = document.getElementById("cajaFecha");
      if (inDia && !inDia.value) {
        let diaDef = 15;
        if (inFecha && inFecha.value) {
          const d = new Date(inFecha.value + "T00:00:00");
          if (!isNaN(d.getTime())) diaDef = d.getDate();
        }
        inDia.value = diaDef;
      }
      this.updateProximoPagoFecha();
    }
  }

  updateProximoPagoFecha() {
    const inDia = document.getElementById("cajaDiaPago");
    const inProx = document.getElementById("cajaProximoPago");
    const inFecha = document.getElementById("cajaFecha");
    if (!inDia || !inProx) return;

    let day = parseInt(inDia.value, 10);
    if (isNaN(day) || day < 1) day = 1;
    if (day > 31) day = 31;
    inDia.value = day;

    const baseDate = inFecha && inFecha.value ? new Date(inFecha.value + "T00:00:00") : new Date();
    // Sumar 1 mes para el pago del próximo mes
    let targetYear = baseDate.getFullYear();
    let targetMonth = baseDate.getMonth() + 1; // Próximo mes
    if (targetMonth > 11) {
      targetMonth = 0;
      targetYear++;
    }

    const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const safeDay = Math.min(day, lastDayOfTargetMonth);

    const mm = String(targetMonth + 1).padStart(2, '0');
    const dd = String(safeDay).padStart(2, '0');
    inProx.value = `${targetYear}-${mm}-${dd}`;
  }

  onCajaCategoriaChange() {
    const cat = getSafeVal("cajaCategoria", "");
    const cc = document.getElementById("cajaCentroCosto");
    const chk = document.getElementById("cajaEsRecurrente");
    const concepto = document.getElementById("cajaConcepto");

    const esServicioFijo = /alquiler|luz|agua|claro|internet|electricidad|telecomunicaciones/i.test(cat);

    if (esServicioFijo) {
      if (cc) cc.value = /claro|internet|telecom/i.test(cat) ? "Infraestructura & TIC" : "Gasto Administrativo Fijo";
      if (chk && !chk.checked) {
        chk.checked = true;
        this.toggleCajaRecurrente();
      }
      if (concepto && (!concepto.value || concepto.value === "Gasto judicial")) {
        concepto.value = `Pago mensual de ${cat} - Sede Challhuahuacho`;
      }
    }
  }

  async openCajaModal(id = null) {
    this.editingId = id;
    if (window.componentLoader && typeof window.componentLoader.ensureModalsLoaded === "function") {
      const ok = await window.componentLoader.ensureModalsLoaded();
      if (!ok || !document.getElementById("modalCajaChica")) {
        this.showToast("No se pudo cargar el formulario de Caja Chica. Recargue la página.", "error");
        return;
      }
    }

    const form = document.getElementById("formCajaChica");
    if (form) form.reset();

    const titleEl = document.getElementById("modalCajaTitle");
    const chkRecurrente = document.getElementById("cajaEsRecurrente");
    const inDia = document.getElementById("cajaDiaPago");
    const inProx = document.getElementById("cajaProximoPago");
    const fields = document.getElementById("cajaRecurrenteFields");

    if (id) {
      if (titleEl) titleEl.textContent = "Editar Movimiento de Caja Chica";
      const item = window.db.get("caja_chica").find(i => i.id === id);
      if (item) { this._editingOriginalUpdatedAt = item.updatedAt || item.createdAt || null; }
      if (item) {
        const tipoNorm = /^ingreso$/i.test(String(item.tipo || "")) ? "Ingreso" : "Egreso";
        if (document.getElementById("cajaTipo")) document.getElementById("cajaTipo").value = tipoNorm;
        if (document.getElementById("cajaFecha")) document.getElementById("cajaFecha").value = item.fecha;
        if (document.getElementById("cajaCentroCosto")) document.getElementById("cajaCentroCosto").value = item.centroCosto || "Costo Procesal Recuperable";
        if (document.getElementById("cajaCategoria")) document.getElementById("cajaCategoria").value = item.categoria;
        if (document.getElementById("cajaConcepto")) document.getElementById("cajaConcepto").value = item.concepto;
        if (document.getElementById("cajaExpediente")) document.getElementById("cajaExpediente").value = item.expediente || "";
        if (document.getElementById("cajaComprobante")) document.getElementById("cajaComprobante").value = item.comprobante || "";
        if (document.getElementById("cajaResponsable")) document.getElementById("cajaResponsable").value = item.responsable || "";
        if (document.getElementById("cajaMonto")) document.getElementById("cajaMonto").value = item.monto;
        if (document.getElementById("cajaMetodo")) document.getElementById("cajaMetodo").value = item.metodo || "Efectivo";
        if (document.getElementById("cajaSede")) document.getElementById("cajaSede").value = window.db.normalizeSede(item.sede || "challhuahuacho");

        if (chkRecurrente) chkRecurrente.checked = !!item.esRecurrente;
        if (inDia) inDia.value = item.diaPago || "";
        if (inProx) inProx.value = item.proximoPago || "";
        if (fields) fields.classList.toggle("hidden", !item.esRecurrente);
      }
    } else {
      this._editingOriginalUpdatedAt = null;
      if (titleEl) titleEl.textContent = "Nuevo Registro de Caja Chica — PAOLO ALDEA & ABOGADOS";
      if (document.getElementById("cajaFecha")) document.getElementById("cajaFecha").value = getRelativeDateOnlyStr(0);
      const active = window.db ? window.db.getActiveSede() : "challhuahuacho";
      if (document.getElementById("cajaSede")) document.getElementById("cajaSede").value = active === "todas" ? "challhuahuacho" : active;
      if (chkRecurrente) chkRecurrente.checked = false;
      if (inDia) inDia.value = "";
      if (inProx) inProx.value = "";
      if (fields) fields.classList.add("hidden");
    }

    if (document.getElementById("cajaSede")) {
      document.getElementById("cajaSede").disabled = !(window.db && window.db.isGlobalAdmin());
    }

    await this.showModal("modalCajaChica");
  }

  saveCajaChica(e) {
    if (e) e.preventDefault();
    try {
      const conceptoInput = document.getElementById("cajaConcepto");
      const montoInput = document.getElementById("cajaMonto");
      const fechaInput = document.getElementById("cajaFecha");

      if (!conceptoInput || !conceptoInput.value.trim()) {
        if (conceptoInput) {
          conceptoInput.classList.add("ring-2", "ring-rose-500");
          setTimeout(() => conceptoInput.classList.remove("ring-2", "ring-rose-500"), 2500);
          conceptoInput.focus();
        }
        this.showToast("Debe detallar el concepto del movimiento de caja chica.", "warning");
        return;
      }

      const montoNum = parseFloat(montoInput ? montoInput.value : 0);
      if (isNaN(montoNum) || montoNum <= 0) {
        if (montoInput) {
          montoInput.classList.add("ring-2", "ring-rose-500");
          setTimeout(() => montoInput.classList.remove("ring-2", "ring-rose-500"), 2500);
          montoInput.focus();
        }
        this.showToast("El monto debe ser un valor monetario válido mayor a cero.", "warning");
        return;
      }

      if (!fechaInput || !fechaInput.value) {
        if (fechaInput) {
          fechaInput.classList.add("ring-2", "ring-rose-500");
          setTimeout(() => fechaInput.classList.remove("ring-2", "ring-rose-500"), 2500);
          fechaInput.focus();
        }
        this.showToast("Debe indicar una fecha válida para el movimiento de caja.", "warning");
        return;
      }
      const data = {
        sede: getSafeVal("cajaSede", window.db ? window.db.getActiveSede() : "challhuahuacho"),
        tipo: getSafeVal("cajaTipo", "Egreso"),
        fecha: getSafeVal("cajaFecha", getRelativeDateOnlyStr(0)),
        centroCosto: getSafeVal("cajaCentroCosto", "Costo Procesal Recuperable"),
        categoria: getSafeVal("cajaCategoria", "Aranceles y Tasas Judiciales"),
        concepto: getSafeVal("cajaConcepto", "Gasto judicial"),
        expediente: getSafeVal("cajaExpediente", "-"),
        comprobante: getSafeVal("cajaComprobante", "-"),
        responsable: getSafeVal("cajaResponsable", "Ing. Industrial / Asistente Admin"),
        monto: getSafeNum("cajaMonto", 0),
        metodo: getSafeVal("cajaMetodo", "Efectivo"),
        esRecurrente: document.getElementById("cajaEsRecurrente")?.checked || false,
        diaPago: getSafeInt("cajaDiaPago", 0),
        proximoPago: getSafeVal("cajaProximoPago", "")
      };

      const currentUser = (window.db && window.db.getCurrentUser) ? window.db.getCurrentUser() : null;
      const solicitanteInfo = currentUser ? {
        id: currentUser.id,
        nombre: currentUser.nombre || currentUser.nombres || "Colaborador",
        cargo: currentUser.cargo || currentUser.rol || "Colaborador",
        rol: currentUser.rol || "colaborador",
        sede: currentUser.sede || "challhuahuacho"
      } : {
        id: "WRK-CURRENT",
        nombre: getSafeVal("cajaResponsable", "Colaborador"),
        cargo: "Colaborador",
        rol: "colaborador",
        sede: getSafeVal("cajaSede", "challhuahuacho")
      };

      const nowStr = new Date().toLocaleString("es-PE", { hour12: false });

      if (this.editingId) {
        const oldItem = window.db.get("caja_chica").find(i => i.id === this.editingId);
        if (oldItem && this._editingOriginalUpdatedAt && oldItem.updatedAt && oldItem.updatedAt !== this._editingOriginalUpdatedAt) {
          const proceed = confirm("⚠️ AVISO DE CONCURRENCIA (Optimistic Locking):\nEste movimiento de caja fue modificado recientemente por otra sede o usuario.\n\n¿Desea sobrescribir con su versión actual?");
          if (!proceed) {
            this.showToast("Operación cancelada para preservar cambios recientes.", "warning");
            return;
          }
        }
        if (oldItem) {
          data.estadoFlujo = oldItem.estadoFlujo || "pendiente_asistente";
          data.solicitante = oldItem.solicitante || solicitanteInfo;
          data.historialEstados = oldItem.historialEstados || [
            {
              estado: data.estadoFlujo,
              usuario: solicitanteInfo.nombre,
              rol: solicitanteInfo.rol,
              fecha: nowStr,
              comentario: "Registro inicial de rendición de gasto."
            }
          ];
        }
        const updated = window.db.update("caja_chica", this.editingId, data);
        if (!updated) {
          this.showToast("No se pudo actualizar el movimiento de caja. Verifique permisos o reintente.", "error");
          return;
        }
        this.showToast("Movimiento de caja actualizado con éxito", "success");
      } else {
        data.id = window.generateUniqueId("CC");
        data.estadoFlujo = "pendiente_asistente";
        data.solicitante = solicitanteInfo;
        data.historialEstados = [
          {
            estado: "pendiente_asistente",
            usuario: solicitanteInfo.nombre,
            rol: solicitanteInfo.rol,
            fecha: nowStr,
            comentario: "Rendición de gasto ingresada al sistema. En espera de revisión por Asistente Administrativo."
          }
        ];
        const created = window.db.add("caja_chica", data);
        if (!created) {
          this.showToast("No se pudo guardar el movimiento de caja chica. Verifique permisos o reintente.", "error");
          return;
        }
        if (window.PaoloCashManager && typeof window.PaoloCashManager.enqueueLocalEntry === "function") {
          window.PaoloCashManager.enqueueLocalEntry(data).catch(() => {});
        }
        this.showToast("Nuevo movimiento registrado en caja chica", "success");

        // Notificar automáticamente al Asistente Administrativo
        if (window.alerts && typeof window.alerts.notifyRole === "function") {
          window.alerts.notifyRole(["asistente_admin"], {
            title: `💰 Nueva Rendición de Caja Chica: ${data.id}`,
            message: `${solicitanteInfo.nombre} ha registrado un gasto de S/ ${Number(data.monto).toFixed(2)} (${data.concepto}). Clic para revisar y elevar.`,
            severity: "warning",
            priority: "high"
          });
        }
      }

      if (window.draftAutosave) {
        window.draftAutosave.clearDraft("modalCaja");
        window.draftAutosave.clearDraft("modalCajaChica");
      }
      this.closeModal("modalCajaChica");
      this.renderCajaChica();
      window.kpiDashboard.refresh();
      window.alerts.evaluateAlerts();
    } catch (err) {
      console.error("Error al guardar caja chica:", err);
      alert("Error al guardar en Caja Chica: " + err.message);
    }
  }

  editCajaItem(id) {
    if (window.db && !window.db._rbacCheck("caja_chica", "update", id)) return;
    this.openCajaModal(id);
  }

  deleteCajaItem(id) {
    if (window.db && !window.db._rbacCheck("caja_chica", "delete", id)) return;
    if (confirm("¿Está seguro de eliminar este registro contable de Caja Chica?")) {
      const ok = window.db.delete("caja_chica", id);
      if (!ok) {
        this.showToast("No se pudo eliminar el registro de caja chica.", "error");
        return;
      }
      this.renderCajaChica();
      window.kpiDashboard.refresh();
      this.showToast("Registro eliminado con éxito", "info");
    }
  }

  // =========================================================================
  // CONTROLADORES DEL FLUJO DE APROBACIÓN DE CAJA CHICA (3 NIVELES)
  // =========================================================================
  async openFlujoCajaModal(id) {
    this.currentFlujoCajaId = id;
    const item = (window.db.get("caja_chica") || []).find(i => i.id === id);
    if (!item) {
      this.showToast("No se encontró el registro contable de Caja Chica.", "warning");
      return;
    }

    if (window.componentLoader && typeof window.componentLoader.ensureModalsLoaded === "function") {
      const ok = await window.componentLoader.ensureModalsLoaded();
      if (!ok || !document.getElementById("modalFlujoCajaChica")) {
        this.showToast("No se pudo cargar el flujo de caja. Recargue la página (Ctrl+F5).", "error");
        return;
      }
    }

    const curr = window.db.getSettings().currency || "S/";
    const currentUser = (window.db && window.db.getCurrentUser) ? window.db.getCurrentUser() : null;
    const userRole = window.db.normalizeRole
      ? window.db.normalizeRole(currentUser?.rol || "socio")
      : (currentUser?.rol || "socio");
    const isSuper = userRole === "super_admin" || (currentUser && currentUser.id === "WRK-000");

    // Encabezado e información de resumen
    const idBadge = document.getElementById("flujoCajaIdBadge");
    const conceptoEl = document.getElementById("flujoCajaConcepto");
    const fechaEl = document.getElementById("flujoCajaFecha");
    const sedeBadge = document.getElementById("flujoCajaSedeBadge");
    const catBadge = document.getElementById("flujoCajaCategoriaBadge");
    const montoEl = document.getElementById("flujoCajaMonto");
    const solicitanteEl = document.getElementById("flujoCajaSolicitante");
    const comprobanteEl = document.getElementById("flujoCajaComprobante");
    const rolUsuarioBadge = document.getElementById("flujoCajaRolUsuarioBadge");
    const inputComentario = document.getElementById("flujoCajaComentarioInput");

    if (idBadge) idBadge.textContent = item.id;
    if (conceptoEl) conceptoEl.textContent = item.concepto;
    if (fechaEl) fechaEl.textContent = item.fecha;
    if (sedeBadge) sedeBadge.textContent = item.sede ? `Sede ${item.sede.charAt(0).toUpperCase() + item.sede.slice(1)}` : "Sede Principal";
    if (catBadge) catBadge.textContent = item.categoria || "Gasto";
    if (montoEl) montoEl.textContent = `${curr} ${Number(item.monto || 0).toFixed(2)}`;
    if (solicitanteEl) solicitanteEl.textContent = item.solicitante?.nombre || item.responsable || "Colaborador del Estudio";
    if (comprobanteEl) comprobanteEl.textContent = `${item.comprobante || 'Sin comp.'} ${item.expediente ? '• Exp: ' + item.expediente : ''}`;
    if (rolUsuarioBadge) rolUsuarioBadge.textContent = `Tu Rol: ${window.db.getRoleLabel ? window.db.getRoleLabel(userRole) : userRole}`;
    if (inputComentario) inputComentario.value = "";

    // Stepper de 3 Pasos
    const estado = item.estadoFlujo || "pendiente_asistente";
    const step1 = document.getElementById("step-colaborador");
    const step2 = document.getElementById("step-asistente");
    const step3 = document.getElementById("step-admin");

    const setStepState = (el, iconClass, text, bgClass, borderClass, textClass) => {
      if (!el) return;
      el.className = `p-2 rounded-lg border font-bold transition flex flex-col items-center gap-1 ${bgClass} ${borderClass} ${textClass}`;
      el.innerHTML = `<i class="${iconClass} text-xs"></i><span>${text}</span>`;
    };

    // Paso 1: Registrado
    setStepState(step1, "fa-solid fa-circle-check", "1. Registrado", "bg-emerald-50", "border-emerald-300", "text-emerald-800");

    // Pasos 2 y 3 según el estado
    if (estado === "pendiente_asistente") {
      setStepState(step2, "fa-solid fa-hourglass-half animate-pulse", "2. En Revisión Asistente", "bg-amber-50", "border-amber-400", "text-amber-800");
      setStepState(step3, "fa-regular fa-clock", "3. Pendiente Socio", "bg-slate-50", "border-slate-200", "text-slate-400");
    } else if (estado === "elevado_admin") {
      setStepState(step2, "fa-solid fa-circle-check", "2. Elevado por Asistente", "bg-blue-50", "border-blue-300", "text-blue-800");
      setStepState(step3, "fa-solid fa-shield-halved animate-pulse", "3. En Revisión Socio / Admin", "bg-amber-50", "border-amber-400", "text-amber-800");
    } else if (estado === "observado") {
      setStepState(step2, "fa-solid fa-triangle-exclamation animate-bounce", "2. Observado (Por corregir)", "bg-orange-50", "border-orange-400", "text-orange-800");
      setStepState(step3, "fa-regular fa-circle-xmark", "3. Pausado por Obs.", "bg-slate-50", "border-slate-200", "text-slate-400");
    } else if (estado === "aprobado") {
      setStepState(step2, "fa-solid fa-circle-check", "2. V°B° Asistente", "bg-emerald-50", "border-emerald-300", "text-emerald-800");
      setStepState(step3, "fa-solid fa-circle-check", "3. Aprobado & Desembolsado", "bg-emerald-100", "border-emerald-400", "text-emerald-900");
    } else if (estado === "rechazado") {
      setStepState(step2, "fa-solid fa-circle-check", "2. Revisado Asistente", "bg-slate-100", "border-slate-300", "text-slate-600");
      setStepState(step3, "fa-solid fa-ban", "3. Gasto Rechazado", "bg-rose-50", "border-rose-400", "text-rose-800");
    }

    // Historial de Auditoría Inmutable
    const timelineContainer = document.getElementById("flujoCajaTimeline");
    const historial = item.historialEstados || [
      {
        estado: item.estadoFlujo || "pendiente_asistente",
        usuario: item.solicitante?.nombre || item.responsable || "Colaborador",
        rol: item.solicitante?.rol || "colaborador",
        fecha: item.fecha,
        comentario: "Registro inicial de rendición de gasto."
      }
    ];

    if (timelineContainer) {
      timelineContainer.innerHTML = historial.map(h => {
        let badgeColor = "bg-slate-200 text-slate-800 border-slate-300";
        let icon = "fa-circle-dot";
        if (h.estado === "pendiente_asistente") { badgeColor = "bg-amber-100 text-amber-800 border-amber-300"; icon = "fa-hourglass-half"; }
        else if (h.estado === "elevado_admin") { badgeColor = "bg-blue-100 text-blue-800 border-blue-300"; icon = "fa-arrow-up-right-from-square"; }
        else if (h.estado === "observado") { badgeColor = "bg-orange-100 text-orange-800 border-orange-300"; icon = "fa-triangle-exclamation"; }
        else if (h.estado === "aprobado") { badgeColor = "bg-emerald-100 text-emerald-800 border-emerald-300"; icon = "fa-circle-check"; }
        else if (h.estado === "rechazado") { badgeColor = "bg-rose-100 text-rose-800 border-rose-300"; icon = "fa-ban"; }

        return `
          <div class="flex items-start gap-2.5 pb-2 border-b border-slate-200/60 last:border-0 last:pb-0 text-[11px]">
            <div class="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${badgeColor}">
              <i class="fa-solid ${icon} text-[9px]"></i>
            </div>
            <div class="flex-1">
              <div class="flex items-center justify-between">
                <span class="font-bold text-slate-800">${escapeHtml(h.usuario || 'Usuario')} <span class="text-[10px] text-slate-500 font-normal">(${escapeHtml(h.rol || '')})</span></span>
                <span class="text-[10px] text-slate-400 font-mono">${escapeHtml(h.fecha || '')}</span>
              </div>
              <div class="text-slate-600 mt-0.5 leading-relaxed bg-white/70 p-1.5 rounded border border-slate-200/60">
                ${escapeHtml(h.comentario || 'Actualización registrada en el flujo.')}
              </div>
            </div>
          </div>
        `;
      }).join("");
    }

    // Visibilidad de Botones de Gestión según Rol RBAC (super_admin puede todo)
    const secAsistente = document.getElementById("flujoAccionesAsistente");
    const secAdmin = document.getElementById("flujoAccionesAdmin");
    const secColaborador = document.getElementById("flujoMensajeColaborador");

    const canAsistente = isSuper || ["asistente_admin", "admin", "socio"].includes(userRole);
    const canAdmin = isSuper || ["admin", "socio"].includes(userRole);

    if (secAsistente) secAsistente.classList.toggle("hidden", !canAsistente);
    if (secAdmin) secAdmin.classList.toggle("hidden", !canAdmin);
    if (secColaborador) secColaborador.classList.toggle("hidden", canAsistente || canAdmin);

    await this.showModal("modalFlujoCajaChica");
  }

  elevarCajaChica() {
    if (!this.currentFlujoCajaId) return;
    const item = window.db.get("caja_chica").find(i => i.id === this.currentFlujoCajaId);
    if (!item) return;

    const currentUser = window.db.getCurrentUser ? window.db.getCurrentUser() : null;
    const userRole = currentUser?.rol || "asistente_admin";
    const userName = currentUser?.nombre || currentUser?.nombres || "Asistente Administrativo";

    if (!["super_admin", "asistente_admin", "admin", "socio"].includes(userRole) && !(currentUser && currentUser.id === "WRK-000")) {
      this.showToast("Solo el Asistente Administrativo o Dirección pueden elevar gastos.", "error");
      return;
    }

    const inputComentario = document.getElementById("flujoCajaComentarioInput");
    const nota = (inputComentario?.value || "").trim() || "Comprobante verificado con éxito por Asistente Administrativo. Elevado a Administración / Socio para su desembolso.";

    item.estadoFlujo = "elevado_admin";
    if (!item.historialEstados) item.historialEstados = [];
    item.historialEstados.push({
      estado: "elevado_admin",
      usuario: userName,
      rol: userRole,
      fecha: new Date().toLocaleString("es-PE", { hour12: false }),
      comentario: nota
    });

    window.db.update("caja_chica", item.id, item);
    if (window.__ENTERPRISE_CLOUD__ && window.PaoloCashManager && typeof window.PaoloCashManager.transition === "function") {
      const cloudState = (window.PaoloSyncManager && window.PaoloSyncManager.mapLegacyWorkflow)
        ? window.PaoloSyncManager.mapLegacyWorkflow("elevado_admin")
        : "branch_approved";
      window.PaoloCashManager.transition(item.id, cloudState, nota).catch((err) => {
        console.warn("[CashManager] elevar cloud:", err && err.message);
      });
    }
    this.showToast("Gasto elevado con éxito a Administración / Socio", "success");

    // Notificar a Dirección / Socios
    if (window.alerts && typeof window.alerts.notifyRole === "function") {
      window.alerts.notifyRole(["admin", "socio"], {
        title: `🚨 Gasto Elevado por Asistente: ${item.id}`,
        message: `${userName} ha revisado y elevado el gasto de ${item.concepto} (S/ ${Number(item.monto).toFixed(2)}) para aprobación final.`,
        severity: "urgent",
        priority: "high"
      });
    }

    // Notificar al Colaborador solicitante
    if (item.solicitante?.id && window.alerts && typeof window.alerts.notifyUser === "function") {
      window.alerts.notifyUser(item.solicitante.id, {
        title: `⬆️ Tu Rendición ha sido Elevada: ${item.id}`,
        message: `El Asistente Administrativo revisó tu gasto (${item.concepto}) y lo elevó a Dirección para desembolso.`,
        severity: "info"
      });
    }

    this.openFlujoCajaModal(item.id);
    this.renderCajaChica();
  }

  observarCajaChica() {
    if (!this.currentFlujoCajaId) return;
    const item = window.db.get("caja_chica").find(i => i.id === this.currentFlujoCajaId);
    if (!item) return;

    const currentUser = window.db.getCurrentUser ? window.db.getCurrentUser() : null;
    const userRole = currentUser?.rol || "asistente_admin";
    const userName = currentUser?.nombre || currentUser?.nombres || "Asistente Administrativo";

    if (!["super_admin", "asistente_admin", "admin", "socio"].includes(userRole) && !(currentUser && currentUser.id === "WRK-000")) {
      this.showToast("Solo el Asistente Administrativo o Dirección pueden observar gastos.", "error");
      return;
    }

    const inputComentario = document.getElementById("flujoCajaComentarioInput");
    const nota = (inputComentario?.value || "").trim();
    if (!nota) {
      alert("Por favor ingrese en el campo de texto el motivo u observación que el colaborador debe corregir.");
      inputComentario?.focus();
      return;
    }

    item.estadoFlujo = "observado";
    if (!item.historialEstados) item.historialEstados = [];
    item.historialEstados.push({
      estado: "observado",
      usuario: userName,
      rol: userRole,
      fecha: new Date().toLocaleString("es-PE", { hour12: false }),
      comentario: nota
    });

    window.db.update("caja_chica", item.id, item);
    this.showToast("Observación registrada. Se notificó al colaborador.", "warning");

    // Notificar al colaborador
    if (item.solicitante?.id && window.alerts && typeof window.alerts.notifyUser === "function") {
      window.alerts.notifyUser(item.solicitante.id, {
        title: `⚠️ Gasto Observado por Asistente: ${item.id}`,
        message: `Observación: ${nota}`,
        severity: "warning"
      });
    }

    this.openFlujoCajaModal(item.id);
    this.renderCajaChica();
  }

  aprobarCajaChica() {
    if (!this.currentFlujoCajaId) return;
    const item = window.db.get("caja_chica").find(i => i.id === this.currentFlujoCajaId);
    if (!item) return;

    const currentUser = window.db.getCurrentUser ? window.db.getCurrentUser() : null;
    const userRole = currentUser?.rol || "socio";
    const userName = currentUser?.nombre || currentUser?.nombres || "Socio Principal";

    if (!["super_admin", "admin", "socio"].includes(userRole) && !(currentUser && currentUser.id === "WRK-000")) {
      this.showToast("Solo los Socios Principales o Administradores pueden aprobar desembolsos.", "error");
      return;
    }

    const inputComentario = document.getElementById("flujoCajaComentarioInput");
    const nota = (inputComentario?.value || "").trim() || "Gasto aprobado y desembolsado por Dirección General.";

    item.estadoFlujo = "aprobado";
    if (!item.historialEstados) item.historialEstados = [];
    item.historialEstados.push({
      estado: "aprobado",
      usuario: userName,
      rol: userRole,
      fecha: new Date().toLocaleString("es-PE", { hour12: false }),
      comentario: nota
    });

    window.db.update("caja_chica", item.id, item);
    if (window.__ENTERPRISE_CLOUD__ && window.PaoloCashManager && typeof window.PaoloCashManager.transition === "function") {
      // Flujo legal: branch_approved → disbursed (no saltar requested → disbursed)
      window.PaoloCashManager.transition(item.id, "disbursed", nota).catch((err) => {
        console.warn("[CashManager] aprobar cloud:", err && err.message);
        this.showToast("Aprobado local; nube: " + ((err && err.message) || "error"), "warning");
      });
    } else if (window.PaoloCashManager && window.PaoloCashManager.enqueueLocalEntry) {
      window.PaoloCashManager.enqueueLocalEntry(item).catch(() => {});
    }
    this.showToast("Gasto aprobado y autorizado para desembolso", "success");

    // Notificar al colaborador solicitante
    if (item.solicitante?.id && window.alerts && typeof window.alerts.notifyUser === "function") {
      window.alerts.notifyUser(item.solicitante.id, {
        title: `✅ Rendición Aprobada: ${item.id}`,
        message: `Su gasto por S/ ${Number(item.monto).toFixed(2)} (${item.concepto}) ha sido APROBADO por ${userName}.`,
        severity: "info"
      });
    }

    // Notificar al Asistente Administrativo
    if (window.alerts && typeof window.alerts.notifyRole === "function") {
      window.alerts.notifyRole(["asistente_admin"], {
        title: `✅ Gasto Aprobado para Desembolso: ${item.id}`,
        message: `${userName} aprobó el gasto de ${item.concepto}. Proceder con el registro contable y desembolso.`,
        severity: "info"
      });
    }

    this.openFlujoCajaModal(item.id);
    this.renderCajaChica();
  }

  rechazarCajaChica() {
    if (!this.currentFlujoCajaId) return;
    const item = window.db.get("caja_chica").find(i => i.id === this.currentFlujoCajaId);
    if (!item) return;

    const currentUser = window.db.getCurrentUser ? window.db.getCurrentUser() : null;
    const userRole = currentUser?.rol || "socio";
    const userName = currentUser?.nombre || currentUser?.nombres || "Socio Principal";

    if (!["super_admin", "admin", "socio"].includes(userRole) && !(currentUser && currentUser.id === "WRK-000")) {
      this.showToast("Solo los Socios Principales o Administradores pueden rechazar gastos.", "error");
      return;
    }

    const inputComentario = document.getElementById("flujoCajaComentarioInput");
    const nota = (inputComentario?.value || "").trim();
    if (!nota) {
      alert("Por favor ingrese el motivo del rechazo en el campo de texto.");
      inputComentario?.focus();
      return;
    }

    item.estadoFlujo = "rechazado";
    if (!item.historialEstados) item.historialEstados = [];
    item.historialEstados.push({
      estado: "rechazado",
      usuario: userName,
      rol: userRole,
      fecha: new Date().toLocaleString("es-PE", { hour12: false }),
      comentario: nota
    });

    window.db.update("caja_chica", item.id, item);
    if (window.__ENTERPRISE_CLOUD__ && window.PaoloCashManager && typeof window.PaoloCashManager.transition === "function") {
      window.PaoloCashManager.transition(item.id, "rejected", nota).catch((err) => {
        console.warn("[CashManager] rechazar cloud:", err && err.message);
      });
    }
    this.showToast("Gasto rechazado por Dirección", "info");

    // Notificar al colaborador solicitante
    if (item.solicitante?.id && window.alerts && typeof window.alerts.notifyUser === "function") {
      window.alerts.notifyUser(item.solicitante.id, {
        title: `❌ Rendición Rechazada: ${item.id}`,
        message: `Motivo: ${nota}`,
        severity: "urgent"
      });
    }

    this.openFlujoCajaModal(item.id);
    this.renderCajaChica();
  }

  setCasosViewMode(mode) {
    this.casosViewMode = mode;
    const btnTable = document.getElementById("btnViewModeTable");
    const btnKanban = document.getElementById("btnViewModeKanban");
    const containerTable = document.getElementById("casosTableViewContainer");
    const containerKanban = document.getElementById("casosKanbanViewContainer");

    if (btnTable && btnKanban) {
      btnTable.classList.toggle("bg-slate-900", mode === "table");
      btnTable.classList.toggle("text-white", mode === "table");
      btnTable.classList.toggle("bg-white", mode !== "table");
      btnTable.classList.toggle("text-slate-700", mode !== "table");

      btnKanban.classList.toggle("bg-slate-900", mode === "kanban");
      btnKanban.classList.toggle("text-white", mode === "kanban");
      btnKanban.classList.toggle("bg-white", mode !== "kanban");
      btnKanban.classList.toggle("text-slate-700", mode !== "kanban");
    }

    if (containerTable && containerKanban) {
      containerTable.classList.toggle("hidden", mode !== "table");
      containerKanban.classList.toggle("hidden", mode !== "kanban");
    }

    this.renderCasos();
  }

  renderCasos() {
    if (this.casosViewMode === "kanban") {
      this.renderCasosKanban();
    } else {
      this.renderCasosTable();
    }
  }

  renderCasosTable() {
    const items = window.db.get("casos");
    const container = document.getElementById("casosTableBody");
    const searchVal = (document.getElementById("searchCasos")?.value || "").toLowerCase();
    const filterMateria = document.getElementById("filterMateriaCasos")?.value || "ALL";
    const filterEstado = document.getElementById("filterEstadoCasos")?.value || "ALL";
    const filterResolucion = document.getElementById("filterResolucionCasos")?.value || "ALL";
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!container) return;

    const filtered = items.filter(c => {
      const matchSearch =
        (c.expediente || "").toLowerCase().includes(searchVal) ||
        (c.caratula || "").toLowerCase().includes(searchVal) ||
        (c.cliente || "").toLowerCase().includes(searchVal) ||
        (c.juzgado || "").toLowerCase().includes(searchVal);

      const matchMat = filterMateria === "ALL" || c.materia === filterMateria;
      const matchEst = filterEstado === "ALL" || c.estado === filterEstado;

      const hasExp = !!(c.pdfMeta && c.pdfMeta.expediente && c.pdfMeta.expediente.hasPdf);
      const hasRes = !!(c.pdfMeta && ((c.pdfMeta.resolucion && c.pdfMeta.resolucion.hasPdf) || (c.pdfMeta.hasPdf && !c.pdfMeta.expediente)));
      const hasAny = hasExp || hasRes;

      let matchRes = true;
      if (filterResolucion === "CON_PDF") {
        matchRes = hasAny;
      } else if (filterResolucion === "CON_EXPEDIENTE") {
        matchRes = hasExp;
      } else if (filterResolucion === "CON_RESOLUCION") {
        matchRes = hasRes;
      } else if (filterResolucion === "CON_AMBOS") {
        matchRes = hasExp && hasRes;
      } else if (filterResolucion === "SIN_PDF") {
        matchRes = !hasAny;
      }

      return matchSearch && matchMat && matchEst && matchRes;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="9" class="text-center py-8 text-slate-400">
            <i class="fa-solid fa-folder-open text-3xl mb-2 text-slate-300"></i>
            <p>No se encontraron expedientes con los criterios seleccionados</p>
          </td>
        </tr>
      `;
      this._syncTablePager("casosTablePager", "casos", { page: 1, pages: 1, pageSize: 50, total: 0, start: 0, end: 0 });
      return;
    }

    const pageState = this.getTablePageState("casos", filtered.length, 50);
    const pageItems = filtered.slice(pageState.start, pageState.end);

    container.innerHTML = pageItems.map(c => {
      let deadlineBadge = `<span class="text-slate-400 text-xs">Sin plazo fijado</span>`;
      if (c.vencimiento) {
        const vDate = new Date(c.vencimiento + "T00:00:00");
        const diffDays = Math.round((vDate - today) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
          deadlineBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse"><i class="fa-solid fa-triangle-exclamation mr-1"></i>VENCIDO (${Math.abs(diffDays)}d)</span>`;
        } else if (diffDays === 0) {
          deadlineBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-600 text-white animate-bounce shadow-sm"><i class="fa-solid fa-skull mr-1"></i>¡VENCE HOY!</span>`;
        } else if (diffDays <= 2) {
          deadlineBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-400"><i class="fa-solid fa-hourglass-end mr-1"></i>Plazo Fatal: ${diffDays} día(s)</span>`;
        } else if (diffDays <= 5) {
          deadlineBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">Próx: ${diffDays} días</span>`;
        } else {
          deadlineBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">${diffDays} días restantes</span>`;
        }
      }

      const matterColors = {
        "Civil": "bg-blue-100 text-blue-800 border-blue-200",
        "Civil / Comercial": "bg-blue-100 text-blue-800 border-blue-200",
        "Penal": "bg-red-100 text-red-800 border-red-200",
        "Laboral": "bg-amber-100 text-amber-800 border-amber-200",
        "Corporativo": "bg-emerald-100 text-emerald-800 border-emerald-200",
        "Constitucional / Ambiental": "bg-cyan-100 text-cyan-800 border-cyan-200"
      };

      const matClass = matterColors[c.materia] || "bg-slate-100 text-slate-800 border-slate-200";

      const docExp = (c.pdfMeta && c.pdfMeta.expediente && c.pdfMeta.expediente.hasPdf) ? c.pdfMeta.expediente : null;
      const docRes = (c.pdfMeta && c.pdfMeta.resolucion && c.pdfMeta.resolucion.hasPdf)
        ? c.pdfMeta.resolucion
        : ((c.pdfMeta && c.pdfMeta.hasPdf && !c.pdfMeta.expediente) ? c.pdfMeta : null);

      return `
        <tr id="caso-row-${escapeHtml(c.id)}" class="hover:bg-slate-50 transition border-b border-slate-200">
          <td class="font-mono text-xs font-bold text-slate-900">
            <div class="flex items-center gap-1.5 flex-wrap">
              <i class="fa-solid fa-scale-balanced text-amber-600"></i>
              <span>${escapeHtml(c.expediente)}</span>
              ${window.renderSedeBadge ? window.renderSedeBadge(c.sede) : ''}
            </div>
            <span class="text-[10px] text-slate-500 font-sans block mt-0.5">${escapeHtml(c.juzgado)}</span>
          </td>
          <td>
            <div class="font-semibold text-xs text-slate-900">${escapeHtml(c.caratula)}</div>
            <div class="text-[11px] text-slate-600 mt-0.5"><i class="fa-regular fa-user text-[10px] mr-1"></i>Patrocinado: ${escapeHtml(c.cliente)}</div>
          </td>
          <td>
            <span class="px-2 py-0.5 rounded text-xs font-semibold border ${matClass}">${escapeHtml(c.materia)}</span>
          </td>
          <td>
            <div>${deadlineBadge}</div>
            <div class="text-[10px] text-slate-600 mt-0.5 truncate max-w-xs">${escapeHtml(c.detalleVencimiento || c.vencimiento || '-')}</div>
          </td>
          <td class="text-xs">
            <span class="font-medium text-slate-800">${c.proximaAudiencia && c.proximaAudiencia !== '-' ? escapeHtml(c.proximaAudiencia.replace("T", " ")) : '<span class="text-slate-400">Sin audiencia</span>'}</span>
          </td>
          <td>
            <span class="px-2 py-0.5 rounded text-xs font-semibold ${c.estado === 'Concluido / Ganado' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}">
              ${escapeHtml(c.etapa || c.estado)}
            </span>
          </td>
          <td class="text-center whitespace-nowrap py-2 px-1">
            <div class="flex flex-col gap-1 items-center justify-center">
              <!-- Documento 1: Expediente Digital Completo -->
              <div class="inline-flex items-center gap-1">
                ${docExp ? `
                  <button onclick="window.app.viewCasoPdf(${jsStr(c.id)}, 'expediente')" class="bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-bold px-2 py-0.5 rounded text-[11px] inline-flex items-center gap-1 shadow-sm transition" title="Ver Expediente: ${escapeHtml(docExp.fileName || 'Expediente Digital')}">
                    <i class="fa-solid fa-folder-closed text-blue-600"></i>
                    <span class="truncate max-w-[70px]">${escapeHtml(docExp.fileName || 'Exp. PDF')}</span>
                  </button>
                  <button onclick="window.app.downloadCasoPdf(${jsStr(c.id)}, 'expediente')" class="text-slate-400 hover:text-blue-700 p-0.5 text-xs" title="Descargar Expediente PDF"><i class="fa-solid fa-download"></i></button>
                ` : `
                  <button onclick="window.app.openCargarResolucionRapidaModal(${jsStr(c.id)}, 'expediente')" class="text-blue-700 hover:text-blue-900 bg-blue-50/70 hover:bg-blue-100 border border-dashed border-blue-300 font-semibold px-2 py-0.5 rounded text-[10px] inline-flex items-center gap-1 transition" title="Cargar archivo PDF del expediente digital completo">
                    <i class="fa-solid fa-cloud-arrow-up text-blue-600 text-[10px]"></i> + Exp. PDF
                  </button>
                `}
              </div>
              <!-- Documento 2: Resolución Judicial -->
              <div class="inline-flex items-center gap-1">
                ${docRes ? `
                  <button onclick="window.app.viewCasoPdf(${jsStr(c.id)}, 'resolucion')" class="bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 font-bold px-2 py-0.5 rounded text-[11px] inline-flex items-center gap-1 shadow-sm transition" title="Ver Resolución: ${escapeHtml(docRes.fileName || 'Resolución Judicial')}">
                    <i class="fa-solid fa-file-lines text-rose-600"></i>
                    <span class="truncate max-w-[70px]">${escapeHtml(docRes.fileName || 'Res. PDF')}</span>
                  </button>
                  <button onclick="window.app.downloadCasoPdf(${jsStr(c.id)}, 'resolucion')" class="text-slate-400 hover:text-rose-700 p-0.5 text-xs" title="Descargar Resolución PDF"><i class="fa-solid fa-download"></i></button>
                ` : `
                  <button onclick="window.app.openCargarResolucionRapidaModal(${jsStr(c.id)}, 'resolucion')" class="text-rose-700 hover:text-rose-900 bg-rose-50/70 hover:bg-rose-100 border border-dashed border-rose-300 font-semibold px-2 py-0.5 rounded text-[10px] inline-flex items-center gap-1 transition" title="Cargar archivo PDF de la resolución judicial">
                    <i class="fa-solid fa-cloud-arrow-up text-rose-600 text-[10px]"></i> + Res. PDF
                  </button>
                `}
              </div>
            </div>
          </td>
          <td class="text-xs font-mono text-center text-slate-600">
            ${c.tiempoCicloDias || 45} d
          </td>
          <td class="text-center whitespace-nowrap">
            <button onclick="window.app.openGeneradorEscritoModal(${jsStr(c.id)})" class="text-amber-600 hover:text-amber-800 p-1.5 transition" title="Redactar Escrito Judicial Automático"><i class="fa-solid fa-file-signature"></i></button>
            <button onclick="window.app.openTimelineCasoModal(${jsStr(c.id)})" class="text-cyan-600 hover:text-cyan-800 p-1.5 transition" title="Ver Línea de Tiempo Procesal"><i class="fa-solid fa-timeline"></i></button>
            <button onclick="window.app.editCaso(${jsStr(c.id)})" class="text-slate-500 hover:text-blue-600 p-1.5 transition" title="Editar"><i class="fa-solid fa-pen-to-square"></i></button>
            <button onclick="window.app.deleteCaso(${jsStr(c.id)})" class="text-slate-400 hover:text-red-600 p-1.5 transition" title="Eliminar"><i class="fa-solid fa-trash-can"></i></button>
          </td>
        </tr>
      `;
    }).join("");
    this._syncTablePager("casosTablePager", "casos", pageState);
  }

  renderCasosKanban() {
    const items = window.db.get("casos");
    const container = document.getElementById("casosKanbanColumnsContainer");
    const searchVal = (document.getElementById("searchCasos")?.value || "").toLowerCase();
    const curr = window.db.getSettings().currency;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!container) return;

    const stages = [
      { key: "Postulatoria", label: "1. Postulatoria", desc: "Demandas y Excepciones" },
      { key: "Probatoria", label: "2. Probatoria", desc: "Peritajes y Pruebas" },
      { key: "Juzgamiento", label: "3. Audiencias", desc: "Alegatos e Informes" },
      { key: "Sentencia", label: "4. Sentencia", desc: "Fallo e Impugnación" },
      { key: "Ejecución", label: "5. Ejecución / Ganado", desc: "Cobro y Conclusión" }
    ];

    container.innerHTML = stages.map(stage => {
      const stageCasos = items.filter(c => {
        const etapa = (c.etapa || "").toLowerCase();
        const est = (c.estado || "").toLowerCase();
        const matchSearch =
          (c.expediente || "").toLowerCase().includes(searchVal) ||
          (c.caratula || "").toLowerCase().includes(searchVal) ||
          (c.cliente || "").toLowerCase().includes(searchVal);

        if (!matchSearch) return false;

        const isEjecucion = etapa.includes("ejecuci") || est.includes("concluido") || est.includes("ganado");
        if (stage.key === "Postulatoria") return etapa.includes("postulatoria") || etapa.includes("calificación");
        if (stage.key === "Probatoria") return etapa.includes("probatoria") || etapa.includes("conciliación");
        if (stage.key === "Juzgamiento") return etapa.includes("juzgamiento") || etapa.includes("intermedia") || etapa.includes("audiencia");
        // Sentencia NO debe incluir "Ejecución de Sentencia" (contiene la subcadena "sentencia")
        if (stage.key === "Sentencia") return !isEjecucion && (etapa.includes("sentencia") || etapa.includes("apelación"));
        if (stage.key === "Ejecución") return isEjecucion;
        return false;
      });

      const cardsHtml = stageCasos.map(c => {
        let deadlineNotice = "";
        if (c.vencimiento) {
          const vDate = new Date(c.vencimiento + "T00:00:00");
          const diffDays = Math.round((vDate - today) / (1000 * 60 * 60 * 24));
          if (diffDays <= 2) {
            deadlineNotice = `<div class="text-[10px] text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200 mt-1.5 flex items-center gap-1">
              <i class="fa-solid fa-triangle-exclamation"></i> Vence en ${diffDays <= 0 ? 'HOY' : diffDays + 'd'}
            </div>`;
          }
        }

        const docExp = (c.pdfMeta && c.pdfMeta.expediente && c.pdfMeta.expediente.hasPdf) ? c.pdfMeta.expediente : null;
        const docRes = (c.pdfMeta && c.pdfMeta.resolucion && c.pdfMeta.resolucion.hasPdf)
          ? c.pdfMeta.resolucion
          : ((c.pdfMeta && c.pdfMeta.hasPdf && !c.pdfMeta.expediente) ? c.pdfMeta : null);

        return `
          <div class="kanban-card p-3 space-y-2 bg-white">
            <div class="flex items-center justify-between gap-1 flex-wrap">
              <span class="font-mono text-[11px] font-bold text-slate-800">${escapeHtml(c.expediente)}</span>
              <div class="flex items-center gap-1">
                ${window.renderSedeBadge ? window.renderSedeBadge(c.sede) : ''}
                <span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">${escapeHtml(c.materia)}</span>
              </div>
            </div>

            <h5 class="text-xs font-bold text-slate-900 leading-tight">${escapeHtml(c.caratula)}</h5>
            <div class="text-[10px] text-slate-500"><i class="fa-solid fa-user-tie text-[9px]"></i> ${escapeHtml(c.cliente)}</div>

            ${deadlineNotice}

            ${(docExp || docRes) ? `
              <div class="space-y-1">
                ${docExp ? `
                  <div class="flex items-center justify-between bg-blue-50 border border-blue-200 rounded px-2 py-0.5 text-[10px]">
                    <span class="text-blue-800 font-bold truncate flex items-center gap-1" title="${escapeHtml(docExp.fileName || 'Expediente')}">
                      <i class="fa-solid fa-folder-closed text-blue-600"></i> ${escapeHtml(docExp.fileName || 'Expediente')}
                    </span>
                    <button type="button" onclick="window.app.viewCasoPdf(${jsStr(c.id)}, 'expediente')" class="text-blue-700 hover:text-blue-950 font-bold underline ml-1 shrink-0">Ver</button>
                  </div>
                ` : ''}
                ${docRes ? `
                  <div class="flex items-center justify-between bg-rose-50 border border-rose-200 rounded px-2 py-0.5 text-[10px]">
                    <span class="text-rose-800 font-bold truncate flex items-center gap-1" title="${escapeHtml(docRes.fileName || 'Resolución')}">
                      <i class="fa-solid fa-file-lines text-rose-600"></i> ${escapeHtml(docRes.fileName || 'Resolución')}
                    </span>
                    <button type="button" onclick="window.app.viewCasoPdf(${jsStr(c.id)}, 'resolucion')" class="text-rose-700 hover:text-rose-950 font-bold underline ml-1 shrink-0">Ver</button>
                  </div>
                ` : ''}
              </div>
            ` : ''}

            <div class="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px]">
              <span class="font-bold text-blue-900">${curr} ${Number(c.honorarios || 0).toLocaleString()}</span>
              <button onclick="window.app.advanceCasoStage(${jsStr(c.id)})" class="text-amber-800 hover:text-amber-950 font-bold flex items-center gap-1 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded transition" title="Avanzar Etapa">
                Avanzar <i class="fa-solid fa-chevron-right text-[8px]"></i>
              </button>
            </div>
          </div>
        `;
      }).join("");

      return `
        <div class="kanban-column p-3 flex-1 min-w-[240px]">
          <div class="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
            <div>
              <h4 class="font-bold text-xs text-slate-900">${stage.label}</h4>
              <span class="text-[10px] text-slate-500">${stage.desc}</span>
            </div>
            <span class="w-5 h-5 rounded-full bg-slate-200 text-slate-800 text-[10px] font-bold flex items-center justify-center">
              ${stageCasos.length}
            </span>
          </div>

          <div class="flex-1 space-y-2.5 overflow-y-auto max-h-[580px]">
            ${cardsHtml || '<div class="py-8 text-center text-[11px] text-slate-400">Sin causas en esta etapa</div>'}
          </div>
        </div>
      `;
    }).join("");
  }

  advanceCasoStage(id) {
    const list = window.db.get("casos");
    const caso = list.find(c => c.id === id);
    if (!caso) return;

    const stages = ["Postulatoria", "Probatoria", "Juzgamiento", "Sentencia", "Ejecución de Sentencia"];
    const currentEtapa = String(caso.etapa || "Postulatoria").trim();
    // Igualdad exacta (o match del tramo más largo primero): evita que "Ejecución de Sentencia" quede atrapada en "Sentencia"
    let nextIdx = stages.findIndex(s => currentEtapa === s);
    if (nextIdx === -1) {
      const lower = currentEtapa.toLowerCase();
      if (lower.includes("ejecuci")) nextIdx = 4;
      else if (lower.includes("sentencia") || lower.includes("apelaci")) nextIdx = 3;
      else if (lower.includes("juzgamiento") || lower.includes("audiencia") || lower.includes("intermedia")) nextIdx = 2;
      else if (lower.includes("probatoria") || lower.includes("conciliaci")) nextIdx = 1;
      else if (lower.includes("postulatoria") || lower.includes("calificaci")) nextIdx = 0;
    }

    if (nextIdx === -1 || nextIdx >= stages.length - 1) {
      caso.estado = "Concluido / Ganado";
      caso.etapa = "Ejecución de Sentencia";
      this.showToast(`Expediente ${caso.expediente} marcado como Concluido / Ganado`, "success");
    } else {
      caso.etapa = stages[nextIdx + 1];
      this.showToast(`Expediente ${caso.expediente} avanzado a: ${caso.etapa}`, "info");
    }

    window.db.update("casos", id, caso);
    this.renderCasos();
    window.kpiDashboard.refresh();
  }

  openCasoModal(id = null) {
    this.editingId = id;
    this.pendingCasoPdfFile = null;
    this.pendingExpedientePdfFile = null;
    this.pendingResolucionPdfFile = null;
    this.removePdfFlag = false;
    this.removeExpedientePdfFlag = false;
    this.removeResolucionPdfFlag = false;
    this.currentWaCitaId = null;

    const form = document.getElementById("formCaso");
    if (form) form.reset();

    const inputExp = document.getElementById("casoInputExpedientePdf");
    if (inputExp) inputExp.value = "";
    const inputRes = document.getElementById("casoInputResolucionPdf");
    if (inputRes) inputRes.value = "";

    const titleEl = document.getElementById("modalCasoTitle");

    // Referencias UI Expediente Digital
    const expFileNameEl = document.getElementById("casoExpedienteFileName");
    const expFileSizeEl = document.getElementById("casoExpedienteFileSize");
    const expBadgeEl = document.getElementById("casoExpedientePdfBadge");
    const expActionsEl = document.getElementById("casoExpedienteActions");
    const expBtnTextEl = document.getElementById("btnUploadExpedienteText");

    // Referencias UI Resolución Judicial
    const resFileNameEl = document.getElementById("casoResolucionFileName");
    const resFileSizeEl = document.getElementById("casoResolucionFileSize");
    const resBadgeEl = document.getElementById("casoResolucionPdfBadge");
    const resActionsEl = document.getElementById("casoResolucionActions");
    const resBtnTextEl = document.getElementById("btnUploadResolucionText");

    const resetPdfUI = () => {
      if (expFileNameEl) expFileNameEl.textContent = "Ningún expediente PDF adjunto";
      if (expFileSizeEl) expFileSizeEl.textContent = "";
      if (expBadgeEl) { expBadgeEl.textContent = "Sin archivo"; expBadgeEl.className = "text-[10px] font-semibold text-slate-400"; }
      if (expActionsEl) expActionsEl.classList.add("hidden");
      if (expBtnTextEl) expBtnTextEl.textContent = "Subir Expediente";

      if (resFileNameEl) resFileNameEl.textContent = "Ninguna resolución PDF adjunta";
      if (resFileSizeEl) resFileSizeEl.textContent = "";
      if (resBadgeEl) { resBadgeEl.textContent = "Sin archivo"; resBadgeEl.className = "text-[10px] font-semibold text-slate-400"; }
      if (resActionsEl) resActionsEl.classList.add("hidden");
      if (resBtnTextEl) resBtnTextEl.textContent = "Subir Resolución";
    };

    resetPdfUI();

    if (id) {
      if (titleEl) titleEl.textContent = "Editar Expediente Judicial";
      const item = window.db.get("casos").find(i => i.id === id);
      if (item) { this._editingOriginalUpdatedAt = item.updatedAt || item.createdAt || null; }
      if (item) {
        if (document.getElementById("casoExpediente")) document.getElementById("casoExpediente").value = item.expediente;
        if (document.getElementById("casoCaratula")) document.getElementById("casoCaratula").value = item.caratula;
        if (document.getElementById("casoMateria")) document.getElementById("casoMateria").value = item.materia;
        if (document.getElementById("casoTipoProceso")) document.getElementById("casoTipoProceso").value = item.tipoProceso || "";
        if (document.getElementById("casoCliente")) document.getElementById("casoCliente").value = item.cliente;
        if (document.getElementById("casoParteContraria")) document.getElementById("casoParteContraria").value = item.parteContraria || "";
        if (document.getElementById("casoJuzgado")) document.getElementById("casoJuzgado").value = item.juzgado;
        if (document.getElementById("casoJuez")) document.getElementById("casoJuez").value = item.juez || "";
        if (document.getElementById("casoVencimiento")) document.getElementById("casoVencimiento").value = item.vencimiento || "";
        if (document.getElementById("casoDetalleVencimiento")) document.getElementById("casoDetalleVencimiento").value = item.detalleVencimiento || "";
        if (document.getElementById("casoAudiencia")) document.getElementById("casoAudiencia").value = item.proximaAudiencia || "";
        if (document.getElementById("casoEstado")) document.getElementById("casoEstado").value = item.estado;
        if (document.getElementById("casoEtapa")) document.getElementById("casoEtapa").value = item.etapa || "Postulatoria";
        if (document.getElementById("casoPrioridad")) document.getElementById("casoPrioridad").value = item.prioridad;
        if (document.getElementById("casoCuantia")) document.getElementById("casoCuantia").value = item.cuantia || 0;
        if (document.getElementById("casoHonorarios")) document.getElementById("casoHonorarios").value = item.honorarios || 0;
        if (document.getElementById("casoTiempoCiclo")) document.getElementById("casoTiempoCiclo").value = item.tiempoCicloDias || 30;
        if (document.getElementById("casoRiesgo")) document.getElementById("casoRiesgo").value = item.nivelRiesgo || "Normal";
        if (document.getElementById("casoNotas")) document.getElementById("casoNotas").value = item.notas || "";
        if (document.getElementById("casoSede")) document.getElementById("casoSede").value = window.db.normalizeSede(item.sede || "challhuahuacho");

        // 1. Cargar metadatos de Expediente Digital
        if (item.pdfMeta && item.pdfMeta.expediente && item.pdfMeta.expediente.hasPdf) {
          const doc = item.pdfMeta.expediente;
          if (expFileNameEl) expFileNameEl.textContent = doc.fileName || "Expediente Digital.pdf";
          if (expFileSizeEl) expFileSizeEl.textContent = doc.fileSizeStr ? `(${doc.fileSizeStr})` : "";
          if (expBadgeEl) { expBadgeEl.textContent = "Almacenado"; expBadgeEl.className = "text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded"; }
          if (expActionsEl) expActionsEl.classList.remove("hidden");
          if (expBtnTextEl) expBtnTextEl.textContent = "Cambiar";
        }

        // 2. Cargar metadatos de Resolución Judicial (con retrocompatibilidad)
        const resDoc = (item.pdfMeta && item.pdfMeta.resolucion && item.pdfMeta.resolucion.hasPdf)
          ? item.pdfMeta.resolucion
          : ((item.pdfMeta && item.pdfMeta.hasPdf && !item.pdfMeta.expediente) ? item.pdfMeta : null);

        if (resDoc) {
          if (resFileNameEl) resFileNameEl.textContent = resDoc.fileName || "Resolución Judicial.pdf";
          if (resFileSizeEl) resFileSizeEl.textContent = resDoc.fileSizeStr ? `(${resDoc.fileSizeStr})` : "";
          if (resBadgeEl) { resBadgeEl.textContent = "Almacenado"; resBadgeEl.className = "text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded"; }
          if (resActionsEl) resActionsEl.classList.remove("hidden");
          if (resBtnTextEl) resBtnTextEl.textContent = "Cambiar";
        }
      }
    } else {
      this._editingOriginalUpdatedAt = null;
      if (titleEl) titleEl.textContent = "Nuevo Expediente — PAOLO ALDEA & ABOGADOS";
      if (document.getElementById("casoVencimiento")) document.getElementById("casoVencimiento").value = getRelativeDateOnlyStr(5);
      const active = window.db ? window.db.getActiveSede() : "challhuahuacho";
      if (document.getElementById("casoSede")) document.getElementById("casoSede").value = active === "todas" ? "challhuahuacho" : active;
    }

    if (document.getElementById("casoSede")) {
      document.getElementById("casoSede").disabled = !(window.db && window.db.isGlobalAdmin());
    }

    this.showModal("modalCaso");
  }

  async saveCaso(e) {
    if (e) e.preventDefault();
    try {
      const expInput = document.getElementById("casoExpediente");
      const cliInput = document.getElementById("casoCliente");
      const vencInput = document.getElementById("casoVencimiento");

      if (!expInput || !expInput.value.trim()) {
        if (expInput) {
          expInput.classList.add("ring-2", "ring-rose-500");
          setTimeout(() => expInput.classList.remove("ring-2", "ring-rose-500"), 2500);
          expInput.focus();
        }
        this.showToast("Debe ingresar el número de expediente judicial.", "warning");
        return;
      }

      if (!cliInput || !cliInput.value.trim()) {
        if (cliInput) {
          cliInput.classList.add("ring-2", "ring-rose-500");
          setTimeout(() => cliInput.classList.remove("ring-2", "ring-rose-500"), 2500);
          cliInput.focus();
        }
        this.showToast("Debe ingresar el nombre del cliente o entidad patrocinada.", "warning");
        return;
      }

      if (vencInput && vencInput.value && isNaN(new Date(vencInput.value).getTime())) {
        vencInput.classList.add("ring-2", "ring-rose-500");
        setTimeout(() => vencInput.classList.remove("ring-2", "ring-rose-500"), 2500);
        vencInput.focus();
        this.showToast("La fecha de vencimiento ingresada no tiene un formato válido.", "warning");
        return;
      }
      const data = {
        sede: getSafeVal("casoSede", window.db ? window.db.getActiveSede() : "challhuahuacho"),
        expediente: getSafeVal("casoExpediente", "EXP-S/N"),
        caratula: getSafeVal("casoCaratula", "Sin carátula"),
        materia: getSafeVal("casoMateria", "Civil / Comercial"),
        tipoProceso: getSafeVal("casoTipoProceso", "Proceso Judicial"),
        cliente: getSafeVal("casoCliente", "Patrocinado"),
        parteContraria: getSafeVal("casoParteContraria", "-"),
        juzgado: getSafeVal("casoJuzgado", "Juzgado de Cotabambas"),
        juez: getSafeVal("casoJuez", "-"),
        vencimiento: getSafeVal("casoVencimiento", ""),
        detalleVencimiento: getSafeVal("casoDetalleVencimiento", ""),
        proximaAudiencia: getSafeVal("casoAudiencia", ""),
        estado: getSafeVal("casoEstado", "En trámite"),
        etapa: getSafeVal("casoEtapa", "Postulatoria"),
        prioridad: getSafeVal("casoPrioridad", "Media"),
        cuantia: getSafeNum("casoCuantia", 0),
        honorarios: getSafeNum("casoHonorarios", 0),
        tiempoCicloDias: getSafeInt("casoTiempoCiclo", 30),
        nivelRiesgo: getSafeVal("casoRiesgo", "Normal"),
        notas: getSafeVal("casoNotas", ""),
        abogadoAsignado: "Dr. Paolo Aldea"
      };

      const casoId = this.editingId || window.generateUniqueId("CASO");

      // Recuperar metadatos existentes
      const existing = this.editingId ? window.db.get("casos").find(c => c.id === this.editingId) : null;
      let expMeta = existing?.pdfMeta?.expediente || null;
      let resMeta = existing?.pdfMeta?.resolucion || (existing?.pdfMeta?.hasPdf && !existing?.pdfMeta?.expediente ? existing.pdfMeta : null);

      // 1. Guardar o borrar Expediente Digital (PDF)
      if (this.removeExpedientePdfFlag) {
        if (this.editingId) {
          try { await window.pdfDb.deletePdf(this.editingId, "expediente"); } catch (e) { console.warn(e); }
        }
        expMeta = null;
      } else if (this.pendingExpedientePdfFile) {
        const mb = (this.pendingExpedientePdfFile.size / (1024 * 1024)).toFixed(2) + " MB";
        await window.pdfDb.savePdf(casoId, this.pendingExpedientePdfFile, "expediente");
        expMeta = {
          hasPdf: true,
          fileName: this.pendingExpedientePdfFile.name,
          fileSizeStr: mb,
          uploadDate: new Date().toISOString()
        };
      }

      // 2. Guardar o borrar Resolución Judicial (PDF)
      if (this.removeResolucionPdfFlag || this.removePdfFlag) {
        if (this.editingId) {
          try { await window.pdfDb.deletePdf(this.editingId, "resolucion"); } catch (e) { console.warn(e); }
        }
        resMeta = null;
      } else if (this.pendingResolucionPdfFile || this.pendingCasoPdfFile) {
        const fileToSave = this.pendingResolucionPdfFile || this.pendingCasoPdfFile;
        const mb = (fileToSave.size / (1024 * 1024)).toFixed(2) + " MB";
        await window.pdfDb.savePdf(casoId, fileToSave, "resolucion");
        resMeta = {
          hasPdf: true,
          fileName: fileToSave.name,
          fileSizeStr: mb,
          uploadDate: new Date().toISOString()
        };
      }

      const hasAnyPdf = !!(expMeta?.hasPdf || resMeta?.hasPdf);
      data.pdfMeta = {
        hasPdf: hasAnyPdf,
        expediente: expMeta,
        resolucion: resMeta
      };

      if (this.editingId) {
        const freshCaso = window.db.get("casos").find(c => c.id === this.editingId);
        if (freshCaso && this._editingOriginalUpdatedAt && freshCaso.updatedAt && freshCaso.updatedAt !== this._editingOriginalUpdatedAt) {
          const proceed = confirm("⚠️ AVISO DE CONCURRENCIA (Optimistic Locking):\nEste expediente fue actualizado recientemente por otra sede o usuario mientras usted realizaba cambios.\n\n¿Desea sobrescribir con su versión actual?");
          if (!proceed) {
            this.showToast("Operación cancelada para preservar cambios recientes de la otra sede.", "warning");
            return;
          }
        }
        const updated = window.db.update("casos", this.editingId, data);
        if (!updated) {
          this.showToast("No se pudo actualizar el expediente. Verifique permisos o reintente.", "error");
          return;
        }
        this.showToast("Expediente judicial actualizado con éxito", "success");
      } else {
        data.id = casoId;
        data.fechaInicio = getRelativeDateOnlyStr(0);
        const created = window.db.add("casos", data);
        if (!created) {
          this.showToast("No se pudo guardar el expediente. Verifique permisos o reintente.", "error");
          return;
        }
        this.showToast("Nuevo expediente judicial registrado en el despacho", "success");
      }
      if (window.PaoloCaseService && typeof window.PaoloCaseService.upsertCase === "function") {
        window.PaoloCaseService.upsertCase(data).catch(() => {});
      }

      if (window.draftAutosave) window.draftAutosave.clearDraft("modalCaso");

      this.pendingCasoPdfFile = null;
      this.pendingExpedientePdfFile = null;
      this.pendingResolucionPdfFile = null;
      this.removePdfFlag = false;
      this.removeExpedientePdfFlag = false;
      this.removeResolucionPdfFlag = false;

      this.closeModal("modalCaso");
      this.renderCasos();
      window.alerts.evaluateAlerts();
      window.kpiDashboard.refresh();
    } catch (err) {
      console.error("Error al guardar caso:", err);
      alert("Error al guardar Expediente: " + err.message);
    }
  }

  editCaso(id) {
    if (window.db && !window.db._rbacCheck("casos", "update", id)) return;
    this.openCasoModal(id);
  }

  async deleteCaso(id) {
    if (window.db && !window.db._rbacCheck("casos", "delete", id)) return;
    if (confirm("¿Está seguro de eliminar este expediente judicial del sistema?")) {
      try {
        await window.pdfDb.deletePdf(id); // Elimina expediente, resolución y claves legacy
      } catch (e) {
        console.warn("No se pudo eliminar PDF asociado a caso:", e);
      }
      const ok = window.db.delete("casos", id);
      if (!ok) {
        this.showToast("No se pudo eliminar el expediente.", "error");
        return;
      }
      this.renderCasos();
      window.alerts.evaluateAlerts();
      window.kpiDashboard.refresh();
      this.showToast("Expediente eliminado", "info");
    }
  }

  // =========================================================================
  // GESTIÓN Y VISOR DE EXPEDIENTES & RESOLUCIONES PDF (INDEXEDDB)
  // =========================================================================
  handleCasoDocSelected(e, docType = "resolucion") {
    const file = e.target?.files?.[0];
    if (!file) return;

    if (file.type && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      alert("Por favor seleccione un archivo en formato PDF válido.");
      e.target.value = "";
      return;
    }

    if (file.size > 60 * 1024 * 1024) {
      alert("El archivo excede el límite recomendado de 60 MB para almacenamiento offline.");
      e.target.value = "";
      return;
    }

    const mb = (file.size / (1024 * 1024)).toFixed(2);

    if (docType === "expediente") {
      this.pendingExpedientePdfFile = file;
      this.removeExpedientePdfFlag = false;

      const fileNameEl = document.getElementById("casoExpedienteFileName");
      const fileSizeEl = document.getElementById("casoExpedienteFileSize");
      const badgeEl = document.getElementById("casoExpedientePdfBadge");
      const actionsEl = document.getElementById("casoExpedienteActions");
      const btnTextEl = document.getElementById("btnUploadExpedienteText");

      if (fileNameEl) fileNameEl.textContent = file.name;
      if (fileSizeEl) fileSizeEl.textContent = `(${mb} MB)`;
      if (badgeEl) { badgeEl.textContent = "Listo para guardar"; badgeEl.className = "text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded"; }
      if (actionsEl) actionsEl.classList.remove("hidden");
      if (btnTextEl) btnTextEl.textContent = "Cambiar";
    } else {
      this.pendingResolucionPdfFile = file;
      this.removeResolucionPdfFlag = false;

      const fileNameEl = document.getElementById("casoResolucionFileName");
      const fileSizeEl = document.getElementById("casoResolucionFileSize");
      const badgeEl = document.getElementById("casoResolucionPdfBadge");
      const actionsEl = document.getElementById("casoResolucionActions");
      const btnTextEl = document.getElementById("btnUploadResolucionText");

      if (fileNameEl) fileNameEl.textContent = file.name;
      if (fileSizeEl) fileSizeEl.textContent = `(${mb} MB)`;
      if (badgeEl) { badgeEl.textContent = "Listo para guardar"; badgeEl.className = "text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded"; }
      if (actionsEl) actionsEl.classList.remove("hidden");
      if (btnTextEl) btnTextEl.textContent = "Cambiar";
    }
  }

  // Alias retrocompatible
  handleCasoPdfSelected(e) {
    this.handleCasoDocSelected(e, "resolucion");
  }

  removeModalDoc(docType = "resolucion") {
    if (docType === "expediente") {
      this.pendingExpedientePdfFile = null;
      this.removeExpedientePdfFlag = true;

      const input = document.getElementById("casoInputExpedientePdf");
      if (input) input.value = "";

      const fileNameEl = document.getElementById("casoExpedienteFileName");
      const fileSizeEl = document.getElementById("casoExpedienteFileSize");
      const badgeEl = document.getElementById("casoExpedientePdfBadge");
      const actionsEl = document.getElementById("casoExpedienteActions");
      const btnTextEl = document.getElementById("btnUploadExpedienteText");

      if (fileNameEl) fileNameEl.textContent = "Ningún expediente PDF adjunto";
      if (fileSizeEl) fileSizeEl.textContent = "";
      if (badgeEl) { badgeEl.textContent = "Sin archivo"; badgeEl.className = "text-[10px] font-semibold text-slate-400"; }
      if (actionsEl) actionsEl.classList.add("hidden");
      if (btnTextEl) btnTextEl.textContent = "Subir Expediente";
    } else {
      this.pendingResolucionPdfFile = null;
      this.removeResolucionPdfFlag = true;

      const input = document.getElementById("casoInputResolucionPdf");
      if (input) input.value = "";

      const fileNameEl = document.getElementById("casoResolucionFileName");
      const fileSizeEl = document.getElementById("casoResolucionFileSize");
      const badgeEl = document.getElementById("casoResolucionPdfBadge");
      const actionsEl = document.getElementById("casoResolucionActions");
      const btnTextEl = document.getElementById("btnUploadResolucionText");

      if (fileNameEl) fileNameEl.textContent = "Ninguna resolución PDF adjunta";
      if (fileSizeEl) fileSizeEl.textContent = "";
      if (badgeEl) { badgeEl.textContent = "Sin archivo"; badgeEl.className = "text-[10px] font-semibold text-slate-400"; }
      if (actionsEl) actionsEl.classList.add("hidden");
      if (btnTextEl) btnTextEl.textContent = "Subir Resolución";
    }
  }

  // Alias retrocompatible
  removeCurrentModalPdf() {
    this.removeModalDoc("resolucion");
  }

  async previewModalDoc(docType = "resolucion") {
    const pending = docType === "expediente" ? this.pendingExpedientePdfFile : this.pendingResolucionPdfFile;
    if (pending) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        this.currentViewingPdf = {
          fileName: pending.name,
          dataUrl: dataUrl
        };
        const titleEl = document.getElementById("pdfViewerTitle");
        const subTitleEl = document.getElementById("pdfViewerSubtitle");
        const frame = document.getElementById("pdfViewerFrame");
        if (titleEl) titleEl.textContent = `${docType === 'expediente' ? '📁 Expediente Judicial Digital' : '📄 Resolución Judicial'} — ${pending.name}`;
        if (subTitleEl) subTitleEl.textContent = "Vista previa antes de guardar en almacenamiento local";
        if (frame) frame.src = dataUrl;
        this.showModal("modalPdfViewer");
      };
      reader.readAsDataURL(pending);
    } else if (this.editingId) {
      await this.viewCasoPdf(this.editingId, docType);
    }
  }

  // Alias retrocompatible
  previewCurrentModalPdf() {
    this.previewModalDoc("resolucion");
  }

  async downloadModalDoc(docType = "resolucion") {
    const pending = docType === "expediente" ? this.pendingExpedientePdfFile : this.pendingResolucionPdfFile;
    if (pending) {
      const url = URL.createObjectURL(pending);
      const a = document.createElement("a");
      a.href = url;
      a.download = pending.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } else if (this.editingId) {
      await this.downloadCasoPdf(this.editingId, docType);
    }
  }

  // Alias retrocompatible
  downloadCurrentModalPdf() {
    this.downloadModalDoc("resolucion");
  }

  async viewCasoPdf(casoId, docType = "resolucion") {
    try {
      const record = await window.pdfDb.getPdf(casoId, docType);
      if (!record || !record.dataUrl) {
        this.showToast(`No se encontró el archivo de ${docType === 'expediente' ? 'expediente digital' : 'resolución'} en la base de datos local.`, "warning");
        return;
      }
      this.currentViewingPdf = record;
      const caso = window.db.get("casos").find(c => c.id === casoId);

      const titleEl = document.getElementById("pdfViewerTitle");
      const subTitleEl = document.getElementById("pdfViewerSubtitle");
      const frame = document.getElementById("pdfViewerFrame");

      if (titleEl) titleEl.textContent = `${docType === 'expediente' ? '📁 Expediente Judicial Digital' : '📄 Resolución Judicial'} — ${record.fileName || 'Documento PDF'}`;
      if (subTitleEl) {
        subTitleEl.textContent = caso ? `Expediente: ${caso.expediente} — ${caso.caratula} | ${caso.juzgado}` : "";
      }
      if (frame) frame.src = record.dataUrl;

      this.showModal("modalPdfViewer");
    } catch (err) {
      console.error("Error al cargar PDF:", err);
      this.showToast("Error al abrir archivo PDF: " + err.message, "error");
    }
  }

  async downloadCasoPdf(casoId, docType = "resolucion") {
    try {
      const record = await window.pdfDb.getPdf(casoId, docType);
      if (!record || !record.dataUrl) {
        this.showToast("No se encontró el documento PDF para descargar.", "warning");
        return;
      }
      const defaultName = docType === 'expediente' ? 'Expediente_Digital.pdf' : 'Resolucion_Judicial.pdf';
      this.downloadDataUrl(record.dataUrl, record.fileName || defaultName);
    } catch (err) {
      console.error("Error al descargar PDF:", err);
      this.showToast("Error al descargar archivo PDF", "error");
    }
  }

  openPdfInNewTab() {
    if (!this.currentViewingPdf || !this.currentViewingPdf.dataUrl) return;
    try {
      const parts = this.currentViewingPdf.dataUrl.split(",");
      const mime = parts[0].match(/:(.*?);/)?.[1] || "application/pdf";
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank");
    } catch (e) {
      const win = window.open();
      if (win) {
        win.document.write(`<iframe src="${this.currentViewingPdf.dataUrl}" frameborder="0" style="border:0; top:0; left:0; bottom:0; right:0; width:100%; height:100%;" allowfullscreen></iframe>`);
      }
    }
  }

  downloadViewingPdf() {
    if (!this.currentViewingPdf || !this.currentViewingPdf.dataUrl) return;
    this.downloadDataUrl(this.currentViewingPdf.dataUrl, this.currentViewingPdf.fileName || "Documento_Juridico.pdf");
  }

  downloadDataUrl(dataUrl, fileName) {
    try {
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error("Error al disparar descarga:", e);
    }
  }

  // =========================================================================
  // SUBIR Y GESTIONAR EXPEDIENTES & RESOLUCIONES PDF (MODAL RÁPIDO)
  // =========================================================================
  openCargarResolucionRapidaModal(casoId = null, docType = "resolucion") {
    this.pendingRapidaPdfFile = null;
    const form = document.getElementById("formCargarResolucionRapida");
    if (form) form.reset();

    const select = document.getElementById("rapidaCasoSelect");
    if (select) {
      select.innerHTML = '<option value="">-- Elija un expediente --</option>';
      const casos = window.db.get("casos");
      casos.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = `${c.expediente} — ${c.caratula} (${c.juzgado})`;
        if (casoId && c.id === casoId) opt.selected = true;
        select.appendChild(opt);
      });
    }

    const docTypeSelect = document.getElementById("rapidaTipoDoc");
    if (docTypeSelect) {
      docTypeSelect.value = docType || "resolucion";
    }

    this.handleRapidaTipoDocChange();

    const fileNameEl = document.getElementById("rapidaPdfFileName");
    const fileSizeEl = document.getElementById("rapidaPdfFileSize");
    const btnTextEl = document.getElementById("rapidaBtnUploadText");
    const input = document.getElementById("rapidaInputPdf");

    if (input) input.value = "";
    if (fileNameEl) fileNameEl.textContent = "Ningún archivo PDF seleccionado";
    if (fileSizeEl) fileSizeEl.textContent = "";
    if (btnTextEl) btnTextEl.textContent = "Seleccionar PDF";

    this.showModal("modalCargarResolucionRapida");
  }

  handleRapidaTipoDocChange() {
    const docType = document.getElementById("rapidaTipoDoc")?.value || "resolucion";
    const labelEl = document.getElementById("rapidaFileLabel");
    if (labelEl) {
      labelEl.textContent = docType === "expediente"
        ? "Archivo de Expediente Judicial Completo (PDF) *"
        : "Archivo de Resolución Judicial Principal (PDF) *";
    }
  }

  handleResolucionRapidaFile(e) {
    const file = e.target?.files?.[0];
    if (!file) return;

    if (file.type && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      alert("Por favor seleccione un archivo en formato PDF válido.");
      e.target.value = "";
      return;
    }

    if (file.size > 60 * 1024 * 1024) {
      alert("El archivo excede el límite recomendado de 60 MB.");
      e.target.value = "";
      return;
    }

    this.pendingRapidaPdfFile = file;
    const fileNameEl = document.getElementById("rapidaPdfFileName");
    const fileSizeEl = document.getElementById("rapidaPdfFileSize");
    const btnTextEl = document.getElementById("rapidaBtnUploadText");

    if (fileNameEl) fileNameEl.textContent = file.name;
    if (fileSizeEl) {
      const mb = (file.size / (1024 * 1024)).toFixed(2);
      fileSizeEl.textContent = `Tamaño: ${mb} MB (Listo para almacenar localmente en IndexedDB)`;
    }
    if (btnTextEl) btnTextEl.textContent = "Cambiar archivo";
  }

  async saveResolucionRapida(e) {
    if (e) e.preventDefault();
    const select = document.getElementById("rapidaCasoSelect");
    const casoId = select ? select.value : null;
    const docType = document.getElementById("rapidaTipoDoc")?.value || "resolucion";

    if (!casoId) {
      alert("Por favor elija el expediente judicial al cual vincular el documento PDF.");
      return;
    }

    if (!this.pendingRapidaPdfFile) {
      alert("Por favor seleccione el archivo PDF antes de guardar.");
      return;
    }

    try {
      const fileSizeMb = (this.pendingRapidaPdfFile.size / (1024 * 1024)).toFixed(2) + " MB";
      await window.pdfDb.savePdf(casoId, this.pendingRapidaPdfFile, docType);

      const caso = window.db.get("casos").find(c => c.id === casoId);
      if (caso) {
        if (!caso.pdfMeta) caso.pdfMeta = {};
        caso.pdfMeta.hasPdf = true;
        caso.pdfMeta[docType] = {
          hasPdf: true,
          fileName: this.pendingRapidaPdfFile.name,
          fileSizeStr: fileSizeMb,
          uploadDate: new Date().toISOString()
        };
        window.db.update("casos", casoId, caso);
      }

      const tipoName = docType === "expediente" ? "Expediente digital" : "Resolución judicial";
      this.showToast(`${tipoName} vinculada con éxito al Expediente ${caso ? caso.expediente : ''}`, "success");
      this.closeModal("modalCargarResolucionRapida");
      this.renderCasos();
      window.alerts.evaluateAlerts();
    } catch (err) {
      console.error("Error al asociar documento rápido:", err);
      alert("Error al guardar archivo en IndexedDB: " + err.message);
    }
  }

  async deleteResolucionFromCaso(casoId, docType = null) {
    const promptMsg = docType === "expediente"
      ? "¿Desea quitar el expediente digital PDF de esta causa judicial?"
      : (docType === "resolucion" ? "¿Desea quitar la resolución judicial PDF de esta causa?" : "¿Desea quitar los documentos PDF adjuntos de este expediente?");

    if (confirm(promptMsg)) {
      try {
        await window.pdfDb.deletePdf(casoId, docType);
        const caso = window.db.get("casos").find(c => c.id === casoId);
        if (caso && caso.pdfMeta) {
          if (docType === "expediente") {
            delete caso.pdfMeta.expediente;
          } else if (docType === "resolucion") {
            delete caso.pdfMeta.resolucion;
            delete caso.pdfMeta.fileName;
          } else {
            caso.pdfMeta = { hasPdf: false };
          }
          const hasAny = !!((caso.pdfMeta.expediente && caso.pdfMeta.expediente.hasPdf) || (caso.pdfMeta.resolucion && caso.pdfMeta.resolucion.hasPdf));
          caso.pdfMeta.hasPdf = hasAny;
          window.db.update("casos", casoId, caso);
        }
        this.showToast("Documento PDF eliminado del expediente", "info");
        this.renderCasos();
        window.alerts.evaluateAlerts();
      } catch (err) {
        console.error("Error al borrar documento:", err);
        alert("Error al eliminar PDF: " + err.message);
      }
    }
  }

  // =========================================================================
  // AJUSTES WEB PUSH (VAPID) — segundo plano
  // =========================================================================
  async refreshWebPushStatus() {
    const label = document.getElementById("webPushStatusLabel");
    if (!label) return;
    if (!window.PaoloPushService) {
      label.textContent = "Estado: servicio push no cargado.";
      return;
    }
    try {
      const st = await window.PaoloPushService.status();
      if (!st.supported) {
        label.textContent = "Estado: este navegador no soporta Web Push.";
        return;
      }
      const parts = [
        "permiso " + st.permission,
        st.optedIn ? "opt-in activo" : "sin opt-in",
        st.subscribed ? "dispositivo suscrito" : "sin suscripción",
        st.hasToken ? "sesión cloud OK" : "falta sesión cloud",
        st.vapidReady ? "VAPID listo" : "VAPID pendiente en servidor"
      ];
      label.textContent = "Estado: " + parts.join(" · ");
    } catch (_) {
      label.textContent = "Estado: no disponible.";
    }
  }

  async enableWebPushOnDevice() {
    if (!window.PaoloPushService) {
      this.showToast("PushService no disponible.", "error");
      return;
    }
    this.showToast("Solicitando permiso y registrando este dispositivo…", "info");
    try {
      const res = await window.PaoloPushService.subscribe({ forcePermission: true });
      const opt = document.getElementById("cfgWebPushOptIn");
      if (opt) opt.checked = !!res.ok;
      if (res.ok) {
        this.showToast("Dispositivo suscrito a Web Push.", "success");
        this.autoSaveCurrentSettings();
      } else {
        const map = {
          denied: "Permiso denegado en el navegador.",
          vapid_missing: "Falta VAPID_PUBLIC_KEY en Cloudflare.",
          no_session: "Inicie sesión online (syncToken) primero.",
          unsupported: "Navegador sin soporte Push.",
          permission_needed: "Se requiere permiso de notificaciones."
        };
        this.showToast(map[res.reason] || ("No se pudo suscribir (" + (res.reason || "?") + ")."), "error");
      }
    } catch (err) {
      this.showToast((err && err.message) || "Error al suscribir Web Push", "error");
    }
    this.refreshWebPushStatus();
  }

  async disableWebPushOnDevice() {
    if (!window.PaoloPushService) return;
    try {
      await window.PaoloPushService.unsubscribe();
      const opt = document.getElementById("cfgWebPushOptIn");
      if (opt) opt.checked = false;
      this.autoSaveCurrentSettings();
      this.showToast("Web Push desactivado en este dispositivo.", "info");
    } catch (err) {
      this.showToast((err && err.message) || "Error al desactivar", "error");
    }
    this.refreshWebPushStatus();
  }

  savePushNotificationSettings() {
    try {
      this.autoSaveCurrentSettings();
      this.applySettingsToUI();
      if (typeof this.renderDynamicSidebarModules === "function") this.renderDynamicSidebarModules();
      this.showToast("Ajustes de Web Push guardados", "success");
    } catch (err) {
      console.error("Error al guardar ajustes push:", err);
      alert("Error al guardar ajustes de notificaciones: " + err.message);
    }
  }

  async testPushNotification() {
    this.showToast("Enviando prueba Web Push…", "info");
    const res = await window.alerts.testPushNotification();
    if (res.success) {
      this.showToast("Prueba enviada. Revise la notificación del sistema.", "success");
    } else {
      this.showToast(
        "No se completó la prueba. Suscriba el dispositivo e inicie sesión cloud (VAPID configurado).",
        "info"
      );
    }
    this.refreshWebPushStatus();
  }

  openPhoneNotificationUrl() {
    this.showToast("Web Push usa el navegador/PWA; ya no se usa un canal público.", "info");
  }

  showWindowsNotifierInstructions() {
    alert("CÓMO ACTIVAR LAS NOTIFICACIONES EN WINDOWS (PC / LAPTOP):\n\n" +
      "1. En la carpeta de la aplicación encontrará el archivo:\n" +
      "   «iniciar_notificador_segundo_plano.vbs»\n\n" +
      "2. Al hacerle doble clic, se ejecutará silenciosamente en segundo plano sin ninguna ventana abierta.\n\n" +
      "3. Si desea que inicie siempre de forma automática cada vez que encienda su computadora, ejecute:\n" +
      "   «instalar_alerta_segundo_plano.bat»\n\n" +
      "¡Listo! Recibirá avisos emergentes nativos de Windows cuando haya plazos fatales y audiencias.");
  }

  // =========================================================================
  // 3. MÓDULO CITAS & AUDIENCIAS (CON ASISTENTE INTELIGENTE DE WHATSAPP)
  // =========================================================================
  renderCitas() {
    this.renderDirectorioBanner();
    const items = window.db.get("citas");
    const container = document.getElementById("citasCardsContainer");
    const searchVal = (document.getElementById("searchCitas")?.value || "").toLowerCase();
    const filterEstado = document.getElementById("filterEstadoCitas")?.value || "ALL";

    if (!container) return;

    const filtered = items.filter(c => {
      const matchSearch =
        (c.cliente || "").toLowerCase().includes(searchVal) ||
        (c.motivo || "").toLowerCase().includes(searchVal) ||
        (c.abogado || "").toLowerCase().includes(searchVal) ||
        (c.modalidad || "").toLowerCase().includes(searchVal);

      const matchEst = filterEstado === "ALL" || c.estado === filterEstado;
      return matchSearch && matchEst;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="col-span-full py-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
          <i class="fa-regular fa-calendar-xmark text-4xl mb-2 text-slate-300"></i>
          <p>No se encontraron citas programadas</p>
        </div>
      `;
      return;
    }

    filtered.sort((a, b) => (new Date(a.fechaHora || 0)) - (new Date(b.fechaHora || 0)));

    const now = new Date();

    container.innerHTML = filtered.map(c => {
      const d = c.fechaHora ? new Date(c.fechaHora) : null;
      const dateStr = d ? d.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' }) : "-";
      const timeStr = d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-";

      const stateColors = {
        "Confirmada": "bg-blue-100 text-blue-800 border-blue-300",
        "Pendiente": "bg-amber-100 text-amber-900 border-amber-300",
        "Atendida": "bg-emerald-100 text-emerald-800 border-emerald-300",
        "Cancelada": "bg-rose-100 text-rose-800 border-rose-300"
      };

      const badgeClass = stateColors[c.estado] || "bg-slate-100 text-slate-800";
      const cleanPhone = (c.telefono || "").replace(/[^0-9]/g, "");

      // Cálculo de proximidad temporal para recordatorios automáticos
      const diffHours = d ? (d - now) / (1000 * 60 * 60) : 999;
      const isToday = d && d.toDateString() === now.toDateString();
      const isSoon = diffHours > -2 && diffHours <= 36;
      const isPendiente = c.estado === "Pendiente";

      const docsList = c.documentosRequeridos || [];

      return `
        <div id="cita-card-${c.id}" class="bg-white rounded-xl border ${isPendiente ? 'border-amber-300 bg-amber-50/20' : (isToday ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200')} shadow-sm p-4 hover:shadow-md transition flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between gap-2 mb-2">
              <span class="px-2 py-0.5 rounded text-xs font-bold border ${badgeClass}">
                ${isPendiente ? '<i class="fa-regular fa-hourglass-half mr-1"></i>' : ''}${c.estado}
              </span>
              <span class="text-xs font-bold ${isToday ? 'text-rose-900 bg-rose-100 border-rose-300' : 'text-amber-900 bg-amber-50 border-amber-200'} px-2.5 py-1 rounded-full border flex items-center gap-1">
                <i class="fa-regular fa-clock"></i> ${timeStr} ${isToday ? '<span class="text-[9px] font-extrabold uppercase ml-0.5 text-rose-700">HOY</span>' : ''}
              </span>
            </div>

            <h4 class="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <i class="fa-solid fa-user-tie text-slate-600"></i> ${escapeHtml(c.cliente)}
            </h4>

            <p class="text-xs text-slate-700 font-medium mt-1.5 line-clamp-2">${escapeHtml(c.motivo)}</p>

            ${c.materia ? `
              <span class="inline-block mt-1.5 text-[10px] font-semibold text-blue-900 bg-blue-100 px-2 py-0.5 rounded">
                ${escapeHtml(c.materia)}
              </span>
            ` : ''}

            <!-- Checklist de Documentos Requeridos a Traer -->
            ${docsList.length > 0 ? `
              <div class="mt-2.5 pt-2 border-t border-slate-100">
                <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1 flex items-center gap-1">
                  <i class="fa-solid fa-file-circle-check text-blue-600"></i> Documentos a Traer:
                </span>
                <div class="flex flex-wrap gap-1">
                  ${docsList.map(doc => `<span class="bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-medium px-2 py-0.5 rounded truncate max-w-full" title="${escapeHtml(doc)}">• ${escapeHtml(doc)}</span>`).join("")}
                </div>
              </div>
            ` : ''}

            ${c.notas ? `
              <div class="mt-2 text-[11px] text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-100 italic">
                <i class="fa-solid fa-info-circle mr-1 text-slate-400"></i>${escapeHtml(c.notas)}
              </div>
            ` : ''}

            <div class="mt-3 space-y-1 text-xs text-slate-500 border-t border-slate-100 pt-2.5">
              <div class="flex items-center gap-1.5">
                <i class="fa-solid fa-calendar-day text-amber-600 w-4"></i>
                <span class="font-semibold text-slate-700 capitalize">${dateStr}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <i class="fa-solid fa-location-dot text-slate-400 w-4"></i>
                <span>${escapeHtml(c.modalidad)}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <i class="fa-solid fa-gavel text-slate-400 w-4"></i>
                <span>${escapeHtml(c.abogado)}</span>
              </div>
            </div>

            <!-- Sala Virtual Google Meet si está configurada -->
            ${c.meetUrl ? `
              <div class="mt-2.5 p-2 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-2">
                <div class="flex items-center gap-1.5 min-w-0 flex-1">
                  <i class="fa-solid fa-video text-emerald-600 text-xs shrink-0"></i>
                  <div class="min-w-0 flex-1">
                    <div class="text-[9px] font-bold text-emerald-900 uppercase">Sala Virtual Meet:</div>
                    <a href="${escapeHtml(c.meetUrl)}" target="_blank" rel="noopener noreferrer" class="text-xs font-mono font-semibold text-emerald-700 hover:underline truncate block" title="${escapeHtml(c.meetUrl)}">
                      ${escapeHtml(c.meetUrl)}
                    </a>
                  </div>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                  <a href="${escapeHtml(c.meetUrl)}" target="_blank" rel="noopener noreferrer" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded text-[11px] flex items-center gap-1 shadow-2xs transition">
                    Unirse
                  </a>
                  <button type="button" onclick="window.app.copiarMeetUrl(${jsStr(c.meetUrl)})" class="p-1 text-slate-400 hover:text-emerald-700 text-xs" title="Copiar enlace Meet">
                    <i class="fa-regular fa-copy"></i>
                  </button>
                </div>
              </div>
            ` : ''}
          </div>

          <!-- Acciones y Botones Inteligentes de WhatsApp -->
          <div class="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1.5">
            ${cleanPhone ? `
              <div class="flex items-center gap-1 flex-wrap">
                ${isPendiente ? `
                  <button onclick="window.app.openWhatsAppModal(${jsStr(c.id)}, 'pendiente')" class="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-2.5 py-1 rounded shadow-sm transition animate-pulse" title="Enviar solicitud de confirmación con frase de caso y lista de documentos">
                    <i class="fa-brands fa-whatsapp text-emerald-600 text-sm"></i> Confirmar Cita
                  </button>
                ` : (isToday ? `
                  <button onclick="window.app.openWhatsAppModal(${jsStr(c.id)}, 'recordatorio_hoy')" class="inline-flex items-center gap-1 text-[11px] font-bold text-rose-900 bg-rose-100 hover:bg-rose-200 border border-rose-300 px-2.5 py-1 rounded shadow-sm transition" title="Enviar recordatorio urgente de cita para hoy">
                    <i class="fa-regular fa-clock text-rose-600 text-xs"></i> Recordar Cita Hoy
                  </button>
                ` : (isSoon ? `
                  <button onclick="window.app.openWhatsAppModal(${jsStr(c.id)}, 'recordatorio_24h')" class="inline-flex items-center gap-1 text-[11px] font-bold text-blue-900 bg-blue-100 hover:bg-blue-200 border border-blue-300 px-2.5 py-1 rounded shadow-sm transition" title="Enviar recordatorio de cita próxima">
                    <i class="fa-regular fa-bell text-blue-600 text-xs"></i> Recordar Cita (24h)
                  </button>
                ` : `
                  <button onclick="window.app.openWhatsAppModal(${jsStr(c.id)}, 'confirmada')" class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded transition" title="Enviar ficha de confirmación oficial">
                    <i class="fa-brands fa-whatsapp text-emerald-600"></i> WhatsApp
                  </button>
                `))}

                <button onclick="window.app.openWhatsAppModal(${jsStr(c.id)}, 'auto')" class="text-slate-400 hover:text-emerald-700 p-1 text-xs" title="Opciones avanzadas de WhatsApp"><i class="fa-solid fa-sliders"></i></button>
              </div>
            ` : '<span class="text-[11px] text-slate-400 italic">Sin celular</span>'}

            <div class="flex items-center gap-1 ml-auto">
              <button onclick="window.app.editCita(${jsStr(c.id)})" class="text-slate-400 hover:text-blue-600 p-1.5 transition" title="Editar Cita"><i class="fa-solid fa-pen-to-square"></i></button>
              <button onclick="window.app.deleteCita(${jsStr(c.id)})" class="text-slate-400 hover:text-red-600 p-1.5 transition" title="Eliminar"><i class="fa-solid fa-trash-can"></i></button>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  handleCitaEstadoChange() {
    const estado = document.getElementById("citaEstado")?.value;
    if (estado === "Pendiente") {
      this.showToast("Cita marcada como 'Pendiente'. Se habilitará el mensaje de confirmación por WhatsApp.", "info");
    }
  }

  openCitaModal(id = null) {
    this.editingId = id;
    const form = document.getElementById("formCita");
    if (form) form.reset();

    // Desmarcar todos los checkboxes de documentos requeridos
    document.querySelectorAll('input[name="citaDocCheck"]').forEach(cb => cb.checked = false);

    const titleEl = document.getElementById("modalCitaTitle");

    if (id) {
      if (titleEl) titleEl.textContent = "Editar Cita / Audiencia";
      const item = window.db.get("citas").find(i => i.id === id);
      if (item) { this._editingOriginalUpdatedAt = item.updatedAt || item.createdAt || null; }
      if (item) {
        if (document.getElementById("citaCliente")) document.getElementById("citaCliente").value = item.cliente;
        if (document.getElementById("citaTelefono")) document.getElementById("citaTelefono").value = item.telefono || "";
        if (document.getElementById("citaMotivo")) document.getElementById("citaMotivo").value = item.motivo;
        if (document.getElementById("citaFechaHora")) document.getElementById("citaFechaHora").value = item.fechaHora;
        if (document.getElementById("citaModalidad")) document.getElementById("citaModalidad").value = item.modalidad;
        if (document.getElementById("citaMeetUrl")) document.getElementById("citaMeetUrl").value = item.meetUrl || "";
        if (document.getElementById("citaAbogado")) document.getElementById("citaAbogado").value = item.abogado;
        if (document.getElementById("citaEstado")) document.getElementById("citaEstado").value = item.estado;
        if (document.getElementById("citaMateria")) document.getElementById("citaMateria").value = item.materia || "General";
        if (document.getElementById("citaNotas")) document.getElementById("citaNotas").value = item.notas || "";
        if (document.getElementById("citaSede")) document.getElementById("citaSede").value = window.db.normalizeSede(item.sede || "challhuahuacho");

        // Marcar checkboxes guardados
        if (Array.isArray(item.documentosRequeridos)) {
          item.documentosRequeridos.forEach(docName => {
            const cb = document.querySelector(`input[name="citaDocCheck"][value="${docName}"]`);
            if (cb) cb.checked = true;
          });
        }
      }
    } else {
      this._editingOriginalUpdatedAt = null;
      if (titleEl) titleEl.textContent = "Agendar Cita — PAOLO ALDEA & ABOGADOS";
      if (document.getElementById("citaFechaHora")) document.getElementById("citaFechaHora").value = getRelativeDateStr(0, 11, 0);
      if (document.getElementById("citaMateria")) document.getElementById("citaMateria").value = "General";
      if (document.getElementById("citaMeetUrl")) document.getElementById("citaMeetUrl").value = "";
      const active = window.db ? window.db.getActiveSede() : "challhuahuacho";
      if (document.getElementById("citaSede")) document.getElementById("citaSede").value = active === "todas" ? "challhuahuacho" : active;

      // Marcar DNI por defecto en citas nuevas
      const dniCb = document.querySelector('input[name="citaDocCheck"][value^="DNI"]');
      if (dniCb) dniCb.checked = true;
    }

    if (document.getElementById("citaSede")) {
      document.getElementById("citaSede").disabled = !(window.db && window.db.isGlobalAdmin());
    }

    this.showModal("modalCita");
  }

  saveCita(e) {
    if (e) e.preventDefault();
    try {
      const cliInput = document.getElementById("citaCliente");
      const fechaInput = document.getElementById("citaFechaHora");

      if (!cliInput || !cliInput.value.trim()) {
        if (cliInput) {
          cliInput.classList.add("ring-2", "ring-rose-500");
          setTimeout(() => cliInput.classList.remove("ring-2", "ring-rose-500"), 2500);
          cliInput.focus();
        }
        this.showToast("Por favor ingrese el nombre del cliente o entidad para la cita o audiencia.", "warning");
        return;
      }

      if (!fechaInput || !fechaInput.value || isNaN(new Date(fechaInput.value).getTime())) {
        if (fechaInput) {
          fechaInput.classList.add("ring-2", "ring-rose-500");
          setTimeout(() => fechaInput.classList.remove("ring-2", "ring-rose-500"), 2500);
          fechaInput.focus();
        }
        this.showToast("Por favor indique una fecha y hora válida para la cita o audiencia.", "warning");
        return;
      }
      const selectedDocs = Array.from(document.querySelectorAll('input[name="citaDocCheck"]:checked')).map(cb => cb.value);

      const data = {
        sede: getSafeVal("citaSede", window.db ? window.db.getActiveSede() : "challhuahuacho"),
        cliente: getSafeVal("citaCliente", "Cliente"),
        telefono: getSafeVal("citaTelefono", ""),
        motivo: getSafeVal("citaMotivo", "Consulta Jurídica"),
        fechaHora: getSafeVal("citaFechaHora", getRelativeDateStr(0, 11, 0)),
        modalidad: getSafeVal("citaModalidad", "Presencial en Sede Challhuahuacho"),
        meetUrl: getSafeVal("citaMeetUrl", "").trim(),
        abogado: getSafeVal("citaAbogado", "Dr. Paolo Aldea"),
        estado: getSafeVal("citaEstado", "Confirmada"),
        materia: getSafeVal("citaMateria", "General"),
        documentosRequeridos: selectedDocs,
        notas: getSafeVal("citaNotas", "")
      };

      if (this.editingId) {
        const freshCita = window.db.get("citas").find(c => c.id === this.editingId);
        if (freshCita && this._editingOriginalUpdatedAt && freshCita.updatedAt && freshCita.updatedAt !== this._editingOriginalUpdatedAt) {
          const proceed = confirm("⚠️ AVISO DE CONCURRENCIA (Optimistic Locking):\nEsta cita/audiencia fue actualizada recientemente por otra sede o usuario.\n\n¿Desea sobrescribir con su versión actual?");
          if (!proceed) {
            this.showToast("Operación cancelada para preservar cambios recientes.", "warning");
            return;
          }
        }
        const updated = window.db.update("citas", this.editingId, data);
        if (!updated) {
          this.showToast("No se pudo actualizar la cita. Verifique permisos o reintente.", "error");
          return;
        }
        this.showToast("Cita actualizada exitosamente", "success");
      } else {
        data.id = window.generateUniqueId("CITA");
        const created = window.db.add("citas", data);
        if (!created) {
          this.showToast("No se pudo guardar la cita. Verifique permisos o reintente.", "error");
          return;
        }
        this.showToast("Cita agendada en Sede Challhuahuacho", "success");
        window.alerts.playChime("alert");
      }

      if (window.draftAutosave) window.draftAutosave.clearDraft("modalCita");
      this.closeModal("modalCita");
      this.renderCitas();
      window.alerts.evaluateAlerts();
      window.kpiDashboard.refresh();
    } catch (err) {
      console.error("Error al guardar cita:", err);
      alert("Error al agendar cita: " + err.message);
    }
  }

  editCita(id) {
    if (window.db && !window.db._rbacCheck("citas", "update", id)) return;
    this.openCitaModal(id);
  }

  deleteCita(id) {
    if (window.db && !window.db._rbacCheck("citas", "delete", id)) return;
    if (confirm("¿Desea cancelar y eliminar esta cita de la agenda?")) {
      const ok = window.db.delete("citas", id);
      if (!ok) {
        this.showToast("No se pudo eliminar la cita.", "error");
        return;
      }
      this.renderCitas();
      window.alerts.evaluateAlerts();
      window.kpiDashboard.refresh();
      this.showToast("Cita eliminada", "info");
    }
  }

  agendarDirectorioViernes() {
    this.openCitaModal();
    const nextFriday = getNextFridayDateStr(15, 0);
    const meetUrl = this.getDirectorioMeetUrl();
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    setVal("citaCliente", "Sesión de Directorio de Socios & Equipo Legal");
    setVal("citaTelefono", "+51 943 410 215");
    setVal("citaFechaHora", nextFriday);
    setVal("citaMotivo", "Directorio Semanal Estratégico & Evaluación de Casos Sede Challhuahuacho");
    setVal("citaModalidad", "Virtual por Google Meet");
    setVal("citaMeetUrl", meetUrl);
    setVal("citaAbogado", "Dr. Paolo Aldea & Socios");
    setVal("citaEstado", "Confirmada");
    setVal("citaMateria", "Directorio");
    setVal("citaNotas", `Sesión obligatoria de Directorio todos los viernes a las 3:00 PM vía Google Meet (${meetUrl}) para revisión de casos críticos y balance financiero.`);

    const docsToMark = [
      "Peritajes, informes técnicos o liquidaciones previas",
      "Resoluciones judiciales o cédulas de notificación",
      "Vigencia de poder o personería jurídica de la empresa"
    ];
    document.querySelectorAll('input[name="citaDocCheck"]').forEach(cb => {
      cb.checked = docsToMark.includes(cb.value);
    });
    this.showToast("Cita pre-configurada para el Directorio del próximo viernes (3:00 PM vía Meet)", "info");
  }

  // =========================================================================
  // GESTIÓN DE ENLACES DE GOOGLE MEET (DIRECTORIO & REUNIONES VIRTUALES)
  // Sincronización en tiempo real & Gobernanza por Roles (Socio / Administrador)
  // =========================================================================
  getDirectorioMeetUrl() {
    const s = window.db ? window.db.getSettings() : {};
    return s.directorioMeetUrl || localStorage.getItem("aldea_directorio_meet_url") || "https://meet.google.com/paolo-aldea-jur";
  }

  getDirectorioMeetNotas() {
    const s = window.db ? window.db.getSettings() : {};
    return s.directorioMeetNotas || localStorage.getItem("aldea_directorio_meet_notas") || "";
  }

  initRealtimeMeetSync() {
    // 1. Canal BroadcastChannel para comunicación instantánea entre todas las pestañas/ventanas abiertas
    try {
      if (typeof BroadcastChannel !== "undefined") {
        this.syncChannel = new BroadcastChannel("paolo_aldea_sync_channel");
        this.syncChannel.onmessage = (event) => {
          if (event.data && event.data.type === "DIRECTORIO_MEET_UPDATED") {
            this.renderDirectorioBanner();
            const autor = event.data.updatedBy || "Administración";
            this.showToast(`El enlace oficial de Google Meet para el Directorio ha sido actualizado por ${autor}.`, "info");
          }
        };
      }
    } catch (err) {
      console.warn("BroadcastChannel warning:", err);
    }

    // 2. Oyente 'storage' de LocalStorage para pestañas en segundo plano
    window.addEventListener("storage", (e) => {
      if (e.key === "aldea_directorio_meet_url" || e.key === "aldea_directorio_meet_timestamp" || (e.key && e.key.includes("settings"))) {
        this.renderDirectorioBanner();
      }
    });

    // 3. Oyente de evento personalizado local
    window.addEventListener("aldea:meet-url-updated", () => {
      this.renderDirectorioBanner();
    });

    // 4. Polling de sincronización pasiva cada 15 segundos
    setInterval(() => {
      const display = document.getElementById("bannerDirectorioMeetUrlDisplay");
      if (display) {
        const currentUrl = this.getDirectorioMeetUrl();
        if (display.textContent.trim() !== currentUrl) {
          this.renderDirectorioBanner();
        }
      }
    }, 15000);
  }

  /** Pinta u oculta la foto de perfil del usuario en la barra lateral. */
  updateProfilePhotoUI(photoDataUrl) {
    const img = document.getElementById("userProfileAvatarImg");
    const icon = document.getElementById("userProfileFallbackIcon");
    const btnRemove = document.getElementById("btnRemoveUserPhoto");
    const hasPhoto = typeof photoDataUrl === "string" && photoDataUrl.startsWith("data:image/");
    if (img) {
      if (hasPhoto) img.src = photoDataUrl; else img.removeAttribute("src");
      img.classList.toggle("hidden", !hasPhoto);
    }
    if (icon) icon.classList.toggle("hidden", hasPhoto);
    if (btnRemove) btnRemove.classList.toggle("hidden", !hasPhoto);
  }

  /** Guarda la foto de perfil del usuario actual (redimensionada a 256 px, max. 5 MB de origen). */
  handleProfilePhotoUpload(event) {
    const input = event && event.target;
    const file = input && input.files && input.files[0];
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      this.showToast("Formato no permitido. Use PNG, JPG o WEBP.", "error");
      input.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.showToast("La imagen supera 5 MB.", "error");
      input.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => this.showToast("No se pudo leer la imagen.", "error");
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => this.showToast("Imagen invalida.", "error");
      image.onload = () => {
        const size = 256;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const side = Math.min(image.width, image.height);
        canvas.getContext("2d").drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, size, size);
        this._persistProfilePhoto(canvas.toDataURL("image/jpeg", 0.85));
        input.value = "";
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  removeProfilePhoto() {
    this._persistProfilePhoto("");
  }

  _persistProfilePhoto(dataUrl) {
    const currentUser = window.db ? window.db.getCurrentUser() : null;
    const userId = currentUser ? (currentUser.id || currentUser.dni || "WRK-000") : "WRK-000";
    const key = "PAOLO_ALDEA_USER_PHOTO_" + userId;
    try {
      if (dataUrl) localStorage.setItem(key, dataUrl); else localStorage.removeItem(key);
    } catch (e) {
      this.showToast("No hay espacio para guardar la foto.", "error");
      return;
    }
    if (window.db && typeof window.db.getSettings === "function" && typeof window.db.saveSettings === "function") {
      const settings = window.db.getSettings() || {};
      settings.userPhoto = dataUrl || "";
      window.db.saveSettings(settings);
    }
    if (currentUser && window.db.setCurrentUser) {
      window.db.setCurrentUser({ ...currentUser, foto: dataUrl });
    }
    if (currentUser && currentUser.id && window.db.update) {
      const saved = window.db.update("workers", currentUser.id, { foto: dataUrl, updatedAt: new Date().toISOString() });
      if (!saved) {
        this.showToast("La foto se ve ahora, pero no quedó en la ficha del colaborador.", "warning");
      }
    }
    this.updateProfilePhotoUI(dataUrl);
    this.showToast(dataUrl ? "Foto de perfil actualizada." : "Foto de perfil eliminada.", "success");
  }
  renderDirectorioBanner() {
    const url = this.getDirectorioMeetUrl();
    const notas = this.getDirectorioMeetNotas();
    const btn = document.getElementById("bannerDirectorioMeetBtn");
    const display = document.getElementById("bannerDirectorioMeetUrlDisplay");
    const btnOpenEdit = document.getElementById("btnOpenEditMeet");
    const badgeRole = document.getElementById("badgeMeetRoleInfo");

    if (btn) btn.href = url;
    if (display) {
      display.textContent = url;
      display.href = url;
    }

    // Verificación de rol: Super Admin, Socio o Administrador pueden subir/cambiar enlace
    const currentUser = window.db ? window.db.getCurrentUser() : null;
    const roleSlug = window.db ? window.db.getRoleCategorySlug(window.db.getUserRole(currentUser)) : "socio";
    const canEditMeet = (roleSlug === "socio" || roleSlug === "admin" || roleSlug === "super_admin");

    if (btnOpenEdit) {
      if (canEditMeet) {
        btnOpenEdit.classList.remove("hidden");
        if (badgeRole) badgeRole.classList.add("hidden");
      } else {
        btnOpenEdit.classList.add("hidden");
        if (badgeRole) {
          badgeRole.classList.remove("hidden");
          badgeRole.classList.add("inline-flex");
        }
      }
    }

    // Sincronizar en elementos de modal de alerta y probar
    const alertaUrl = document.getElementById("alertaMeetUrlText");
    const btnAlertaUnirse = document.getElementById("btnAlertaUnirseMeet");
    const btnProbar = document.getElementById("btnProbarMeetModal");

    if (alertaUrl) alertaUrl.textContent = url;
    if (btnAlertaUnirse) btnAlertaUnirse.href = url;
    if (btnProbar) btnProbar.href = url;
  }

  copiarDirectorioMeetUrl() {
    const url = this.getDirectorioMeetUrl();
    this.copiarMeetUrl(url);
  }

  copiarMeetUrl(url) {
    if (!url) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        this.showToast("Enlace de Google Meet copiado al portapapeles", "success");
      }).catch(() => {
        prompt("Copie el enlace de Google Meet:", url);
      });
    } else {
      prompt("Copie el enlace de Google Meet:", url);
    }
  }

  openEditDirectorioMeetModal() {
    // Control estricto de acceso por rol (Super Admin, Socio o Administrador)
    const currentUser = window.db ? window.db.getCurrentUser() : null;
    const roleSlug = window.db ? window.db.getRoleCategorySlug(window.db.getUserRole(currentUser)) : "socio";
    if (roleSlug !== "socio" && roleSlug !== "admin" && roleSlug !== "super_admin") {
      this.showToast("Acceso restringido: Solo el Administrador o Socio Principal puede registrar o cambiar el enlace oficial de Google Meet.", "warning");
      return;
    }

    const url = this.getDirectorioMeetUrl();
    const notas = this.getDirectorioMeetNotas();
    const inUrl = document.getElementById("inputDirectorioMeetUrl");
    const inNotas = document.getElementById("inputDirectorioMeetNotas");
    const btnProbar = document.getElementById("btnProbarMeetModal");

    if (inUrl) inUrl.value = url;
    if (inNotas) inNotas.value = notas;
    if (btnProbar) btnProbar.href = url;

    this.showModal("modalDirectorioMeet");
  }

  setQuickMeetUrl(type) {
    const inUrl = document.getElementById("inputDirectorioMeetUrl");
    const btnProbar = document.getElementById("btnProbarMeetModal");
    let target = "https://meet.google.com/new";
    if (type === "default") {
      target = "https://meet.google.com/paolo-aldea-jur";
    }
    if (inUrl) inUrl.value = target;
    if (btnProbar) btnProbar.href = target;
  }

  saveDirectorioMeetConfig(e) {
    if (e) e.preventDefault();

    // Verificación de seguridad de rol (Super Admin, Administrador o Socio)
    const currentUser = window.db ? window.db.getCurrentUser() : null;
    const roleSlug = window.db ? window.db.getRoleCategorySlug(window.db.getUserRole(currentUser)) : "socio";
    if (roleSlug !== "socio" && roleSlug !== "admin" && roleSlug !== "super_admin") {
      this.showToast("Acceso denegado: Su usuario no cuenta con privilegios de Socio o Administrador.", "error");
      return;
    }

    let url = (document.getElementById("inputDirectorioMeetUrl")?.value || "").trim();
    const notas = (document.getElementById("inputDirectorioMeetNotas")?.value || "").trim();

    if (!url) {
      alert("Por favor ingrese un enlace válido de Google Meet.");
      return;
    }

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }

    // 1. Guardado persistente en Settings central y LocalStorage
    const s = window.db.getSettings();
    s.directorioMeetUrl = url;
    s.directorioMeetNotas = notas;
    s.directorioMeetUpdatedAt = new Date().toISOString();
    s.directorioMeetUpdatedBy = currentUser ? (currentUser.nombre || currentUser.nombres || "Socio") : "Administrador";

    window.db.saveSettings(s);
    localStorage.setItem("aldea_directorio_meet_url", url);
    localStorage.setItem("aldea_directorio_meet_notas", notas);
    const syncTimestamp = Date.now().toString();
    localStorage.setItem("aldea_directorio_meet_timestamp", syncTimestamp);

    // 2. Transmisión en tiempo real a todas las ventanas / trabajadores conectados
    try {
      if (this.syncChannel) {
        this.syncChannel.postMessage({
          type: "DIRECTORIO_MEET_UPDATED",
          url: url,
          notas: notas,
          updatedBy: s.directorioMeetUpdatedBy,
          timestamp: syncTimestamp
        });
      }
    } catch (err) {
      console.warn("Error en syncChannel:", err);
    }
    window.dispatchEvent(new CustomEvent("aldea:meet-url-updated", { detail: { url, notas } }));

    // 3. Sincronización automática con la nube si está activada
    if (typeof this.sincronizarConNube === "function" && s.cloudSyncAuto) {
      this.sincronizarConNube(true);
    }

    // 4. Actualización inmediata del banner y UI
    this.renderDirectorioBanner();
    this.closeModal("modalDirectorioMeet");
    this.showToast("Enlace de Google Meet actualizado y sincronizado en tiempo real con todo el equipo", "success");
  }

  mostrarModalAlertaDirectorioMeet(detalles) {
    const url = this.getDirectorioMeetUrl();
    const notas = this.getDirectorioMeetNotas();

    const badgeTiempo = document.getElementById("alertaMeetTiempoBadge");
    const urlText = document.getElementById("alertaMeetUrlText");
    const notasText = document.getElementById("alertaMeetNotasText");
    const btnUnirse = document.getElementById("btnAlertaUnirseMeet");

    if (badgeTiempo) badgeTiempo.textContent = detalles.etiqueta || "Faltan 15 Minutos";
    if (urlText) urlText.textContent = url;
    if (notasText) {
      notasText.textContent = notas || detalles.mensaje || "Reunión obligatoria de coordinación jurídica semanal, evaluación de casos y balance procesal.";
    }
    if (btnUnirse) btnUnirse.href = url;

    this.showModal("modalAlertaDirectorioMeet");
  }

  mostrarBannerReunionViernes(detalles) {
    const url = this.getDirectorioMeetUrl();
    const banner = document.getElementById("topAlertBanner");
    const content = document.getElementById("topAlertBannerContent");
    if (!banner || !content) return;

    banner.className = "bg-gradient-to-r from-amber-600 via-amber-700 to-indigo-900 text-white px-4 py-2.5 shadow-md flex items-center justify-between gap-3 text-xs shrink-0 transition-all border-b border-amber-400/40";
    banner.classList.remove("hidden");

    const safeUrl = (typeof escapeHtml === "function") ? escapeHtml(url) : url;
    const safeEtiqueta = (typeof escapeHtml === "function") ? escapeHtml(detalles.etiqueta || "Viernes 3:00 PM") : (detalles.etiqueta || "Viernes 3:00 PM");
    const safeMsg = (typeof escapeHtml === "function") ? escapeHtml(detalles.mensaje || "Reunión semanal obligatoria de la firma. Ingrese a la sala de Google Meet.") : (detalles.mensaje || "Reunión semanal obligatoria de la firma. Ingrese a la sala de Google Meet.");

    content.innerHTML = `
      <div class="flex items-center gap-3">
        <span class="w-8 h-8 rounded-lg bg-white/20 border border-white/30 flex items-center justify-center text-white font-bold shrink-0 animate-pulse">
          <i class="fa-solid fa-people-roof"></i>
        </span>
        <div>
          <div class="font-bold flex items-center gap-2">
            <span>🏛️ DIRECTORIO DE SOCIOS & EQUIPO LEGAL — ${safeEtiqueta}</span>
            <span class="bg-emerald-500 text-white text-[10px] px-2 py-0.2 rounded-full font-bold animate-pulse">EN VIVO / PRÓXIMO</span>
          </div>
          <div class="text-[11px] text-amber-200">
            ${safeMsg}
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button type="button" onclick="window.app.copiarDirectorioMeetUrl()" class="px-2.5 py-1 bg-black/30 hover:bg-black/50 border border-white/20 text-white rounded-lg text-xs font-bold transition cursor-pointer">
          <i class="fa-regular fa-copy"></i> Copiar
        </button>
        <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="px-3.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition cursor-pointer">
          <i class="fa-solid fa-video"></i> Unirse a Google Meet
        </a>
        <button type="button" data-alert-action="dismiss-meet" class="text-white/70 hover:text-white min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center cursor-pointer" title="Cerrar" aria-label="Cerrar banner">
          <i class="fa-solid fa-xmark pointer-events-none"></i>
        </button>
      </div>
    `;
    const meetClose = content.querySelector('[data-alert-action="dismiss-meet"]');
    if (meetClose) {
      meetClose.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.alerts && typeof window.alerts.dismissTopBanner === "function") {
          window.alerts.dismissTopBanner("meet-banner");
        } else {
          banner.classList.add("hidden");
        }
      });
    }
  }

  pegarDirectorioMeetEnCita() {
    const url = this.getDirectorioMeetUrl();
    const inCitaUrl = document.getElementById("citaMeetUrl");
    if (inCitaUrl) {
      inCitaUrl.value = url;
      this.showToast("Enlace oficial de Directorio aplicado a la cita", "info");
    }
  }

  handleCitaModalidadChange() {
    const mod = document.getElementById("citaModalidad")?.value || "";
    const inCitaUrl = document.getElementById("citaMeetUrl");
    if (mod.includes("Google Meet") && inCitaUrl && !inCitaUrl.value) {
      inCitaUrl.value = this.getDirectorioMeetUrl();
    }
  }

  // =========================================================================
  // SISTEMA INTELIGENTE DE WHATSAPP CON FRASES AUTOMÁTICAS Y RECORDATORIOS
  // =========================================================================
  getFraseJuridicaByMateria(materia = "General", motivo = "") {
    const m = (materia || "").toLowerCase();
    const mot = (motivo || "").toLowerCase();

    if (m.includes("directorio") || mot.includes("directorio")) {
      return "🏛️ *CONVOCATORIA OFICIAL DE DIRECTORIO:* Convocatoria formal a la Sesión de Directorio Semanal de PAOLO ALDEA & ABOGADOS para este viernes a las 3:00 PM vía Google Meet. Asistencia obligatoria para evaluación de casos críticos y balance de sede.";
    }
    if (m.includes("penal") || mot.includes("penal") || mot.includes("denuncia") || mot.includes("fiscal") || mot.includes("delito")) {
      return "⚠️ *Nota procesal reservada:* Tratándose de diligencias de índole penal, su puntualidad y preparación técnica con su defensa es de máxima prioridad para salvaguardar sus garantías constitucionales y libertad individual.";
    }
    if (m.includes("civil") || m.includes("comercial") || mot.includes("demanda") || mot.includes("terreno") || mot.includes("propiedad") || mot.includes("contrato") || mot.includes("deuda")) {
      return "📄 *Recomendación documental:* Rogamos traer consigo copias físicas legibles o digitales de los contratos, escrituras públicas, recibos o títulos valor pertinentes a su caso para su análisis pericial exhaustivo.";
    }
    if (m.includes("laboral") || mot.includes("despido") || mot.includes("beneficios") || mot.includes("remunerac") || mot.includes("indemniz")) {
      return "💼 *Documentación requerida:* Por favor acudir con sus boletas de remuneración, contrato de trabajo, cartas notariales o cualquier medio probatorio del vínculo y cese laboral.";
    }
    if (m.includes("audiencia") || mot.includes("audiencia") || mot.includes("juzgado") || mot.includes("juicio") || mot.includes("alegato")) {
      return "⚖️ *COMPARECENCIA JUDICIAL:* Se trata de una diligencia judicial formal programada ante el Juzgado. Le recordamos que su concurrencia es de carácter obligatorio bajo apercibimientos de ley.";
    }
    if (m.includes("corporativo") || mot.includes("sociedad") || mot.includes("empresa") || mot.includes("mina") || mot.includes("contratista")) {
      return "🏛️ *Gestión corporativa:* Le solicitamos tener a disposición la vigencia de poder actualizada de la empresa, estatutos y documentos societarios correspondientes.";
    }
    if (m.includes("familia") || mot.includes("alimentos") || mot.includes("sucesión") || mot.includes("herencia") || mot.includes("divorcio")) {
      return "📑 *Requisitos de la causa:* Por favor contar con las partidas de nacimiento, matrimonio o defunción originales, así como documentos que acrediten fehacientemente necesidades e ingresos.";
    }
    return "📌 *Indicación del despacho:* Le sugerimos preparar una relación cronológica de los hechos y tener a la mano todos los antecedentes que sustenten su consulta legal.";
  }

  openWhatsAppModal(citaId, forcedType = "auto") {
    const cita = window.db.get("citas").find(c => c.id === citaId);
    if (!cita) {
      this.showToast("Cita no encontrada", "warning");
      return;
    }

    this.currentWaCitaId = citaId;

    const nombreEl = document.getElementById("waClienteNombre");
    const telEl = document.getElementById("waClienteTel");
    const fechaEl = document.getElementById("waCitaFecha");
    const modEl = document.getElementById("waCitaModalidad");
    const badgeEl = document.getElementById("waModalEstadoBadge");
    const tipoSelect = document.getElementById("waTipoMensajeSelect");
    const matSelect = document.getElementById("waMateriaSelect");
    const fraseEl = document.getElementById("waFraseJuridica");

    if (nombreEl) nombreEl.textContent = cita.cliente;
    if (telEl) telEl.textContent = cita.telefono ? `📞 ${cita.telefono}` : "⚠️ Sin número celular registrado";

    const d = cita.fechaHora ? new Date(cita.fechaHora) : null;
    const dateStr = d ? d.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' }) : "-";
    const timeStr = d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-";

    if (fechaEl) fechaEl.textContent = `${dateStr} a las ${timeStr}`;
    if (modEl) modEl.textContent = cita.modalidad || "Sede Challhuahuacho";
    if (badgeEl) badgeEl.textContent = cita.estado || "Programada";

    // Determinar tipo automático si viene 'auto'
    let resolvedType = forcedType;
    if (forcedType === "auto") {
      const now = new Date();
      const diffHours = d ? (d - now) / (1000 * 60 * 60) : 999;
      const isToday = d && d.toDateString() === now.toDateString();

      if (cita.estado === "Pendiente") {
        resolvedType = "pendiente";
      } else if (isToday) {
        resolvedType = "recordatorio_hoy";
      } else if (diffHours > -2 && diffHours <= 36) {
        resolvedType = "recordatorio_24h";
      } else {
        resolvedType = "confirmada";
      }
    }

    if (tipoSelect) tipoSelect.value = resolvedType;
    if (matSelect) matSelect.value = cita.materia || "General";

    // Frase automática según materia y motivo
    if (fraseEl) {
      fraseEl.value = this.getFraseJuridicaByMateria(cita.materia || "General", cita.motivo || "");
    }

    // Renderizar chips de documentos marcados
    this.renderWaDocsChips(cita.documentosRequeridos || []);

    // Actualizar vista previa en vivo
    this.updateWhatsAppPreview();

    this.showModal("modalWhatsAppCita");
  }

  renderWaDocsChips(selectedDocs) {
    const container = document.getElementById("waDocsContainer");
    if (!container) return;

    const allDocs = [
      "DNI vigente / Carné de Extranjería",
      "Contratos, convenios o adendas firmadas",
      "Boletas de pago, recibos por honorarios o facturas",
      "Resoluciones judiciales o cédulas de notificación",
      "Títulos de propiedad, partidas o escrituras públicas (Sunarp)",
      "Cartas notariales y cargos de recepción",
      "Vigencia de poder o personería jurídica de la empresa",
      "Medios probatorios (chats WhatsApp, correos o fotos)",
      "Peritajes, informes técnicos o liquidaciones previas"
    ];

    container.innerHTML = allDocs.map(doc => {
      const isChecked = selectedDocs.includes(doc);
      return `
        <label class="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] cursor-pointer transition ${isChecked ? 'bg-emerald-100 text-emerald-900 border-emerald-300 font-semibold' : 'bg-white text-slate-500 border-slate-200'}">
          <input type="checkbox" name="waDocItem" value="${escapeHtml(doc)}" ${isChecked ? 'checked' : ''} onchange="window.app.updateWhatsAppPreview()" class="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5">
          <span>${escapeHtml(doc)}</span>
        </label>
      `;
    }).join("");
  }

  handleWaMateriaChange() {
    const mat = document.getElementById("waMateriaSelect")?.value || "General";
    const cita = window.db.get("citas").find(c => c.id === this.currentWaCitaId);
    const fraseEl = document.getElementById("waFraseJuridica");
    if (fraseEl) {
      fraseEl.value = this.getFraseJuridicaByMateria(mat, cita ? cita.motivo : "");
    }
    this.updateWhatsAppPreview();
  }

  resetWaFrase() {
    this.handleWaMateriaChange();
    this.showToast("Frase jurídica restablecida al estándar", "info");
  }

  buildWhatsAppText() {
    const cita = window.db.get("citas").find(c => c.id === this.currentWaCitaId);
    if (!cita) return "";

    const tipo = document.getElementById("waTipoMensajeSelect")?.value || "confirmada";
    const fraseCustom = document.getElementById("waFraseJuridica")?.value || "";

    const checkedDocs = Array.from(document.querySelectorAll('input[name="waDocItem"]:checked')).map(cb => cb.value);

    const d = cita.fechaHora ? new Date(cita.fechaHora) : null;
    const dateStr = d ? d.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : "-";
    const timeStr = d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-";

    let estadoHeader = "";
    let callToAction = "";

    if (tipo === "pendiente") {
      estadoHeader = "⏳ *SOLICITUD DE CONFIRMACIÓN DE CITA*\nLe informamos que tenemos una cita programada en estado *PENDIENTE DE CONFIRMACIÓN* en nuestra agenda de Sede Challhuahuacho:";
      callToAction = "👉 *ACCIÓN REQUERIDA:* Por favor responda a este mensaje con la palabra *\"CONFIRMO\"* para asegurar la reserva de sala y el tiempo del despacho jurídico.";
    } else if (tipo === "recordatorio_hoy") {
      estadoHeader = "🚨 *RECORDATORIO URGENTE — CITA PROGRAMADA PARA HOY*\nLe recordamos cordialmente que el día de *HOY* tiene una diligencia/cita agendada con nuestra defensa técnica:";
      callToAction = "👉 *Agradeceremos su puntual asistencia.* Por favor tome sus precauciones de traslado hacia nuestra sede en Challhuahuacho.";
    } else if (tipo === "recordatorio_24h") {
      estadoHeader = "🔔 *RECORDATORIO DE CITA (PRÓXIMAS 24 HORAS)*\nLe recordamos que el día de mañana tiene una cita programada en nuestro despacho jurídico:";
      callToAction = "👉 *Agradeceremos su puntual asistencia.* Si tuviese algún inconveniente imprevisto, infórmenos oportunamente.";
    } else {
      estadoHeader = "✅ *CONFIRMACIÓN OFICIAL DE CITA AGENDADA*\nLe confirmamos que su cita ha sido agendada con éxito en el sistema del Estudio Jurídico:";
      callToAction = "👉 *Le esperamos puntualmente.* En caso de requerir reprogramación, por favor comuníquese con anticipación.";
    }

    let meetBlock = "";
    if (cita.meetUrl && cita.meetUrl.trim()) {
      meetBlock = `\n💻 *Enlace Virtual (Google Meet):* ${cita.meetUrl.trim()}`;
    }

    let docsBlock = "";
    if (checkedDocs.length > 0) {
      docsBlock = `\n📋 *DOCUMENTOS REQUERIDOS A TRAER:*\n${checkedDocs.map(doc => ` • ${doc}`).join("\n")}\n`;
    }

    let notasBlock = "";
    if (cita.notas && cita.notas.trim()) {
      notasBlock = `\n📝 *Indicación adicional:* ${cita.notas.trim()}\n`;
    }

    const msg = 
`⚖️ *ESTUDIO PAOLO ALDEA & ABOGADOS*
📍 *Sede Challhuahuacho - Cotabambas, Apurímac*
──────────────────────────
Estimado(a) *${cita.cliente}*, reciba un cordial saludo.

${estadoHeader}

🗓️ *Fecha:* ${dateStr}
⏰ *Hora exacta:* ${timeStr}
📌 *Modalidad / Lugar:* ${cita.modalidad || 'Sede Challhuahuacho'}${meetBlock}
👨‍⚖️ *Abogado Asignado:* ${cita.abogado || 'Dr. Paolo Aldea'}
💼 *Motivo:* ${cita.motivo}

${fraseCustom ? `${fraseCustom}\n` : ''}${docsBlock}${notasBlock}
${callToAction}

──────────────────────────
🏛️ _Compromiso procesal, rigor técnico y defensa de excelencia._
📞 Central / WhatsApp: +51 943 410 215`.trim();

    return msg;
  }

  updateWhatsAppPreview() {
    const previewEl = document.getElementById("waPreviewText");
    if (!previewEl) return;
    const msg = this.buildWhatsAppText();
    previewEl.textContent = msg;
  }

  copyWhatsAppText() {
    const text = this.buildWhatsAppText();
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      this.showToast("Mensaje de WhatsApp copiado al portapapeles", "success");
    }).catch(err => {
      console.warn("Error al copiar texto:", err);
      this.showToast("Seleccione el texto para copiar", "info");
    });
  }

  sendWhatsAppMessage() {
    const cita = window.db.get("citas").find(c => c.id === this.currentWaCitaId);
    if (!cita) return;

    let phone = (cita.telefono || "").replace(/[^0-9]/g, "");
    if (!phone) {
      alert("La cita seleccionada no cuenta con un número de teléfono o celular registrado. Por favor edite la cita e ingrese el número.");
      return;
    }

    if (phone.length === 9) {
      phone = "51" + phone;
    }

    const text = this.buildWhatsAppText();
    const waUrl = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;

    window.open(waUrl, "_blank");

    this.showToast(`Abriendo WhatsApp para ${cita.cliente}...`, "success");
    this.closeModal("modalWhatsAppCita");
  }

  // =========================================================================
  // MÓDULO PRESUPUESTOS & PROYECCIONES FINANCIERAS (SEDE CHALLHUAHUACHO)
  // =========================================================================
  renderPresupuestos() {
    const items = window.db.get("presupuestos");
    const container = document.getElementById("presupuestoTableBody");
    const searchVal = (document.getElementById("searchPresupuesto")?.value || "").toLowerCase();
    const filterTipo = document.getElementById("filterTipoPresupuesto")?.value || "ALL";
    const filterCat = document.getElementById("filterCategoriaPresupuesto")?.value || "ALL";
    const filterFrec = document.getElementById("filterFrecuenciaPresupuesto")?.value || "ALL";
    const filterCc = document.getElementById("filterCentroCostoPresupuesto")?.value || "ALL";
    const curr = window.db.getSettings().currency || "S/";

    if (!container) return;

    // Resúmenes financieros
    const capexTotal = items.filter(i => i.tipo === "CAPEX").reduce((s, i) => s + Number(i.subtotal || 0), 0);
    const opexTotal = items.filter(i => i.tipo === "OPEX").reduce((s, i) => s + Number(i.subtotal || 0), 0);
    const contingenciaTotal = items.filter(i => i.tipo === "Contingencia" || i.categoria === "Fondo de Contingencia").reduce((s, i) => s + Number(i.subtotal || 0), 0);
    const cajaChicaTotal = items.filter(i => i.tipo === "Caja Chica" || i.categoria === "Asignación de Caja Chica").reduce((s, i) => s + Number(i.subtotal || 0), 0);
    const granTotal = capexTotal + opexTotal + contingenciaTotal + cajaChicaTotal;

    // Métricas de Ejecución Real y Porcentajes de Eficiencia Presupuestal
    const totalEjecutado = items.filter(i => i.estado === "Ejecutado").reduce((s, i) => {
      const gasto = (i.montoEjecutado !== undefined && i.montoEjecutado !== null) ? Number(i.montoEjecutado) : Number(i.subtotal || 0);
      return s + gasto;
    }, 0);
    const totalSaldo = granTotal - totalEjecutado;
    const pctGlobalUsado = granTotal > 0 ? (totalEjecutado / granTotal) * 100 : 0;
    const pctGlobalNoUsado = granTotal > 0 ? Math.max(0, 100 - pctGlobalUsado) : 0;

    const elCapex = document.getElementById("presSummaryCapex");
    const elOpex = document.getElementById("presSummaryOpex");
    const elCont = document.getElementById("presSummaryContingencia");
    const elCaja = document.getElementById("presSummaryCajaChica");
    const elTotal = document.getElementById("presSummaryTotal");
    const elEjec = document.getElementById("presSummaryEjecutado");
    const elPctUsado = document.getElementById("presSummaryPctUsado");
    const elSaldo = document.getElementById("presSummarySaldo");
    const elPctNoUsado = document.getElementById("presSummaryPctNoUsado");
    const elCount = document.getElementById("presSummaryCount");

    if (elCapex) elCapex.textContent = `${curr} ${capexTotal.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (elOpex) elOpex.textContent = `${curr} ${opexTotal.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (elCont) elCont.textContent = `${curr} ${contingenciaTotal.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (elCaja) elCaja.textContent = `${curr} ${cajaChicaTotal.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (elTotal) elTotal.textContent = `${curr} ${granTotal.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (elEjec) elEjec.textContent = `${curr} ${totalEjecutado.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (elPctUsado) elPctUsado.textContent = `${pctGlobalUsado.toFixed(1)}% usado`;
    if (elSaldo) elSaldo.textContent = `${curr} ${totalSaldo.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (elPctNoUsado) elPctNoUsado.textContent = `${pctGlobalNoUsado.toFixed(1)}% disponible`;
    if (elCount) elCount.textContent = `${items.length} partidas activas`;

    // Filtros
    const filtered = items.filter(item => {
      const matchSearch =
        (item.concepto || "").toLowerCase().includes(searchVal) ||
        (item.categoria || "").toLowerCase().includes(searchVal) ||
        (item.id && item.id.toLowerCase().includes(searchVal)) ||
        (item.subcategoria && item.subcategoria.toLowerCase().includes(searchVal)) ||
        (item.responsable && item.responsable.toLowerCase().includes(searchVal)) ||
        (item.notas && item.notas.toLowerCase().includes(searchVal));

      const matchTipo = filterTipo === "ALL" || item.tipo === filterTipo;
      const matchCat = filterCat === "ALL" || item.categoria === filterCat;
      const matchFrec = filterFrec === "ALL" || item.frecuencia === filterFrec || (filterFrec === "Por Días" && item.frecuencia && item.frecuencia.includes("Días"));
      const itemCc = item.centroCosto || (item.id && item.id.split("-")[1]) || "ADM";
      const matchCc = filterCc === "ALL" || itemCc === filterCc;

      return matchSearch && matchTipo && matchCat && matchFrec && matchCc;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="10" class="text-center py-8 text-slate-400">
            <i class="fa-solid fa-file-invoice-dollar text-3xl mb-2 block text-slate-300"></i>
            No se encontraron partidas presupuestarias con los filtros aplicados.
          </td>
        </tr>
      `;
      return;
    }

    const typeBadge = (tipo) => {
      switch (tipo) {
        case "CAPEX":
          return `<span class="bg-blue-100 text-blue-900 border border-blue-300 font-bold px-2 py-0.5 rounded text-[10px]">CAPEX (Inicial)</span>`;
        case "OPEX":
          return `<span class="bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold px-2 py-0.5 rounded text-[10px]">OPEX (Mensual)</span>`;
        case "Contingencia":
          return `<span class="bg-amber-100 text-amber-900 border border-amber-300 font-bold px-2 py-0.5 rounded text-[10px]">Contingencia</span>`;
        case "Caja Chica":
          return `<span class="bg-purple-100 text-purple-900 border border-purple-300 font-bold px-2 py-0.5 rounded text-[10px]">Caja Chica</span>`;
        default:
          return `<span class="bg-slate-100 text-slate-800 font-bold px-2 py-0.5 rounded text-[10px]">${tipo}</span>`;
      }
    };

    const estadoBadge = (estado) => {
      switch (estado) {
        case "Ejecutado":
          return `<span class="bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-2 py-0.5 rounded text-[10px] inline-flex items-center gap-1 shadow-2xs"><i class="fa-solid fa-check-double text-emerald-600"></i>Ejecutado</span>`;
        case "Aprobado":
          return `<span class="bg-blue-50 text-blue-700 border border-blue-200 font-semibold px-2 py-0.5 rounded text-[10px] inline-flex items-center gap-1"><i class="fa-solid fa-check text-blue-600"></i>Aprobado</span>`;
        case "En Revisión":
          return `<span class="bg-amber-50 text-amber-700 border border-amber-200 font-semibold px-2 py-0.5 rounded text-[10px] inline-flex items-center gap-1"><i class="fa-regular fa-clock text-amber-600"></i>En Revisión</span>`;
        default:
          return `<span class="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px]">${estado}</span>`;
      }
    };

    container.innerHTML = filtered.map(item => {
      const ptoInicial = Number(item.subtotal || 0);
      const isEjecutado = item.estado === "Ejecutado" || (item.montoEjecutado !== undefined && item.montoEjecutado !== null);
      const montoEjec = isEjecutado ? Number(item.montoEjecutado !== undefined && item.montoEjecutado !== null ? item.montoEjecutado : ptoInicial) : 0;
      const pctUsado = ptoInicial > 0 ? (montoEjec / ptoInicial) * 100 : (montoEjec > 0 ? 100 : 0);
      const saldoRemanente = ptoInicial - montoEjec;
      const pctNoUsado = ptoInicial > 0 ? Math.max(0, 100 - pctUsado) : 0;
      const isOver = montoEjec > ptoInicial;

      let ejecCellHtml = "";
      if (isEjecutado) {
        ejecCellHtml = `
          <div class="space-y-1 py-1">
            <div class="flex items-center justify-between text-[11px] font-mono leading-tight">
              <span class="font-bold text-slate-900">${curr} ${montoEjec.toFixed(2)}</span>
              <span class="${isOver ? 'text-rose-700 bg-rose-50 border border-rose-300' : 'text-emerald-800 bg-emerald-50 border border-emerald-300'} px-1.5 py-0.5 rounded text-[10px] font-bold">
                ${pctUsado.toFixed(1)}% usado
              </span>
            </div>
            <!-- Barra visual de ejecución -->
            <div class="w-full h-2 bg-slate-200 rounded-full overflow-hidden flex border border-slate-300/60" title="${pctUsado.toFixed(1)}% usado • ${pctNoUsado.toFixed(1)}% no usado">
              <div class="${isOver ? 'bg-rose-500' : 'bg-emerald-500'} h-full transition-all" style="width: ${Math.min(100, pctUsado)}%;"></div>
              ${!isOver ? `<div class="bg-amber-300 h-full" style="width: ${pctNoUsado}%;"></div>` : ''}
            </div>
            <div class="flex items-center justify-between text-[10px] leading-tight">
              ${!isOver
                ? `<span class="text-amber-900 font-semibold flex items-center gap-1"><i class="fa-solid fa-piggy-bank text-amber-600 text-[9px]"></i> ${pctNoUsado.toFixed(1)}% no usado (${curr} ${saldoRemanente.toFixed(2)})</span>`
                : `<span class="text-rose-700 font-bold flex items-center gap-1"><i class="fa-solid fa-triangle-exclamation text-rose-500 text-[9px]"></i> Sobregiro: ${curr} ${Math.abs(saldoRemanente).toFixed(2)}</span>`
              }
            </div>
          </div>
        `;
      } else if (item.estado === "Aprobado") {
        ejecCellHtml = `
          <div class="py-1 text-center">
            <button onclick="window.app.openEjecutarPresupuestoModal(${jsStr(item.id)})" class="inline-flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 hover:border-amber-400 font-bold px-2 py-1 rounded-lg text-[10px] shadow-2xs transition group" title="Registrar gasto real efectuado de este presupuesto">
              <i class="fa-solid fa-money-bill-transfer text-amber-600 group-hover:scale-110 transition"></i>
              <span>Registrar Ejecución (0% usado)</span>
            </button>
            <div class="text-[9px] text-slate-400 mt-0.5 font-medium">100% disponible (${curr} ${ptoInicial.toFixed(2)})</div>
          </div>
        `;
      } else {
        ejecCellHtml = `
          <div class="text-center text-[10px] text-slate-400 py-1 italic">
            <i class="fa-regular fa-clock mr-1"></i>Pendiente de Aprobación
          </div>
        `;
      }

      const btnEjecutarAction = (item.estado === "Aprobado" || isEjecutado) ? `
        <button onclick="window.app.openEjecutarPresupuestoModal(${jsStr(item.id)})" class="text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 p-1.5 rounded border border-amber-300 transition shadow-2xs" title="${isEjecutado ? 'Modificar Liquidación / Ver % Usado' : 'Registrar Gasto Ejecutado'}">
          <i class="fa-solid fa-chart-pie"></i>
        </button>
      ` : '';

      // Centro de Costo & Clase PCGE
      const cc = item.centroCosto || (item.id && item.id.split("-")[1]) || "ADM";
      const pcge = item.clasePcge || (item.id && item.id.split("-")[2]) || "";
      let ccBadgeClass = "bg-blue-100 text-blue-900 border-blue-200";
      if (cc === "LOG") ccBadgeClass = "bg-amber-100 text-amber-900 border-amber-300";
      else if (cc === "SRI") ccBadgeClass = "bg-purple-100 text-purple-900 border-purple-300";
      else if (cc === "SEG") ccBadgeClass = "bg-emerald-100 text-emerald-900 border-emerald-300";

      const ccTitleMap = {
        ADM: "Administración y Finanzas",
        LOG: "Logística, Almacenes y Transportes",
        SRI: "Relaciones Comunitarias / Gestión Social",
        SEG: "Seguridad y Salud Ocupacional (SST)"
      };

      return `
        <tr class="hover:bg-slate-50 transition border-b border-slate-100 text-xs">
          <td class="font-mono text-[11px]">
            <div class="font-black text-slate-900 tracking-tight">${escapeHtml(item.id)}</div>
            <div class="mt-1 flex items-center gap-1 flex-wrap">
              <span class="text-[9px] font-bold px-1.5 py-0.2 rounded border ${ccBadgeClass}" title="${ccTitleMap[cc] || cc}">
                ${cc}
              </span>
              ${pcge ? `<span class="text-[8.5px] font-mono text-slate-600 bg-slate-100 px-1 py-0.2 rounded border border-slate-200" title="Clase de Gasto PCGE">PCGE ${pcge}</span>` : ''}
            </div>
          </td>
          <td>
            <div class="font-bold text-slate-800 text-[11px]">${escapeHtml(item.categoria)}</div>
            ${item.subcategoria && item.subcategoria !== "General" ? `<div class="text-[10px] text-amber-900 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 inline-block mt-0.5">${escapeHtml(item.subcategoria)}</div>` : ''}
          </td>
          <td>
            <div class="font-bold text-slate-900">${escapeHtml(item.concepto)}</div>
            ${item.notas ? `<div class="text-[11px] text-slate-500 italic mt-0.5 line-clamp-1"><i class="fa-solid fa-info-circle mr-1 text-slate-400"></i>${escapeHtml(item.notas)}</div>` : ''}
            ${item.responsable ? `<div class="text-[10px] text-slate-400 mt-0.5">Resp: <span class="font-medium text-slate-600">${escapeHtml(item.responsable)}</span></div>` : ''}
          </td>
          <td class="text-center">${typeBadge(item.tipo)}</td>
          <td class="text-center">
            <span class="text-[11px] font-semibold text-slate-700 block">${escapeHtml(item.frecuencia)}</span>
          </td>
          <td class="text-center font-mono">
            <span class="font-bold text-slate-800">${item.cantidad}</span>
            <span class="text-[10px] text-slate-400 block">${escapeHtml(item.unidad || 'Unidad')}</span>
          </td>
          <td class="text-right font-mono font-bold text-slate-900">
            ${curr} ${ptoInicial.toFixed(2)}
          </td>
          <td class="min-w-[190px]">
            ${ejecCellHtml}
          </td>
          <td class="text-center">${estadoBadge(item.estado)}</td>
          <td class="text-center">
            <div class="flex items-center justify-center gap-1">
              ${btnEjecutarAction}
              <button onclick="window.pdfExporter.exportSinglePresupuestoPdf(${jsStr(item.id)})" class="text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 p-1.5 rounded border border-rose-200 transition shadow-2xs" title="Exportar comprobante PDF"><i class="fa-solid fa-file-pdf"></i></button>
              <button onclick="window.excelExporter.exportSinglePresupuesto(${jsStr(item.id)})" class="text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 p-1.5 rounded border border-emerald-200 transition shadow-2xs" title="Exportar comprobante Excel"><i class="fa-solid fa-file-excel"></i></button>
              <button onclick="window.app.editPresupuesto(${jsStr(item.id)})" class="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 p-1.5 rounded border border-blue-200 transition shadow-2xs" title="Editar partida"><i class="fa-solid fa-pen-to-square"></i></button>
              <button onclick="window.app.deletePresupuesto(${jsStr(item.id)})" class="text-slate-400 hover:text-red-600 bg-slate-50 hover:bg-red-50 p-1.5 rounded border border-slate-200 transition shadow-2xs" title="Eliminar"><i class="fa-solid fa-trash-can"></i></button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  openPresupuestoModal(id = null) {
    this.editingPresupuestoId = id;
    const form = document.getElementById("formPresupuesto");
    if (form) form.reset();

    const titleEl = document.getElementById("modalPresupuestoTitle");
    const setVal = (fid, val) => { const el = document.getElementById(fid); if (el) el.value = val !== undefined && val !== null ? val : ""; };

    // Resetear indicadores de auto-detección
    const ccBadge = document.getElementById("presCcAutoIndicator");
    if (ccBadge) {
      ccBadge.className = "text-[9px] text-emerald-800 bg-emerald-100 font-bold px-1.5 py-0.2 rounded border border-emerald-300 flex items-center gap-1";
      ccBadge.innerHTML = `<i class="fa-solid fa-robot text-[8px]"></i> Auto-Detectado`;
    }
    const pcgeBadge = document.getElementById("presPcgeAutoIndicator");
    if (pcgeBadge) {
      pcgeBadge.className = "text-[9px] text-blue-800 bg-blue-100 font-bold px-1.5 py-0.2 rounded border border-blue-300 flex items-center gap-1";
      pcgeBadge.innerHTML = `<i class="fa-solid fa-book-bookmark text-[8px]"></i> PCGE Oficial`;
    }

    if (id) {
      if (titleEl) titleEl.textContent = "Editar Partida Presupuestaria — Sede Challhuahuacho";
      const item = window.db.get("presupuestos").find(i => i.id === id);
      if (item) { this._editingOriginalUpdatedAt = item.updatedAt || item.createdAt || null; }
      if (item) {
        setVal("presConcepto", item.concepto);
        setVal("presCategoria", item.categoria);
        setVal("presSubcategoria", item.subcategoria || "General");
        setVal("presTipo", item.tipo);

        const detected = window.detectCentroCostoAndPcge ? window.detectCentroCostoAndPcge(item) : { centroCosto: "ADM", clasePcge: "63" };
        setVal("presCentroCosto", item.centroCosto || detected.centroCosto);
        setVal("presClasePcge", item.clasePcge || detected.clasePcge);
        
        // Normalizar frecuencia si venía con formato anterior
        let frec = item.frecuencia || "Inversión Única";
        if (frec.includes("Días")) frec = "Por Días";
        if (frec.includes("Semanas")) frec = "Por Semanas";
        setVal("presFrecuencia", frec);

        const diasVal = item.dias || item.diasEventual || 1;
        setVal("presDias", diasVal);
        setVal("presSemanas", item.semanas || 1);

        setVal("presCantidad", item.cantidad || 1);
        setVal("presUnidad", item.unidad || "Unidad");
        setVal("presCostoUnitario", item.costoUnitario || "");
        setVal("presEstado", item.estado || "Aprobado");
        setVal("presPrioridad", item.prioridad || "Alta");
        setVal("presResponsable", item.responsable || "Ing. Yimer Damián Soto");
        setVal("presNotas", item.notas || "");

        // Desglose de viáticos si existe
        if (item.desgloseViaticos) {
          setVal("vPasajesCant", item.desgloseViaticos.pasajesCant || 0);
          setVal("vPasajesMonto", item.desgloseViaticos.pasajesMonto || 0);
          setVal("vAlimCant", item.desgloseViaticos.alimCant || 0);
          setVal("vAlimMonto", item.desgloseViaticos.alimMonto || 0);
          setVal("vHospCant", item.desgloseViaticos.hospCant || 0);
          setVal("vHospMonto", item.desgloseViaticos.hospMonto || 0);
          setVal("vOtrosCant", item.desgloseViaticos.otrosCant || 0);
          setVal("vOtrosMonto", item.desgloseViaticos.otrosMonto || 0);
        } else {
          setVal("vPasajesCant", 0);
          setVal("vPasajesMonto", 0);
          setVal("vAlimCant", 0);
          setVal("vAlimMonto", 0);
          setVal("vHospCant", 0);
          setVal("vHospMonto", 0);
          setVal("vOtrosCant", 0);
          setVal("vOtrosMonto", 0);
        }

        // Cargar campos consolidados de todas las subcategorías si existen
        if (item.detalleSubcategorias) {
          const d = item.detalleSubcategorias;
          Object.keys(d).forEach(k => {
            setVal(k, d[k]);
          });
        }

        // Cargar campos específicos de subcategoría si existen (compatibilidad)
        if (item.detalleSubcategoria && item.detalleSubcategoria.data) {
          const d = item.detalleSubcategoria.data;
          if (d.detalle) setVal("subGenDetalle", d.detalle);
          if (d.proveedor) setVal("subGenProveedor", d.proveedor);
          if (d.modalidad && d.ruta !== undefined) {
            setVal("subPasModalidad", d.modalidad);
            setVal("subPasRuta", d.ruta);
            setVal("subPasEmpresa", d.empresa || "");
            setVal("subPasCant", d.cantidad || 1);
            setVal("subPasCostoUnit", d.costoUnitario || 0);
          }
          if (d.restaurante !== undefined) {
            setVal("subAlimModalidad", d.modalidad || "Almuerzo Ejecutivo Diario");
            setVal("subAlimRestaurante", d.restaurante);
            setVal("subAlimPersonas", d.personas || 1);
            setVal("subAlimDias", d.dias || 1);
            setVal("subAlimCostoDiario", d.costoDiario || 0);
          }
          if (d.hotel !== undefined) {
            setVal("subHospHotel", d.hotel);
            setVal("subHospCiudad", d.ciudad || "Challhuahuacho (Principal)");
            setVal("subHospTipo", d.tipoHabitacion || "Individual Ejecutiva");
            setVal("subHospHab", d.habitaciones || 1);
            setVal("subHospNoches", d.noches || 1);
            setVal("subHospTarifa", d.tarifa || 0);
          }
          if (d.ruta !== undefined && d.modalidad && (d.modalidad.includes("Taxi") || d.modalidad.includes("Expreso") || d.modalidad.includes("Combustible") || d.modalidad.includes("Camioneta"))) {
            setVal("subMovTipo", d.modalidad);
            setVal("subMovRuta", d.ruta);
            setVal("subMovCant", d.cantidad || 1);
            setVal("subMovCosto", d.costoUnitario || 0);
          }
          if (d.cargo !== undefined) {
            setVal("subPersCargo", d.cargo);
            setVal("subPersZona", d.zona || "");
            setVal("subPersPersonas", d.personas || 1);
            setVal("subPersDias", d.dias || 1);
            setVal("subPersJornal", d.jornal || 0);
          }
          if (d.canal !== undefined) {
            setVal("subPubCanal", d.canal);
            setVal("subPubMedio", d.medio || "");
            setVal("subPubUnidad", d.unidad || "Cuñas Radiales");
            setVal("subPubCant", d.cantidad || 1);
            setVal("subPubTarifa", d.tarifa || 0);
          }
          if (d.tipoLetrero !== undefined) {
            setVal("subLetTipo", d.tipoLetrero);
            setVal("subLetMedidas", d.medidas || "");
            setVal("subLetTaller", d.taller || "");
            setVal("subLetInstalacion", d.instalacion || "Sí - Confección, traslado e instalación");
            setVal("subLetCosto", d.costo || 0);
          }
          if (d.tipoServicio !== undefined) {
            setVal("subServTipo", d.tipoServicio);
            setVal("subServSuministro", d.suministro || "");
            setVal("subServProveedor", d.proveedor || "");
            setVal("subServMeses", d.meses || 1);
            setVal("subServTarifa", d.tarifa || 0);
          }
          if (d.local !== undefined) {
            setVal("subAlqLocal", d.local);
            setVal("subAlqArrendador", d.arrendador || "");
            setVal("subAlqMeses", d.meses || 1);
            setVal("subAlqRenta", d.renta || 0);
            setVal("subAlqGarantia", d.garantia || 0);
          }
          if (d.sedeNotarial !== undefined) {
            setVal("subNotSede", d.sedeNotarial);
            setVal("subNotActo", d.actoNotarial || "");
            setVal("subNotCant", d.cantidad || 1);
            setVal("subNotTarifa", d.tarifa || 0);
          }
          if (d.tipoActivo !== undefined) {
            setVal("subTicTipo", d.tipoActivo);
            setVal("subTicMarca", d.especificacion || "");
            setVal("subTicProveedor", d.proveedor || "");
            setVal("subTicCant", d.cantidad || 1);
            setVal("subTicPrecio", d.precio || 0);
          }
          if (item.subcategoria === "Ferretería" || d.descripcion !== undefined) {
            setVal("subFerrDesc", d.descripcion || "");
            setVal("subFerrCant", d.cantidad || 1);
            setVal("subFerrMonto", d.montoUnitario || "");
          }
        }
        setVal("presSede", window.db ? window.db.normalizeSede(item.sede || "challhuahuacho") : "challhuahuacho");
      }
    } else {
      if (titleEl) titleEl.textContent = "Nueva Partida Presupuestaria — PAOLO ALDEA & ABOGADOS";
      const active = window.db ? window.db.getActiveSede() : "challhuahuacho";
      setVal("presSede", active === "todas" ? "challhuahuacho" : active);
      setVal("presCantidad", 1);
      setVal("presDias", 1);
      setVal("presSemanas", 1);
      setVal("presCostoUnitario", "");
      setVal("presResponsable", "Ing. Yimer Damián Soto");
      setVal("presPrioridad", "Alta");
      setVal("presEstado", "Aprobado");
      setVal("presSubcategoria", "General");
      setVal("vPasajesCant", 0);
      setVal("vPasajesMonto", 0);
      setVal("vAlimCant", 0);
      setVal("vAlimMonto", 0);
      setVal("vHospCant", 0);
      setVal("vHospMonto", 0);
      setVal("vOtrosCant", 0);
      setVal("vOtrosMonto", 0);

      // Limpiar campos de todas las subcategorías
      setVal("subGenDetalle", "");
      setVal("subGenProveedor", "");
      setVal("subPasRuta", "");
      setVal("subPasEmpresa", "");
      setVal("subPasCant", 1);
      setVal("subPasCostoUnit", "");
      setVal("subAlimRestaurante", "");
      setVal("subAlimPersonas", 1);
      setVal("subAlimDias", 1);
      setVal("subAlimCostoDiario", "");
      setVal("subHospHotel", "");
      setVal("subHospHab", 1);
      setVal("subHospNoches", 1);
      setVal("subHospTarifa", "");
      setVal("subMovRuta", "");
      setVal("subMovCant", 1);
      setVal("subMovCosto", "");
      setVal("subPersZona", "");
      setVal("subPersPersonas", 1);
      setVal("subPersDias", 1);
      setVal("subPersJornal", "");
      setVal("subPubMedio", "");
      setVal("subPubCant", 1);
      setVal("subPubTarifa", "");
      setVal("subLetMedidas", "");
      setVal("subLetTaller", "");
      setVal("subLetCosto", "");
      setVal("subServSuministro", "");
      setVal("subServProveedor", "");
      setVal("subServMeses", 1);
      setVal("subServTarifa", "");
      setVal("subAlqLocal", "");
      setVal("subAlqArrendador", "");
      setVal("subAlqMeses", 1);
      setVal("subAlqRenta", "");
      setVal("subAlqGarantia", 0);
      setVal("subNotCant", 1);
      setVal("subNotTarifa", "");
      setVal("subTicMarca", "");
      setVal("subTicProveedor", "");
      setVal("subTicCant", 1);
      setVal("subTicPrecio", "");
      setVal("subFerrDesc", "");
      setVal("subFerrCant", 1);
      setVal("subFerrMonto", "");
    }

    if (document.getElementById("presSede")) {
      document.getElementById("presSede").disabled = !(window.db && window.db.isGlobalAdmin());
    }

    this.onPresupuestoCategoriaChange(false);
    this.onPresupuestoSubcategoriaChange(false);
    this.onPresupuestoFrecuenciaChange();
    this.onPresupuestoCalcChange();
    this.updatePresupuestoCodePreview(id);
    this.showModal("modalPresupuesto");
  }

  onPresupuestoConceptoInput() {
    this.updatePresupuestoCodePreview();
  }

  onCentroCostoManualChange() {
    const badge = document.getElementById("presCcAutoIndicator");
    if (badge) {
      badge.className = "text-[9px] text-amber-800 bg-amber-100 font-bold px-1.5 py-0.2 rounded border border-amber-300 flex items-center gap-1";
      badge.innerHTML = `<i class="fa-solid fa-hand text-[8px]"></i> Manual`;
    }
    this.updatePresupuestoCodePreview();
  }

  onClasePcgeManualChange() {
    const badge = document.getElementById("presPcgeAutoIndicator");
    if (badge) {
      badge.className = "text-[9px] text-amber-800 bg-amber-100 font-bold px-1.5 py-0.2 rounded border border-amber-300 flex items-center gap-1";
      badge.innerHTML = `<i class="fa-solid fa-hand text-[8px]"></i> Manual`;
    }
    this.updatePresupuestoCodePreview();
  }

  extractCorrelativo(id) {
    if (!id) return 1;
    const m = /-(\d+)$/.exec(id);
    return m ? parseInt(m[1], 10) : 1;
  }

  updatePresupuestoCodePreview(forceId = null) {
    const getVal = (fid, def = "") => document.getElementById(fid)?.value || def;
    const setText = (fid, txt) => { const el = document.getElementById(fid); if (el) el.textContent = txt; };

    const concepto = getVal("presConcepto");
    const categoria = getVal("presCategoria");
    const subcategoria = getVal("presSubcategoria");
    const tipo = getVal("presTipo");

    const detected = window.detectCentroCostoAndPcge
      ? window.detectCentroCostoAndPcge({ concepto, categoria, subcategoria, tipo })
      : { centroCosto: "ADM", clasePcge: "63" };

    const ccSelect = document.getElementById("presCentroCosto");
    const pcgeSelect = document.getElementById("presClasePcge");

    const ccAutoBadge = document.getElementById("presCcAutoIndicator");
    const isCcManual = ccAutoBadge && ccAutoBadge.textContent.includes("Manual");
    if (ccSelect && !isCcManual && !this.editingPresupuestoId) {
      ccSelect.value = detected.centroCosto;
    }

    const pcgeAutoBadge = document.getElementById("presPcgeAutoIndicator");
    const isPcgeManual = pcgeAutoBadge && pcgeAutoBadge.textContent.includes("Manual");
    if (pcgeSelect && !isPcgeManual && !this.editingPresupuestoId) {
      pcgeSelect.value = detected.clasePcge;
    }

    const cc = ccSelect?.value || detected.centroCosto;
    const pcge = pcgeSelect?.value || detected.clasePcge;

    let numStr = "001";
    if (this.editingPresupuestoId) {
      const existing = window.db.get("presupuestos").find(i => i.id === this.editingPresupuestoId);
      const num = existing?.correlativo || (existing?.id ? this.extractCorrelativo(existing.id) : 1);
      numStr = String(num).padStart(3, "0");
    } else {
      const maxNum = window.db.get("presupuestos").reduce((mx, p) => {
        let num = p.correlativo;
        if (!num && p.id) {
          const m = /-(\d+)$/.exec(p.id);
          if (m) num = parseInt(m[1], 10);
        }
        return Math.max(mx, num || 0);
      }, 0);
      numStr = String(maxNum + 1).padStart(3, "0");
    }

    const selectedSede = document.getElementById("presSede")?.value || (window.db ? window.db.getActiveSede() : "challhuahuacho");
    const normSede = window.db ? window.db.normalizeSede(selectedSede) : "challhuahuacho";
    const branchPrefix = (window.SEDES_CONFIG && window.SEDES_CONFIG[normSede]) ? window.SEDES_CONFIG[normSede].codigo : "CH";

    const code = forceId || `${branchPrefix}-${cc}-${pcge}-${numStr}`;
    setText("presCodigoPreview", code);

    const ccMap = {
      ADM: "ADM • Administración",
      LOG: "LOG • Logística y Transportes",
      SRI: "SRI • Relaciones Comunitarias",
      SEG: "SEG • Seguridad SST"
    };
    setText("presCcLabel", ccMap[cc] || cc);

    const pcgeMap = {
      "60": "60 • Compras (Suministros)",
      "62": "62 • Cargas de Personal",
      "63": "63 • Servicios Terceros",
      "65": "65 • Gestión & Contingencia",
      "68": "68 • Valuación Activos (CAPEX)"
    };
    setText("presPcgeLabel", pcgeMap[pcge] || pcge);
    setText("presCorrelativoLabel", `Ítem N° ${numStr}`);
  }

  onPresupuestoCategoriaChange(autoSetFields = true) {
    const cat = document.getElementById("presCategoria")?.value || "";
    const tipoEl = document.getElementById("presTipo");
    const frecEl = document.getElementById("presFrecuencia");
    const subcatEl = document.getElementById("presSubcategoria");

    if (autoSetFields) {
      if (cat === "Viáticos, Pasajes, Alimentación") {
        if (subcatEl) subcatEl.value = "Viáticos Integrales (Pasajes + Alim. + Hospedaje)";
        if (tipoEl) tipoEl.value = "OPEX";
        if (frecEl) frecEl.value = "Por Días";
      } else if (cat === "Gastos Legales y Constitución") {
        if (tipoEl) tipoEl.value = "CAPEX";
        if (frecEl) frecEl.value = "Inversión Única";
        if (subcatEl) subcatEl.value = "Notaría y Trámites Registrales SUNARP";
      } else if (cat === "Infraestructura y Mobiliario") {
        if (tipoEl) tipoEl.value = "CAPEX";
        if (frecEl) frecEl.value = "Inversión Única";
        if (subcatEl) subcatEl.value = "Equipamiento y TIC";
      } else if (cat === "Marketing y Publicidad") {
        if (tipoEl) tipoEl.value = "OPEX";
        if (frecEl) frecEl.value = "Por Días";
        if (subcatEl) subcatEl.value = "Personal Eventual de Difusión";
      } else if (cat.includes("Gastos Fijos")) {
        if (tipoEl) tipoEl.value = "OPEX";
        if (frecEl) frecEl.value = "Mensual";
        if (subcatEl) subcatEl.value = "Servicios Básicos (Luz / Agua / Internet Claro)";
      } else if (cat === "Fondo de Contingencia") {
        if (tipoEl) tipoEl.value = "Contingencia";
        if (frecEl) frecEl.value = "Mensual";
        if (subcatEl) subcatEl.value = "General";
      } else if (cat === "Asignación de Caja Chica") {
        if (tipoEl) tipoEl.value = "Caja Chica";
        if (frecEl) frecEl.value = "Mensual";
        if (subcatEl) subcatEl.value = "General";
      }
    }

    this.onPresupuestoSubcategoriaChange(autoSetFields);
    this.updatePresupuestoCodePreview();
  }

  switchSubcategoria(subcat) {
    const sel1 = document.getElementById("presSubcategoria");
    const sel2 = document.getElementById("presSubcatQuickSelect");
    if (sel1) sel1.value = subcat;
    if (sel2) sel2.value = subcat;
    this.onPresupuestoSubcategoriaChange(false);
  }

  switchSubcatById(id) {
    const map = {
      ViaticosIntegrales: "Viáticos Integrales (Pasajes + Alim. + Hospedaje)",
      Pasajes: "Pasajes Terrestres / Aéreos",
      Alimentacion: "Alimentación & Dietas de Trabajo",
      Hospedaje: "Hospedaje & Alojamiento",
      Movilidad: "Movilidad Local / Taxis / Combustible",
      Personal: "Personal Eventual de Difusión",
      Publicidad: "Pauta Digital y Publicidad Local",
      Letreros: "Letreros e Imagen Corporativa",
      Servicios: "Servicios Básicos (Luz / Agua / Internet Claro)",
      Alquiler: "Alquiler de Inmueble Sede",
      Notaria: "Notaría y Trámites Registrales SUNARP",
      Equipamiento: "Equipamiento y TIC",
      Ferreteria: "Ferretería"
    };
    const target = map[id] || "General";
    this.switchSubcategoria(target);
  }

  clearSubcat(id) {
    const setVal = (fid, val) => { const el = document.getElementById(fid); if (el) el.value = val; };
    if (id === "ViaticosIntegrales") {
      setVal("vPasajesCant", 0); setVal("vPasajesMonto", 0);
      setVal("vAlimCant", 0); setVal("vAlimMonto", 0);
      setVal("vHospCant", 0); setVal("vHospMonto", 0);
      setVal("vOtrosCant", 0); setVal("vOtrosMonto", 0);
    } else if (id === "Pasajes") {
      setVal("subPasCant", 1); setVal("subPasCostoUnit", ""); setVal("subPasRuta", ""); setVal("subPasEmpresa", "");
    } else if (id === "Alimentacion") {
      setVal("subAlimPersonas", 1); setVal("subAlimDias", 1); setVal("subAlimCostoDiario", ""); setVal("subAlimRestaurante", "");
    } else if (id === "Hospedaje") {
      setVal("subHospHab", 1); setVal("subHospNoches", 1); setVal("subHospTarifa", ""); setVal("subHospHotel", "");
    } else if (id === "Movilidad") {
      setVal("subMovCant", 1); setVal("subMovCosto", ""); setVal("subMovRuta", "");
    } else if (id === "Personal") {
      setVal("subPersPersonas", 1); setVal("subPersDias", 1); setVal("subPersJornal", ""); setVal("subPersCargo", "");
    } else if (id === "Publicidad") {
      setVal("subPubCant", 1); setVal("subPubTarifa", ""); setVal("subPubMedio", "");
    } else if (id === "Letreros") {
      setVal("subLetCosto", ""); setVal("subLetMedidas", "");
    } else if (id === "Servicios") {
      setVal("subServMeses", 1); setVal("subServTarifa", ""); setVal("subServProveedor", "");
    } else if (id === "Alquiler") {
      setVal("subAlqMeses", 1); setVal("subAlqRenta", ""); setVal("subAlqGarantia", 0); setVal("subAlqLocal", "");
    } else if (id === "Notaria") {
      setVal("subNotCant", 1); setVal("subNotTarifa", ""); setVal("subNotActo", "");
    } else if (id === "Equipamiento") {
      setVal("subTicCant", 1); setVal("subTicPrecio", ""); setVal("subTicMarca", "");
    } else if (id === "Ferreteria") {
      setVal("subFerrCant", 1); setVal("subFerrMonto", ""); setVal("subFerrDesc", "");
    }
    this.onPresupuestoCalcChange();
    this.showToast("Subcategoría restablecida", "info");
  }

  onPresupuestoSubcategoriaChange(autoSetFields = true) {
    const subcat = document.getElementById("presSubcategoria")?.value || "General";
    const sel2 = document.getElementById("presSubcatQuickSelect");
    if (sel2 && sel2.value !== subcat) sel2.value = subcat;

    const activeBadge = document.getElementById("activeSubcatBadge");
    if (activeBadge) {
      activeBadge.textContent = subcat || "General / Principal";
    }

    // Ocultar todos los paneles de subcategoría
    const allPanels = [
      "subcatPanel_General",
      "subcatPanel_ViaticosIntegrales",
      "subcatPanel_Pasajes",
      "subcatPanel_Alimentacion",
      "subcatPanel_Hospedaje",
      "subcatPanel_Movilidad",
      "subcatPanel_Personal",
      "subcatPanel_Publicidad",
      "subcatPanel_Letreros",
      "subcatPanel_Servicios",
      "subcatPanel_Alquiler",
      "subcatPanel_Notaria",
      "subcatPanel_Equipamiento",
      "subcatPanel_Ferreteria"
    ];

    allPanels.forEach(pId => {
      const el = document.getElementById(pId);
      if (el) el.classList.add("hidden");
    });

    // Activar panel correspondiente según la opción elegida
    if (subcat === "General") {
      document.getElementById("subcatPanel_General")?.classList.remove("hidden");
    } else if (subcat === "Viáticos Integrales (Pasajes + Alim. + Hospedaje)") {
      document.getElementById("subcatPanel_ViaticosIntegrales")?.classList.remove("hidden");
    } else if (subcat === "Pasajes Terrestres / Aéreos") {
      document.getElementById("subcatPanel_Pasajes")?.classList.remove("hidden");
    } else if (subcat === "Alimentación & Dietas de Trabajo") {
      document.getElementById("subcatPanel_Alimentacion")?.classList.remove("hidden");
    } else if (subcat.includes("Hospedaje")) {
      document.getElementById("subcatPanel_Hospedaje")?.classList.remove("hidden");
    } else if (subcat.includes("Movilidad Local")) {
      document.getElementById("subcatPanel_Movilidad")?.classList.remove("hidden");
    } else if (subcat === "Personal Eventual de Difusión") {
      document.getElementById("subcatPanel_Personal")?.classList.remove("hidden");
    } else if (subcat === "Pauta Digital y Publicidad Local") {
      document.getElementById("subcatPanel_Publicidad")?.classList.remove("hidden");
    } else if (subcat === "Letreros e Imagen Corporativa") {
      document.getElementById("subcatPanel_Letreros")?.classList.remove("hidden");
    } else if (subcat.includes("Servicios Básicos")) {
      document.getElementById("subcatPanel_Servicios")?.classList.remove("hidden");
    } else if (subcat === "Alquiler de Inmueble Sede") {
      document.getElementById("subcatPanel_Alquiler")?.classList.remove("hidden");
    } else if (subcat.includes("Notaría")) {
      document.getElementById("subcatPanel_Notaria")?.classList.remove("hidden");
    } else if (subcat === "Equipamiento y TIC") {
      document.getElementById("subcatPanel_Equipamiento")?.classList.remove("hidden");
    } else if (subcat === "Ferretería") {
      document.getElementById("subcatPanel_Ferreteria")?.classList.remove("hidden");
    }

    this.onPresupuestoCalcChange();
  }

  // --- Métodos de cálculo rápido por subcategoría ---
  calcSubcatPasajes() { this.onPresupuestoCalcChange(); }
  calcSubcatAlim() { this.onPresupuestoCalcChange(); }
  calcSubcatHosp() { this.onPresupuestoCalcChange(); }
  calcSubcatMov() { this.onPresupuestoCalcChange(); }
  calcSubcatPersonal() { this.onPresupuestoCalcChange(); }
  setSubPersDias(d) {
    const el = document.getElementById("subPersDias");
    if (el) el.value = d;
    this.onPresupuestoCalcChange();
  }
  calcSubcatPublicidad() { this.onPresupuestoCalcChange(); }
  calcSubcatLetreros() { this.onPresupuestoCalcChange(); }
  calcSubcatServicios() { this.onPresupuestoCalcChange(); }
  calcSubcatAlquiler() { this.onPresupuestoCalcChange(); }
  calcSubcatNotaria() { this.onPresupuestoCalcChange(); }
  calcSubcatEquipamiento() { this.onPresupuestoCalcChange(); }
  calcSubcatFerreteria() { this.onPresupuestoCalcChange(); }
  calcViaticosDesglose() { this.onPresupuestoCalcChange(); }
  onPresupuestoFrecuenciaChange() { this.onPresupuestoCalcChange(); }
  setPresDias(d) { const el = document.getElementById("presDias"); if (el) el.value = d; this.onPresupuestoCalcChange(); }
  setPresSemanas(s) { const el = document.getElementById("presSemanas"); if (el) el.value = s; this.onPresupuestoCalcChange(); }

  calculateAllPresupuestoSubcategorias() {
    const curr = window.db.getSettings().currency || "S/";
    const list = [];

    // 1. Viáticos Integrales
    const pCant = parseFloat(document.getElementById("vPasajesCant")?.value) || 0;
    const pMonto = parseFloat(document.getElementById("vPasajesMonto")?.value) || 0;
    const pSub = pCant * pMonto;

    const aCant = parseFloat(document.getElementById("vAlimCant")?.value) || 0;
    const aMonto = parseFloat(document.getElementById("vAlimMonto")?.value) || 0;
    const aSub = aCant * aMonto;

    const hCant = parseFloat(document.getElementById("vHospCant")?.value) || 0;
    const hMonto = parseFloat(document.getElementById("vHospMonto")?.value) || 0;
    const hSub = hCant * hMonto;

    const oCant = parseFloat(document.getElementById("vOtrosCant")?.value) || 0;
    const oMonto = parseFloat(document.getElementById("vOtrosMonto")?.value) || 0;
    const oSub = oCant * oMonto;

    const vTotal = pSub + aSub + hSub + oSub;
    const elP = document.getElementById("vPasajesSubtotal");
    const elA = document.getElementById("vAlimSubtotal");
    const elH = document.getElementById("vHospSubtotal");
    const elO = document.getElementById("vOtrosSubtotal");
    const elTot = document.getElementById("vTotalDesgloseDisplay");
    if (elP) elP.textContent = `${curr} ${pSub.toFixed(2)}`;
    if (elA) elA.textContent = `${curr} ${aSub.toFixed(2)}`;
    if (elH) elH.textContent = `${curr} ${hSub.toFixed(2)}`;
    if (elO) elO.textContent = `${curr} ${oSub.toFixed(2)}`;
    if (elTot) elTot.textContent = `${curr} ${vTotal.toFixed(2)}`;

    if (vTotal > 0) {
      const parts = [];
      if (pSub > 0) parts.push(`Pasajes: ${curr} ${pSub.toFixed(2)}`);
      if (aSub > 0) parts.push(`Alim.: ${curr} ${aSub.toFixed(2)}`);
      if (hSub > 0) parts.push(`Hosp.: ${curr} ${hSub.toFixed(2)}`);
      if (oSub > 0) parts.push(`Mov./Otros: ${curr} ${oSub.toFixed(2)}`);
      list.push({
        id: "ViaticosIntegrales",
        name: "Viáticos Integrales",
        icon: "fa-route",
        color: "text-emerald-700 bg-emerald-50 border-emerald-200",
        detail: parts.join(" • ") || "Desglose de viáticos completo",
        amount: vTotal
      });
    }

    // 2. Pasajes
    const pasCant = parseFloat(document.getElementById("subPasCant")?.value) || 0;
    const pasCosto = parseFloat(document.getElementById("subPasCostoUnit")?.value) || 0;
    const pasSub = pasCant * pasCosto;
    const pasDisp = document.getElementById("subPasSubtotalDisplay");
    if (pasDisp) pasDisp.textContent = `${curr} ${pasSub.toFixed(2)}`;
    if (pasSub > 0) {
      const ruta = (document.getElementById("subPasRuta")?.value || "").trim();
      const emp = (document.getElementById("subPasEmpresa")?.value || "").trim();
      list.push({
        id: "Pasajes",
        name: "Pasajes Terrestres / Aéreos",
        icon: "fa-plane-departure",
        color: "text-sky-700 bg-sky-50 border-sky-200",
        detail: `${pasCant} boleto(s)${ruta ? ` • ${ruta}` : ''}${emp ? ` (${emp})` : ''} a ${curr} ${pasCosto.toFixed(2)}`,
        amount: pasSub
      });
    }

    // 3. Alimentación
    const alimPers = parseFloat(document.getElementById("subAlimPersonas")?.value) || 0;
    const alimDias = parseFloat(document.getElementById("subAlimDias")?.value) || 0;
    const alimCosto = parseFloat(document.getElementById("subAlimCostoDiario")?.value) || 0;
    const alimSub = alimPers * alimDias * alimCosto;
    const alimDisp = document.getElementById("subAlimSubtotalDisplay");
    if (alimDisp) alimDisp.textContent = `${curr} ${alimSub.toFixed(2)}`;
    if (alimSub > 0) {
      const rest = (document.getElementById("subAlimRestaurante")?.value || "").trim();
      list.push({
        id: "Alimentacion",
        name: "Alimentación & Dietas",
        icon: "fa-utensils",
        color: "text-amber-700 bg-amber-50 border-amber-200",
        detail: `${alimPers} pers. x ${alimDias} día(s) x ${curr} ${alimCosto.toFixed(2)}${rest ? ` • ${rest}` : ''}`,
        amount: alimSub
      });
    }

    // 4. Hospedaje
    const hospHab = parseFloat(document.getElementById("subHospHab")?.value) || 0;
    const hospNoches = parseFloat(document.getElementById("subHospNoches")?.value) || 0;
    const hospTarifa = parseFloat(document.getElementById("subHospTarifa")?.value) || 0;
    const hospSub = hospHab * hospNoches * hospTarifa;
    const hospDisp = document.getElementById("subHospSubtotalDisplay");
    if (hospDisp) hospDisp.textContent = `${curr} ${hospSub.toFixed(2)}`;
    if (hospSub > 0) {
      const hotel = (document.getElementById("subHospHotel")?.value || "").trim();
      const ciudad = (document.getElementById("subHospCiudad")?.value || "Challhuahuacho");
      list.push({
        id: "Hospedaje",
        name: "Hospedaje & Alojamiento",
        icon: "fa-hotel",
        color: "text-purple-700 bg-purple-50 border-purple-200",
        detail: `${hospHab} hab. x ${hospNoches} noche(s) x ${curr} ${hospTarifa.toFixed(2)}${hotel ? ` • ${hotel}` : ''} (${ciudad})`,
        amount: hospSub
      });
    }

    // 5. Movilidad Local
    const movCant = parseFloat(document.getElementById("subMovCant")?.value) || 0;
    const movCosto = parseFloat(document.getElementById("subMovCosto")?.value) || 0;
    const movSub = movCant * movCosto;
    const movDisp = document.getElementById("subMovSubtotalDisplay");
    if (movDisp) movDisp.textContent = `${curr} ${movSub.toFixed(2)}`;
    if (movSub > 0) {
      const ruta = (document.getElementById("subMovRuta")?.value || "").trim();
      const tipo = (document.getElementById("subMovTipo")?.value || "Movilidad");
      list.push({
        id: "Movilidad",
        name: "Movilidad Local & Combustible",
        icon: "fa-car-side",
        color: "text-cyan-700 bg-cyan-50 border-cyan-200",
        detail: `${movCant} carrera(s)/item(s) x ${curr} ${movCosto.toFixed(2)}${ruta ? ` • ${ruta}` : ''} (${tipo})`,
        amount: movSub
      });
    }

    // 6. Personal Eventual
    const persCant = parseFloat(document.getElementById("subPersPersonas")?.value) || 0;
    const persDias = parseFloat(document.getElementById("subPersDias")?.value) || 0;
    const persJornal = parseFloat(document.getElementById("subPersJornal")?.value) || 0;
    const persSub = persCant * persDias * persJornal;
    const persDisp = document.getElementById("subPersSubtotalDisplay");
    if (persDisp) persDisp.textContent = `${curr} ${persSub.toFixed(2)}`;
    if (persSub > 0) {
      const cargo = (document.getElementById("subPersCargo")?.value || "Personal eventual").trim();
      list.push({
        id: "Personal",
        name: "Personal Eventual de Difusión",
        icon: "fa-users-gear",
        color: "text-amber-800 bg-yellow-50 border-amber-300",
        detail: `${persCant} ${cargo} x ${persDias} día(s) x ${curr} ${persJornal.toFixed(2)}`,
        amount: persSub
      });
    }

    // 7. Publicidad y Pauta Digital
    const pubCant = parseFloat(document.getElementById("subPubCant")?.value) || 0;
    const pubTarifa = parseFloat(document.getElementById("subPubTarifa")?.value) || 0;
    const pubSub = pubCant * pubTarifa;
    const pubDisp = document.getElementById("subPubSubtotalDisplay");
    if (pubDisp) pubDisp.textContent = `${curr} ${pubSub.toFixed(2)}`;
    if (pubSub > 0) {
      const canal = (document.getElementById("subPubCanal")?.value || "Publicidad");
      const medio = (document.getElementById("subPubMedio")?.value || "").trim();
      list.push({
        id: "Publicidad",
        name: "Pauta Digital & Publicidad Local",
        icon: "fa-bullhorn",
        color: "text-pink-700 bg-pink-50 border-pink-200",
        detail: `${pubCant} pauta(s) x ${curr} ${pubTarifa.toFixed(2)}${medio ? ` • ${medio}` : ''} (${canal})`,
        amount: pubSub
      });
    }

    // 8. Letreros e Imagen
    const letCosto = parseFloat(document.getElementById("subLetCosto")?.value) || 0;
    const letDisp = document.getElementById("subLetSubtotalDisplay");
    if (letDisp) letDisp.textContent = `${curr} ${letCosto.toFixed(2)}`;
    if (letCosto > 0) {
      const tipo = (document.getElementById("subLetTipo")?.value || "Letrero");
      const med = (document.getElementById("subLetMedidas")?.value || "").trim();
      list.push({
        id: "Letreros",
        name: "Letreros e Imagen Corporativa",
        icon: "fa-signs-post",
        color: "text-indigo-700 bg-indigo-50 border-indigo-200",
        detail: `${tipo}${med ? ` [${med}]` : ''} • Costo S/ ${letCosto.toFixed(2)}`,
        amount: letCosto
      });
    }

    // 9. Servicios Básicos
    const servMeses = parseFloat(document.getElementById("subServMeses")?.value) || 0;
    const servTarifa = parseFloat(document.getElementById("subServTarifa")?.value) || 0;
    const servSub = servMeses * servTarifa;
    const servDisp = document.getElementById("subServSubtotalDisplay");
    if (servDisp) servDisp.textContent = `${curr} ${servSub.toFixed(2)}`;
    if (servSub > 0) {
      const tipo = (document.getElementById("subServTipo")?.value || "Servicio Básico");
      list.push({
        id: "Servicios",
        name: "Servicios Básicos (Luz/Agua/Claro)",
        icon: "fa-plug",
        color: "text-blue-700 bg-blue-50 border-blue-200",
        detail: `${servMeses} mes(es) ${tipo} x ${curr} ${servTarifa.toFixed(2)}`,
        amount: servSub
      });
    }

    // 10. Alquiler de Inmueble
    const alqMeses = parseFloat(document.getElementById("subAlqMeses")?.value) || 0;
    const alqGarantia = parseFloat(document.getElementById("subAlqGarantia")?.value) || 0;
    const alqRenta = parseFloat(document.getElementById("subAlqRenta")?.value) || 0;
    const alqTotalMeses = alqMeses + alqGarantia;
    const alqSub = alqTotalMeses * alqRenta;
    const alqDisp = document.getElementById("subAlqSubtotalDisplay");
    if (alqDisp) alqDisp.textContent = `${curr} ${alqSub.toFixed(2)}`;
    if (alqSub > 0) {
      const local = (document.getElementById("subAlqLocal")?.value || "Local Sede");
      list.push({
        id: "Alquiler",
        name: "Alquiler de Inmueble Sede",
        icon: "fa-building",
        color: "text-slate-800 bg-slate-100 border-slate-300",
        detail: `${alqTotalMeses} mes(es) (${alqMeses} renta + ${alqGarantia} garantía) x ${curr} ${alqRenta.toFixed(2)} • ${local}`,
        amount: alqSub
      });
    }

    // 11. Notaría y Trámites
    const notCant = parseFloat(document.getElementById("subNotCant")?.value) || 0;
    const notTarifa = parseFloat(document.getElementById("subNotTarifa")?.value) || 0;
    const notSub = notCant * notTarifa;
    const notDisp = document.getElementById("subNotSubtotalDisplay");
    if (notDisp) notDisp.textContent = `${curr} ${notSub.toFixed(2)}`;
    if (notSub > 0) {
      const sede = (document.getElementById("subNotSede")?.value || "Notaría");
      const acto = (document.getElementById("subNotActo")?.value || "").trim();
      list.push({
        id: "Notaria",
        name: "Notaría & Registros SUNARP",
        icon: "fa-stamp",
        color: "text-violet-700 bg-violet-50 border-violet-200",
        detail: `${notCant} trámite(s) x ${curr} ${notTarifa.toFixed(2)}${acto ? ` • ${acto}` : ''} (${sede})`,
        amount: notSub
      });
    }

    // 12. Equipamiento y TIC
    const ticCant = parseFloat(document.getElementById("subTicCant")?.value) || 0;
    const ticPrecio = parseFloat(document.getElementById("subTicPrecio")?.value) || 0;
    const ticSub = ticCant * ticPrecio;
    const ticDisp = document.getElementById("subTicSubtotalDisplay");
    if (ticDisp) ticDisp.textContent = `${curr} ${ticSub.toFixed(2)}`;
    if (ticSub > 0) {
      const tipo = (document.getElementById("subTicTipo")?.value || "Equipamiento TIC");
      const marca = (document.getElementById("subTicMarca")?.value || "").trim();
      list.push({
        id: "Equipamiento",
        name: "Equipamiento & TIC",
        icon: "fa-laptop",
        color: "text-emerald-800 bg-emerald-50 border-emerald-300",
        detail: `${ticCant} x ${tipo}${marca ? ` • ${marca}` : ''} a ${curr} ${ticPrecio.toFixed(2)}`,
        amount: ticSub
      });
    }

    // 13. Ferretería
    const ferrCant = parseFloat(document.getElementById("subFerrCant")?.value) || 0;
    const ferrMonto = parseFloat(document.getElementById("subFerrMonto")?.value) || 0;
    const ferrSub = ferrCant * ferrMonto;
    const ferrDisp = document.getElementById("subFerrSubtotalDisplay");
    if (ferrDisp) ferrDisp.textContent = `${curr} ${ferrSub.toFixed(2)}`;
    if (ferrSub > 0) {
      const desc = (document.getElementById("subFerrDesc")?.value || "Materiales de ferretería").trim();
      list.push({
        id: "Ferreteria",
        name: "Ferretería & Materiales",
        icon: "fa-hammer",
        color: "text-amber-900 bg-amber-50 border-amber-300",
        detail: `${ferrCant} x ${desc} a ${curr} ${ferrMonto.toFixed(2)}`,
        amount: ferrSub
      });
    }

    const totalSum = list.reduce((acc, item) => acc + item.amount, 0);

    // Renderizar lista consolidada en UI
    const container = document.getElementById("presSubcatList");
    const countBadge = document.getElementById("presSubcatCountBadge");
    const sumDisplay = document.getElementById("presSubcatSumDisplay");

    if (countBadge) countBadge.textContent = list.length;
    if (sumDisplay) sumDisplay.textContent = `${curr} ${totalSum.toFixed(2)}`;

    if (container) {
      if (list.length === 0) {
        container.innerHTML = `<p class="text-[11px] text-slate-500 italic">No hay subcategorías con monto ingresado aún. Seleccione una subcategoría arriba e ingrese los datos para sumarla a esta partida.</p>`;
      } else {
        container.innerHTML = list.map(item => `
          <div class="flex items-center justify-between p-2 rounded-lg border ${item.color} bg-white shadow-2xs gap-2">
            <div class="flex items-center gap-2 min-w-0 flex-1">
              <span class="w-6 h-6 rounded flex items-center justify-center bg-white border border-slate-200 text-xs shadow-2xs flex-shrink-0">
                <i class="fa-solid ${item.icon}"></i>
              </span>
              <div class="min-w-0 flex-1">
                <div class="font-bold text-slate-900 text-[11px] truncate">${item.name}</div>
                <div class="text-[10px] text-slate-600 truncate">${item.detail}</div>
              </div>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <span class="font-mono font-bold text-xs text-emerald-800">${curr} ${item.amount.toFixed(2)}</span>
              <button type="button" onclick="window.app.switchSubcatById(${jsStr(item.id)})" class="text-blue-600 hover:text-blue-800 p-1 text-xs" title="Editar este rubro"><i class="fa-solid fa-pen"></i></button>
              <button type="button" onclick="window.app.clearSubcat(${jsStr(item.id)})" class="text-slate-400 hover:text-red-600 p-1 text-xs" title="Limpiar y quitar este rubro"><i class="fa-solid fa-trash-can"></i></button>
            </div>
          </div>
        `).join("");
      }
    }

    return { list, totalSum };
  }

  onPresupuestoCalcChange() {
    const { list, totalSum } = this.calculateAllPresupuestoSubcategorias();
    const curr = window.db.getSettings().currency || "S/";

    const cEl = document.getElementById("presCantidad");
    const uEl = document.getElementById("presCostoUnitario");
    const disp = document.getElementById("presSubtotalDisplay");
    const formEl = document.getElementById("presCalcFormula");

    if (list.length > 0) {
      // MODO MULTI-SUBCATEGORÍA CONSOLIDADO
      if (uEl) uEl.value = totalSum.toFixed(2);
      const cant = parseFloat(cEl?.value) || 1;
      const subtotal = totalSum * cant;

      if (disp) disp.textContent = `${curr} ${subtotal.toFixed(2)}`;
      if (formEl) {
        const breakdown = list.map(s => `${s.name}: ${curr} ${s.amount.toFixed(2)}`).join(" + ");
        formEl.textContent = cant > 1 ? `(${breakdown}) x ${cant} = ${curr} ${subtotal.toFixed(2)}` : `${breakdown} = ${curr} ${subtotal.toFixed(2)}`;
      }
    } else {
      // MODO MANUAL (GENERAL O SIN SUBCATEGORÍAS ACTIVAS)
      const cant = parseFloat(cEl?.value) || 1;
      const unit = parseFloat(uEl?.value) || 0;
      const subtotal = cant * unit;

      if (disp) disp.textContent = `${curr} ${subtotal.toFixed(2)}`;
      if (formEl) formEl.textContent = `${cant} unid. x ${curr} ${unit.toFixed(2)}`;
    }
  }

  getAllSubcatFormData() {
    const getVal = (id, def = "") => (document.getElementById(id)?.value || def).trim();
    return {
      subGenDetalle: getVal("subGenDetalle"),
      subGenProveedor: getVal("subGenProveedor"),
      vPasajesCant: parseFloat(getVal("vPasajesCant", "0")) || 0,
      vPasajesMonto: parseFloat(getVal("vPasajesMonto", "0")) || 0,
      vAlimCant: parseFloat(getVal("vAlimCant", "0")) || 0,
      vAlimMonto: parseFloat(getVal("vAlimMonto", "0")) || 0,
      vHospCant: parseFloat(getVal("vHospCant", "0")) || 0,
      vHospMonto: parseFloat(getVal("vHospMonto", "0")) || 0,
      vOtrosCant: parseFloat(getVal("vOtrosCant", "0")) || 0,
      vOtrosMonto: parseFloat(getVal("vOtrosMonto", "0")) || 0,
      subPasModalidad: getVal("subPasModalidad"),
      subPasRuta: getVal("subPasRuta"),
      subPasEmpresa: getVal("subPasEmpresa"),
      subPasCant: parseFloat(getVal("subPasCant", "1")) || 1,
      subPasCostoUnit: parseFloat(getVal("subPasCostoUnit", "0")) || 0,
      subAlimModalidad: getVal("subAlimModalidad"),
      subAlimRestaurante: getVal("subAlimRestaurante"),
      subAlimPersonas: parseFloat(getVal("subAlimPersonas", "1")) || 1,
      subAlimDias: parseFloat(getVal("subAlimDias", "1")) || 1,
      subAlimCostoDiario: parseFloat(getVal("subAlimCostoDiario", "0")) || 0,
      subHospHotel: getVal("subHospHotel"),
      subHospCiudad: getVal("subHospCiudad"),
      subHospTipo: getVal("subHospTipo"),
      subHospHab: parseFloat(getVal("subHospHab", "1")) || 1,
      subHospNoches: parseFloat(getVal("subHospNoches", "1")) || 1,
      subHospTarifa: parseFloat(getVal("subHospTarifa", "0")) || 0,
      subMovTipo: getVal("subMovTipo"),
      subMovRuta: getVal("subMovRuta"),
      subMovCant: parseFloat(getVal("subMovCant", "1")) || 1,
      subMovCosto: parseFloat(getVal("subMovCosto", "0")) || 0,
      subPersCargo: getVal("subPersCargo"),
      subPersZona: getVal("subPersZona"),
      subPersPersonas: parseFloat(getVal("subPersPersonas", "1")) || 1,
      subPersDias: parseFloat(getVal("subPersDias", "1")) || 1,
      subPersJornal: parseFloat(getVal("subPersJornal", "0")) || 0,
      subPubCanal: getVal("subPubCanal"),
      subPubMedio: getVal("subPubMedio"),
      subPubUnidad: getVal("subPubUnidad"),
      subPubCant: parseFloat(getVal("subPubCant", "1")) || 1,
      subPubTarifa: parseFloat(getVal("subPubTarifa", "0")) || 0,
      subLetTipo: getVal("subLetTipo"),
      subLetMedidas: getVal("subLetMedidas"),
      subLetTaller: getVal("subLetTaller"),
      subLetInstalacion: getVal("subLetInstalacion"),
      subLetCosto: parseFloat(getVal("subLetCosto", "0")) || 0,
      subServTipo: getVal("subServTipo"),
      subServSuministro: getVal("subServSuministro"),
      subServProveedor: getVal("subServProveedor"),
      subServMeses: parseFloat(getVal("subServMeses", "1")) || 1,
      subServTarifa: parseFloat(getVal("subServTarifa", "0")) || 0,
      subAlqLocal: getVal("subAlqLocal"),
      subAlqArrendador: getVal("subAlqArrendador"),
      subAlqMeses: parseFloat(getVal("subAlqMeses", "1")) || 1,
      subAlqRenta: parseFloat(getVal("subAlqRenta", "0")) || 0,
      subAlqGarantia: parseFloat(getVal("subAlqGarantia", "0")) || 0,
      subNotSede: getVal("subNotSede"),
      subNotActo: getVal("subNotActo"),
      subNotCant: parseFloat(getVal("subNotCant", "1")) || 1,
      subNotTarifa: parseFloat(getVal("subNotTarifa", "0")) || 0,
      subTicTipo: getVal("subTicTipo"),
      subTicMarca: getVal("subTicMarca"),
      subTicProveedor: getVal("subTicProveedor"),
      subTicCant: parseFloat(getVal("subTicCant", "1")) || 1,
      subTicPrecio: parseFloat(getVal("subTicPrecio", "0")) || 0,
      subFerrDesc: getVal("subFerrDesc"),
      subFerrCant: parseFloat(getVal("subFerrCant", "1")) || 1,
      subFerrMonto: parseFloat(getVal("subFerrMonto", "0")) || 0
    };
  }

  savePresupuesto(e) {
    if (e) e.preventDefault();
    try {
      const getVal = (id, def = "") => (document.getElementById(id)?.value || def).trim();
      const cant = parseFloat(getVal("presCantidad", "1")) || 1;
      const unit = parseFloat(getVal("presCostoUnitario", "0")) || 0;
      const frec = getVal("presFrecuencia", "Inversión Única");

      const { list, totalSum } = this.calculateAllPresupuestoSubcategorias();
      const allSubcatsData = this.getAllSubcatFormData();

      let finalSubtotal = 0;
      let finalUnit = unit;
      let finalSubcatTitle = getVal("presSubcategoria", "General");

      if (list.length > 0) {
        finalSubtotal = totalSum * cant;
        finalUnit = totalSum;
        finalSubcatTitle = list.map(s => s.name).join(" + ");
      } else {
        finalSubtotal = cant * unit;
      }

      // Compatibilidad con desglose viáticos si aplica
      const viatSub = list.find(s => s.id === "ViaticosIntegrales");
      const desgloseViaticos = viatSub ? {
        pasajesCant: allSubcatsData.vPasajesCant,
        pasajesMonto: allSubcatsData.vPasajesMonto,
        alimCant: allSubcatsData.vAlimCant,
        alimMonto: allSubcatsData.vAlimMonto,
        hospCant: allSubcatsData.vHospCant,
        hospMonto: allSubcatsData.vHospMonto,
        otrosCant: allSubcatsData.vOtrosCant,
        otrosMonto: allSubcatsData.vOtrosMonto,
        total: viatSub.amount
      } : null;

      const data = {
        sede: getVal("presSede", window.db ? window.db.getActiveSede() : "challhuahuacho"),
        concepto: getVal("presConcepto", "Partida Presupuestaria"),
        categoria: getVal("presCategoria", "Otros Gastos Operativos"),
        subcategoria: finalSubcatTitle,
        subcategoriasActivas: list,
        detalleSubcategorias: allSubcatsData,
        tipo: getVal("presTipo", "OPEX"),
        frecuencia: frec,
        dias: 1,
        semanas: 1,
        cantidad: cant,
        unidad: getVal("presUnidad", "Unidad"),
        costoUnitario: finalUnit,
        subtotal: finalSubtotal,
        desgloseViaticos: desgloseViaticos,
        estado: getVal("presEstado", "Aprobado"),
        prioridad: getVal("presPrioridad", "Alta"),
        responsable: getVal("presResponsable", "Ing. Yimer Damián Soto"),
        notas: getVal("presNotas", "")
      };

      const cc = getVal("presCentroCosto", "ADM");
      const pcge = getVal("presClasePcge", "63");
      data.centroCosto = cc;
      data.clasePcge = pcge;

      const normSede = window.db ? window.db.normalizeSede(data.sede) : "challhuahuacho";
      const branchPrefix = (window.SEDES_CONFIG && window.SEDES_CONFIG[normSede]) ? window.SEDES_CONFIG[normSede].codigo : "CH";

      if (this.editingPresupuestoId) {
        const existing = window.db.get("presupuestos").find(i => i.id === this.editingPresupuestoId);
        const existingNum = existing?.correlativo || (existing?.id ? this.extractCorrelativo(existing.id) : 1);
        data.correlativo = existingNum;
        data.id = `${branchPrefix}-${cc}-${pcge}-${String(existingNum).padStart(3, "0")}`;

        const updated = window.db.update("presupuestos", this.editingPresupuestoId, data);
        if (!updated) {
          this.showToast("No se pudo actualizar la partida presupuestaria. Verifique permisos.", "error");
          return;
        }
        this.showToast(`Partida presupuestaria ${data.id} actualizada con éxito`, "success");
      } else {
        // Correlativo global por raw (todas las sedes) para evitar colisiones CHL/MIR → mismo 001
        const maxNum = (window.db.getRaw("presupuestos") || []).reduce((mx, p) => {
          let num = p.correlativo;
          if (!num && p.id) {
            const m = /-(\d+)$/.exec(p.id);
            if (m) num = parseInt(m[1], 10);
          }
          return Math.max(mx, num || 0);
        }, 0);
        const nextNum = maxNum + 1;
        data.correlativo = nextNum;
        data.id = `${branchPrefix}-${cc}-${pcge}-${String(nextNum).padStart(3, "0")}`;

        const created = window.db.add("presupuestos", data);
        if (!created) {
          this.showToast("No se pudo guardar el presupuesto. Verifique permisos o reintente.", "error");
          return;
        }
        this.showToast(`Partida ${data.id} registrada con éxito`, "success");
        window.alerts.playChime("alert");
      }

      if (window.draftAutosave) window.draftAutosave.clearDraft("modalPresupuesto");
      this.closeModal("modalPresupuesto");
      this.renderPresupuestos();
      window.alerts.evaluateAlerts();
    } catch (err) {
      console.error("Error al guardar partida presupuestaria:", err);
      alert("Error al guardar presupuesto: " + err.message);
    }
  }

  editPresupuesto(id) {
    if (window.db && !window.db._rbacCheck("presupuestos", "update", id)) return;
    this.openPresupuestoModal(id);
  }

  deletePresupuesto(id) {
    if (window.db && !window.db._rbacCheck("presupuestos", "delete", id)) return;
    if (confirm("¿Está seguro de que desea eliminar esta partida presupuestaria?")) {
      const ok = window.db.delete("presupuestos", id);
      if (!ok) {
        this.showToast("No se pudo eliminar la partida presupuestaria.", "error");
        return;
      }
      this.renderPresupuestos();
      window.kpiDashboard.refresh();
      this.showToast("Partida presupuestaria eliminada", "info");
    }
  }

  // =========================================================================
  // CONTROL & LIQUIDACIÓN DE EJECUCIÓN PRESUPUESTARIA (% USADO vs % NO USADO)
  // =========================================================================
  openEjecutarPresupuestoModal(id) {
    const item = window.db.get("presupuestos").find(i => i.id === id);
    if (!item) {
      this.showToast("Partida presupuestaria no encontrada", "error");
      return;
    }

    const curr = window.db.getSettings().currency || "S/";
    const ptoInicial = Number(item.subtotal || 0);

    const setVal = (fid, val) => { const el = document.getElementById(fid); if (el) el.value = val !== undefined && val !== null ? val : ""; };
    const setText = (fid, txt) => { const el = document.getElementById(fid); if (el) el.textContent = txt; };

    setVal("ejecPresupuestoId", item.id);
    setText("ejecPresCodigo", item.id);
    setText("ejecPresTipoBadge", item.tipo || "OPEX");
    setText("ejecPresConcepto", item.concepto);
    setText("ejecPresCategoria", `${item.categoria} ${item.subcategoria && item.subcategoria !== 'General' ? '• ' + item.subcategoria : ''}`);
    setText("ejecPresMontoInicialDisplay", `${curr} ${ptoInicial.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

    const cc = item.centroCosto || (item.id && item.id.split("-")[1]) || "ADM";
    const pcge = item.clasePcge || (item.id && item.id.split("-")[2]) || "63";
    const ccLabels = {
      ADM: "ADM • Administración",
      LOG: "LOG • Logística y Transportes",
      SRI: "SRI • Relaciones Comunitarias",
      SEG: "SEG • Seguridad SST"
    };

    setText("ejecPresCcBadge", ccLabels[cc] || cc);
    setText("ejecPresPcgeBadge", `PCGE ${pcge}`);

    const montoRealInicial = item.montoEjecutado !== undefined && item.montoEjecutado !== null ? item.montoEjecutado : ptoInicial;
    setVal("ejecPresMontoReal", montoRealInicial);
    setVal("ejecPresFecha", item.fechaEjecucion || getRelativeDateOnlyStr(0));
    setVal("ejecPresComprobante", item.comprobanteEjecucion || "");
    setVal("ejecPresResponsable", item.responsable || "Ing. Industrial / Asistente Admin");
    setVal("ejecPresNotas", item.notasEjecucion || "");

    const presetSelect = document.getElementById("ejecPresMotivoPreset");
    if (presetSelect) presetSelect.value = "";
    this.updateJustificacionCharCount();

    const syncChk = document.getElementById("ejecPresSyncCajaChica");
    if (syncChk) syncChk.checked = false;

    this.calculateEjecucionLive();
    this.showModal("modalEjecutarPresupuesto");
  }

  calculateEjecucionLive() {
    const id = document.getElementById("ejecPresupuestoId")?.value;
    const item = window.db.get("presupuestos").find(i => i.id === id);
    if (!item) return;

    const curr = window.db.getSettings().currency || "S/";
    const ptoInicial = Number(item.subtotal || 0);
    const montoReal = parseFloat(document.getElementById("ejecPresMontoReal")?.value) || 0;

    const pctUsado = ptoInicial > 0 ? (montoReal / ptoInicial) * 100 : (montoReal > 0 ? 100 : 0);
    const saldo = ptoInicial - montoReal;
    const pctNoUsado = ptoInicial > 0 ? Math.max(0, 100 - pctUsado) : 0;
    const isOver = montoReal > ptoInicial;

    const elPctUsadoText = document.getElementById("ejecLivePctUsadoText");
    const elPctNoUsadoText = document.getElementById("ejecLivePctNoUsadoText");
    const elBarUsado = document.getElementById("ejecLiveBarUsado");
    const elBarNoUsado = document.getElementById("ejecLiveBarNoUsado");
    const elMontoUsado = document.getElementById("ejecLiveMontoUsadoDisplay");
    const elMontoNoUsado = document.getElementById("ejecLiveMontoNoUsadoDisplay");
    const elPctUsadoBadge = document.getElementById("ejecLivePctUsadoBadge");
    const elPctNoUsadoBadge = document.getElementById("ejecLivePctNoUsadoBadge");
    const elLabelNoUsado = document.getElementById("ejecLiveLabelNoUsado");
    const elEstadoBadge = document.getElementById("ejecLiveEstadoBadge");

    if (elPctUsadoText) elPctUsadoText.textContent = `${pctUsado.toFixed(1)}%`;
    if (elPctNoUsadoText) {
      elPctNoUsadoText.textContent = isOver ? `0.0% (Excedido en +${(pctUsado - 100).toFixed(1)}%)` : `${pctNoUsado.toFixed(1)}%`;
    }

    if (elBarUsado) {
      elBarUsado.style.width = `${Math.min(100, pctUsado)}%`;
      if (isOver) {
        elBarUsado.className = "bg-gradient-to-r from-rose-600 to-red-500 h-full rounded-l-full transition-all duration-300";
      } else {
        elBarUsado.className = "bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-l-full transition-all duration-300";
      }
    }

    if (elBarNoUsado) {
      elBarNoUsado.style.width = `${!isOver ? pctNoUsado : 0}%`;
    }

    if (elMontoUsado) elMontoUsado.textContent = `${curr} ${montoReal.toFixed(2)}`;
    if (elPctUsadoBadge) elPctUsadoBadge.textContent = `${pctUsado.toFixed(1)}% del presupuesto inicial`;

    if (elMontoNoUsado) {
      elMontoNoUsado.textContent = isOver ? `-${curr} ${Math.abs(saldo).toFixed(2)}` : `${curr} ${saldo.toFixed(2)}`;
      elMontoNoUsado.className = isOver ? "text-base font-bold text-rose-400 font-mono mt-0.5" : "text-base font-bold text-amber-400 font-mono mt-0.5";
    }

    if (elLabelNoUsado) {
      elLabelNoUsado.textContent = isOver ? "Sobregiro Presupuestal (Exceso)" : "Monto No Usado (Ahorro / Saldo)";
    }

    if (elPctNoUsadoBadge) {
      elPctNoUsadoBadge.textContent = isOver ? `Excedido por ${curr} ${Math.abs(saldo).toFixed(2)}` : `${pctNoUsado.toFixed(1)}% disponible`;
      elPctNoUsadoBadge.className = isOver ? "text-[9px] font-semibold text-rose-300 bg-rose-950 px-1.5 py-0.5 rounded border border-rose-800/50 inline-block mt-1" : "text-[9px] font-semibold text-amber-300 bg-amber-950 px-1.5 py-0.5 rounded border border-amber-800/50 inline-block mt-1";
    }

    if (elEstadoBadge) {
      if (isOver) {
        elEstadoBadge.textContent = "⚠️ Sobregiro Presupuestal";
        elEstadoBadge.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30";
      } else if (pctUsado === 100) {
        elEstadoBadge.textContent = "🎯 Ejecución al 100%";
        elEstadoBadge.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30";
      } else {
        elEstadoBadge.textContent = `✨ Ahorro del ${pctNoUsado.toFixed(1)}%`;
        elEstadoBadge.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
      }
    }

    // Actualizar Módulo Ejecutivo de Sustento & Justificación
    const justBadge = document.getElementById("ejecJustificacionBadge");
    const justBadgeText = document.getElementById("ejecJustificacionBadgeText");

    if (justBadge && justBadgeText) {
      if (montoReal === 0) {
        justBadge.className = "inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs";
        justBadgeText.textContent = "Ingrese el monto gastado para análisis de variación";
      } else if (saldo > 0) {
        // Ahorro
        justBadge.className = "inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs";
        justBadgeText.innerHTML = `<i class="fa-solid fa-arrow-trend-down text-emerald-700"></i> Eficiencia / Ahorro Logrado: ${curr} ${saldo.toFixed(2)} (+${pctNoUsado.toFixed(1)}% disponible)`;
      } else if (saldo < 0) {
        // Sobrecosto / Desviación
        const exceso = Math.abs(saldo);
        const excesoPct = (pctUsado - 100).toFixed(1);
        justBadge.className = "inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-rose-300 shadow-2xs animate-pulse";
        justBadgeText.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-rose-700"></i> Desviación / Sobrecosto: -${curr} ${exceso.toFixed(2)} (+${excesoPct}% exceso) • Requiere Sustento`;
      } else {
        // Conforme al 100%
        justBadge.className = "inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-300 shadow-2xs";
        justBadgeText.innerHTML = `<i class="fa-solid fa-check-double text-blue-700"></i> Conforme al 100% (Sin Desviación Presupuestal)`;
      }
    }
    this.updateJustificacionCharCount();
  }

  applyJustificacionPreset(val) {
    if (!val) return;
    const txtArea = document.getElementById("ejecPresNotas");
    if (!txtArea) return;
    const current = txtArea.value.trim();
    if (current) {
      txtArea.value = current + " • " + val;
    } else {
      txtArea.value = val;
    }
    this.updateJustificacionCharCount();
    txtArea.focus();
  }

  insertJustificacionChip(text) {
    const txtArea = document.getElementById("ejecPresNotas");
    if (!txtArea) return;
    const current = txtArea.value.trim();
    if (current) {
      txtArea.value = current + " • " + text;
    } else {
      txtArea.value = text;
    }
    this.updateJustificacionCharCount();
    txtArea.focus();
  }

  clearJustificacionNotas() {
    const txtArea = document.getElementById("ejecPresNotas");
    if (txtArea) {
      txtArea.value = "";
      this.updateJustificacionCharCount();
    }
    const preset = document.getElementById("ejecPresMotivoPreset");
    if (preset) preset.value = "";
  }

  updateJustificacionCharCount() {
    const txtArea = document.getElementById("ejecPresNotas");
    const countEl = document.getElementById("ejecPresNotasCount");
    if (txtArea && countEl) {
      const len = txtArea.value.length;
      countEl.textContent = `${len} / 500 car.`;
      if (len > 500) {
        countEl.className = "font-mono text-rose-600 font-bold";
      } else {
        countEl.className = "font-mono text-slate-400";
      }
    }
  }

  saveEjecucionPresupuesto(e) {
    if (e) e.preventDefault();
    try {
      const id = document.getElementById("ejecPresupuestoId")?.value;
      const item = window.db.get("presupuestos").find(i => i.id === id);
      if (item) { this._editingOriginalUpdatedAt = item.updatedAt || item.createdAt || null; }
      if (!item) return;

      const ptoInicial = Number(item.subtotal || 0);
      const montoEjec = parseFloat(document.getElementById("ejecPresMontoReal")?.value) || 0;
      const fechaEjec = document.getElementById("ejecPresFecha")?.value || getRelativeDateOnlyStr(0);
      const compEjec = (document.getElementById("ejecPresComprobante")?.value || "").trim();
      const respEjec = (document.getElementById("ejecPresResponsable")?.value || item.responsable || "").trim();
      const notasEjec = (document.getElementById("ejecPresNotas")?.value || "").trim();
      const syncCaja = document.getElementById("ejecPresSyncCajaChica")?.checked || false;

      const pctUsado = ptoInicial > 0 ? (montoEjec / ptoInicial) * 100 : 100;
      const saldo = ptoInicial - montoEjec;
      const pctNoUsado = ptoInicial > 0 ? Math.max(0, 100 - pctUsado) : 0;

      const updatedData = {
        estado: "Ejecutado",
        montoEjecutado: montoEjec,
        fechaEjecucion: fechaEjec,
        comprobanteEjecucion: compEjec,
        responsableEjecucion: respEjec,
        notasEjecucion: notasEjec,
        porcentajeUsado: Math.round(pctUsado * 10) / 10,
        porcentajeNoUsado: Math.round(pctNoUsado * 10) / 10,
        saldoRestante: Math.round(saldo * 100) / 100
      };

      window.db.update("presupuestos", id, updatedData);

      // Si el usuario marcó sincronizar con Caja Chica
      if (syncCaja) {
        const cajaItem = {
          id: window.generateUniqueId("CC"),
          fecha: fechaEjec,
          tipo: "Egreso",
          centroCosto: item.tipo === "CAPEX" ? "Infraestructura & TIC" : "Sede Challhuahuacho - Operaciones",
          categoria: item.categoria,
          concepto: `[Ejecución ${item.id}] ${item.concepto}`,
          expediente: "-",
          comprobante: compEjec || `LIQ-${item.id}`,
          responsable: respEjec,
          monto: montoEjec,
          metodo: "Transferencia BCP",
          esRecurrente: false,
          notas: `Liquidación presupuestaria. Se usó el ${pctUsado.toFixed(1)}% (S/ ${montoEjec.toFixed(2)}) de un presupuesto inicial de S/ ${ptoInicial.toFixed(2)}. ${notasEjec}`
        };
        window.db.add("caja_chica", cajaItem);
        this.renderCajaChica();
      }

      this.closeModal("modalEjecutarPresupuesto");
      this.renderPresupuestos();
      window.kpiDashboard.refresh();
      window.alerts.evaluateAlerts();

      this.showToast(`¡Liquidación guardada! Se usó el ${pctUsado.toFixed(1)}% (Saldo no usado: ${pctNoUsado.toFixed(1)}%)`, "success");
    } catch (err) {
      console.error("Error al guardar ejecución presupuestaria:", err);
      alert("Error al liquidar presupuesto: " + err.message);
    }
  }

  // 4. MÓDULO INVENTARIO ABC
  // =========================================================================
  renderInventario() {
    const items = window.db.get("inventario");
    const container = document.getElementById("inventarioTableBody");
    const searchVal = (document.getElementById("searchInventario")?.value || "").toLowerCase();
    const filterCat = document.getElementById("filterCatInventario")?.value || "ALL";
    const curr = window.db.getSettings().currency;

    if (!container) return;

    const filtered = (this.inventory && typeof this.inventory.filterInventory === "function")
      ? this.inventory.filterInventory(items, searchVal, filterCat, "ALL", "ALL")
      : items.filter(item => {
          const matchSearch =
            (item.nombre || "").toLowerCase().includes(searchVal) ||
            item.codigo.toLowerCase().includes(searchVal) ||
            (item.clasificacionABC && item.clasificacionABC.toLowerCase().includes(searchVal)) ||
            item.ubicacion.toLowerCase().includes(searchVal);
          const matchCat = filterCat === "ALL" || item.categoria === filterCat;
          return matchSearch && matchCat;
        });

    if (filtered.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-8 text-slate-400">
            <i class="fa-solid fa-boxes-stacked text-3xl mb-2 text-slate-300"></i>
            <p>No se encontraron bienes o expedientes físicos</p>
          </td>
        </tr>
      `;
      return;
    }

    container.innerHTML = filtered.map(item => {
      const isClaseA = (item.clasificacionABC || "").includes("Clase A");
      const abcBadge = isClaseA
        ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300">Clase A (Crítico)</span>`
        : `<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">${item.clasificacionABC || 'Clase B/C'}</span>`;

      return `
        <tr id="inv-row-${escapeHtml(item.id)}" class="hover:bg-slate-50 transition border-b border-slate-200">
          <td class="font-mono text-xs font-semibold text-slate-700">${escapeHtml(item.codigo)}</td>
          <td>
            <div class="font-bold text-xs text-slate-900">${escapeHtml(item.nombre)}</div>
            <div class="text-[11px] text-slate-500 mt-0.5">${escapeHtml(item.observacion || '-')}</div>
          </td>
          <td>${abcBadge}</td>
          <td class="text-xs font-medium text-slate-700">${escapeHtml(item.categoria)}</td>
          <td class="text-xs text-slate-700">
            <i class="fa-solid fa-map-pin text-slate-400 mr-1"></i> ${escapeHtml(item.ubicacion)}
          </td>
          <td class="text-xs font-bold text-slate-900 text-center">
            ${item.stock} <span class="text-[10px] font-normal text-slate-500">${escapeHtml(item.unidad || 'und')}</span>
          </td>
          <td class="text-xs font-mono font-bold text-slate-800 text-right">
            ${curr} ${(Number(item.stock || 0) * Number(item.costoUnitario || 0)).toFixed(2)}
          </td>
          <td class="text-center whitespace-nowrap">
            <button onclick="window.app.editInventario(${jsStr(item.id)})" class="text-slate-500 hover:text-blue-600 p-1.5 transition" title="Editar"><i class="fa-solid fa-pen-to-square"></i></button>
            <button onclick="window.app.deleteInventario(${jsStr(item.id)})" class="text-slate-400 hover:text-red-600 p-1.5 transition" title="Eliminar"><i class="fa-solid fa-trash-can"></i></button>
          </td>
        </tr>
      `;
    }).join("");
  }

  openInventarioModal(id = null) {
    this.editingId = id;
    const form = document.getElementById("formInventario");
    if (form) form.reset();

    const titleEl = document.getElementById("modalInventarioTitle");

    if (id) {
      if (titleEl) titleEl.textContent = "Editar Ítem de Inventario / Archivo";
      const item = window.db.get("inventario").find(i => i.id === id);
      if (item) {
        if (document.getElementById("invCodigo")) document.getElementById("invCodigo").value = item.codigo;
        if (document.getElementById("invNombre")) document.getElementById("invNombre").value = item.nombre;
        if (document.getElementById("invClasificacionABC")) document.getElementById("invClasificacionABC").value = item.clasificacionABC || "Clase B (Valor Moderado)";
        if (document.getElementById("invCategoria")) document.getElementById("invCategoria").value = item.categoria;
        if (document.getElementById("invUbicacion")) document.getElementById("invUbicacion").value = item.ubicacion;
        if (document.getElementById("invStock")) document.getElementById("invStock").value = item.stock;
        if (document.getElementById("invUnidad")) document.getElementById("invUnidad").value = item.unidad || "Unidad";
        if (document.getElementById("invPuntoReorden")) document.getElementById("invPuntoReorden").value = item.puntoReorden || 1;
        if (document.getElementById("invCostoUnitario")) document.getElementById("invCostoUnitario").value = item.costoUnitario || 0;
        if (document.getElementById("invEstado")) document.getElementById("invEstado").value = item.estado;
        if (document.getElementById("invResponsable")) document.getElementById("invResponsable").value = item.responsable || "";
        if (document.getElementById("invObservacion")) document.getElementById("invObservacion").value = item.observacion || "";
        if (document.getElementById("invSede")) document.getElementById("invSede").value = window.db.normalizeSede(item.sede || "challhuahuacho");
      }
    } else {
      if (titleEl) titleEl.textContent = "Registrar Activo / Expediente — PAOLO ALDEA & ABOGADOS";
      if (document.getElementById("invCodigo")) document.getElementById("invCodigo").value = window.generateUniqueId("EQP");
      const active = window.db ? window.db.getActiveSede() : "challhuahuacho";
      if (document.getElementById("invSede")) document.getElementById("invSede").value = active === "todas" ? "challhuahuacho" : active;
    }

    if (document.getElementById("invSede")) {
      document.getElementById("invSede").disabled = !(window.db && window.db.isGlobalAdmin());
    }

    this.showModal("modalInventario");
  }

  saveInventario(e) {
    if (e) e.preventDefault();
    try {
      const data = {
        sede: getSafeVal("invSede", window.db ? window.db.getActiveSede() : "challhuahuacho"),
        codigo: getSafeVal("invCodigo", window.generateUniqueId("ART")),
        nombre: getSafeVal("invNombre", "Bien / Expediente"),
        clasificacionABC: getSafeVal("invClasificacionABC", "Clase B (Valor Moderado)"),
        categoria: getSafeVal("invCategoria", "Equipos y Bienes"),
        ubicacion: getSafeVal("invUbicacion", "Sede Challhuahuacho"),
        stock: getSafeInt("invStock", 1),
        unidad: getSafeVal("invUnidad", "Unidad"),
        puntoReorden: getSafeInt("invPuntoReorden", 1),
        costoUnitario: getSafeNum("invCostoUnitario", 0),
        estado: getSafeVal("invEstado", "Disponible"),
        responsable: getSafeVal("invResponsable", "Ing. Industrial / Asistente Admin"),
        observacion: getSafeVal("invObservacion", "")
      };

      if (this.editingId) {
        const updated = window.db.update("inventario", this.editingId, data);
        if (!updated) {
          this.showToast("No se pudo actualizar el ítem de inventario. Verifique permisos.", "error");
          return;
        }
        this.showToast("Inventario actualizado correctamente", "success");
      } else {
        data.id = window.generateUniqueId("INV");
        const created = window.db.add("inventario", data);
        if (!created) {
          this.showToast("No se pudo registrar el ítem. Verifique permisos o reintente.", "error");
          return;
        }
        this.showToast("Ítem registrado en inventario", "success");
      }

      this.closeModal("modalInventario");
      this.renderInventario();
      window.kpiDashboard.refresh();
    } catch (err) {
      console.error("Error al guardar inventario:", err);
      alert("Error al guardar en Inventario: " + err.message);
    }
  }

  editInventario(id) {
    if (window.db && !window.db._rbacCheck("inventario", "update", id)) return;
    this.openInventarioModal(id);
  }

  deleteInventario(id) {
    if (window.db && !window.db._rbacCheck("inventario", "delete", id)) return;
    if (confirm("¿Desea dar de baja este artículo del inventario?")) {
      const ok = window.db.delete("inventario", id);
      if (!ok) {
        this.showToast("No se pudo eliminar el ítem de inventario.", "error");
        return;
      }
      this.renderInventario();
      window.kpiDashboard.refresh();
      this.showToast("Ítem eliminado", "info");
    }
  }

  // =========================================================================
  // 5. GESTIÓN DOCUMENTAL
  // =========================================================================
  renderDocumentos() {
    const items = window.db.get("documentos");
    const container = document.getElementById("documentosCardsContainer");
    const searchVal = (document.getElementById("searchDocumentos")?.value || "").toLowerCase();

    if (!container) return;

    const filtered = (this.documents && typeof this.documents.filterDocuments === "function")
      ? this.documents.filterDocuments(items, searchVal, "ALL", "ALL", "ALL")
      : items.filter(d => {
          return d.titulo.toLowerCase().includes(searchVal) ||
                 d.tipo.toLowerCase().includes(searchVal) ||
                 (d.expediente && d.expediente.toLowerCase().includes(searchVal)) ||
                 (d.cliente && d.cliente.toLowerCase().includes(searchVal));
        });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="col-span-full text-center py-12 text-slate-400 bg-white rounded-xl border border-slate-200">
          <i class="fa-solid fa-file-shield text-4xl mb-2 text-slate-300"></i>
          <p class="font-semibold text-slate-700">No hay documentos con este criterio</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(d => {
      return `
        <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between gap-2 mb-2">
              <span class="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                ${escapeHtml(d.tipo)}
              </span>
              <span class="text-xs text-slate-400 font-mono">${escapeHtml(d.version)}</span>
            </div>

            <h4 class="text-sm font-bold text-slate-900 leading-snug">${escapeHtml(d.titulo)}</h4>

            <div class="mt-2 space-y-1 text-xs text-slate-600">
              <div><span class="text-slate-400">Expediente:</span> <span class="font-mono font-medium">${escapeHtml(d.expediente || '-')}</span></div>
              <div><span class="text-slate-400">Patrocinado:</span> <span class="font-medium">${escapeHtml(d.cliente || '-')}</span></div>
              <div><span class="text-slate-400">Fecha:</span> <span>${escapeHtml(d.fecha)}</span></div>
            </div>

            <div class="mt-2.5">
              <span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <i class="fa-solid fa-stamp text-[10px] mr-1"></i> ${escapeHtml(d.estado)}
              </span>
            </div>
          </div>

          <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <button onclick="window.app.previewDocument(${jsStr(d.id)})" class="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded transition">
              <i class="fa-solid fa-eye text-blue-600"></i> Leer Escrito
            </button>

            <div class="flex items-center gap-1">
              <button onclick="window.app.editDocument(${jsStr(d.id)})" class="text-slate-400 hover:text-blue-600 p-1.5 transition" title="Editar"><i class="fa-solid fa-pen-to-square"></i></button>
              <button onclick="window.app.deleteDocument(${jsStr(d.id)})" class="text-slate-400 hover:text-red-600 p-1.5 transition" title="Eliminar"><i class="fa-solid fa-trash-can"></i></button>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  previewDocument(id) {
    const doc = window.db.get("documentos").find(d => d.id === id);
    if (!doc) return;
    this.currentPreviewDoc = doc;

    document.getElementById("previewDocTitle").textContent = doc.titulo;
    document.getElementById("previewDocMeta").textContent = `${doc.tipo} | PAOLO ALDEA & ABOGADOS | Versión: ${doc.version} | ${doc.fecha}`;
    document.getElementById("previewDocBody").textContent = doc.contenido || "(Sin contenido redactado)";

    this.showModal("modalPreviewDoc");
  }

  copyPreviewDoc() {
    if (this.currentPreviewDoc && this.currentPreviewDoc.contenido) {
      navigator.clipboard.writeText(this.currentPreviewDoc.contenido).then(() => {
        this.showToast("Contenido copiado al portapapeles", "success");
      });
    }
  }

  openDocumentModal(id = null) {
    this.editingId = id;
    const form = document.getElementById("formDocumento");
    if (form) form.reset();

    const titleEl = document.getElementById("modalDocumentoTitle");

    if (id) {
      if (titleEl) titleEl.textContent = "Editar Documento Legal";
      const item = window.db.get("documentos").find(i => i.id === id);
      if (item) {
        if (document.getElementById("docTitulo")) document.getElementById("docTitulo").value = item.titulo;
        if (document.getElementById("docTipo")) document.getElementById("docTipo").value = item.tipo;
        if (document.getElementById("docExpediente")) document.getElementById("docExpediente").value = item.expediente || "";
        if (document.getElementById("docCliente")) document.getElementById("docCliente").value = item.cliente || "";
        if (document.getElementById("docMateria")) document.getElementById("docMateria").value = item.materia || "Civil";
        if (document.getElementById("docFecha")) document.getElementById("docFecha").value = item.fecha;
        if (document.getElementById("docVersion")) document.getElementById("docVersion").value = item.version || "v1.0";
        if (document.getElementById("docEstado")) document.getElementById("docEstado").value = item.estado;
        if (document.getElementById("docContenido")) document.getElementById("docContenido").value = item.contenido || "";
        if (document.getElementById("docSede")) document.getElementById("docSede").value = window.db.normalizeSede(item.sede || "challhuahuacho");
      }
    } else {
      if (titleEl) titleEl.textContent = "Nuevo Escrito o Contrato — PAOLO ALDEA & ABOGADOS";
      if (document.getElementById("docFecha")) document.getElementById("docFecha").value = getRelativeDateOnlyStr(0);
      const active = window.db ? window.db.getActiveSede() : "challhuahuacho";
      if (document.getElementById("docSede")) document.getElementById("docSede").value = active === "todas" ? "challhuahuacho" : active;
    }

    if (document.getElementById("docSede")) {
      document.getElementById("docSede").disabled = !(window.db && window.db.isGlobalAdmin());
    }

    this.showModal("modalDocumento");
  }

  saveDocumento(e) {
    if (e) e.preventDefault();
    try {
      const data = {
        sede: getSafeVal("docSede", window.db ? window.db.getActiveSede() : "challhuahuacho"),
        titulo: getSafeVal("docTitulo", "Documento Legal"),
        tipo: getSafeVal("docTipo", "Escrito Judicial"),
        expediente: getSafeVal("docExpediente", "-"),
        cliente: getSafeVal("docCliente", "-"),
        materia: getSafeVal("docMateria", "Civil / Comercial"),
        fecha: getSafeVal("docFecha", getRelativeDateOnlyStr(0)),
        version: getSafeVal("docVersion", "v1.0"),
        estado: getSafeVal("docEstado", "Borrador"),
        contenido: getSafeVal("docContenido", "")
      };

      if (this.editingId) {
        const updated = window.db.update("documentos", this.editingId, data);
        if (!updated) {
          this.showToast("No se pudo actualizar el documento. Verifique permisos.", "error");
          return;
        }
        this.showToast("Documento actualizado correctamente", "success");
      } else {
        data.id = window.generateUniqueId("DOC");
        const created = window.db.add("documentos", data);
        if (!created) {
          this.showToast("No se pudo guardar el documento. Verifique permisos o reintente.", "error");
          return;
        }
        this.showToast("Nuevo documento legal guardado", "success");
      }

      this.closeModal("modalDocumento");
      this.renderDocumentos();
      window.kpiDashboard.refresh();
    } catch (err) {
      console.error("Error al guardar documento:", err);
      alert("Error al guardar Documento: " + err.message);
    }
  }

  editDocument(id) {
    if (window.db && !window.db._rbacCheck("documentos", "update", id)) return;
    this.openDocumentModal(id);
  }

  deleteDocument(id) {
    if (window.db && !window.db._rbacCheck("documentos", "delete", id)) return;
    if (confirm("¿Desea eliminar este documento de la base de datos?")) {
      const ok = window.db.delete("documentos", id);
      if (!ok) {
        this.showToast("No se pudo eliminar el documento.", "error");
        return;
      }
      this.renderDocumentos();
      window.kpiDashboard.refresh();
      this.showToast("Documento eliminado", "info");
    }
  }

  // =========================================================================
  // 6. CALCULADORA LEGAL Y ARANCELARIA RÁPIDA
  // =========================================================================
  openCalculadoraModal() {
    this.showModal("modalCalculadora");
    this.recalcularTasas();
  }

  recalcularTasas() {
    const urpValue = 515.00;
    const cuantiaVal = getSafeNum("calcCuantia", 0);
    const pctExito = getSafeNum("calcPctExito", 15);

    const honorarioEstimado = (cuantiaVal * pctExito) / 100;
    const urpsCount = cuantiaVal / urpValue;
    let arancelEstimado = 51.50;
    if (urpsCount > 50) arancelEstimado = 103.00;
    if (urpsCount > 100) arancelEstimado = 206.00;
    if (urpsCount > 250) arancelEstimado = 360.50;

    const elHon = document.getElementById("calcResHonorario");
    const elArancel = document.getElementById("calcResArancel");
    const elUrps = document.getElementById("calcResUrps");

    if (elHon) elHon.textContent = `S/ ${honorarioEstimado.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
    if (elArancel) elArancel.textContent = `S/ ${arancelEstimado.toFixed(2)}`;
    if (elUrps) elUrps.textContent = `${urpsCount.toFixed(1)} URPs`;
  }

  // =========================================================================
  // 7. AJUSTES, BACKUP Y RESTORE
  // =========================================================================
  saveSettings(e) {
    if (e) e.preventDefault();
    try {
      const current = window.db.getSettings();
      const activeSedeKey = window.db ? window.db.getActiveSede() : "challhuahuacho";
      const newSettings = {
        ...current,
        firmName: getSafeVal("cfgFirmName", "PAOLO ALDEA & ABOGADOS"),
        firmBranch: getSafeVal("cfgFirmBranch", "Sede Challhuahuacho - Cotabambas, Apurímac"),
        managingAttorney: getSafeVal("cfgManagingAttorney", "Dr. Paolo Aldea Quincho"),
        firmLicense: getSafeVal("cfgFirmLicense", "CAL / CAA - Registro Profesional"),
        adminOfficer: getSafeVal("cfgAdminOfficer", "Ing. Yimer Damián Soto"),
        adminTitle: getSafeVal("cfgAdminTitle", "Ingeniería Industrial"),
        firmAddress: getSafeVal("cfgFirmAddress", "Av. Los Mineros Mz. D Lt. 4, Challhuahuacho"),
        firmPhone: getSafeVal("cfgFirmPhone", "+51 943 410 215"),
        currency: getSafeVal("cfgCurrency", "S/")
      };

      if (window.SEDES_CONFIG && window.SEDES_CONFIG[activeSedeKey]) {
        window.SEDES_CONFIG[activeSedeKey].nombre = newSettings.firmBranch;
        window.SEDES_CONFIG[activeSedeKey].direccion = newSettings.firmAddress;
        window.SEDES_CONFIG[activeSedeKey].telefono = newSettings.firmPhone;
        try {
          localStorage.setItem("PAOLO_ALDEA_SEDES_CUSTOM", JSON.stringify(window.SEDES_CONFIG));
          if (window.db && typeof window.db.saveCustomSedes === "function") {
            window.db.saveCustomSedes(Object.values(window.SEDES_CONFIG));
          }
        } catch(e) {}
      }

      window.db.saveSettings(newSettings);
      document.querySelectorAll(".firm-name-display").forEach(el => el.textContent = newSettings.firmName);
      document.querySelectorAll(".firm-branch-display").forEach(el => el.textContent = newSettings.firmBranch);
      document.querySelectorAll(".firm-attorney-display").forEach(el => el.textContent = newSettings.managingAttorney);
      document.querySelectorAll(".firm-license-display").forEach(el => el.textContent = newSettings.firmLicense);
      document.querySelectorAll(".admin-officer-display").forEach(el => el.textContent = newSettings.adminOfficer);
      document.querySelectorAll(".admin-title-display").forEach(el => el.textContent = newSettings.adminTitle);

      this.applySettingsToUI();
      this.renderMasterSedes();
      if (typeof this.renderSedeSelector === 'function') this.renderSedeSelector();
      if (typeof this.applySedeToHeader === 'function') this.applySedeToHeader();
      if (typeof this.renderDynamicSidebarModules === 'function') this.renderDynamicSidebarModules();
      this.showToast("Configuraciones de Sede guardadas con éxito", "success");
      if (window.kpiDashboard) window.kpiDashboard.refresh();
    } catch (err) {
      console.error("Error al guardar ajustes:", err);
      alert("Error al guardar ajustes: " + err.message);
    }
  }

    copiarUrlPowerBI() {
    const port = window.__LOCAL_SERVER_PORT__ || window.location.port || "8080";
    const token = window.__LOCAL_SERVER_API_KEY__ || sessionStorage.getItem("PA_LOCAL_API_TOKEN") || "";
    const url = window.__POWER_BI_URL__ || `${window.location.protocol}//${window.location.hostname}:${port}/api/powerbi/dataset`;
    const hint = token
      ? `${url}\n\nAutenticacion (Header):\nAuthorization: Bearer ${token}\n\nEl token ya no viaja en la URL (seguridad Semana 1).`
      : `${url}\n\nEmpareje la sesion local (abrir_app.bat) para obtener el Bearer.`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(hint).then(() => {
        this.showToast("URL Power BI + cabecera Bearer copiados (sin token en query).", "success");
      }).catch(() => {
        prompt("Power BI — URL y cabecera Authorization:", hint);
      });
    } else {
      prompt("Power BI — URL y cabecera Authorization:", hint);
    }
  }

  async triggerServerBackup() {
    this.showToast("Iniciando snapshot de respaldo en servidor local...", "info");
    try {
      const token = window.__LOCAL_SERVER_API_KEY__ || sessionStorage.getItem("PA_LOCAL_API_TOKEN") || "";
      const headers = token ? { "Authorization": `Bearer ${token}` } : {};
      const resp = await fetch("/api/backup", { method: "POST", headers, credentials: "same-origin" });
      if (resp.ok) {
        const data = await resp.json();
        this.showToast(`Snapshot seguro creado: ${data.snapshot}`, "success");
      } else {
        throw new Error("HTTP " + resp.status);
      }
    } catch (e) {
      console.warn("Fallo respaldo via API local, usando exportación JSON:", e);
      this.exportBackupJson();
    }
  }

  async exportBackupJson() {
    this.showToast("Generando copia de seguridad consolidada con expedientes...", "info");
    const res = await window.db.exportAllDataJson();
    const pdfMsg = (res && res.pdfCount > 0) ? ` (${res.pdfCount} expedientes PDF incluidos)` : "";
    this.showToast(`¡Copia de seguridad completa descargada${pdfMsg}!`, "success");
  }

  importBackupJson(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      this.showToast("Restaurando datos y expedientes de la copia...", "info");
      const res = await window.db.importDataJson(e.target.result);
      if (res.success) {
        this.applySettingsToUI();
    if (typeof this.renderDynamicSidebarModules === 'function') this.renderDynamicSidebarModules();
        window.alerts.evaluateAlerts();
        this.switchTab(this.currentTab);
        const pdfMsg = (res.restoredPdfCount > 0) ? ` y ${res.restoredPdfCount} archivos PDF` : "";
        this.showToast(`¡Datos restaurados con éxito${pdfMsg}!`, "success");
      } else {
        alert("Error al importar archivo JSON: " + res.error);
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  clearAllData() {
    if (confirm("¿Está seguro de que desea eliminar todos los ejemplos y vaciar las tablas (Caja Chica, Casos, Citas, Inventario y Documentos)?\n\nEl sistema quedará completamente en blanco y limpio para su uso personal y profesional.")) {
      window.db.clearAllOperationalData();
      this.applySettingsToUI();
    if (typeof this.renderDynamicSidebarModules === 'function') this.renderDynamicSidebarModules();
      window.alerts.evaluateAlerts();
      this.switchTab(this.currentTab);
      window.kpiDashboard.refresh();
      this.showToast("Tablas vaciadas con éxito. Sistema listo en blanco para su uso.", "success");
    }
  }

  loadDemoData() {
    this.showToast("El sistema se encuentra configurado en Modo Producción en Blanco para uso real.", "info");
  }

  resetAllData() {
    this.clearAllData();
  }

  // =========================================================================
  // MODALES & TOASTS
  // =========================================================================
  async showModal(modalId) {
    try {
      if (window.componentLoader && typeof window.componentLoader.ensureModalsLoaded === "function") {
        await window.componentLoader.ensureModalsLoaded();
      }
      const modal = document.getElementById(modalId);
      if (!modal) {
        console.warn("[showModal] Modal no encontrado:", modalId);
        return false;
      }
      this._lastFocusedElementBeforeModal = document.activeElement;
      this.activeModal = modalId;
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      if (!modal.getAttribute("aria-label")) {
        const heading = modal.querySelector("h2, h3, h4");
        if (heading && heading.textContent) {
          modal.setAttribute("aria-label", heading.textContent.trim());
        }
      }
      modal.classList.remove("hidden");
      modal.classList.add("flex");

      // Enfocar automáticamente el primer campo interactivo (Accesibilidad WCAG 2.1 AA)
      setTimeout(() => {
        const firstInput = modal.querySelector('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])');
        if (firstInput && typeof firstInput.focus === "function") {
          firstInput.focus();
        }
      }, 60);

      // Verificar si existe borrador autoguardado para restaurar
      if (window.draftAutosave && typeof window.draftAutosave.checkAndPromptRestore === "function") {
        try {
          window.draftAutosave.checkAndPromptRestore(modalId, !!this.editingId);
        } catch (draftErr) {
          console.warn("[showModal] draft restore:", draftErr);
        }
      }

      if (!modal.dataset.backdropConfigured) {
        modal.dataset.backdropConfigured = "true";
        modal.addEventListener("click", (e) => {
          if (e.target === modal) {
            this.closeModal(modalId);
          }
        });
      }
      return true;
    } catch (err) {
      console.error("[showModal]", modalId, err);
      this.showToast("No se pudo abrir el formulario. Intente de nuevo o recargue la página.", "error");
      return false;
    }
  }

  async openModal(modalId) {
    await this.showModal(modalId);
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    if (this.activeModal === modalId) {
      this.activeModal = null;
    }
    if (modalId === "modalCaso" || modalId === "modalCajaChica" || modalId === "modalCita" || modalId === "modalInventario" || modalId === "modalDocumento" || modalId === "modalPresupuesto" || modalId === "modalEjecutarPresupuesto") {
      this.editingId = null;
      this.editingPresupuestoId = null;
    }
    if (modalId === "modalCaso") {
      this.pendingCasoPdfFile = null;
      this.pendingExpedientePdfFile = null;
      this.pendingResolucionPdfFile = null;
      this.removePdfFlag = false;
      this.removeExpedientePdfFlag = false;
      this.removeResolucionPdfFlag = false;
    }
    if (modalId === "modalPdfViewer") {
      const frame = document.getElementById("pdfViewerFrame");
      if (frame) frame.src = "about:blank";
    }
    if (modalId === "modalWhatsAppCita") {
      this.currentWaCitaId = null;
    }
    if (modalId === "modalCargarResolucionRapida") {
      this.pendingRapidaPdfFile = null;
    }
    if (this._lastFocusedElementBeforeModal && typeof this._lastFocusedElementBeforeModal.focus === "function") {
      try {
        this._lastFocusedElementBeforeModal.focus();
      } catch (_) {}
      this._lastFocusedElementBeforeModal = null;
    }
  }

  closeAllModals() {
    document.querySelectorAll(".modal-container").forEach(m => {
      m.classList.add("hidden");
      m.classList.remove("flex");
    });
    this.activeModal = null;
    this.editingId = null;
  }

  /**
   * Confirmación institucional (reemplaza window.confirm nativo).
   * options: { title, message, detail, confirmLabel, cancelLabel, danger }
   */
  ensureAppConfirmModal() {
    let modal = document.getElementById("modalAppConfirm");
    if (modal && document.getElementById("btnAppConfirmOk") && document.getElementById("btnAppConfirmCancel")) {
      return modal;
    }
    if (modal) modal.remove();
    modal = document.createElement("div");
    modal.id = "modalAppConfirm";
    modal.className = "modal-container hidden fixed inset-0 z-[10060] items-center justify-center p-4";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.style.background = "rgba(8, 12, 24, 0.82)";
    modal.style.backdropFilter = "blur(10px)";
    modal.innerHTML = `
      <div class="app-confirm-sheet relative w-full max-w-md rounded-2xl border border-amber-500/40 bg-slate-950 shadow-2xl overflow-hidden text-slate-100">
        <div class="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-600 via-rose-500 to-amber-600"></div>
        <div class="px-5 pt-5 pb-3.5 border-b border-slate-800/90 bg-gradient-to-r from-slate-950 via-slate-900 to-rose-950/30 flex items-start gap-3">
          <span id="modalAppConfirmIcon" class="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-400/40 text-rose-400 flex items-center justify-center shrink-0 shadow-inner text-lg"><i class="fa-solid fa-trash-can"></i></span>
          <div class="min-w-0 flex-1 pt-0.5">
            <p id="modalAppConfirmSubtitle" class="text-[10px] uppercase tracking-[0.16em] text-amber-400/90 font-bold">Paolo Aldea &amp; Abogados · Control seguro</p>
            <h3 id="modalAppConfirmTitle" class="text-base font-extrabold tracking-wide text-white mt-0.5">Confirmar acción</h3>
          </div>
          <button type="button" id="btnAppConfirmClose" class="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition" aria-label="Cerrar"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="px-5 py-4 space-y-3">
          <p id="modalAppConfirmMessage" class="text-xs sm:text-sm leading-relaxed text-slate-300"></p>
          <div id="modalAppConfirmDetail" class="hidden rounded-xl border border-amber-500/35 bg-gradient-to-br from-slate-900 to-slate-950 px-3.5 py-3">
            <p class="text-[10px] uppercase tracking-wider text-amber-400/90 font-bold mb-1">Registro afectado</p>
            <p id="modalAppConfirmDetailText" class="text-xs font-semibold text-slate-100 break-words"></p>
          </div>
        </div>
        <div class="px-5 py-3.5 border-t border-slate-800 bg-slate-950/95 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button type="button" id="btnAppConfirmCancel" class="min-h-[46px] px-4 py-2 rounded-xl text-xs font-bold border border-slate-600 text-slate-200 hover:bg-slate-900 transition">Cancelar</button>
          <button type="button" id="btnAppConfirmOk" class="min-h-[46px] px-4 py-2 rounded-xl text-xs font-extrabold bg-rose-600 hover:bg-rose-500 text-white border border-rose-400 shadow-md transition inline-flex items-center justify-center gap-2"><i class="fa-solid fa-trash-can text-[11px]"></i><span>Sí, eliminar</span></button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    return modal;
  }

  confirmAction(options = {}) {
    const opts = typeof options === "string" ? { message: options } : (options || {});
    return new Promise((resolve) => {
      const modal = this.ensureAppConfirmModal();
      const titleEl = document.getElementById("modalAppConfirmTitle");
      const msgEl = document.getElementById("modalAppConfirmMessage");
      const detailBox = document.getElementById("modalAppConfirmDetail");
      const detailText = document.getElementById("modalAppConfirmDetailText");
      const iconWrap = document.getElementById("modalAppConfirmIcon");
      const okBtn = document.getElementById("btnAppConfirmOk");
      const cancelBtn = document.getElementById("btnAppConfirmCancel");
      const closeBtn = document.getElementById("btnAppConfirmClose");

      if (!modal || !okBtn || !cancelBtn) {
        resolve(false);
        return;
      }

      if (titleEl) titleEl.textContent = opts.title || "Confirmar acción";
      if (msgEl) msgEl.textContent = opts.message || "¿Desea continuar?";
      if (detailBox && detailText) {
        if (opts.detail) {
          detailText.textContent = opts.detail;
          detailBox.classList.remove("hidden");
        } else {
          detailBox.classList.add("hidden");
          detailText.textContent = "";
        }
      }
      cancelBtn.textContent = opts.cancelLabel || "Cancelar";
      const danger = opts.danger !== false;
      const iconName = String(opts.icon || (danger ? "fa-trash-can" : "fa-triangle-exclamation")).replace(/[^a-z0-9-]/gi, "");
      if (iconWrap) {
        iconWrap.className = danger
          ? "w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-400/40 text-rose-400 flex items-center justify-center shrink-0 shadow-inner text-lg"
          : "w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-400/40 text-amber-400 flex items-center justify-center shrink-0 shadow-inner text-lg";
        iconWrap.innerHTML = '<i class="fa-solid ' + iconName + '"></i>';
      }
      const subtitleEl = document.getElementById("modalAppConfirmSubtitle");
      if (subtitleEl) {
        subtitleEl.textContent = opts.subtitle || "Paolo Aldea & Abogados · Control seguro";
      }
      const confirmLabel = opts.confirmLabel || (danger ? "Sí, eliminar" : "Confirmar");
      okBtn.innerHTML = danger
        ? '<i class="fa-solid fa-trash-can text-[11px]"></i><span>' + confirmLabel + "</span>"
        : "<span>" + confirmLabel + "</span>";
      okBtn.className = danger
        ? "min-h-[46px] px-4 py-2 rounded-xl text-xs font-extrabold bg-rose-600 hover:bg-rose-500 text-white border border-rose-400 shadow-md transition inline-flex items-center justify-center gap-2"
        : "min-h-[46px] px-4 py-2 rounded-xl text-xs font-extrabold bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-300 shadow-md transition inline-flex items-center justify-center gap-2";
      cancelBtn.className = "min-h-[46px] px-4 py-2 rounded-xl text-xs font-bold border border-slate-600 text-slate-200 hover:bg-slate-900 transition";

      const finish = (value) => {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
        modal.style.display = "none";
        okBtn.onclick = null;
        cancelBtn.onclick = null;
        if (closeBtn) closeBtn.onclick = null;
        modal.onclick = null;
        document.removeEventListener("keydown", onKey);
        resolve(!!value);
      };

      const onKey = (ev) => {
        if (ev.key === "Escape") finish(false);
      };

      okBtn.onclick = () => finish(true);
      cancelBtn.onclick = () => finish(false);
      if (closeBtn) closeBtn.onclick = () => finish(false);
      modal.onclick = (ev) => {
        if (ev.target === modal) finish(false);
      };
      document.addEventListener("keydown", onKey);

      modal.classList.remove("hidden");
      modal.classList.add("flex");
      modal.style.display = "flex";
      modal.style.zIndex = "10060";
      try {
        okBtn.focus();
      } catch (_) {}
    });
  }

  showToast(message, type = "success", durationMs = null) {
    if (typeof message === "string") {
      message = message
        .replace(/\u00C3\u00A1/g, "\u00E1")
        .replace(/\u00C3\u00A9/g, "\u00E9")
        .replace(/\u00C3\u00AD/g, "\u00ED")
        .replace(/\u00C3\u00B3/g, "\u00F3")
        .replace(/\u00C3\u00BA/g, "\u00FA")
        .replace(/\u00C3\u00B1/g, "\u00F1")
        .replace(/\u00C3\u0081/g, "\u00C1")
        .replace(/\u00C3\u0089/g, "\u00C9")
        .replace(/\u00C3\u008D/g, "\u00CD")
        .replace(/\u00C3\u0093/g, "\u00D3")
        .replace(/\u00C3\u009A/g, "\u00DA")
        .replace(/\u00C3\u0091/g, "\u00D1")
        .replace(/\u00C2\u00A1/g, "\u00A1")
        .replace(/\u00C2\u00BF/g, "\u00BF")
        .replace(/\u00C2/g, "")
        .replace(/guardad[^\s]*as/gi, "guardadas")
        .replace(/[^\s]*xito/gi, "\u00E9xito");
    }
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    const icons = {
      success: "fa-circle-check text-emerald-400",
      info: "fa-circle-info text-blue-400",
      warning: "fa-triangle-exclamation text-amber-400",
      error: "fa-circle-xmark text-rose-400"
    };
    const durations = { success: 3500, info: 4000, warning: 5500, error: 7000 };
    const ttl = typeof durationMs === "number" && durationMs >= 0
      ? durationMs
      : (durations[type] != null ? durations[type] : 4000);

    toast.className = "toast-enter bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-start gap-3 border border-slate-700 text-sm max-w-sm pointer-events-auto";
    toast.setAttribute("role", "status");
    const iconEl = document.createElement("i");
    iconEl.className = `fa-solid ${icons[type] || icons.info} text-lg mt-0.5 shrink-0`;
    const textEl = document.createElement("div");
    textEl.className = "flex-1 font-medium leading-snug";
    textEl.textContent = String(message == null ? "" : message);
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "shrink-0 w-8 h-8 -mr-1 -mt-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center touch-manipulation";
    closeBtn.setAttribute("aria-label", "Cerrar notificación");
    closeBtn.innerHTML = '<i class="fa-solid fa-xmark text-sm"></i>';

    let closed = false;
    let hideTimer = null;
    const dismiss = () => {
      if (closed) return;
      closed = true;
      if (hideTimer) clearTimeout(hideTimer);
      toast.style.opacity = "0";
      toast.style.transform = "translateX(100%)";
      toast.style.transition = "all 0.3s ease-in";
      setTimeout(() => toast.remove(), 300);
    };
    closeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      dismiss();
    });

    toast.appendChild(iconEl);
    toast.appendChild(textEl);
    toast.appendChild(closeBtn);
    container.appendChild(toast);

    // Pausar auto-cierre al pasar el mouse / tocar (móvil).
    const armTimer = () => {
      if (closed || ttl <= 0) return;
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(dismiss, ttl);
    };
    toast.addEventListener("mouseenter", () => { if (hideTimer) clearTimeout(hideTimer); });
    toast.addEventListener("mouseleave", armTimer);
    toast.addEventListener("touchstart", () => { if (hideTimer) clearTimeout(hideTimer); }, { passive: true });
    armTimer();
  }

  // =========================================================================
  // SISTEMA DE SEGURIDAD & BLOQUEO EXCLUSIVO: RECARGA DE PÁGINA (F5/RELOAD) O APAGADO/BLOQUEO DE PANTALLA MÓVIL
  // =========================================================================

  /**
   * Detecta de forma determinista si la carga actual de la página corresponde a una recarga (F5 / Ctrl+R / Reload)
   */
  isPageReloadNavigation() {
    try {
      if (window.performance && typeof window.performance.getEntriesByType === "function") {
        const navEntries = window.performance.getEntriesByType("navigation");
        if (navEntries && navEntries.length > 0 && navEntries[0].type) {
          return navEntries[0].type === "reload";
        }
      }
      if (window.performance && window.performance.navigation) {
        return window.performance.navigation.type === 1; // TYPE_RELOAD
      }
    } catch (e) {}
    return false;
  }

  /**
   * Verifica si existe una sesión activa válida (flag + firma + usuario resuelto en nómina)
   */
  isSessionActive() {
    const flagged =
      sessionStorage.getItem("PAOLO ALDEA_AUTH_LOGGED_IN") === "true" ||
      localStorage.getItem("PAOLO ALDEA_AUTH_LOGGED_IN") === "true";
    if (!flagged) return false;
    if (!window.db || typeof window.db.getCurrentUser !== "function") return false;
    return !!window.db.getCurrentUser();
  }

  /**
   * Limpia las claves de sesión activa en sessionStorage y localStorage
   */
  clearSessionStorageState() {
    sessionStorage.removeItem("PAOLO ALDEA_AUTH_LOGGED_IN");
    sessionStorage.removeItem("PAOLO ALDEA_AUTH_USER_OBJ");
    sessionStorage.removeItem("PAOLO ALDEA_AUTH_USER");
    sessionStorage.removeItem("PAOLO ALDEA_AUTH_SIG");
    sessionStorage.removeItem("PAOLO ALDEA_ACTIVE_SEDE");
    localStorage.removeItem("PAOLO ALDEA_AUTH_LOGGED_IN");
    localStorage.removeItem("PAOLO ALDEA_AUTH_USER_OBJ");
    localStorage.removeItem("PAOLO ALDEA_AUTH_USER");
    localStorage.removeItem("PAOLO ALDEA_AUTH_SIG");
    localStorage.removeItem("PAOLO ALDEA_AUTH_REMEMBERED");
    localStorage.removeItem("PAOLO_ALDEA_LAST_ACTIVITY");
    if (window.db && typeof window.db.setCurrentUser === "function") {
      try { window.db.setCurrentUser(null); } catch (_) {}
    }
  }

  /**
   * Inicializa el ciclo de vida de la sesión al arrancar el documento:
   * - Si el usuario recargó la página (reload / F5 / Ctrl+R), bloquea de inmediato la sesión y exige login.
   * - Si abrió una nueva pestaña/ventana (navigate) y existe una sesión activa previa,
   *   hidrata la sesión automáticamente permitiendo navegación multipestaña/multiventana fluida.
   */
  initSessionLifecycle() {
    const isReload = this.isPageReloadNavigation();

    if (isReload) {
      this._lockedByReason = "reload";
      this.clearSessionStorageState();
      this.broadcastSessionEvent("SESSION_LOCK", { reason: "reload" });
      return;
    }

    // Si no es recarga (ej. apertura de nueva pestaña o ventana del navegador), verificar sesión compartida
    const sharedLoggedIn = localStorage.getItem("PAOLO ALDEA_AUTH_LOGGED_IN") === "true";
    const sharedSig = localStorage.getItem("PAOLO ALDEA_AUTH_SIG");

    if (sharedLoggedIn && sharedSig) {
      // Hidratar sessionStorage en la nueva pestaña/ventana para soporte multipestaña transparente
      sessionStorage.setItem("PAOLO ALDEA_AUTH_LOGGED_IN", "true");
      const userObjStr = localStorage.getItem("PAOLO ALDEA_AUTH_USER_OBJ");
      const userStr = localStorage.getItem("PAOLO ALDEA_AUTH_USER");
      const sedeStr = localStorage.getItem("PAOLO ALDEA_ACTIVE_SEDE");
      if (userObjStr) sessionStorage.setItem("PAOLO ALDEA_AUTH_USER_OBJ", userObjStr);
      if (userStr) sessionStorage.setItem("PAOLO ALDEA_AUTH_USER", userStr);
      if (sedeStr) sessionStorage.setItem("PAOLO ALDEA_ACTIVE_SEDE", sedeStr);
      sessionStorage.setItem("PAOLO ALDEA_AUTH_SIG", sharedSig);
      // Si la firma/nómina no validan, forzar login (p. ej. post-borrón de credenciales)
      if (window.db && typeof window.db.getCurrentUser === "function" && !window.db.getCurrentUser()) {
        this.clearSessionStorageState();
      }
    } else {
      this.clearSessionStorageState();
    }
  }

  /**
   * Emite eventos de sincronización de sesión entre pestañas y ventanas abiertas del mismo navegador
   */
  broadcastSessionEvent(type, payload = {}) {
    try {
      if (this._sessionChannel) {
        this._sessionChannel.postMessage({
          type,
          timestamp: Date.now(),
          ...payload
        });
      }
    } catch (e) {}
  }

  /**
   * Configura la seguridad de sesión:
   * - Bloqueo automático por recarga de página (F5/Reload).
   * - Bloqueo inmediato cuando la pantalla del celular se apaga o se bloquea (visibilityState === "hidden" en dispositivos táctiles/móviles).
   * - Eliminado el temporizador de 3 minutos de inactividad a petición del usuario.
   */
  setupScreenLockSecurity() {
    if (this._screenLockBound) return;
    this._screenLockBound = true;

    // 1. Canal de sincronización en tiempo real entre pestañas y ventanas
    if (typeof BroadcastChannel !== "undefined") {
      try {
        this._sessionChannel = new BroadcastChannel("paolo_aldea_session_sync");
        this._sessionChannel.onmessage = (event) => {
          const msg = event.data;
          if (!msg || !msg.type) return;

          if (msg.type === "SESSION_LOCK") {
            // No tumbar un login en curso (p. ej. otra pestaña hizo F5 a la vez).
            if (this._establishingSession) return;
            if (this.isSessionActive() || !document.getElementById("loginOverlay")?.classList.contains("flex")) {
              this.lockScreen(true, msg.reason || "remote_lock", true);
            }
          } else if (msg.type === "SESSION_LOGIN") {
            if (this._establishingSession) return;
            const userObjStr = localStorage.getItem("PAOLO ALDEA_AUTH_USER_OBJ");
            const userStr = localStorage.getItem("PAOLO ALDEA_AUTH_USER");
            const sig = localStorage.getItem("PAOLO ALDEA_AUTH_SIG");
            sessionStorage.setItem("PAOLO ALDEA_AUTH_LOGGED_IN", "true");
            if (userObjStr) sessionStorage.setItem("PAOLO ALDEA_AUTH_USER_OBJ", userObjStr);
            if (userStr) sessionStorage.setItem("PAOLO ALDEA_AUTH_USER", userStr);
            if (sig) sessionStorage.setItem("PAOLO ALDEA_AUTH_SIG", sig);
            if (!this.isSessionActive() || !window.db.getCurrentUser()) {
              // Solo limpiar sessionStorage de ESTA pestaña. Nunca borrar localStorage
              // compartido: eso dispara storage→remote_lock y tumba el login origen.
              sessionStorage.removeItem("PAOLO ALDEA_AUTH_LOGGED_IN");
              sessionStorage.removeItem("PAOLO ALDEA_AUTH_USER_OBJ");
              sessionStorage.removeItem("PAOLO ALDEA_AUTH_USER");
              sessionStorage.removeItem("PAOLO ALDEA_AUTH_SIG");
              sessionStorage.removeItem("PAOLO ALDEA_ACTIVE_SEDE");
              return;
            }
            this.hideLoginOverlay();
            this.applySettingsToUI();
            if (typeof this.renderDynamicSidebarModules === "function") this.renderDynamicSidebarModules();
            this.refreshCurrentModuleView();
          }
        };
      } catch (e) {
        console.warn("[SessionSync] BroadcastChannel no disponible, usando fallback storage:", e);
      }
    }

    // 2. Fallback universal de sincronización multipestaña vía evento storage
    window.addEventListener("storage", (e) => {
      if (e.key === "PAOLO ALDEA_AUTH_LOGGED_IN") {
        if (e.newValue === "true") {
          if (this._establishingSession) return;
          sessionStorage.setItem("PAOLO ALDEA_AUTH_LOGGED_IN", "true");
          const userObjStr = localStorage.getItem("PAOLO ALDEA_AUTH_USER_OBJ");
          const sig = localStorage.getItem("PAOLO ALDEA_AUTH_SIG");
          if (userObjStr) sessionStorage.setItem("PAOLO ALDEA_AUTH_USER_OBJ", userObjStr);
          if (sig) sessionStorage.setItem("PAOLO ALDEA_AUTH_SIG", sig);
          if (!this.isSessionActive() || !window.db.getCurrentUser()) {
            sessionStorage.removeItem("PAOLO ALDEA_AUTH_LOGGED_IN");
            sessionStorage.removeItem("PAOLO ALDEA_AUTH_USER_OBJ");
            sessionStorage.removeItem("PAOLO ALDEA_AUTH_USER");
            sessionStorage.removeItem("PAOLO ALDEA_AUTH_SIG");
            return;
          }
          this.hideLoginOverlay();
          this.applySettingsToUI();
        } else if (!e.newValue) {
          if (this._establishingSession) return;
          this.lockScreen(true, "remote_lock", true);
        }
      }
    });

    // 3. Detección precisa de bloqueo o apagado de pantalla en Celular / Móvil / Tablet
    const isMobileDevice = () => {
      return (
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        (window.matchMedia && window.matchMedia("(max-width: 820px)").matches) ||
        (navigator.maxTouchPoints && navigator.maxTouchPoints > 1)
      );
    };

    // Al bloquear el celular o apagarse la pantalla, el navegador dispara 'visibilitychange' a hidden
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        if (isMobileDevice() && this.isSessionActive()) {
          // El celular apagó la pantalla, se bloqueó o pasó a segundo plano -> bloquear inmediatamente
          this.lockScreen(true, "screen_off");
        }
      } else if (document.visibilityState === "visible") {
        if (!this.isSessionActive()) {
          this.showLoginOverlay();
        } else {
          if (window.AttendanceModule && typeof window.AttendanceModule.refreshGpsPosition === "function") {
            window.AttendanceModule.refreshGpsPosition();
          }
        }
      }
    });

    // Evento 'pagehide' como respaldo adicional en móviles al bloquear el dispositivo
    window.addEventListener("pagehide", (e) => {
      if (isMobileDevice() && this.isSessionActive()) {
        this.lockScreen(true, "screen_off");
      }
    });
  }

  checkAuthentication() {
    this.updateAuthGateUI();
    const sessionLoggedIn = this.isSessionActive();
    if (sessionLoggedIn) {
      this.hideLoginOverlay();
    } else {
      this.showLoginOverlay();
      const errAlert = document.getElementById("loginErrorAlert");
      const errMsg = document.getElementById("loginErrorMessage");
      if (this._lockedByReason === "reload") {
        if (errAlert && errMsg) {
          errMsg.textContent = "Sesión bloqueada por recarga de página. Ingrese sus credenciales para continuar.";
          errAlert.classList.remove("hidden");
        }
        this._lockedByReason = null;
      } else if (this._lockedByReason === "screen_off") {
        if (errAlert && errMsg) {
          errMsg.textContent = "Dispositivo bloqueado. Ingrese sus credenciales de despacho para continuar.";
          errAlert.classList.remove("hidden");
        }
        this._lockedByReason = null;
      }
    }
  }

  /**
   * Consulta/registra el estado de autenticación en la nube (Modo B).
   * Evita que un celular vacío pida "crear Super Admin" si ya existe en Supabase.
   */
  async syncCloudAuthGate() {
    if (!window.__ENTERPRISE_CLOUD__ || !window.PaoloAuthService) {
      window.__CLOUD_AUTH_BOOTSTRAPPED__ = false;
      return false;
    }
    let status = null;
    try {
      const res = await fetch("/api/auth-firm-status", { credentials: "same-origin" });
      status = await res.json();
    } catch (_) {
      status = null;
    }
    const cloudBoot = status && status.bootstrapped === true;
    window.__CLOUD_AUTH_STATUS__ = status || null;
    if (cloudBoot) {
      window.__CLOUD_AUTH_BOOTSTRAPPED__ = true;
      return true;
    }

    // Si este navegador ya tiene admin local y la nube aún no, publicar registro (una vez)
    const localReady = window.db && typeof window.db.needsAuthBootstrap === "function" && !window.db.needsAuthBootstrap();
    if (localReady) {
      try {
        const workers = window.db.getRaw("workers") || [];
        const admin = workers.find((w) => w && w.activo !== false && (w.rol === "super_admin" || w.id === "WRK-000") && w.passwordHash);
        if (admin) {
          await window.PaoloAuthService.pushCloudBootstrap({
            id: admin.id,
            usuario: admin.usuario || admin.username,
            email: admin.email || "",
            dni: admin.dni || "",
            nombre: admin.nombre,
            cargo: admin.cargo,
            rol: admin.rol || "super_admin",
            sede: admin.sede || "todas",
            passwordHash: admin.passwordHash,
            pinHash: admin.pinHash || "",
            permisos: admin.permisos || null
          });
          window.__CLOUD_AUTH_BOOTSTRAPPED__ = true;
          this.showToast("Super Admin publicado en la nube. Ya puede ingresar desde otros dispositivos.", "success");
          return true;
        }
      } catch (e) {
        console.warn("[Auth] No se pudo publicar admin local a la nube:", e && e.message);
        const detail = (status && status.detail) || "";
        if (detail === "missing_tables") {
          this.showToast("Falta ejecutar el SQL de autenticación en Supabase (firm_auth_registry).", "warning");
        } else if (detail === "missing_service_role") {
          this.showToast("Falta SUPABASE_SERVICE_ROLE_KEY en Netlify.", "warning");
        } else {
          this.showToast("No se pudo sincronizar el admin a la nube: " + (e.message || "error"), "warning");
        }
      }
    } else if (status && (status.detail === "missing_tables" || status.detail === "missing_service_role")) {
      console.warn("[Auth] Nube no lista:", status.detail, status.hint || "");
    }

    window.__CLOUD_AUTH_BOOTSTRAPPED__ = false;
    return false;
  }

  /** true si hay que mostrar el formulario de registro inicial. */
  needsAuthBootstrapUI() {
    const localNeeds = window.db && typeof window.db.needsAuthBootstrap === "function" && window.db.needsAuthBootstrap();
    if (!localNeeds) return false;
    // Si la nube ya tiene admin, nunca pedir bootstrap en un dispositivo vacío
    if (window.__CLOUD_AUTH_BOOTSTRAPPED__) return false;
    return true;
  }

  /** Alterna login vs registro inicial (borrón y cuenta nueva). */
  updateAuthGateUI() {
    const needsBootstrap = this.needsAuthBootstrapUI();
    const loginForm = document.getElementById("formLogin");
    const bootForm = document.getElementById("formBootstrapAdmin");
    const bootBanner = document.getElementById("authBootstrapBanner");
    if (loginForm) loginForm.classList.toggle("hidden", !!needsBootstrap);
    if (bootForm) bootForm.classList.toggle("hidden", !needsBootstrap);
    if (bootBanner) bootBanner.classList.toggle("hidden", !needsBootstrap);
    return needsBootstrap;
  }

  showLoginOverlay() {
    const el = document.getElementById("loginOverlay");
    if (el) {
      el.classList.remove("hidden");
      el.classList.add("flex");
    }
    if (typeof window.updateLoginModeBadge === "function") {
      window.updateLoginModeBadge();
    }
    // Mostrar última sede de uso / consolidado aunque aún no haya sesión
    if (typeof this.applySedeToHeader === "function") this.applySedeToHeader();
    const needsBootstrap = this.updateAuthGateUI();
    const userInput = document.getElementById("loginUsername");
    const passInput = document.getElementById("loginPassword");
    if (userInput) userInput.value = "";
    if (passInput) passInput.value = "";
    const bootUser = document.getElementById("bootstrapUsername");
    const bootPass = document.getElementById("bootstrapPassword");
    const bootConf = document.getElementById("bootstrapPasswordConfirm");
    const bootName = document.getElementById("bootstrapFullName");
    if (bootPass) bootPass.value = "";
    if (bootConf) bootConf.value = "";
    setTimeout(() => {
      if (needsBootstrap) {
        if (bootName) bootName.focus();
        else if (bootUser) bootUser.focus();
      } else if (userInput) {
        userInput.focus();
      }
    }, 150);
  }

  hideLoginOverlay() {
    const el = document.getElementById("loginOverlay");
    if (el) {
      el.classList.add("hidden");
      el.classList.remove("flex");
    }
    try {
      if (window.AttendanceModule && typeof window.AttendanceModule.updateAnchorOfficeVisibility === "function") {
        window.AttendanceModule.updateAnchorOfficeVisibility();
      }
    } catch (_) {}
  }

  /** Politica de claves: minimo 10 caracteres, no solo digitos, no triviales. */
  _validatePasswordPolicy(pw) {
    if (!pw || pw.length < 10) return "La contrasena debe tener al menos 10 caracteres.";
    if (/^\d+$/.test(pw)) return "La contrasena no puede ser solo numerica.";
    if (/^(.)\1+$/.test(pw) || /(password|contrasena|12345|qwerty|admin|aldea)/i.test(pw)) return "La contrasena es demasiado predecible. Use una frase larga y unica.";
    return "";
  }

  _loginGuardLoad() {
    try { return JSON.parse(localStorage.getItem("PA_LOGIN_GUARD") || "{}"); } catch (e) { return {}; }
  }
  /** Milisegundos restantes de bloqueo (persistente: sobrevive a recargas de pagina). */
  _loginGuardRemaining() {
    const g = this._loginGuardLoad();
    return g.lockUntil && g.lockUntil > Date.now() ? g.lockUntil - Date.now() : 0;
  }
  /** Registra un fallo; cada 5 fallos bloquea con retroceso exponencial (30 s, 60 s, 120 s ... max. 15 min). */
  _loginGuardFail() {
    const g = this._loginGuardLoad();
    g.fails = (g.fails || 0) + 1;
    let lockMs = 0;
    if (g.fails >= 5) {
      g.locks = (g.locks || 0) + 1;
      lockMs = Math.min(15 * 60 * 1000, 30000 * Math.pow(2, g.locks - 1));
      g.lockUntil = Date.now() + lockMs;
      g.fails = 0;
    }
    localStorage.setItem("PA_LOGIN_GUARD", JSON.stringify(g));
    return { fails: g.fails, lockMs };
  }
  _loginGuardReset() { localStorage.removeItem("PA_LOGIN_GUARD"); }

  async completeAuthBootstrap(e) {
    if (e) e.preventDefault();
    const errAlert = document.getElementById("loginErrorAlert");
    const errMsg = document.getElementById("loginErrorMessage");
    const showErr = (msg) => {
      if (errAlert && errMsg) {
        errMsg.textContent = msg;
        errAlert.classList.remove("hidden");
      } else {
        this.showToast(msg, "error");
      }
    };

    if (!this.needsAuthBootstrapUI()) {
      showErr("El sistema ya tiene un administrador registrado. Use el formulario de acceso.");
      this.updateAuthGateUI();
      return;
    }

    const nombre = (document.getElementById("bootstrapFullName")?.value || "").trim();
    const usuario = (document.getElementById("bootstrapUsername")?.value || "").trim().toLowerCase();
    const email = (document.getElementById("bootstrapEmail")?.value || "").trim().toLowerCase();
    const pass = (document.getElementById("bootstrapPassword")?.value || "").trim();
    const conf = (document.getElementById("bootstrapPasswordConfirm")?.value || "").trim();
    const dni = (document.getElementById("bootstrapDni")?.value || "").trim() || "00000001";

    if (!nombre || nombre.length < 3) return showErr("Ingrese el nombre completo del Super Administrador.");
    if (!usuario || usuario.length < 3) return showErr("Elija un usuario de al menos 3 caracteres.");
    if (!/^[a-z0-9._@-]+$/i.test(usuario)) return showErr("El usuario solo puede contener letras, números, punto, guion o @.");
    const pwErr = this._validatePasswordPolicy(pass);
    if (pwErr) return showErr(pwErr);
    if (pass !== conf) return showErr("Las contraseñas no coinciden.");

    // En Modo B, revalidar nube antes de crear (evita dos Super Admin)
    if (window.__ENTERPRISE_CLOUD__ && window.PaoloAuthService) {
      try {
        const remote = await window.PaoloAuthService.fetchFirmBootstrapped();
        if (remote === true) {
          window.__CLOUD_AUTH_BOOTSTRAPPED__ = true;
          this.updateAuthGateUI();
          return showErr("Ya existe un Super Administrador en la nube. Inicie sesión con esas credenciales.");
        }
      } catch (_) {}
    }

    const passHash = await window.hashSecret(pass);
    const worker = {
      id: "WRK-000",
      dni,
      nombre,
      cargo: "Super Administrador / Control Total del Despacho",
      rol: "super_admin",
      usuario,
      username: usuario,
      passwordHash: passHash,
      pinHash: "",
      sede: "todas",
      email: email || "",
      telefono: "",
      colegiatura: "",
      activo: true,
      fechaIngreso: new Date().toISOString().slice(0, 10),
      observaciones: "Cuenta raíz creada en el registro inicial (borrón y cuenta nueva).",
      permisos: window.db.getDefaultPermissionsForRole
        ? window.db.getDefaultPermissionsForRole("super_admin")
        : {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    window.db._trusted = true;
    try {
      window.db.save("workers", [window.db.sanitizeWorkerCredentials(worker)]);
      const s = window.db.getSettings();
      s.adminUser = usuario;
      s.adminPasswordHash = passHash;
      s.masterPasswordHash = passHash;
      s.bossPasswordHash = "";
      s.masterPinHash = "";
      s.authBootstrapped = true;
      delete s.adminPassword;
      delete s.masterPassword;
      delete s.bossPassword;
      window.db.saveSettings(s);
    } finally {
      window.db._trusted = false;
    }

    if (window.__ENTERPRISE_CLOUD__ && window.PaoloAuthService) {
      try {
        await window.PaoloAuthService.pushCloudBootstrap({
          id: worker.id,
          usuario: worker.usuario,
          email: worker.email,
          dni: worker.dni,
          nombre: worker.nombre,
          cargo: worker.cargo,
          rol: worker.rol,
          sede: worker.sede,
          passwordHash: worker.passwordHash,
          pinHash: worker.pinHash,
          permisos: worker.permisos
        });
        window.__CLOUD_AUTH_BOOTSTRAPPED__ = true;
      } catch (cloudErr) {
        if (cloudErr && cloudErr.status === 409) {
          window.__CLOUD_AUTH_BOOTSTRAPPED__ = true;
          this.updateAuthGateUI();
          return showErr("Ya existe un Super Administrador en la nube. Use el formulario de acceso con esas credenciales.");
        }
        console.warn("[Auth] Bootstrap local OK; nube pendiente:", cloudErr && cloudErr.message);
        this.showToast("Admin local creado. La publicación en nube falló; reintente al tener conexión.", "warning");
      }
    }

    try { window.db.logAudit("BOOTSTRAP_ADMIN", "seguridad", "WRK-000", "Registro inicial del Super Administrador '" + usuario + "'", null, null); } catch (_) {}
    if (errAlert) errAlert.classList.add("hidden");
    await this._establishAuthenticatedSession(worker, pass);
    this.showToast("Despacho inicializado. Super Administrador creado. Ya puede registrar colaboradores con roles.", "success");
  }

  async _establishAuthenticatedSession(matchedWorker, pass) {
    this._establishingSession = true;
    try {
      const userObj = {
        id: matchedWorker.id,
        dni: matchedWorker.dni,
        nombre: matchedWorker.nombre,
        cargo: matchedWorker.cargo,
        rol: window.db.normalizeRole(matchedWorker.rol),
        sede: window.db.normalizeSede(matchedWorker.sede),
        email: matchedWorker.email,
        usuario: matchedWorker.usuario || matchedWorker.dni,
        username: matchedWorker.usuario || matchedWorker.nombre,
        permisos: matchedWorker.permisos || null
      };

      sessionStorage.setItem("PAOLO ALDEA_AUTH_LOGGED_IN", "true");
      sessionStorage.setItem("PAOLO ALDEA_AUTH_USER", userObj.nombre);
      localStorage.setItem("PAOLO ALDEA_AUTH_LOGGED_IN", "true");
      localStorage.setItem("PAOLO ALDEA_AUTH_USER", userObj.nombre);
      window.db.setCurrentUser(userObj);
      this.broadcastSessionEvent("SESSION_LOGIN", { user: userObj.nombre });

      if (window.legalCrypto) {
        try { await window.legalCrypto.deriveSessionKey(pass); } catch (_) {}
      }
      this.updateStorageQuotaDisplay();
      this.hideLoginOverlay();
      this.updateAuthGateUI();

      const sedeCfg = (userObj.sede !== "todas" && window.SEDES_CONFIG && window.SEDES_CONFIG[userObj.sede])
        ? window.SEDES_CONFIG[userObj.sede].nombreCorto
        : "Consolidado Nacional";
      this.showToast(`Bienvenido al Despacho: ${userObj.nombre} (${sedeCfg})`, "success");
      // Alinear sede activa a la del usuario (salvo consolidado/global)
      if (userObj.sede && userObj.sede !== "todas" && window.db && typeof window.db.setActiveSede === "function") {
        try { window.db.setActiveSede(userObj.sede); } catch (_) {}
      }
      this.applySettingsToUI();
      if (typeof this.applySedeToHeader === "function") this.applySedeToHeader();
      if (typeof this.renderDynamicSidebarModules === "function") this.renderDynamicSidebarModules();

      this.switchTab("asistencia");
      if (window.AttendanceModule) {
        // Siempre abrir en Kiosco Colaborador (Supervisión solo bajo demanda).
        if (typeof window.AttendanceModule.enterKioskColaborador === "function") {
          window.AttendanceModule.enterKioskColaborador();
        } else if (typeof window.AttendanceModule.setRoleView === "function") {
          window.AttendanceModule.setRoleView("colaborador");
        }
        if (userObj.dni && typeof window.AttendanceModule.selectWorker === "function") {
          window.AttendanceModule.selectWorker(userObj.dni);
        }
        if (typeof window.AttendanceModule.startAutoGeofenceTracking === "function") {
          window.AttendanceModule.startAutoGeofenceTracking();
        }
        if (typeof window.AttendanceModule.updateAnchorOfficeVisibility === "function") {
          window.AttendanceModule.updateAnchorOfficeVisibility();
        }
        // Roles privilegiados: dejan supervisión lista, sin abrir el panel admin.
        if (typeof window.AttendanceModule.ensurePrivilegedSupervision === "function") {
          window.AttendanceModule.ensurePrivilegedSupervision(false);
        }
      }
      if (window.alerts) window.alerts.evaluateAlerts();
      if (window.kpiDashboard) window.kpiDashboard.refresh();
      // Refresco post-login. La sync nube la dispara handleLogin en background
      // (evita doble pull/push que retrasaba el arranque del panel).
      this.refreshCurrentModuleView();
      if (window.AttendanceModule && typeof window.AttendanceModule.enterKioskColaborador === "function") {
        window.AttendanceModule.enterKioskColaborador();
      }
    } finally {
      // Ventana breve: evita que un F5 en otra pestaña tumbe el login recién hecho.
      setTimeout(() => { this._establishingSession = false; }, 1500);
      const btnLogin = document.getElementById("btnLoginSubmit");
      if (btnLogin) {
        btnLogin.disabled = false;
        btnLogin.classList.remove("opacity-80", "cursor-wait");
      }
    }
  }

  async resetSuperAdminAccess(e) {
    if (e) e.preventDefault();
    const errAlert = document.getElementById("loginErrorAlert");
    const errMsg = document.getElementById("loginErrorMessage");
    const showErr = (msg) => {
      if (errAlert && errMsg) {
        errMsg.textContent = msg;
        errAlert.classList.remove("hidden");
      } else {
        this.showToast(msg, "error");
      }
    };
    const code = (document.getElementById("resetAdminCode")?.value || "").trim();
    const pass = (document.getElementById("resetAdminPassword")?.value || "").trim();
    const conf = (document.getElementById("resetAdminPasswordConfirm")?.value || "").trim();
    if (!code) return showErr("Ingrese el código de restablecimiento.");
    const pwErr = this._validatePasswordPolicy(pass);
    if (pwErr) return showErr(pwErr);
    if (pass !== conf) return showErr("Las contraseñas no coinciden.");
    let passwordHash = "";
    try {
      passwordHash = await window.hashSecret(pass);
    } catch (err) {
      return showErr(err && err.message ? err.message : "No se pudo proteger la contraseña.");
    }
    try {
      const res = await fetch("/api/auth-login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: "reset-admin", code, passwordHash })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return showErr((data && data.error) || "No se pudo restablecer la contraseña.");
      const usuario = data.usuario || "";
      const userInput = document.getElementById("loginUsername");
      if (userInput && usuario) userInput.value = usuario;
      const form = document.getElementById("formResetAdmin");
      if (form) form.classList.add("hidden");
      if (errAlert) errAlert.classList.add("hidden");
      this.showToast("Contraseña actualizada. Entre con el usuario " + usuario + ".", "success");
    } catch (err) {
      showErr(err && err.message ? err.message : "No se pudo restablecer la contraseña.");
    }
  }

  async handleLogin(e) {
    if (e) e.preventDefault();
    if (this.needsAuthBootstrapUI()) {
      return this.completeAuthBootstrap(e);
    }

    const user = (document.getElementById("loginUsername")?.value || "").trim();
    const pass = (document.getElementById("loginPassword")?.value || "").trim();
    const errAlert = document.getElementById("loginErrorAlert");
    const errMsg = document.getElementById("loginErrorMessage");
    const btnLogin = document.getElementById("btnLoginSubmit");
    const btnLoginHtml = btnLogin ? btnLogin.innerHTML : "";
    const setLoginBusy = (busy) => {
      if (!btnLogin) return;
      btnLogin.disabled = !!busy;
      if (busy) {
        btnLogin.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verificando acceso…';
        btnLogin.classList.add("opacity-80", "cursor-wait");
      } else {
        btnLogin.innerHTML = btnLoginHtml || '<i class="fa-solid fa-lock-open text-slate-950"></i> Ingresar al Despacho Jurídico';
        btnLogin.classList.remove("opacity-80", "cursor-wait");
      }
    };

    const _remain = this._loginGuardRemaining();
    if (_remain > 0) {
      const waitSec = Math.ceil(_remain / 1000);
      if (errAlert && errMsg) {
        errMsg.textContent = `Acceso bloqueado por seguridad tras múltiples intentos fallidos. Espere ${waitSec} segundos antes de reintentar.`;
        errAlert.classList.remove("hidden");
      }
      return;
    }

    if (!user) {
      if (errAlert && errMsg) {
        errMsg.textContent = "Por favor, ingrese su usuario de despacho.";
        errAlert.classList.remove("hidden");
      }
      return;
    }
    if (!pass) {
      if (errAlert && errMsg) {
        errMsg.textContent = "Ingrese su contraseña.";
        errAlert.classList.remove("hidden");
      }
      return;
    }

    setLoginBusy(true);

    let workers = window.db ? window.db.getRaw("workers") : [];
    const uLower = user.toLowerCase().trim();
    let matchedWorker = workers.find(w =>
      (w.dni && String(w.dni).toLowerCase() === uLower) ||
      (w.usuario && String(w.usuario).toLowerCase() === uLower) ||
      (w.email && String(w.email).toLowerCase() === uLower)
    );

    let isWorkerValid = false;
    let legacyUpgrade = null;
    if (matchedWorker && matchedWorker.activo !== false) {
      if (matchedWorker.passwordHash && await window.verifySecret(pass, matchedWorker.passwordHash)) {
        isWorkerValid = true;
        if (window.isLegacySecret(matchedWorker.passwordHash)) legacyUpgrade = "passwordHash";
      } else if (matchedWorker.pinHash && await window.verifySecret(pass, matchedWorker.pinHash)) {
        isWorkerValid = true;
        if (window.isLegacySecret(matchedWorker.pinHash)) legacyUpgrade = "pinHash";
      }
      // Texto plano residual: migrar una sola vez y borrar el campo en claro
      if (!isWorkerValid && matchedWorker.password && pass === matchedWorker.password) {
        isWorkerValid = true;
        legacyUpgrade = "password";
      } else if (!isWorkerValid && matchedWorker.pin && pass === String(matchedWorker.pin)) {
        isWorkerValid = true;
        legacyUpgrade = "pin";
      }
    }

    let isValid = !!(matchedWorker && isWorkerValid);
    let cloudSyncToken = null;
    let cloudFailMessage = "";

    // Dispositivo vacío / sin nómina local: autenticar contra Supabase (staff_directory)
    if (!isValid && window.__ENTERPRISE_CLOUD__ && window.PaoloAuthService && navigator.onLine) {
      try {
        const cloud = await window.PaoloAuthService.cloudLogin(user, pass);
        if (cloud && cloud.ok && cloud.worker) {
          window.PaoloAuthService.hydrateLocalWorkers(cloud.directory || [cloud.worker]);
          workers = window.db.getRaw("workers") || [];
          matchedWorker = workers.find(w => String(w.id) === String(cloud.worker.id)) || cloud.worker;
          isValid = true;
          cloudSyncToken = cloud.syncToken || null;
          window.__CLOUD_AUTH_BOOTSTRAPPED__ = true;
        }
      } catch (cloudErr) {
        cloudFailMessage = (cloudErr && cloudErr.message) || "";
        console.warn("[Login] Nube:", cloudFailMessage);
      }
    }

    if (!isValid && matchedWorker && matchedWorker.activo !== false && user.includes("@") && window.firebaseService && window.firebaseService.hasCredentials() && navigator.onLine) {
      try {
        const fbRes = await window.firebaseService.loginWithEmail(user, pass);
        if (fbRes && fbRes.success) isValid = true;
      } catch (fbErr) {
        console.warn("[Login] Validación Firebase no superada:", fbErr.message);
      }
    }

    if (!isValid) {
      setLoginBusy(false);
      const _g = this._loginGuardFail();
      window._loginAttempts = _g.fails;
      try { window.db.logAudit("LOGIN_FALLIDO", "sesion", "-", "Intento de acceso fallido para el usuario '" + user.slice(0, 40) + "'", null, null); } catch (_) {}
      if (_g.lockMs > 0) {
        if (errAlert && errMsg) {
          errMsg.textContent = "Acceso bloqueado por seguridad tras 5 intentos fallidos. Espere " + Math.ceil(_g.lockMs / 1000) + " segundos antes de reintentar.";
          errAlert.classList.remove("hidden");
        }
      } else if (errAlert && errMsg) {
        const restantes = 5 - window._loginAttempts;
        const cloudDetail = cloudFailMessage && cloudFailMessage !== "Credenciales incorrectas."
          ? " " + cloudFailMessage
          : "";
        errMsg.textContent = `Credenciales incorrectas. Verifique usuario y contraseña (${restantes} intento${restantes === 1 ? "" : "s"} restante${restantes === 1 ? "" : "s"}).${cloudDetail}`;
        errAlert.classList.remove("hidden");
      }
      const passInput = document.getElementById("loginPassword");
      if (passInput) {
        passInput.classList.add("ring-2", "ring-rose-500");
        setTimeout(() => passInput.classList.remove("ring-2", "ring-rose-500"), 2000);
        passInput.focus();
      }
      return;
    }

    window._loginAttempts = 0;
    window._loginLockUntil = 0;
    this._loginGuardReset();

    if (matchedWorker && legacyUpgrade) {
      try {
        const upgraded = window.db.sanitizeWorkerCredentials({ ...matchedWorker });
        if (legacyUpgrade === "passwordHash" || legacyUpgrade === "password") {
          upgraded.passwordHash = await window.hashSecret(pass);
        } else {
          upgraded.pinHash = await window.hashSecret(pass);
        }
        window.db._trusted = true;
        try { window.db.update("workers", matchedWorker.id, upgraded); } finally { window.db._trusted = false; }
        Object.assign(matchedWorker, upgraded);
      } catch (upErr) { console.warn("[Seguridad] No se pudo migrar la credencial:", upErr.message); }
    }

    if (window.firebaseService && window.firebaseService.hasCredentials() && navigator.onLine) {
      const emailForFb = user.includes("@") ? user : (matchedWorker?.email || "");
      if (emailForFb && emailForFb.includes("@")) {
        window.firebaseService.loginWithEmail(emailForFb, pass)
          .catch(() => {})
          .finally(() => {
            window.firebaseService.fullSync(null, true).catch(() => {});
          });
      } else {
        window.firebaseService.fullSync(null, true).catch(() => {});
      }
    }

    // Credenciales de re-auth solo en sessionStorage (sync en segundo plano).
    try {
      sessionStorage.setItem("PA_SYNC_REAUTH", JSON.stringify({ u: user, p: pass }));
    } catch (_) {}

    if (errAlert) errAlert.classList.add("hidden");

    // Abrir el panel YA: no bloquear la UI esperando push/pull de 8 colecciones.
    await this._establishAuthenticatedSession(matchedWorker, pass);

    // Sync nube en background (token + merge). El indicador refleja el progreso.
    if (window.__ENTERPRISE_CLOUD__ && navigator.onLine && window.PaoloAuthService) {
      const bgUser = user;
      const bgPass = pass;
      const bgToken = cloudSyncToken;
      this.actualizarIndicadorNube("syncing", "Sincronizando…");
      Promise.resolve()
        .then(async () => {
          let token = bgToken;
          if (!token) {
            const cloudRefresh = await window.PaoloAuthService.cloudLogin(bgUser, bgPass);
            if (cloudRefresh && cloudRefresh.ok) {
              token = cloudRefresh.syncToken || null;
              if (cloudRefresh.directory) {
                window.PaoloAuthService.hydrateLocalWorkers(cloudRefresh.directory);
              }
            }
          }
          if (token && window.PaoloCloudDataSync) {
            window.__CLOUD_AUTH_BOOTSTRAPPED__ = true;
            // quick: pull primero; push completo diferido (evita 8 POSTs en el login)
            await window.PaoloCloudDataSync.afterLogin(token, { quick: true });
            this.actualizarIndicadorNube("online", "Nube sincronizada");
          } else {
            this.actualizarIndicadorNube("offline", "Sync pendiente");
          }
        })
        .catch((syncErr) => {
          console.warn("[Login] Sync background:", syncErr && syncErr.message);
          this.actualizarIndicadorNube("offline", "Sync pendiente");
        });
    }
  }

  lockScreen(silent = false, reason = "manual", fromRemote = false) {
    this.clearSessionStorageState();
    this._inactivityWarningShown = false;
    try { sessionStorage.removeItem("PA_SYNC_REAUTH"); } catch (_) {}
    if (window.PaoloCloudDataSync && typeof window.PaoloCloudDataSync.clearToken === "function") {
      window.PaoloCloudDataSync.clearToken();
    }

    if (!fromRemote) {
      this.broadcastSessionEvent("SESSION_LOCK", { reason });
    }

    const userInput = document.getElementById("loginUsername");
    if (userInput) userInput.value = "";
    const passInput = document.getElementById("loginPassword");
    if (passInput) passInput.value = "";
    const errAlert = document.getElementById("loginErrorAlert");
    const errMsg = document.getElementById("loginErrorMessage");

    if (errAlert && errMsg) {
      if (reason === "screen_off") {
        errMsg.textContent = "Dispositivo bloqueado. Ingrese sus credenciales de despacho para continuar.";
        errAlert.classList.remove("hidden");
      } else if (reason === "reload") {
        errMsg.textContent = "Sesión bloqueada por recarga de página. Ingrese sus credenciales.";
        errAlert.classList.remove("hidden");
      } else {
        errAlert.classList.add("hidden");
      }
    }

    this.closeAllModals();
    this.showLoginOverlay();

    if (!silent) {
      if (reason === "screen_off") {
        this.showToast("Dispositivo bloqueado por seguridad. Ingrese su contraseña.", "info");
      } else {
        this.showToast("Sesión bloqueada por seguridad. Ingrese su usuario y contraseña.", "info");
      }
    }
  }

  togglePasswordVisibility(inputId, iconId) {
    if (typeof window.togglePasswordVisibility === 'function') { window.togglePasswordVisibility(inputId, iconId); return; }
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (!input) return;
    if (input.type === "password") {
      input.type = "text";
      if (icon) {
        icon.classList.remove("fa-eye");
        icon.classList.add("fa-eye-slash");
      }
    } else {
      input.type = "password";
      if (icon) {
        icon.classList.remove("fa-eye-slash");
        icon.classList.add("fa-eye");
      }
    }
  }

  // =========================================================================
  // MÓDULO: GESTIÓN DE PERSONAL PROFESIONAL & PADRÓN MULTI-SEDE
  // =========================================================================
  renderPersonal() {
    if (!window.db) return;
    const currentUser = window.db.getCurrentUser();
    const isGlobal = window.db.isGlobalAdmin(currentUser);
    const activeSedeKey = window.db.getActiveSede();
    const userRole = window.db.getUserRole(currentUser);

    // Cargar siempre el padrón completo de trabajadores registrados para que ningún colaborador
    // se oculte al editar su sede, rol o estado; el filtrado se controla desde los selectores de esta vista.
    const rawWorkers = window.db.getRaw("workers");
    const allWorkers = Array.isArray(rawWorkers) ? rawWorkers.filter(Boolean) : [];
    const container = document.getElementById("personalTableBody");

    // Calcular métricas para los 5 KPIs
    const kpiTotalEl = document.getElementById("kpiPersonalTotal");
    const kpiActivosBadge = document.getElementById("kpiPersonalActivosBadge");
    const kpiInactivosBadge = document.getElementById("kpiPersonalInactivosBadge");
    const kpiAbogadosEl = document.getElementById("kpiPersonalAbogados");
    const kpiAsistentesEl = document.getElementById("kpiPersonalAsistentes");
    const kpiAdminsEl = document.getElementById("kpiPersonalAdmins");
    const kpiSedesEl = document.getElementById("kpiPersonalSedes");

    const activosCount = allWorkers.filter(w => w.activo !== false && w.activo !== "false").length;
    const inactivosCount = allWorkers.length - activosCount;
    const abogadosCount = allWorkers.filter(w => window.db.getUserRole(w) === "abogado").length;
    const asistentesCount = allWorkers.filter(w => {
      const r = window.db.getUserRole(w);
      return r === "asistente_legal" || r === "asistente_admin" || r === "asistente";
    }).length;
    const adminsCount = allWorkers.filter(w => {
      const r = window.db.getUserRole(w);
      return r === "admin" || r === "socio" || r === "super_admin";
    }).length;

    const uniqueSedes = new Set(allWorkers.map(w => window.db.normalizeSede(w.sede))).size;

    if (kpiTotalEl) kpiTotalEl.textContent = allWorkers.length;
    if (kpiActivosBadge) kpiActivosBadge.textContent = `${activosCount} activos`;
    if (kpiInactivosBadge) kpiInactivosBadge.textContent = `${inactivosCount} inactivos`;
    if (kpiAbogadosEl) kpiAbogadosEl.textContent = abogadosCount;
    if (kpiAsistentesEl) kpiAsistentesEl.textContent = asistentesCount;
    if (kpiAdminsEl) kpiAdminsEl.textContent = adminsCount;
    if (kpiSedesEl) kpiSedesEl.textContent = `${uniqueSedes} ${uniqueSedes === 1 ? 'Sede' : 'Sedes'}`;

    if (!container) return;

    // Obtener valores de filtros
    const searchVal = (document.getElementById("searchPersonal")?.value || "").toLowerCase().trim();
    const filterSede = document.getElementById("filterSedePersonal")?.value || "ALL";
    const filterRol = document.getElementById("filterRolPersonal")?.value || "ALL";
    const filterEstado = document.getElementById("filterEstadoPersonal")?.value || "ALL";

    const filtered = allWorkers.filter(w => {
      // Búsqueda textual por DNI, Usuario, Nombre, Cargo, Colegiatura, Teléfono o Email
      const matchSearch = !searchVal || 
        (w.dni && String(w.dni).toLowerCase().includes(searchVal)) ||
        (w.usuario && String(w.usuario).toLowerCase().includes(searchVal)) ||
        (w.username && String(w.username).toLowerCase().includes(searchVal)) ||
        (w.nombre && String(w.nombre).toLowerCase().includes(searchVal)) ||
        (w.cargo && String(w.cargo).toLowerCase().includes(searchVal)) ||
        (w.colegiatura && String(w.colegiatura).toLowerCase().includes(searchVal)) ||
        (w.telefono && String(w.telefono).toLowerCase().includes(searchVal)) ||
        (w.email && String(w.email).toLowerCase().includes(searchVal));

      // Filtro por Sede
      const normSede = window.db.normalizeSede(w.sede);
      const matchSede = (filterSede === "ALL") || (normSede === filterSede);

      // Filtro por Rol
      const normRol = window.db.getUserRole(w);
      const matchRol = (filterRol === "ALL") || (normRol === filterRol) || (filterRol === "socio" && normRol === "super_admin");

      // Filtro por Estado
      const isActivo = (w.activo !== false && w.activo !== "false");
      const matchEstado = (filterEstado === "ALL") || 
        (filterEstado === "ACTIVO" && isActivo) || 
        (filterEstado === "INACTIVO" && !isActivo);

      return matchSearch && matchSede && matchRol && matchEstado;
    });

    const countLabel = document.getElementById("personalCountLabel");
    if (countLabel) {
      countLabel.textContent = `${filtered.length} ${filtered.length === 1 ? 'colaborador' : 'colaboradores'}`;
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-10 text-slate-400">
            <div class="flex flex-col items-center justify-center gap-2">
              <i class="fa-solid fa-users-slash text-2xl text-slate-300"></i>
              <p class="font-medium">No se encontraron colaboradores registrados que coincidan con los filtros aplicados.</p>
              <button onclick="window.app.resetPersonalFilters()" class="text-xs text-blue-600 hover:underline">Restablecer filtros de búsqueda</button>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    const canMutate = true;

    container.innerHTML = filtered.map(w => {
      const sedeKey = window.db.normalizeSede(w.sede);
      const sedeCfg = window.SEDES_CONFIG ? window.SEDES_CONFIG[sedeKey] : null;
      const sedeLabel = sedeCfg ? sedeCfg.nombreCorto : (sedeKey === "todas" ? "Consolidado Nacional" : (w.sede || "Challhuahuacho"));
      const rolBadge = window.db.getRoleBadge(w.rol);
      const isActivo = (w.activo !== false && w.activo !== "false");
      const initials = (w.nombre || "").split(" ").map(p => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "WR";

      // Color de avatar según rol
      let avatarBg = "bg-blue-100 text-blue-800 border-blue-200";
      const normRole = window.db.getUserRole(w);
      if (normRole === "socio" || normRole === "super_admin") avatarBg = "bg-amber-100 text-amber-950 border-amber-400 font-extrabold";
      else if (normRole === "admin") avatarBg = "bg-purple-100 text-purple-900 border-purple-300";
      else if (normRole === "asistente_admin") avatarBg = "bg-teal-100 text-teal-900 border-teal-300";
      else if (normRole === "asistente_legal") avatarBg = "bg-emerald-100 text-emerald-900 border-emerald-300";

      return `
        <tr class="hover:bg-slate-50/80 transition-colors border-b border-slate-100">
          <!-- Colaborador / DNI -->
          <td class="py-3 px-3">
            <div class="flex items-center gap-2.5">
${safeImageSrc(w.foto) ? `<img src="${escapeHtml(safeImageSrc(w.foto))}" class="w-8 h-8 rounded-full object-cover border border-amber-400 shrink-0 shadow-sm" alt="Foto">` : `
              <div class="w-8 h-8 rounded-full border flex items-center justify-center font-bold text-xs shrink-0 ${avatarBg}">
                ${initials}
              </div>
`}
              <div>
                <div class="font-bold text-slate-900 flex items-center gap-1.5">
                  ${escapeHtml(w.nombre || 'Sin nombre')}
                  ${(normRole === 'socio' || normRole === 'super_admin') ? '<i class="fa-solid fa-crown text-amber-500 text-[11px]" title="Dirección / Socio Principal"></i>' : ''}
                </div>
                <div class="flex flex-wrap items-center gap-1.5 mt-0.5">
                  <span class="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-semibold border border-slate-200">DNI: ${escapeHtml(w.dni || '—')}</span>
                  ${w.usuario ? `<span class="font-mono text-[10px] bg-amber-50 text-amber-800 px-1.5 py-0.2 rounded font-semibold border border-amber-200 flex items-center gap-1"><i class="fa-solid fa-key text-[8.5px] text-amber-600"></i> ${escapeHtml(w.usuario)}</span>` : ''}
                  ${w.colegiatura ? `<span class="text-[10px] text-slate-500 font-mono">${escapeHtml(w.colegiatura)}</span>` : ''}
                </div>
              </div>
            </div>
          </td>

          <!-- Cargo & Especialidad -->
          <td class="py-3 px-3">
            <div class="font-semibold text-slate-800">${escapeHtml(w.cargo || 'Colaborador')}</div>
            <div class="text-[10px] text-slate-500 truncate max-w-[200px]">${escapeHtml(w.observaciones || 'Sin observaciones')}</div>
          </td>

          <!-- Rol Sistema -->
          <td class="py-3 px-3 text-center">
            ${rolBadge}
          </td>

          <!-- Sede Asignada -->
          <td class="py-3 px-3 text-center">
            <span class="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-800 border border-slate-200">
              <i class="fa-solid fa-location-dot text-amber-500 text-[10px]"></i>
              ${escapeHtml(sedeLabel)}
            </span>
            ${(sedeKey === 'miraflores' && w.despacho) ? `
              <div class="mt-1">
                <span class="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-50 text-amber-900 border border-amber-300">
                  <i class="fa-solid fa-door-open text-amber-600 text-[9px]"></i>
                  ${escapeHtml(this.normalizeMirafloresDespacho(w.despacho))}
                </span>
              </div>
            ` : ''}
          </td>

          <!-- Contacto Directo -->
          <td class="py-3 px-3">
            <div class="space-y-0.5">
              ${w.email ? `
                <div class="text-[11px] flex items-center gap-1.5 text-slate-700">
                  <i class="fa-regular fa-envelope text-slate-400 text-[10px]"></i>
                  <a href="mailto:${escapeHtml(w.email)}" class="hover:text-blue-600 hover:underline truncate max-w-[170px]">${escapeHtml(w.email)}</a>
                </div>
              ` : ''}
              ${w.telefono ? `
                <div class="text-[11px] flex items-center gap-1.5 text-slate-700">
                  <i class="fa-brands fa-whatsapp text-emerald-600 text-[11px]"></i>
                  <span class="font-mono font-medium">${escapeHtml(w.telefono)}</span>
                </div>
              ` : ''}
            </div>
          </td>

          <!-- Estado -->
          <td class="py-3 px-3 text-center">
            <span class="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold ${isActivo ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-rose-100 text-rose-800 border border-rose-200'}">
              <span class="w-1.5 h-1.5 rounded-full ${isActivo ? 'bg-emerald-500' : 'bg-rose-500'}"></span>
              ${isActivo ? 'Activo' : 'De Baja'}
            </span>
          </td>

          <!-- Ingreso -->
          <td class="py-3 px-3 text-slate-600 font-mono text-[11px]">
            ${escapeHtml(w.fechaIngreso || '—')}
          </td>

          <!-- Acciones -->
          <td class="py-3 px-3 text-center whitespace-nowrap">
            ${canMutate ? `
              <div class="flex items-center justify-center gap-1">
                <button onclick="window.app.openPersonalModal(${jsStr(w.id)})" class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Editar datos del colaborador">
                  <i class="fa-solid fa-pen-to-square text-xs"></i>
                </button>
                <button onclick="window.app.toggleWorkerStatus(${jsStr(w.id)})" class="p-1.5 ${isActivo ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'} rounded-lg transition" title="${isActivo ? 'Dar de baja temporal' : 'Reactivar colaborador'}">
                  <i class="fa-solid ${isActivo ? 'fa-user-slash' : 'fa-user-check'} text-xs"></i>
                </button>
                ${((window.db && window.db.isSuperAdmin()) || (w.id !== 'WRK-000' && w.rol !== 'super_admin')) ? `
                  <button onclick="window.app.deleteWorkerRecord(${jsStr(w.id)})" class="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition" title="Eliminar registro">
                    <i class="fa-solid fa-trash-can text-xs"></i>
                  </button>
                ` : ''}
              </div>
            ` : `
              <span class="text-[10px] text-slate-400 italic">Solo lectura</span>
            `}
          </td>
        </tr>
      `;
    }).join("");
  }

  filterPersonal() {
    this.renderPersonal();
  }

  resetPersonalFilters() {
    const sInput = document.getElementById("searchPersonal");
    const fSede = document.getElementById("filterSedePersonal");
    const fRol = document.getElementById("filterRolPersonal");
    const fEstado = document.getElementById("filterEstadoPersonal");

    if (sInput) sInput.value = "";
    if (fSede) fSede.value = "ALL";
    if (fRol) fRol.value = "ALL";
    if (fEstado) fEstado.value = "ALL";

    this.renderPersonal();
  }

  openPersonalModal(workerId = null) {
    const modalTitle = document.getElementById("modalPersonalTitle");
    const editIdInput = document.getElementById("personalEditId");
    const dniInput = document.getElementById("personalDni");
    const colegiaturaInput = document.getElementById("personalColegiatura");
    const nombreInput = document.getElementById("personalNombre");
    const cargoInput = document.getElementById("personalCargo");
    const rolInput = document.getElementById("personalRol");
    const sedeInput = document.getElementById("personalSede");
    const usuarioInput = document.getElementById("personalUsuario");
    const passwordInput = document.getElementById("personalPassword");
    const pinInput = document.getElementById("personalPin");
    const telInput = document.getElementById("personalTelefono");
    const emailInput = document.getElementById("personalEmail");
    const activoInput = document.getElementById("personalActivo");
    const fechaInput = document.getElementById("personalFechaIngreso");
    const obsInput = document.getElementById("personalObservaciones");

    if (sedeInput) {
      sedeInput.disabled = false;
    }

    if (workerId) {
      const workers = window.db ? window.db.getRaw("workers") : [];
      const worker = workers.find(w => w.id === workerId);
      if (!worker) {
        this.showToast("Colaborador no encontrado en el padrón.", "error");
        return;
      }

      this.editingPersonalId = worker.id;
      if (modalTitle) modalTitle.textContent = "Editar Colaborador Profesional";
      if (editIdInput) editIdInput.value = worker.id;
      if (dniInput) dniInput.value = worker.dni || "";
      if (colegiaturaInput) colegiaturaInput.value = worker.colegiatura || "";
      if (nombreInput) nombreInput.value = worker.nombre || "";
      if (cargoInput) cargoInput.value = worker.cargo || "";
      if (rolInput) rolInput.value = window.db.normalizeRole(worker.rol);
      if (sedeInput) sedeInput.value = window.db.normalizeSede(worker.sede);
      if (usuarioInput) usuarioInput.value = worker.usuario || worker.username || this.generateSuggestedUsername(worker.nombre, worker.dni);
      if (passwordInput) {
        if (false) {
          passwordInput.value = "";
          passwordInput.required = true;
          passwordInput.placeholder = "Clave institucional";
        } else {
          passwordInput.value = "";
          passwordInput.required = false;
          passwordInput.placeholder = "Sin cambios (dejar vacío para mantener clave actual)";
        }
      }
      if (pinInput) pinInput.value = "";
      if (telInput) telInput.value = worker.telefono || "";
      if (emailInput) emailInput.value = worker.email || "";
      if (activoInput) activoInput.value = (worker.activo !== false && worker.activo !== "false") ? "true" : "false";
      if (fechaInput) fechaInput.value = worker.fechaIngreso || "";
      if (obsInput) obsInput.value = worker.observaciones || "";
    } else {
      this.editingPersonalId = null;
      if (modalTitle) modalTitle.textContent = "Registrar Nuevo Colaborador";
      if (editIdInput) editIdInput.value = "";
      if (dniInput) dniInput.value = "";
      if (colegiaturaInput) colegiaturaInput.value = "";
      if (nombreInput) nombreInput.value = "";
      if (cargoInput) cargoInput.value = "Abogado Litigante Asociado";
      if (rolInput) rolInput.value = "abogado";

      const activeSede = window.db ? window.db.getActiveSede() : "challhuahuacho";
      if (sedeInput) sedeInput.value = activeSede === "todas" ? "challhuahuacho" : activeSede;

      if (usuarioInput) usuarioInput.value = "";
      if (passwordInput) {
        passwordInput.required = true;
        passwordInput.placeholder = "Clave institucional";
        passwordInput.value = this.generateStrongPassword();
      }
      if (pinInput) pinInput.value = "";
      if (telInput) telInput.value = "";
      if (emailInput) emailInput.value = "";
      if (activoInput) activoInput.value = "true";
      if (fechaInput) fechaInput.value = new Date().toISOString().slice(0, 10);
      if (obsInput) obsInput.value = "";
    }

    // Configuración dinámica de foto, super_admin y despacho Miraflores
    const optSuperAdmin = document.getElementById("optPersonalSuperAdmin");
    const contDespacho = document.getElementById("containerPersonalDespacho");
    const selDespacho = document.getElementById("personalDespacho");
    const prevFoto = document.getElementById("personalFotoPreview");
    const fallFoto = document.getElementById("personalFotoFallback");
    const btnRemFoto = document.getElementById("btnPersonalRemoveFoto");
    const inpFoto = document.getElementById("personalFotoInput");
    if (inpFoto) inpFoto.value = "";

    const targetWorker = workerId ? (window.db ? window.db.getRaw("workers").find(w => w.id === workerId) : null) : null;
    if (targetWorker && targetWorker.rol === "super_admin") {
      if (optSuperAdmin) { optSuperAdmin.style.display = ""; optSuperAdmin.classList.remove("hidden"); }
    } else {
      if (optSuperAdmin) { optSuperAdmin.style.display = "none"; optSuperAdmin.classList.add("hidden"); }
    }

    const currentSedeNorm = window.db ? window.db.normalizeSede(targetWorker ? targetWorker.sede : (sedeInput?.value || "challhuahuacho")) : "challhuahuacho";
    if (currentSedeNorm === "miraflores") {
      if (contDespacho) contDespacho.classList.remove("hidden");
      if (selDespacho) selDespacho.value = this.normalizeMirafloresDespacho(targetWorker?.despacho);
    } else {
      if (contDespacho) contDespacho.classList.add("hidden");
      if (selDespacho) selDespacho.value = "";
    }

    if (targetWorker && targetWorker.foto) {
      this.currentPersonalPhotoDataUrl = targetWorker.foto;
      if (prevFoto) { prevFoto.src = targetWorker.foto; prevFoto.classList.remove("hidden"); }
      if (fallFoto) { fallFoto.classList.add("hidden"); }
      if (btnRemFoto) { btnRemFoto.classList.remove("hidden"); }
    } else {
      this.currentPersonalPhotoDataUrl = "";
      if (prevFoto) { prevFoto.src = ""; prevFoto.classList.add("hidden"); }
      if (fallFoto) { fallFoto.classList.remove("hidden"); }
      if (btnRemFoto) { btnRemFoto.classList.add("hidden"); }
    }
    this.showModal("modalPersonal");
  }

  generateSuggestedUsername(nombreCompleto, customDni = "") {
    if (!nombreCompleto) return customDni ? `usr${customDni.slice(-4)}` : "colaborador";
    let clean = nombreCompleto
      .replace(/^(Dr\.|Dra\.|Abg\.|Abga\.|Ing\.|Lic\.|Bach\.|Mg\.|Mag\.)\s+/i, "")
      .trim()
      .toLowerCase();
    
    clean = clean.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "colaborador";

    let base = "";
    if (parts.length === 1) {
      base = parts[0];
    } else {
      const firstInitial = parts[0][0];
      const lastName = parts[parts.length >= 3 ? parts.length - 2 : 1];
      base = `${firstInitial}.${lastName}`;
    }
    base = base.replace(/[^a-z0-9._-]/g, "");
    return base;
  }

  generateWorkerUsername() {
    const nombre = document.getElementById("personalNombre")?.value || "";
    const dni = document.getElementById("personalDni")?.value || "";
    const usuarioInput = document.getElementById("personalUsuario");
    const editId = document.getElementById("personalEditId")?.value || this.editingPersonalId || "";

    if (!nombre && !dni) {
      this.showToast("Ingrese primero el nombre completo o DNI para generar el usuario.", "warning");
      return;
    }

    let candidate = this.generateSuggestedUsername(nombre, dni);
    const allWorkers = window.db ? window.db.getRaw("workers") : [];

    let finalUser = candidate;
    let counter = 1;
    while (allWorkers.some(w => w.usuario && w.usuario.toLowerCase() === finalUser.toLowerCase() && w.id !== editId)) {
      finalUser = `${candidate}${counter}`;
      counter++;
    }

    if (usuarioInput) {
      usuarioInput.value = finalUser;
      usuarioInput.focus();
    }
    this.showToast(`Usuario asignado: ${finalUser}`, "success");
  }

  generateStrongPassword(customNameOrUser = "") {
    let base = "Aldea";
    const nombre = document.getElementById("personalNombre")?.value || "";
    const usuario = document.getElementById("personalUsuario")?.value || "";
    const candidate = customNameOrUser || nombre || usuario;
    if (candidate) {
      let clean = candidate.replace(/^(Dr\.|Dra\.|Abg\.|Abga\.|Ing\.|Lic\.|Bach\.|Mg\.|Mag\.)\s+/i, "").trim();
      clean = clean.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const words = clean.split(/[\s._-]+/).filter(Boolean);
      if (words.length > 0 && words[0].length >= 3) {
        base = words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase();
      } else if (words.length > 1 && words[1].length >= 3) {
        base = words[1].charAt(0).toUpperCase() + words[1].slice(1).toLowerCase();
      }
    }
    const suffix = String(Math.floor(1000 + Math.random() * 9000));
    return `${base}#${suffix}!`;
  }

  generateWorkerPassword() {
    const passwordInput = document.getElementById("personalPassword");
    const pinInput = document.getElementById("personalPin");
    const userOrName = document.getElementById("personalUsuario")?.value || document.getElementById("personalNombre")?.value || "";
    const pwd = this.generateStrongPassword(userOrName);
    if (passwordInput) {
      passwordInput.value = pwd;
      passwordInput.type = "text";
      const icon = document.getElementById("toggleIcon-personalPassword");
      if (icon) {
        icon.classList.remove("fa-eye");
        icon.classList.add("fa-eye-slash");
      }
    }
    const newPin = String(Math.floor(1000 + Math.random() * 9000));
    if (pinInput) pinInput.value = newPin;
    this.showToast("Contraseña generada personalizada al usuario con éxito.", "success");
  }
  copyWorkerCredentials() {
    const nombre = document.getElementById("personalNombre")?.value || "Colaborador";
    const rolVal = document.getElementById("personalRol")?.value || "abogado";
    const sedeVal = document.getElementById("personalSede")?.value || "challhuahuacho";
    const usuario = document.getElementById("personalUsuario")?.value || "";
    const password = document.getElementById("personalPassword")?.value || "";
    const pin = document.getElementById("personalPin")?.value || "";

    if (!usuario || !password) {
      this.showToast("Primero genere o ingrese el usuario y contraseña.", "warning");
      return;
    }

    const rolLabel = window.db ? window.db.getRoleLabel(rolVal) : rolVal;
    const sedeCfg = window.SEDES_CONFIG ? window.SEDES_CONFIG[sedeVal] : null;
    const sedeLabel = sedeCfg ? sedeCfg.nombre : sedeVal;

    const memo = 
`🏛️ PAOLO ALDEA & ABOGADOS — CREDENCIALES DE ACCESO AL DESPACHO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 Colaborador: ${nombre}
⚖️ Cargo/Rol: ${rolLabel}
🏢 Sede Asignada: ${sedeLabel}

🔑 Usuario de Despacho: ${usuario}
🔒 Contraseña Institucional: ${password}
🔢 PIN Marcación Rápida / Tableta: ${pin}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 Plataforma: Suite Jurídica Multi-Sede (PAOLO ALDEA & ABOGADOS)`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(memo).then(() => {
        this.showToast("¡Credenciales copiadas al portapapeles! Listo para enviar por WhatsApp.", "success");
      }).catch(() => {
        prompt("Copie las credenciales del colaborador:", memo);
      });
    } else {
      prompt("Copie las credenciales del colaborador:", memo);
    }
  }

  normalizeMirafloresDespacho(value) {
    const raw = String(value || "").trim();
    const legacy = {
      "Despacho General 1": "Despacho 1",
      "Despacho General 2": "Despacho 2",
      "Despacho General 3": "Despacho 3",
      "Admin General": "Administrador General"
    };
    return legacy[raw] || raw || "Despacho 1";
  }

  onPersonalSedeChange(sedeVal) {
    const cont = document.getElementById("containerPersonalDespacho");
    const sel = document.getElementById("personalDespacho");
    const norm = (window.db ? window.db.normalizeSede(sedeVal) : sedeVal).toLowerCase();
    if (norm === "miraflores") {
      if (cont) cont.classList.remove("hidden");
      if (sel && !sel.value) sel.value = "Despacho 1";
    } else {
      if (cont) cont.classList.add("hidden");
      if (sel) sel.value = "";
    }
  }

  handlePersonalPhotoSelect(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      this.showToast("Seleccione una imagen válida (JPG, PNG o WEBP).", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const raw = event.target.result;
        const compressed = await this.compressImageDataUrl(raw, 320, 0.85);
        this.currentPersonalPhotoDataUrl = compressed;
        const prev = document.getElementById("personalFotoPreview");
        const fall = document.getElementById("personalFotoFallback");
        const btnRem = document.getElementById("btnPersonalRemoveFoto");
        if (prev) { prev.src = compressed; prev.classList.remove("hidden"); }
        if (fall) { fall.classList.add("hidden"); }
        if (btnRem) { btnRem.classList.remove("hidden"); }
        this.showToast("Fotografía seleccionada correctamente.", "info");
      } catch (err) {
        console.error("Error al procesar foto:", err);
      }
    };
    reader.readAsDataURL(file);
  }

  removePersonalModalPhoto() {
    this.currentPersonalPhotoDataUrl = "";
    const prev = document.getElementById("personalFotoPreview");
    const fall = document.getElementById("personalFotoFallback");
    const btnRem = document.getElementById("btnPersonalRemoveFoto");
    const inp = document.getElementById("personalFotoInput");
    if (inp) inp.value = "";
    if (prev) { prev.src = ""; prev.classList.add("hidden"); }
    if (fall) { fall.classList.remove("hidden"); }
    if (btnRem) { btnRem.classList.add("hidden"); }
    this.showToast("Fotografía removida del formulario.", "info");
  }

  onPersonalRolChange(rolVal) {
    const cargoInput = document.getElementById("personalCargo");
    if (!cargoInput) return;

    const currentVal = cargoInput.value.trim().toLowerCase();
    const defaults = {
      super_admin: "Super Administrador",
      socio: "Socio Principal / Dirección General",
      admin: "Administrador de Sede / Finanzas",
      abogado: "Abogado Litigante Asociado",
      asistente_legal: "Asistente Legal & Notificaciones",
      asistente_admin: "Asistente Administrativo & Logística"
    };

    if (!cargoInput.value || Object.values(defaults).some(d => d.toLowerCase() === currentVal)) {
      cargoInput.value = defaults[rolVal] || "";
    }
  }

  async savePersonal(e) {
    if (e) e.preventDefault();

    const editId = (document.getElementById("personalEditId")?.value || this.editingPersonalId || "").trim();
    const dni = (document.getElementById("personalDni")?.value || "").trim();
    const colegiatura = (document.getElementById("personalColegiatura")?.value || "").trim();
    const nombre = (document.getElementById("personalNombre")?.value || "").trim();
    const cargo = (document.getElementById("personalCargo")?.value || "").trim();
    const rol = document.getElementById("personalRol")?.value || "asistente_legal";
    const sede = document.getElementById("personalSede")?.value || "challhuahuacho";
    const usuario = (document.getElementById("personalUsuario")?.value || "").trim().toLowerCase();
    const password = (document.getElementById("personalPassword")?.value || "").trim();
    const pin = (document.getElementById("personalPin")?.value || "").trim();
    const telefono = (document.getElementById("personalTelefono")?.value || "").trim();
    const email = (document.getElementById("personalEmail")?.value || "").trim();
    const activoVal = document.getElementById("personalActivo")?.value;
    const activo = activoVal !== "false";
    const fechaIngreso = document.getElementById("personalFechaIngreso")?.value;
    const observaciones = (document.getElementById("personalObservaciones")?.value || "").trim();

    if (!dni || dni.length !== 8) {
      this.showToast("El DNI debe contener exactamente 8 dígitos numéricos.", "error");
      return;
    }
    if (!nombre) {
      this.showToast("Por favor, ingrese el nombre completo del colaborador.", "error");
      return;
    }
    if (!cargo) {
      this.showToast("Por favor, ingrese el cargo o especialidad jurídica.", "error");
      return;
    }

    const rawWorkers = window.db.getRaw("workers");
    const allWorkers = Array.isArray(rawWorkers) ? rawWorkers : [];
    const existingWorker = editId ? allWorkers.find(w => w.id === editId) : null;

    // Verificar unicidad de DNI si es registro nuevo o cambia DNI
    const duplicate = allWorkers.find(w => w.dni === dni && w.id !== editId);
    if (duplicate) {
      this.showToast(`El DNI ${dni} ya se encuentra asignado a ${duplicate.nombre}.`, "error");
      return;
    }

    // Verificar unicidad de Usuario
    const finalUsuario = usuario || (existingWorker && existingWorker.usuario) || this.generateSuggestedUsername(nombre, dni);
    const duplicateUser = allWorkers.find(w => w.usuario && w.usuario.toLowerCase() === finalUsuario.toLowerCase() && w.id !== editId);
    if (duplicateUser) {
      this.showToast(`El usuario de despacho '${finalUsuario}' ya pertenece a ${duplicateUser.nombre}.`, "error");
      return;
    }

    const normRol = window.db.normalizeRole(rol);
    const normSede = window.db.normalizeSede(sede);
    const finalPin = pin || (existingWorker && (existingWorker.pin || existingWorker.pinHash) ? "" : String(crypto.getRandomValues(new Uint32Array(1))[0] % 900000 + 100000));

    const workerData = {
      ...(existingWorker || {}),
      dni,
      colegiatura,
      nombre,
      cargo,
      rol: normRol,
      sede: normSede,
      usuario: finalUsuario,
      username: finalUsuario,
      telefono,
      email,
      activo: (editId === "WRK-000" ? true : activo),
      fechaIngreso: fechaIngreso || (existingWorker && existingWorker.fechaIngreso) || new Date().toISOString().slice(0, 10),
      observaciones,
      despacho: (normSede === "miraflores") ? (document.getElementById("personalDespacho")?.value || "Despacho 1") : "",
      foto: (this.currentPersonalPhotoDataUrl !== undefined && this.currentPersonalPhotoDataUrl !== null) ? this.currentPersonalPhotoDataUrl : (existingWorker?.foto || ""),
      updatedAt: new Date().toISOString()
    };

    if (password) {
      const pwPolicy = this._validatePasswordPolicy(password);
      if (pwPolicy) {
        this.showToast(pwPolicy, "error");
        return;
      }
      workerData.passwordHash = await window.hashSecret(password);
      workerData.mustChangePassword = false;
    } else if (!existingWorker) {
      // Contrasena temporal aleatoria (se muestra una sola vez; nunca se guarda en claro)
      const _rnd = crypto.getRandomValues(new Uint32Array(3));
      const _tmpPass = "Ald-" + Array.from(_rnd, n => n.toString(36)).join("-") + "X9";
      workerData.mustChangePassword = true;
      this._tempPasswordOnce = _tmpPass;
      workerData.passwordHash = await window.hashSecret(_tmpPass);
    } else if (!existingWorker.passwordHash && !existingWorker.pinHash) {
      this.showToast("El colaborador debe tener una contraseña o PIN. Genere o escriba una clave.", "error");
      return;
    }

    if (finalPin) {
      if (!/^\d{4,6}$/.test(String(finalPin))) {
        this.showToast("El PIN debe tener entre 4 y 6 dígitos numéricos.", "error");
        return;
      }
      workerData.pinHash = await window.hashSecret(String(finalPin));
    }

    // Garantía: nunca persistir secretos en texto plano
    delete workerData.password;
    delete workerData.pin;
    delete workerData.clave;
    delete workerData.passwordPlain;
    delete workerData.pinPlain;
    Object.assign(workerData, window.db.sanitizeWorkerCredentials(workerData));

    if (!workerData.permisos || (existingWorker && window.db.normalizeRole(existingWorker.rol) !== normRol)) {
      workerData.permisos = window.db.getDefaultPermissionsForRole
        ? window.db.getDefaultPermissionsForRole(normRol)
        : (existingWorker ? existingWorker.permisos : null);
    }

    if (editId) {
      workerData.id = editId;
      let updated = window.db.update("workers", editId, workerData);
      if (!updated) {
        const idx = allWorkers.findIndex(w => w.id === editId);
        if (idx !== -1) {
          allWorkers[idx] = { ...allWorkers[idx], ...workerData };
          window.db.save("workers", allWorkers);
          updated = allWorkers[idx];
        }
      }

      if (updated) {
        const currentUser = window.db.getCurrentUser();
        if (currentUser && (currentUser.id === editId || (existingWorker && currentUser.dni === existingWorker.dni))) {
          const updatedSessionUser = {
            ...currentUser,
            id: updated.id,
            dni: updated.dni,
            nombre: updated.nombre,
            cargo: updated.cargo,
            rol: window.db.normalizeRole(updated.rol),
            sede: window.db.normalizeSede(updated.sede),
            email: updated.email,
            usuario: updated.usuario || updated.dni,
            username: updated.usuario || updated.nombre,
            permisos: updated.permisos || currentUser.permisos,
            foto: workerData.foto || currentUser.foto || ""
          };
          if (workerData.foto) {
            localStorage.setItem("PAOLO_ALDEA_USER_PHOTO_" + updated.id, workerData.foto);
            this.updateProfilePhotoUI(workerData.foto);
          }
          window.db.setCurrentUser(updatedSessionUser);
          this.applySettingsToUI();
          if (typeof this.renderDynamicSidebarModules === "function") {
            this.renderDynamicSidebarModules();
          }
        }
        this.showToast(`Colaborador ${nombre} actualizado correctamente en el padrón.`, "success");
      } else {
        this.showToast("Error al actualizar colaborador.", "error");
        return;
      }
    } else {
      const nums = (allWorkers || []).map(w => {
        const m = (w.id || "").match(/WRK-(\d+)/);
        return m ? parseInt(m[1], 10) : 0;
      });
      const maxNum = nums.length > 0 ? Math.max(...nums) : 0;
      const nextNum = maxNum + 1;
      workerData.id = `WRK-${String(nextNum).padStart(3, "0")}`;
      workerData.createdAt = new Date().toISOString();
      const created = window.db.add("workers", workerData);
      if (!created) {
        this.showToast("No se pudo registrar el colaborador. Verifique permisos o reintente.", "error");
        return;
      }
      this.showToast(`Colaborador ${nombre} registrado exitosamente con ID ${workerData.id} y usuario '${finalUsuario}'.`, "success");
      if (this._tempPasswordOnce) {
        alert(`Credenciales iniciales de ${finalUsuario}\nContrasena temporal: ${this._tempPasswordOnce}\nPIN: ${finalPin}\n\nEntreguelas en privado; no se volveran a mostrar.`);
        this._tempPasswordOnce = null;
      }
    }

    this.editingPersonalId = null;

    // Publicar colaborador en directorio nube (multi-dispositivo)
    const canUpsertCloud = window.__ENTERPRISE_CLOUD__ && window.PaoloAuthService && (
      window.__CLOUD_AUTH_BOOTSTRAPPED__ ||
      (window.PaoloCloudDataSync && typeof window.PaoloCloudDataSync.getToken === "function" && window.PaoloCloudDataSync.getToken())
    );
    if (canUpsertCloud) {
      try {
        await window.PaoloAuthService.upsertStaffCloud({
          id: workerData.id,
          usuario: workerData.usuario,
          email: workerData.email,
          dni: workerData.dni,
          nombre: workerData.nombre,
          cargo: workerData.cargo,
          rol: workerData.rol,
          sede: workerData.sede,
          passwordHash: workerData.passwordHash,
          pinHash: workerData.pinHash,
          activo: workerData.activo,
          permisos: workerData.permisos
        });
      } catch (cloudStaffErr) {
        console.warn("[Personal] Sync nube:", cloudStaffErr && cloudStaffErr.message);
        this.showToast("Guardado local OK. Sync nube pendiente: " + (cloudStaffErr.message || "error"), "warning");
      }
    }

    // Garantizar que los filtros de la vista Gestión de Personal no oculten al colaborador recién editado o creado
    const sInput = document.getElementById("searchPersonal");
    const fSede = document.getElementById("filterSedePersonal");
    const fRol = document.getElementById("filterRolPersonal");
    const fEstado = document.getElementById("filterEstadoPersonal");

    if (sInput && sInput.value.trim()) {
      const q = sInput.value.toLowerCase().trim();
      const matchesQuery =
        (workerData.dni && workerData.dni.toLowerCase().includes(q)) ||
        (workerData.usuario && workerData.usuario.toLowerCase().includes(q)) ||
        (workerData.nombre && workerData.nombre.toLowerCase().includes(q)) ||
        (workerData.cargo && workerData.cargo.toLowerCase().includes(q)) ||
        (workerData.colegiatura && workerData.colegiatura.toLowerCase().includes(q)) ||
        (workerData.email && workerData.email.toLowerCase().includes(q));
      if (!matchesQuery) {
        sInput.value = "";
      }
    }
    if (fSede && fSede.value !== "ALL" && fSede.value !== workerData.sede) {
      fSede.value = "ALL";
    }
    if (fRol && fRol.value !== "ALL" && fRol.value !== workerData.rol) {
      fRol.value = "ALL";
    }
    const isNowActivo = workerData.activo !== false;
    if (fEstado && fEstado.value !== "ALL") {
      if ((fEstado.value === "ACTIVO" && !isNowActivo) || (fEstado.value === "INACTIVO" && isNowActivo)) {
        fEstado.value = "ALL";
      }
    }

    this.closeModal("modalPersonal");
    this.renderPersonal();
    if (typeof this.renderRolesYPermisos === "function") {
      this.renderRolesYPermisos();
    }
    if (window.AttendanceModule && typeof window.AttendanceModule.initWorkerSelector === "function") {
      window.AttendanceModule.initWorkerSelector();
    }
  }

  toggleWorkerStatus(workerId) {
    const allWorkers = window.db ? window.db.getRaw("workers") : [];
    const worker = allWorkers.find(w => w.id === workerId);
    if (!worker) return;

    if (worker.id === "WRK-000" || worker.rol === "super_admin") {
      this.showToast("Por seguridad institucional, no se puede dar de baja al Director General.", "error");
      return;
    }

    const newStatus = !(worker.activo !== false && worker.activo !== "false");
    window.db.update("workers", workerId, { activo: newStatus });
    this.showToast(`Colaborador ${worker.nombre} ${newStatus ? 'activado' : 'dado de baja temporalmente'}.`, "info");
    this.renderPersonal();
  }

  async deleteWorkerRecord(workerId) {
    const allWorkers = window.db ? window.db.getRaw("workers") : [];
    const worker = allWorkers.find(w => w.id === workerId);
    if (!worker) return;

    const isSuper = window.db ? window.db.isSuperAdmin() : false;
    const currentUser = window.db ? window.db.getCurrentUser() : null;
    if (currentUser && currentUser.id === workerId) {
      this.showToast("No puede eliminar la sesión actualmente en uso.", "warning");
      return;
    }
    if (!isSuper && (workerId === "WRK-000" || worker.rol === "super_admin")) {
      this.showToast("No se puede eliminar la cuenta principal de la Dirección General.", "error");
      return;
    }

    const confirmed = await this.confirmAction({
      title: "Eliminar del padrón",
      message: "Esta acción es irreversible. El colaborador dejará de aparecer en la nómina tras sincronizar.",
      detail: `${worker.nombre || "Colaborador"}${worker.cargo ? " · " + worker.cargo : ""}`,
      confirmLabel: "Sí, eliminar",
      cancelLabel: "Cancelar",
      danger: true
    });
    if (!confirmed) return;

    // Baja en nube primero para que el sync periódico no lo resuscite
    if (window.__ENTERPRISE_CLOUD__ && window.PaoloAuthService && typeof window.PaoloAuthService.upsertStaffCloud === "function") {
      try {
        await window.PaoloAuthService.upsertStaffCloud({
          id: worker.id,
          usuario: worker.usuario || worker.username || ("user_" + (worker.dni || worker.id)),
          email: worker.email || "",
          dni: worker.dni || "",
          nombre: worker.nombre || "",
          cargo: worker.cargo || "",
          rol: worker.rol || "asistente_admin",
          sede: worker.sede || "challhuahuacho",
          passwordHash: worker.passwordHash || "",
          pinHash: worker.pinHash || "",
          activo: false,
          permisos: worker.permisos || null
        });
      } catch (cloudErr) {
        this.showToast("No se pudo eliminar en la nube: " + ((cloudErr && cloudErr.message) || "error"), "error");
        return;
      }
    }

    const deleted = window.db.delete("workers", workerId);
    if (!deleted) {
      this.showToast("No se pudo eliminar al colaborador (permisos o restricción de sede).", "error");
      return;
    }
    if (window.PaoloCloudDataSync && typeof window.PaoloCloudDataSync.pushCollection === "function") {
      try {
        await window.PaoloCloudDataSync.pushCollection("workers");
      } catch (_) {}
    }
    this.showToast(`Colaborador ${worker.nombre} eliminado del sistema.`, "warning");
    this.renderPersonal();
    if (typeof this.renderRolesYPermisos === "function") {
      this.renderRolesYPermisos();
    }
    if (window.AttendanceModule) {
      if (typeof window.AttendanceModule.renderWorkersList === "function") {
        window.AttendanceModule.renderWorkersList();
      }
      if (typeof window.AttendanceModule.initWorkerSelector === "function") {
        window.AttendanceModule.initWorkerSelector();
      }
    }
  }

  async updateAdminPassword(e) {
    if (e) e.preventDefault();
    const currentPass = (document.getElementById("cfgCurrentPassword")?.value || "").trim();
    const newPass = (document.getElementById("cfgNewPassword")?.value || "").trim();
    const confirmPass = (document.getElementById("cfgConfirmPassword")?.value || "").trim();

    const settings = window.db ? window.db.getSettings() : {};
    if (!window.db.isSuperAdmin()) { alert("Solo el Super Administrador puede cambiar la contrasena del despacho."); return; }
    const currentOk = settings.adminPasswordHash ? await window.verifySecret(currentPass, settings.adminPasswordHash) : false;

    if (!currentOk) {
      alert("La contraseña actual ingresada no es correcta.");
      return;
    }

    const _pwErr = this._validatePasswordPolicy(newPass);
    if (_pwErr) {
      alert(_pwErr);
      return;
    }

    if (newPass !== confirmPass) {
      alert("Las nuevas contraseñas no coinciden. Verifique ambas casillas.");
      return;
    }

    settings.adminPasswordHash = await window.hashSecret(newPass);
    delete settings.adminPassword;
    window.db.saveSettings(settings);

    const elCur = document.getElementById("cfgCurrentPassword");
    if (elCur) elCur.value = "";
    const elNew = document.getElementById("cfgNewPassword");
    if (elNew) elNew.value = "";
    const elConf = document.getElementById("cfgConfirmPassword");
    if (elConf) elConf.value = "";

    this.showToast("Contraseña de despacho actualizada con cifrado SHA-256", "success");
  }

  // =========================================================================
  // GENERADOR INTELIGENTE DE ESCRITOS JUDICIALES & PLANTILLAS LEGALES
  // =========================================================================
  openGeneradorEscritoModal(casoId) {
    const caso = (window.db ? window.db.get("casos") : []).find(c => c.id === casoId);
    if (!caso) {
      this.showToast("No se encontró el expediente seleccionado", "error");
      return;
    }

    this.currentEscritoCaso = caso;
    const settings = window.db ? window.db.getSettings() : {};
    const inputAtty = document.getElementById("genEscritoAbogado");
    if (inputAtty) {
      inputAtty.value = settings.managingAttorney ? `${settings.managingAttorney} — ${settings.firmLicense || 'CAL'}` : "Dr. Paolo Aldea Quincho — CAL N° 45890";
    }

    this.regenerarPlantillaEscrito();
    this.openModal("modalGeneradorEscrito");
  }

  regenerarPlantillaEscrito() {
    const caso = this.currentEscritoCaso;
    if (!caso) return;

    const tipo = document.getElementById("genEscritoTipo")?.value || "apersonamiento";
    const abogado = document.getElementById("genEscritoAbogado")?.value || "Dr. Paolo Aldea Quincho";
    const settings = window.db ? window.db.getSettings() : {};
    const textarea = document.getElementById("genEscritoContenido");
    if (!textarea) return;

    const branchCfg = (window.SEDES_CONFIG && caso.sede) ? window.SEDES_CONFIG[caso.sede] : null;
    const domicilio = branchCfg ? branchCfg.direccion : (settings.firmAddress || "Av. Los Mineros Mz. D Lt. 4, Challhuahuacho, Cotabambas");
    const juzgado = caso.juzgado || "JUZGADO MIXTO DE COTABAMBAS - TAMBOBAMBA";
    const cliente = caso.cliente || "MI PATROCINADO";
    const expediente = caso.expediente || "00142-2024-0-0303-JM-CI-01";
    const materia = caso.materia || "CIVIL / PENAL";

    let texto = "";

    // Compilador modular especializado de documentos legales
    if (this.documents && typeof this.documents.compileTemplate === "function") {
      const compiled = this.documents.compileTemplate(tipo, {
        expediente, juzgado, cliente, materia, abogado, domicilioSede: domicilio
      });
      if (compiled) {
        textarea.value = compiled;
        return;
      }
    }

    if (tipo === "apersonamiento") {
      texto = `EXPEDIENTE   : ${expediente}
ESPECIALISTA : A CARGO DE LA CAUSA
CUADERNO     : PRINCIPAL
ESCRITO N°   : 01-2026
SUMILLA      : ME APERSONO A LA CAUSA, NOMBRO ABOGADO DEFENSOR Y SEÑALO CASILLA ELECTRÓNICA SINOE

SEÑOR JUEZ DEL ${juzgado.toUpperCase()}:

${cliente.toUpperCase()}, identificado(a) con DNI/RUC conforme obra en autos, con domicilio procesal en ${domicilio}, y con CASILLA ELECTRÓNICA SINOE N° 89412 del Poder Judicial; en los seguidos sobre ${materia.toUpperCase()}, a usted con el debido respeto me presento y expongo:

I. PETITORIO:
Que, de conformidad con el derecho de defensa garantizado en el artículo 139° inciso 14 de la Constitución Política del Estado, cumplo con APERSONARME a la presente causa judicial, nombrando como mi Abogado Defensor a don ${abogado}, a quien confiero las facultades generales de representación contenidas en el artículo 74° del Código Procesal Civil.

II. DOMICILIO PROCESAL Y CASILLA ELECTRÓNICA:
A efectos de que se me notifique válidamente con las resoluciones y decretos que emanen de su despacho, señalo:
- Domicilio Procesal Físico: ${domicilio}
- Casilla Electrónica SINOE: N° 89412 (Central de Notificaciones del Poder Judicial)
- Correo Electrónico Institucional: notificaciones@aldea-abogados.pe
- Teléfono de Urgencias Procesales: ${settings.firmPhone || '+51 943 410 215'}

POR TANTO:
A usted Señor Juez, pido tener por presentado mi apersonamiento y proveer conforme a ley.

PRIMER OTROSÍ DIGO: Adjunto fotocopia de documento de identidad y comprobante de pago de arancel judicial por derecho de apersonamiento en Banco de la Nación.

Challhuahuacho / Cotabambas, ${new Date().toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}.



_________________________________                _________________________________
         PATROCINADO(A)                                 ${abogado.toUpperCase()}
`;
    } else if (tipo === "impulso") {
      texto = `EXPEDIENTE   : ${expediente}
ESPECIALISTA : A CARGO DE LA CAUSA
CUADERNO     : PRINCIPAL
ESCRITO N°   : CORRELATIVO
SUMILLA      : SOLICITO IMPULSO PROCESAL Y PRONUNCIAMIENTO RESPECTO A ESCRITO PENDIENTE

SEÑOR JUEZ DEL ${juzgado.toUpperCase()}:

${cliente.toUpperCase()}, en los autos seguidos sobre ${materia.toUpperCase()}, a usted respetuosamente digo:

I. PETITORIO:
Que, al amparo del Principio de Celeridad y Dirección del Proceso consagrado en el Título Preliminar del Código Procesal y el derecho a un proceso sin dilaciones indebidas, SOLICITO a su digna judicatura se sirva DISPONER EL INMEDIATO IMPULSO PROCESAL DE LA CAUSA y emitir la resolución judicial que en derecho corresponda respecto al escrito presentado con fecha precedente, habiendo precluido con creces los plazos de ley.

II. FUNDAMENTOS:
1. Conforme fluye del estado de la causa, este patrocinio cumplió oportunamente con evacuar las observaciones y adjuntar los aranceles de ley.
2. La inacción procesal perjudica de manera irreparable los derechos legítimos de mi representada, por lo que resulta imperativo que los actuados pasen a despacho del Señor Juez para resolver de inmediato.

POR TANTO:
Pido a su despacho dar el trámite urgente solicitado.

Challhuahuacho / Cotabambas, ${new Date().toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}.



_________________________________                _________________________________
         PATROCINADO(A)                                 ${abogado.toUpperCase()}
`;
    } else if (tipo === "apelacion") {
      texto = `EXPEDIENTE   : ${expediente}
ESPECIALISTA : A CARGO DE LA CAUSA
CUADERNO     : PRINCIPAL / APELACIÓN
ESCRITO N°   : CORRELATIVO
SUMILLA      : INTERPONGO RECURSO DE APELACIÓN CON EFECTO SUSPENSIVO CONTRA RESOLUCIÓN QUE ME CAUSA AGRAVIO

SEÑOR JUEZ DEL ${juzgado.toUpperCase()}:

${cliente.toUpperCase()}, en los seguidos sobre ${materia.toUpperCase()}, a usted atentamente digo:

I. PETITORIO:
Que, dentro del plazo perentorio de ley y de conformidad con lo previsto en el artículo 364° y siguientes del Código Procesal Civil / Código Procesal Penal, INTERPONGO RECURSO DE APELACIÓN con efecto suspensivo contra la resolución emitida por vuestro despacho, a fin de que sea admitida y elevada al Superior Jerárquico (Sala Mixta / Penal de Apelaciones), donde esperamos sea REVOCADA o declarada NULA en todos sus extremos.

II. FUNDAMENTACIÓN DEL AGRAVIO:
1. ERROR DE DERECHO E INAPLICACIÓN NORMATIVA: La resolución impugnada vulnera frontalmente el debido proceso y la debida motivación de las resoluciones judiciales al omitir pronunciamiento expreso sobre los medios probatorios válidamente incorporados.
2. GRAVE PERJUICIO ECONÓMICO Y MORAL: Se causa un gravamen irreparable a mi representado al privársele de la tutela jurisdiccional efectiva.

POR TANTO:
Solicito conceder el recurso interpuesto y elevar los autos a la Sala Superior.

OTROSÍ DIGO: Cumplo con adjuntar el arancel judicial respectivo por derecho de apelación expedido por el Banco de la Nación.

Challhuahuacho / Cotabambas, ${new Date().toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}.



_________________________________                _________________________________
         PATROCINADO(A)                                 ${abogado.toUpperCase()}
`;
    } else if (tipo === "contestacion") {
      texto = `EXPEDIENTE   : ${expediente}
ESPECIALISTA : A CARGO DE LA CAUSA
CUADERNO     : PRINCIPAL
ESCRITO N°   : 01
SUMILLA      : CONTESTO LA DEMANDA / DEDUZCO EXCEPCIONES Y OFREZCO MEDIOS PROBATORIOS

SEÑOR JUEZ DEL ${juzgado.toUpperCase()}:

${cliente.toUpperCase()}, en los seguidos en mi contra sobre ${materia.toUpperCase()}, ante usted me apersono y expongo:

I. PETITORIO:
Que, dentro del plazo de ley, cumplo con CONTESTAR LA DEMANDA incoada en mi contra, solicitando a su despacho se sirva declararla INFUNDADA en todos sus extremos, con expresa condena de costas y costos del proceso, en mérito a los fundamentos de hecho y de derecho siguientes:

II. EXCEPCIÓN PREVIA DE FALTA DE LEGITIMIDAD PARA OBRAR:
Deduco la excepción previa conforme al artículo 446° del CPC, toda vez que el demandante carece del título habilitante legítimo para accionar en la presente vía.

III. FUNDAMENTOS DE HECHO:
1. Es falso que mi parte haya incurrido en incumplimiento contractual o daño indemnizable...

IV. MEDIOS PROBATORIOS:
1. El mérito del contrato celebrado con firmas legalizadas ante Notario Público.
2. Los comprobantes de pago bancarizados a través de cuenta institucional.

POR TANTO:
A usted Señor Juez solicito admitir la presente contestación y tener por ofrecidos los medios probatorios.

Challhuahuacho / Cotabambas, ${new Date().toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}.



_________________________________                _________________________________
         PATROCINADO(A)                                 ${abogado.toUpperCase()}
`;
    } else if (tipo === "carta_notarial") {
      texto = `CARTA NOTARIAL DE REQUERIMIENTO DE PAGO Y APERCIBIMIENTO LEGAL

Challhuahuacho, ${new Date().toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}.

SEÑOR(ES):
[NOMBRE DEL DESTINATARIO / CONTRATISTA]
DOMICILIO: [DIRECCIÓN EXACTA EN COTABAMBAS / CUSCO / LIMA]

DE NUESTRA CONSIDERACIÓN:

Por intermedio del conducto notarial, me dirijo a usted en representación legal de ${cliente.toUpperCase()}, con el patrocinio del estudio ${settings.firmName || 'PAOLO ALDEA & ABOGADOS'} (${branchCfg ? branchCfg.nombre : 'Sede Challhuahuacho'}), a fin de REQUERIRLE formal y expresamente lo siguiente:

1. Que, en un plazo IMPRORROGABLE de CUARENTA Y OCHO (48) HORAS de notificada la presente, cumpla con realizar el pago íntegro de la suma adeudada por concepto de valorizaciones y honorarios profesionales derivados del caso judicial N° ${expediente}.

2. En caso de hacer caso omiso al presente requerimiento, procederemos de inmediato a interponer las ACCIONES JUDICIALES correspondientes en la vía Civil y Penal (Acción de Cobro de Soles, Medidas Cautelares de Embargo y Denuncia Penal por Fraude), solicitando además el pago de intereses legales moratorios, costas y costos del proceso.

SIN OTRO PARTICULAR, QUEDA USTED DEBIDAMENTE NOTIFICADO Y APERCIBIDO.

Atentamente,


_________________________________                _________________________________
         PATROCINADO(A)                                 ${abogado.toUpperCase()}
`;
    }

    textarea.value = texto;
  }

  copiarEscritoAlPortapapeles() {
    const textarea = document.getElementById("genEscritoContenido");
    if (!textarea || !textarea.value) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textarea.value).then(() => {
        this.showToast("¡Escrito judicial copiado al portapapeles con éxito!", "success");
      }).catch(() => {
        textarea.select();
        document.execCommand("copy");
        this.showToast("¡Escrito judicial copiado!", "success");
      });
    } else {
      textarea.select();
      document.execCommand("copy");
      this.showToast("¡Escrito judicial copiado!", "success");
    }
  }

  descargarEscritoArchivo() {
    const textarea = document.getElementById("genEscritoContenido");
    if (!textarea || !textarea.value) return;

    const tipo = document.getElementById("genEscritoTipo")?.value || "escrito";
    const exp = (this.currentEscritoCaso?.expediente || "expediente").replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `ESCRITO_${tipo.toUpperCase()}_${exp}.txt`;

    const blob = new Blob([textarea.value], { type: "text/plain;charset=utf-8" });
    if (typeof saveAs !== "undefined") {
      saveAs(blob, fileName);
    } else {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(a.href);
    }
    this.showToast(`Archivo ${fileName} descargado`, "info");
  }

  // =========================================================================
  // LÍNEA DE TIEMPO PROCESAL / TIMELINE HISTÓRICO
  // =========================================================================
  openTimelineCasoModal(casoId) {
    const caso = (window.db ? window.db.get("casos") : []).find(c => c.id === casoId);
    if (!caso) {
      this.showToast("No se encontró el expediente", "error");
      return;
    }

    const titleEl = document.getElementById("timelineModalTitle");
    const subEl = document.getElementById("timelineModalSubtitle");
    const container = document.getElementById("timelineEventsContainer");

    if (titleEl) titleEl.textContent = `Línea de Tiempo: ${caso.expediente}`;
    if (subEl) subEl.textContent = `${caso.caratula || caso.cliente} • ${caso.juzgado || 'Cotabambas'}`;

    if (!container) return;

    // Generar eventos cronológicos del caso
    const events = [];

    if (caso.fechaInicio) {
      events.push({
        fecha: caso.fechaInicio,
        titulo: "Ingreso de la Causa / Demanda Inicial",
        descripcion: `Apertura del expediente en ${caso.juzgado || 'Juzgado'}. Patrocinado: ${caso.cliente}`,
        icono: "fa-folder-plus",
        color: "bg-blue-600 text-white"
      });
    }

    if (caso.pdfMeta?.expediente?.uploadedAt) {
      events.push({
        fecha: caso.pdfMeta.expediente.uploadedAt.split("T")[0],
        titulo: "Expediente Digital Digitalizado e Incorporado",
        descripcion: `Archivo digital: ${caso.pdfMeta.expediente.fileName} (${(caso.pdfMeta.expediente.fileSize / (1024*1024)).toFixed(2)} MB)`,
        icono: "fa-file-pdf",
        color: "bg-indigo-600 text-white"
      });
    }

    if (caso.pdfMeta?.resolucion?.uploadedAt) {
      events.push({
        fecha: caso.pdfMeta.resolucion.uploadedAt.split("T")[0],
        titulo: "Resolución Judicial Notificada",
        descripcion: `Resolución oficial adjuntada: ${caso.pdfMeta.resolucion.fileName}`,
        icono: "fa-gavel",
        color: "bg-rose-600 text-white"
      });
    }

    if (caso.proximaAudiencia && caso.proximaAudiencia !== "-") {
      events.push({
        fecha: caso.proximaAudiencia.split("T")[0],
        titulo: "Audiencia Judicial Programada",
        descripcion: `Diligencia en Sala / Meet a las ${caso.proximaAudiencia.split("T")[1] || '10:00'} hrs.`,
        icono: "fa-calendar-check",
        color: "bg-amber-500 text-slate-950"
      });
    }

    if (caso.vencimiento) {
      events.push({
        fecha: caso.vencimiento,
        titulo: "Plazo Fatal / Término Perentorio",
        descripcion: caso.detalleVencimiento || "Vencimiento para presentación de escrito o alegatos.",
        icono: "fa-triangle-exclamation",
        color: "bg-red-600 text-white"
      });
    }

    if (caso.estado === "Concluido / Ganado") {
      events.push({
        fecha: new Date().toISOString().split("T")[0],
        titulo: "Sentencia Favorable / Causa Concluida con Ééxito",
        descripcion: `Estado actual: ${caso.etapa || 'Ejecución de Sentencia'}. Honorarios liquidados.`,
        icono: "fa-award",
        color: "bg-emerald-600 text-white"
      });
    }

    // Ordenar cronológicamente
    events.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    if (events.length === 0) {
      container.innerHTML = `<p class="text-slate-400 italic">No hay actuaciones registradas en este expediente.</p>`;
    } else {
      container.innerHTML = events.map(ev => `
        <div class="relative pl-6">
          <span class="absolute -left-3 top-0.5 w-6 h-6 rounded-full ${ev.color} flex items-center justify-center text-xs shadow-md">
            <i class="fa-solid ${ev.icono}"></i>
          </span>
          <div class="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-1">
            <div class="flex items-center justify-between">
              <span class="font-bold text-slate-800 text-xs">${escapeHtml(ev.titulo)}</span>
              <span class="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">${escapeHtml(ev.fecha)}</span>
            </div>
            <p class="text-[11px] text-slate-600">${escapeHtml(ev.descripcion)}</p>
          </div>
        </div>
      `).join("");
    }

    this.openModal("modalTimelineCaso");
  }

  showExportLoading(titulo, desc) {
    const modal = document.getElementById("modalExportProgress");
    const tEl = document.getElementById("exportProgressTitle");
    const dEl = document.getElementById("exportProgressDesc");
    if (tEl && titulo) tEl.textContent = titulo;
    if (dEl && desc) dEl.textContent = desc;
    if (modal) modal.classList.remove("hidden");
  }

  hideExportLoading() {
    const modal = document.getElementById("modalExportProgress");
    if (modal) modal.classList.add("hidden");
  }

  /** Exportar PDF/Excel exige permiso 'export' del modulo (evita fuga de informacion por rol). */
  _canExport(module) {
    const mod = ({ resoluciones: "casos" })[module] || module;
    if (!window.db || window.db.canDo(null, "export", mod)) return true;
    this.showToast("Acceso denegado: su rol no puede exportar el modulo " + mod + ".", "error");
    return false;
  }
  async exportModule(module) {
    // KPIs → reporte maestro completo (todas las pestañas)
    if (module === "kpis") {
      const canMaster = !window.db || ["kpis", "caja_chica", "casos", "presupuestos"].some((m) => window.db.canDo(null, "export", m));
      if (!canMaster) {
        this.showToast("Acceso denegado: su rol no puede exportar el reporte maestro.", "error");
        return;
      }
      if (window.excelExporter && typeof window.excelExporter.exportMasterWorkbook === "function") {
        this.showExportLoading("Generando Libro Excel Maestro...", "Consolidando caja, casos, citas, presupuestos, inventario, documentos, asistencia y personal.");
        try {
          await new Promise(r => setTimeout(r, 80));
          return await window.excelExporter.exportMasterWorkbook();
        } finally {
          this.hideExportLoading();
        }
      }
      return;
    }
    if (!this._canExport(module)) return;
    if (window.excelExporter && typeof window.excelExporter.exportModule === "function") {
      this.showExportLoading("Generando Libro Excel de Alta Definición...", `Procesando registros de ${module} con formato contable oficial.`);
      try {
        await new Promise(r => setTimeout(r, 80));
        return await window.excelExporter.exportModule(module);
      } finally {
        this.hideExportLoading();
      }
    }
  }

  async exportPdf(module) {
    if (!this._canExport(module === "kpis" ? "casos" : module)) return;
    if (window.pdfExporter && typeof window.pdfExporter.exportModulePdf === "function") {
      this.showExportLoading("Renderizando Informe Oficial en PDF...", `Generando vista vectorial y foliado institucional de ${module}.`);
      try {
        await new Promise(r => setTimeout(r, 80));
        return await window.pdfExporter.exportModulePdf(module);
      } finally {
        this.hideExportLoading();
      }
    }
  }
  // =========================================================================
  // CONTROLADOR DEL PANEL DE SUPER-ADMINISTRADOR & SOCIO FUNDADOR (MASTER ADMIN)
  // =========================================================================
  isMasterUnlocked() {
    return sessionStorage.getItem("PAOLO ALDEA_MASTER_UNLOCKED") === "true";
  }

  openMasterAdmin() {
    const currentUser = window.db ? window.db.getCurrentUser() : null;
    const isSuper = window.db && typeof window.db.isSuperAdmin === "function" 
      ? window.db.isSuperAdmin(currentUser) 
      : (window.db ? (window.db.getUserRole(currentUser) === "super_admin" || window.db.getUserRole(currentUser) === "socio") : false);

    if (!isSuper) {
      this.showToast("Acceso denegado: El Panel de Control Total & Gobierno es exclusivo del rol Super Administrador y Socios de la firma.", "error");
      return;
    }

    if (this.isMasterUnlocked()) {
      this.switchTab("master_admin");
      this.renderMasterPanel();
    } else {
      this.openModal("modalMasterAuth");
    }
  }

  async submitMasterAuth(e) {
    if (e) e.preventDefault();
    const inKey = document.getElementById("inputMasterAuthKey");
    const val = (inKey?.value || "").trim();

    if (!val) {
      alert("Por favor ingrese la credencial de acceso de Direcci\u00F3n.");
      inKey?.focus();
      return;
    }

    const _remainM = this._loginGuardRemaining();
    if (_remainM > 0) {
      alert("Acceso bloqueado por intentos fallidos. Espere " + Math.ceil(_remainM / 1000) + " segundos.");
      return;
    }
    if (!window.db.isSuperAdmin()) {
      alert("Solo el Super Administrador puede desbloquear este panel.");
      return;
    }
    const s = window.db ? window.db.getSettings() : {};
    let isValid = false;
    for (const h of [s.adminPasswordHash, s.masterPasswordHash, s.masterPinHash, s.bossPasswordHash].filter(Boolean)) {
      if (await window.verifySecret(val, h)) { isValid = true; break; }
    }
    if (isValid) this._loginGuardReset(); else this._loginGuardFail();

    if (isValid) {
      sessionStorage.setItem("PAOLO ALDEA_MASTER_UNLOCKED", "true");
      this.closeModal("modalMasterAuth");
      this.switchTab("master_admin");
      this.renderMasterPanel();
      this.showToast("Acceso verificado. Bienvenido al Panel de Control Total & Gobierno.", "success");
    } else {
      alert("Credencial de acceso incorrecta. Verifique la Clave o PIN de Super Administrador.");
      inKey?.focus();
    }
  }
    lockMasterAdmin() {
    sessionStorage.removeItem("PAOLO ALDEA_MASTER_UNLOCKED");
    this.switchTab("kpis");
    this.showToast("Sesión de Control Total cerrada con éxito.", "info");
  }

  switchMasterSubTab(subTab) {
    document.querySelectorAll(".master-subview").forEach(v => v.classList.add("hidden"));
    document.querySelectorAll(".master-subtab-btn").forEach(btn => {
      btn.className = "master-subtab-btn px-4 py-2 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition flex items-center gap-2";
    });

    const activeView = document.getElementById(`master-subview-${subTab}`);
    const activeBtn = document.getElementById(`master-subtab-btn-${subTab}`);
    if (activeView) activeView.classList.remove("hidden");
    if (activeBtn) activeBtn.className = "master-subtab-btn px-4 py-2 rounded-lg text-xs font-bold bg-amber-500 text-slate-950 shadow-sm transition flex items-center gap-2";

    if (subTab === "modulos") this.renderMasterModulosGrid();
    if (subTab === "sedes") this.renderMasterSedes();
    if (subTab === "rbac") this.renderMasterRbacTable();
    if (subTab === "ajustes") this.applySettingsToUI();
    if (subTab === "historial") this.renderMasterHistorial();
  }

  renderMasterPanel() {
    this.renderMasterModulosGrid();
    this.renderMasterSedes();
    this.renderMasterRbacTable();

    // Cargar ajustes de nube
    const s = window.db ? window.db.getSettings() : {};
    const inEndpoint = document.getElementById("masterCloudEndpoint");
    const inApiKey = document.getElementById("masterCloudApiKey");
    const chkAuto = document.getElementById("masterCloudAutoSync");

    if (inEndpoint) inEndpoint.value = s.cloudSyncEndpoint || "";
    if (inApiKey) inApiKey.value = s.cloudSyncApiKey || "";
    if (chkAuto) chkAuto.checked = !!s.cloudSyncAuto;
  }

  renderMasterModulosGrid() {
    const container = document.getElementById("masterModulosGrid");
    if (!container || !window.db) return;

    const modules = window.db.getModulesConfig();
    container.innerHTML = modules.map(m => {
      const isEnabled = m.enabled !== false;
      const rolesText = (m.rolesAllowed || []).map(r => window.db.getRoleLabel ? window.db.getRoleLabel(r) : r).join(", ") || "Todos";

      return `
        <div class="bg-white p-4 rounded-xl border ${isEnabled ? 'border-slate-200 shadow-xs' : 'border-dashed border-slate-300 bg-slate-50/70 opacity-75'} flex flex-col justify-between gap-3 transition">
          <div class="space-y-2">
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-sm ${m.iconColor || 'text-slate-700'} border border-slate-200 shrink-0">
                  <i class="fa-solid ${escapeHtml(m.icon || 'fa-folder')}"></i>
                </div>
                <div>
                  <h4 class="font-bold text-xs text-slate-900 leading-tight">${escapeHtml(m.label)}</h4>
                  <span class="text-[10px] text-slate-400 font-medium">${escapeHtml(m.category || 'Módulo')}</span>
                </div>
              </div>
              <span class="text-[9.5px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0 ${isEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}">
                ${isEnabled ? 'Activo' : 'Oculto'}
              </span>
            </div>
            <div class="text-[10.5px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 line-clamp-2">
              <strong class="text-slate-700">Roles con acceso:</strong> ${escapeHtml(rolesText)}
            </div>
          </div>

          <div class="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
            <button type="button" onclick="window.app.toggleModuloStatus(${jsStr(m.id)})" class="px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1.5 ${isEnabled ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}">
              <i class="fa-solid ${isEnabled ? 'fa-eye-slash' : 'fa-eye'}"></i>
              <span>${isEnabled ? 'Ocultar' : 'Activar'}</span>
            </button>

            <div class="flex items-center gap-1">
              <button type="button" onclick="window.app.openEditarModuloModal(${jsStr(m.id)})" class="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg transition" title="Renombrar o cambiar ícono">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>
              ${m.isCustom ? `
                <button type="button" onclick="window.app.eliminarModuloPersonalizado(${jsStr(m.id)})" class="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition" title="Eliminar apartado">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join("");

    this.renderDynamicSidebarModules();
  }

  toggleModuloStatus(modId) {
    if (!window.db) return;
    const modules = window.db.getModulesConfig();
    const target = modules.find(m => m.id === modId);
    if (!target) return;

    target.enabled = target.enabled === false ? true : false;
    window.db.saveModulesConfig(modules);
    this.renderMasterModulosGrid();
    this.showToast(`Estado de ${target.label}: ${target.enabled ? 'Habilitado' : 'Oculto'} en la firma.`, "info");
  }

  openNuevoModuloModal() {
    const form = document.getElementById("modalNuevoModulo");
    if (form) {
      document.getElementById("nuevoModNombre").value = "";
      document.getElementById("nuevoModDesc").value = "";
      this.showModal("modalNuevoModulo");
    }
  }

  guardarNuevoModulo(e) {
    if (e) e.preventDefault();
    const nombre = (document.getElementById("nuevoModNombre")?.value || "").trim();
    if (!nombre) return;

    const icono = document.getElementById("nuevoModIcono")?.value || "fa-briefcase";
    const categoria = document.getElementById("nuevoModCategoria")?.value || "Control Ejecutivo";
    const tipo = document.getElementById("nuevoModTipo")?.value || "tabla";
    const desc = (document.getElementById("nuevoModDesc")?.value || "").trim();

    const slug = "mod_" + nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "_").slice(0, 20);

    const modules = window.db.getModulesConfig();
    if (modules.some(m => m.id === slug)) {
      alert("Ya existe un apartado con un nombre similar.");
      return;
    }

    const newMod = {
      id: slug,
      label: nombre,
      icon: icono,
      iconColor: "text-amber-400",
      category: categoria,
      tipo: tipo,
      descripcion: desc,
      enabled: true,
      isCustom: true,
      rolesAllowed: ["socio", "admin", "abogado"]
    };

    modules.push(newMod);
    window.db.saveModulesConfig(modules);
    if (!window.db.get(slug)) {
      window.db.save(slug, []);
    }

    this.closeModal("modalNuevoModulo");
    this.renderMasterModulosGrid();
    this.showToast(`Apartado «${nombre}» creado con éxito en el sistema.`, "success");
  }

  eliminarModuloPersonalizado(modId) {
    if (!confirm("¿Está seguro de eliminar este apartado personalizado? Los datos asociados se mantendrán archivados localmente.")) return;
    const modules = window.db.getModulesConfig().filter(m => m.id !== modId);
    window.db.saveModulesConfig(modules);
    this.renderMasterModulosGrid();
    this.showToast("Apartado personalizado eliminado con éxito.", "info");
  }

  openEditarModuloModal(modId) {
    const modules = window.db.getModulesConfig();
    const target = modules.find(m => m.id === modId);
    if (!target) return;

    const nuevoNombre = prompt(`Renombrar apartado «${target.label}»:`, target.label);
    if (nuevoNombre && nuevoNombre.trim() && nuevoNombre.trim() !== target.label) {
      target.label = nuevoNombre.trim();
      window.db.saveModulesConfig(modules);
      this.renderMasterModulosGrid();
      this.showToast("Nombre de apartado actualizado con éxito", "success");
    }
  }

  resetDefaultModules() {
    if (!confirm("¿Desea restaurar la lista de apartados a la configuración inicial por defecto?")) return;
    if (window.db && typeof window.db.getDefaultModulesConfig === "function") {
      window.db.saveModulesConfig(window.db.getDefaultModulesConfig());
      this.renderMasterModulosGrid();
      this.showToast("Módulos restaurados a valores por defecto.", "info");
    }
  }

  // Refleja en el menú lateral los módulos ocultos, renombrados o nuevos
  renderDynamicSidebarModules() {
    if (!window.db) return;
    const modules = window.db.getModulesConfig();
    const currentUser = window.db.getCurrentUser ? window.db.getCurrentUser() : null;
    const userRole = window.db.getUserRole(currentUser);
    const isSuper = (window.db && typeof window.db.isSuperAdmin === "function") ? window.db.isSuperAdmin(currentUser) : (userRole === "super_admin" || userRole === "socio");
    const navHost = document.querySelector("#sidebar nav") || document.querySelector("aside nav") || document.getElementById("sidebar");
    let customHost = document.getElementById("nav-custom-modules");
    if (!customHost && navHost) {
      customHost = document.createElement("div");
      customHost.id = "nav-custom-modules";
      customHost.className = "mt-2 space-y-1 px-0";
      const masterWrap = document.getElementById("container-nav-master-admin");
      if (masterWrap && masterWrap.parentNode) {
        masterWrap.parentNode.insertBefore(customHost, masterWrap);
      } else {
        navHost.appendChild(customHost);
      }
    }

    modules.forEach(m => {
      let btn = document.querySelector(`.nav-tab-btn[data-tab="${m.id}"]`);
      const canAccess = window.db.canAccessModule(currentUser, m.id);
      const shouldShow = (m.enabled !== false || isSuper) && canAccess;

      // Apartados personalizados: crear botón de navegación si no existe
      if (!btn && m.isCustom && customHost) {
        btn = document.createElement("button");
        btn.type = "button";
        btn.dataset.tab = m.id;
        btn.className = "nav-tab-btn w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold hover:bg-slate-800 hover:text-white transition text-left text-slate-300";
        btn.onclick = () => window.app.switchTab(m.id);
        btn.innerHTML = `<i class="fa-solid ${escapeHtml(m.icon || "fa-folder")} ${escapeHtml(m.iconColor || "text-amber-400")} w-5 text-center"></i><span>${escapeHtml(m.label || m.id)}</span>`;
        customHost.appendChild(btn);
        this.ensureCustomModuleView(m);
      }

      if (btn) {
        btn.style.display = shouldShow ? "" : "none";
        const span = btn.querySelector("span:not(.badge-asistencia-pendientes)");
        if (span && m.label) {
          span.textContent = m.label;
        }
        const icon = btn.querySelector("i.fa-solid");
        if (icon && m.icon) {
          icon.className = `fa-solid ${m.icon} ${m.iconColor || "text-amber-400"} w-5 text-center`;
        }
      }
    });

    // Control Total: Visibilidad exclusiva para el Super Administrador (Oculto para Socios y Admins)
    const navMasterBtn = document.getElementById("nav-btn-master-admin");
    const containerMasterNav = document.getElementById("container-nav-master-admin");
    if (navMasterBtn) navMasterBtn.style.display = isSuper ? "" : "none";
    if (containerMasterNav) containerMasterNav.style.display = isSuper ? "" : "none";
  }

  /** Vista genérica para apartados personalizados (tabla / notas). */
  ensureCustomModuleView(mod) {
    if (!mod || !mod.id) return null;
    const fullId = "view-" + mod.id;
    let el = document.getElementById(fullId);
    if (el) return el;
    const main = document.querySelector("main") || document.body;
    el = document.createElement("section");
    el.id = fullId;
    el.className = "tab-view hidden p-4 sm:p-6 space-y-4";
    el.innerHTML = `
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 class="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <i class="fa-solid ${escapeHtml(mod.icon || "fa-folder")} text-amber-500"></i>
            <span class="custom-mod-title">${escapeHtml(mod.label || mod.id)}</span>
          </h2>
          <p class="text-xs text-slate-500 mt-1">${escapeHtml(mod.descripcion || "Apartado personalizado de la firma")}</p>
        </div>
        <button type="button" class="px-3 py-2 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400"
          onclick="window.app.addCustomModuleNote(${JSON.stringify(String(mod.id))})">
          <i class="fa-solid fa-plus mr-1"></i> Nueva nota
        </button>
      </div>
      <div id="custom-mod-list-${escapeHtml(mod.id)}" class="space-y-2"></div>
    `;
    main.appendChild(el);
    this.renderCustomModuleNotes(mod.id);
    return el;
  }

  renderCustomModuleNotes(modId) {
    const listEl = document.getElementById("custom-mod-list-" + modId);
    if (!listEl || !window.db) return;
    const items = window.db.get(modId) || window.db.getRaw(modId) || [];
    if (!items.length) {
      listEl.innerHTML = `<p class="text-sm text-slate-500 border border-dashed border-slate-300 rounded-xl p-6 text-center">Sin registros. Use «Nueva nota» para comenzar.</p>`;
      return;
    }
    listEl.innerHTML = items.map((n) => `
      <div class="flex items-start justify-between gap-3 p-3 rounded-xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700">
        <div class="min-w-0">
          <p class="text-sm font-semibold text-slate-900 dark:text-white break-words">${escapeHtml(n.titulo || n.texto || "Nota")}</p>
          <p class="text-[11px] text-slate-500 mt-1">${escapeHtml(n.updatedAt || n.createdAt || "")}</p>
        </div>
        <button type="button" class="text-rose-500 hover:text-rose-700 p-1.5" title="Eliminar"
          onclick="window.app.deleteCustomModuleNote(${JSON.stringify(String(modId))}, ${JSON.stringify(String(n.id))})">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    `).join("");
  }

  addCustomModuleNote(modId) {
    const texto = prompt("Contenido de la nota / registro:");
    if (!texto || !texto.trim()) return;
    const note = {
      id: window.generateUniqueId ? window.generateUniqueId("NOTE") : ("NOTE-" + Date.now()),
      titulo: texto.trim().slice(0, 200),
      texto: texto.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sede: window.db.getActiveSede ? window.db.getActiveSede() : "challhuahuacho"
    };
    if (!window.db.add(modId, note)) {
      // Colección custom puede no estar en RBAC: forzar persistencia local
      const raw = window.db.getRaw(modId) || [];
      raw.push(note);
      window.db.save(modId, raw);
    }
    this.renderCustomModuleNotes(modId);
    this.showToast("Registro agregado al apartado.", "success");
  }

  deleteCustomModuleNote(modId, noteId) {
    if (!confirm("¿Eliminar este registro?")) return;
    const ok = window.db.delete(modId, noteId);
    if (!ok) {
      const raw = (window.db.getRaw(modId) || []).filter((n) => String(n.id) !== String(noteId));
      window.db.save(modId, raw);
    }
    this.renderCustomModuleNotes(modId);
    this.showToast("Registro eliminado.", "info");
  }

  /** Regenera selectores de sede (header + modales) desde SEDES_CONFIG. */
  renderSedeSelector() {
    if (!window.SEDES_CONFIG) return;
    const active = window.db && typeof window.db.getActiveSede === "function"
      ? window.db.getActiveSede()
      : "challhuahuacho";
    const buildOptions = (includeTodas) => {
      const keys = Object.keys(window.SEDES_CONFIG);
      return keys
        .filter((k) => includeTodas || k !== "todas")
        .map((k) => {
          const s = window.SEDES_CONFIG[k];
          const label = escapeHtml(s.nombreCorto || s.nombre || k);
          return `<option value="${escapeHtml(k)}">${k === "todas" ? "Consolidado Nacional" : ("Sede " + label)}</option>`;
        })
        .join("");
    };

    const globalSel = document.getElementById("globalSedeSelect");
    if (globalSel) {
      const prev = globalSel.value || active;
      globalSel.innerHTML = buildOptions(true);
      if ([...globalSel.options].some((o) => o.value === prev)) globalSel.value = prev;
      else if ([...globalSel.options].some((o) => o.value === active)) globalSel.value = active;
      if (typeof this.syncSedePickerUI === "function") this.syncSedePickerUI(globalSel.value || active);
    }

    const modalIds = ["casoSede", "cajaSede", "citaSede", "presSede", "invSede", "docSede", "personalSede", "permModalWorkerSede"];
    modalIds.forEach((id) => {
      const sel = document.getElementById(id);
      if (!sel) return;
      const prev = sel.value;
      const keepTodas = [...sel.options].some((o) => o.value === "todas");
      sel.innerHTML = buildOptions(keepTodas || id === "personalSede" || id === "permModalWorkerSede");
      if (prev && [...sel.options].some((o) => o.value === prev)) sel.value = prev;
    });
  }

  // Renderiza el Gestor de Sedes
  renderMasterSedes() {
    const container = document.getElementById("masterSedesContainer");
    if (!container || !window.SEDES_CONFIG) return;

    const keys = Object.keys(window.SEDES_CONFIG);
    container.innerHTML = keys.map(k => {
      const s = window.SEDES_CONFIG[k];
      const isNac = (k === "todas");
      const badgeCls = isNac 
        ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40" 
        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700";
      const cardCls = isNac 
        ? "border-2 border-amber-500/60 bg-amber-50/80 dark:bg-amber-950/40 shadow-xs ring-1 ring-amber-500/20" 
        : "border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/95 shadow-xs";
      const iconCls = isNac ? "fa-globe text-amber-500" : "fa-location-dot text-amber-500";
      const latStr = s.lat ? Number(s.lat).toFixed(4) : "-";
      const lonStr = s.lon ? Number(s.lon).toFixed(4) : "-";
      const radVal = s.radio || 100;
      const nom = escapeHtml(s.nombre || k);
      const cod = escapeHtml(s.codigo || k.toUpperCase());
      const dir = escapeHtml(s.direccion || "Sin dirección registrada");
      const tel = escapeHtml(s.telefono || "Central de Sede");

      return `
        <div class="p-4 rounded-xl border ${cardCls} space-y-2.5 text-xs transition-all hover:border-amber-500/50">
          <div class="flex items-center justify-between">
            <span class="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
              <i class="fa-solid ${iconCls}"></i> ${nom}
            </span>
            <span class="font-mono text-[10px] font-bold ${badgeCls} px-2 py-0.5 rounded">${cod}</span>
          </div>
          <p class="text-[11.5px] text-slate-600 dark:text-slate-300 truncate font-medium" title="${dir}">
            <i class="fa-regular fa-compass text-[10px] text-slate-400 mr-1"></i>${dir}
          </p>
          <div class="flex items-center justify-between text-[10.5px] text-slate-500 dark:text-slate-400 font-mono pt-1">
            <span><i class="fa-solid fa-phone text-[9.5px] mr-1 text-amber-500"></i>${tel}</span>
          </div>
          <div class="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono pt-1.5 border-t border-slate-200 dark:border-slate-800">
            <span>GPS: ${latStr}, ${lonStr}</span>
            <span>Radio: ${radVal}m</span>
          </div>
          <div class="flex items-center justify-end pt-1">
            <button type="button" onclick="window.app.openEditarSedeModal(${jsStr(k)})" class="px-3 py-1 bg-amber-500/10 hover:bg-amber-500 text-amber-700 dark:text-amber-400 hover:text-slate-950 font-bold rounded-lg border border-amber-500/30 transition flex items-center gap-1.5 text-[11px] cursor-pointer">
              <i class="fa-solid fa-pen-to-square text-[10px]"></i> Editar Sede
            </button>
          </div>
        </div>
      `;
    }).join("");
  }
  openNuevaSedeModal() {
    const inputId = document.getElementById("nuevaSedeId");
    if (inputId) inputId.value = "";
    const titleEl = document.getElementById("modalSedeTitle");
    if (titleEl) titleEl.textContent = "Registrar Nueva Sede de la Firma";
    const btn = document.getElementById("btnGuardarSede");
    if (btn) btn.innerHTML = '<i class="fa-solid fa-plus mr-1"></i> Registrar Sede';

    document.getElementById("nuevaSedeNombre").value = "";
    document.getElementById("nuevaSedeCiudad").value = "";
    document.getElementById("nuevaSedeCodigo").value = "";
    document.getElementById("nuevaSedeDireccion").value = "";
    const latIn = document.getElementById("nuevaSedeLat");
    if (latIn) latIn.value = "-14.1166";
    const lonIn = document.getElementById("nuevaSedeLon");
    if (lonIn) lonIn.value = "-72.2450";
    const radIn = document.getElementById("nuevaSedeRadio");
    if (radIn) radIn.value = "100";
    this.showModal("modalNuevaSede");
  }

  openEditarSedeModal(sedeId) {
    if (!window.SEDES_CONFIG || !window.SEDES_CONFIG[sedeId]) return;
    const s = window.SEDES_CONFIG[sedeId];

    const inputId = document.getElementById("nuevaSedeId");
    if (inputId) inputId.value = sedeId;

    const titleEl = document.getElementById("modalSedeTitle");
    if (titleEl) titleEl.textContent = "Editar Sede: " + (s.nombre || sedeId);

    const btn = document.getElementById("btnGuardarSede");
    if (btn) btn.innerHTML = '<i class="fa-solid fa-floppy-disk mr-1"></i> Guardar Cambios';

    const inNombre = document.getElementById("nuevaSedeNombre");
    if (inNombre) inNombre.value = s.nombre || "";

    const inCiudad = document.getElementById("nuevaSedeCiudad");
    if (inCiudad) inCiudad.value = s.region || s.nombreCorto || s.ciudad || "";

    const inCodigo = document.getElementById("nuevaSedeCodigo");
    if (inCodigo) inCodigo.value = s.codigo || "";

    const inDireccion = document.getElementById("nuevaSedeDireccion");
    if (inDireccion) inDireccion.value = s.direccion || "";

    const inLat = document.getElementById("nuevaSedeLat");
    if (inLat) inLat.value = s.lat != null ? s.lat : "";

    const inLon = document.getElementById("nuevaSedeLon");
    if (inLon) inLon.value = s.lon != null ? s.lon : "";

    const inRadio = document.getElementById("nuevaSedeRadio");
        if (inRadio) inRadio.value = s.radio || 100;
    const inTel = document.getElementById("nuevaSedeTelefono");
    if (inTel) inTel.value = s.telefono || "";

    this.showModal("modalNuevaSede");
  }

  guardarNuevaSede(e) {
    if (e) e.preventDefault();
    const sedeIdInput = (document.getElementById("nuevaSedeId")?.value || "").trim();
    const nombre = (document.getElementById("nuevaSedeNombre")?.value || "").trim();
    const ciudad = (document.getElementById("nuevaSedeCiudad")?.value || "").trim();
    const codigo = (document.getElementById("nuevaSedeCodigo")?.value || "").trim().toUpperCase();
    const direccion = (document.getElementById("nuevaSedeDireccion")?.value || "").trim();
    const telefono = (document.getElementById("nuevaSedeTelefono")?.value || "").trim();
    const lat = parseFloat(document.getElementById("nuevaSedeLat")?.value || -14.1166);
    const lon = parseFloat(document.getElementById("nuevaSedeLon")?.value || -72.2450);
    const radio = parseInt(document.getElementById("nuevaSedeRadio")?.value || 100, 10);

    if (!nombre) {
      this.showToast("El nombre de la sede es requerido.", "error");
      return;
    }

    const isEdit = !!sedeIdInput && window.SEDES_CONFIG[sedeIdInput];
    const id = isEdit ? sedeIdInput : (ciudad.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "") || "sede_" + Date.now());

    const prevSede = window.SEDES_CONFIG[id] || {};
    const updatedSede = {
      ...prevSede,
      id: id,
      codigo: codigo || prevSede.codigo || id.slice(0, 3).toUpperCase(),
      nombre: nombre,
      nombreCorto: ciudad || prevSede.nombreCorto || nombre,
      region: ciudad || prevSede.region || "Per\u00FA",
      direccion: direccion || prevSede.direccion || "",
      telefono: telefono || prevSede.telefono || "+51 943 410 215 / Central Despacho",
      lat: isNaN(lat) ? (prevSede.lat || -12.1226) : lat,
      lon: isNaN(lon) ? (prevSede.lon || -77.0114) : lon,
      radio: isNaN(radio) ? (prevSede.radio || 100) : radio
    };

    window.SEDES_CONFIG[id] = updatedSede;

    try {
      localStorage.setItem("PAOLO_ALDEA_SEDES_CUSTOM", JSON.stringify(window.SEDES_CONFIG));
    } catch(err) {}

    const custom = window.db.getCustomSedes();
    const existingIdx = custom.findIndex(cs => cs.id === id);
    if (existingIdx >= 0) {
      custom[existingIdx] = updatedSede;
    } else {
      custom.push(updatedSede);
    }
    window.db.saveCustomSedes(custom);

    this.closeModal("modalNuevaSede");
    this.renderMasterSedes();
    if (typeof this.renderSedeSelector === 'function') this.renderSedeSelector();
    this.applySettingsToUI();
    if (typeof this.applySedeToHeader === 'function') this.applySedeToHeader();

    const toastMsg = isEdit 
      ? `Sede «${nombre}» actualizada con éxito en la red nacional.`
      : `Nueva Sede «${nombre}» registrada con éxito en la red nacional.`;
    this.showToast(toastMsg, "success");
  }


    // Renderiza la Matriz Dinámica RBAC
  renderMasterRbacTable() {
    const tbody = document.getElementById("masterRbacTableBody");
    if (!tbody || !window.db) return;

    const modules = window.db.getModulesConfig();
    const roles = ["asistente_legal", "asistente_admin", "abogado"];

    tbody.innerHTML = modules.map(m => {
      const allowed = m.rolesAllowed || [];
      const isMasterMod = (m.id === "configuracion" || m.id === "master_admin");
      return `
        <tr class="hover:bg-slate-50 border-b border-slate-200">
          <td class="p-2.5 font-bold text-slate-800 flex items-center gap-2">
            <i class="fa-solid ${escapeHtml(m.icon || 'fa-folder')} text-slate-400"></i>
            <span>${escapeHtml(m.label)}</span>
            ${isMasterMod ? '<span class="text-[9px] bg-amber-500/20 text-amber-800 border border-amber-400 px-1.5 py-0.2 rounded font-extrabold ml-1">Exclusivo Super Admin</span>' : ''}
          </td>
          ${roles.map(r => `
            <td class="p-2.5 text-center">
              <input type="checkbox" onchange="window.app.onRbacCheckChange(${jsStr(m.id)}, ${jsStr(r)}, this.checked)" ${allowed.includes(r) ? 'checked' : ''} class="w-4 h-4 text-amber-500 rounded border-slate-300 focus:ring-amber-400 cursor-pointer">
            </td>
          `).join("")}
          <td class="p-2.5 text-center text-xs">
            ${isMasterMod 
              ? '<span class="inline-flex items-center gap-1 text-[10px] font-extrabold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full"><i class="fa-solid fa-lock"></i> Sin Acceso</span>'
              : '<span class="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full"><i class="fa-solid fa-check"></i> Permitido</span>'
            }
          </td>
          <td class="p-2.5 text-center font-black text-amber-600 bg-amber-50/50 border-l border-amber-200 text-xs">
            <i class="fa-solid fa-crown text-amber-500 mr-1"></i> Total
          </td>
        </tr>
      `;
    }).join("");
  }

  onRbacCheckChange(modId, role, isChecked) {
    const modules = window.db.getModulesConfig();
    const mod = modules.find(m => m.id === modId);
    if (!mod) return;

    if (!Array.isArray(mod.rolesAllowed)) mod.rolesAllowed = [];
    if (isChecked) {
      if (!mod.rolesAllowed.includes(role)) mod.rolesAllowed.push(role);
    } else {
      mod.rolesAllowed = mod.rolesAllowed.filter(r => r !== role);
    }

    window.db.saveModulesConfig(modules);
    this.renderDynamicSidebarModules();
  }

  guardarMatrizPermisos() {
    this.showToast("Matriz de Permisos RBAC guardada con éxito en la base de datos.", "success");
  }

  // Sincronización Inter-Sedes (.lexsync)
  exportarPaqueteSincronizacion() {
    try {
      const pkg = window.db.exportSyncPackage();
      const jsonStr = JSON.stringify(pkg, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().split("T")[0];
      a.href = url;
      a.download = `PAQUETE_SYNC_${(pkg.sedeOrigen || 'SEDE').toUpperCase()}_${dateStr}.lexsync`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.showToast("Paquete de Sincronización (.lexsync) exportado con éxito.", "success");
    } catch (e) {
      alert("Error al exportar paquete: " + e.message);
    }
  }

  importarPaqueteSincronizacion(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const pkg = JSON.parse(evt.target.result);
        const stats = window.db.mergeSyncPackage(pkg);

        const rep = document.getElementById("syncMergeReport");
        if (rep) {
          rep.classList.remove("hidden");
          rep.innerHTML = `
            <div class="font-bold text-emerald-800 flex items-center gap-1.5">
              <i class="fa-solid fa-circle-check"></i> Fusión Inter-Sedes Exitosa (${escapeHtml(pkg.sedeOrigen || 'Sede Remota')})
            </div>
            <div class="grid grid-cols-2 gap-1 text-[11px] text-slate-600 pt-1 font-mono">
              <div>• Nuevos Agregados: <strong class="text-emerald-700">${stats.totalAdded}</strong></div>
              <div>• Actualizados: <strong class="text-blue-700">${stats.totalUpdated}</strong></div>
            </div>
            <div class="text-[10px] text-slate-400">Emisor: ${escapeHtml(pkg.emisor || 'Despacho')} • ${escapeHtml(pkg.timestamp || '')}</div>
          `;
        }

        this.showToast(`Sincronización exitosa: ${stats.totalAdded} registros nuevos incorporados.`, "success");
        window.kpiDashboard.refresh();
        window.alerts.evaluateAlerts();
      } catch (err) {
        alert("Error al procesar archivo de sincronización: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  setupNetworkSyncListeners() {
    window.addEventListener("online", () => {
      this.cargarAjustesFirebaseUI();
      this.actualizarIndicadorNube("online", "Conexión Restaurada");
      this.showToast("🌐 Conexión a internet detectada. Sincronizando con la nube...", "info");
      const s = window.db ? window.db.getSettings() : {};
      if (s.cloudSyncAuto !== false || s.cloudSyncEndpoint) {
        this.sincronizarConNube(true);
      }
      if (window.firebaseService && window.firebaseService.hasCredentials()) {
        window.firebaseService.fullSync(null, true).catch(() => {});
      }
    });

    window.addEventListener("offline", () => {
      this.cargarAjustesFirebaseUI();
      this.actualizarIndicadorNube("offline", "Modo Offline Seguro");
      this.showToast("📡 Sin conexión a internet. El sistema opera en modo local 100% autónomo.", "warning");
    });

    // Sincronización en segundo plano periódica cada 30 segundos (Supabase + Firebase)
    setInterval(() => {
      if (navigator.onLine) {
        const s = window.db ? window.db.getSettings() : {};
        if (s.cloudSyncAuto !== false) {
          this.sincronizarConNube(true);
        }
        if (window.firebaseService && window.firebaseService.hasCredentials()) {
          window.firebaseService.fullSync(null, true).catch(() => {});
        }
      }
    }, 30 * 1000);
  }

  actualizarIndicadorNube(estado, texto) {
    const icon = document.getElementById("iconCloudSync");
    const textEl = document.getElementById("textCloudSync");
    if (!icon) return;

    icon.className = "fa-solid text-xs transition";
    if (estado === "online" || estado === "synced") {
      icon.classList.add("fa-cloud", "text-emerald-500");
      if (textEl) textEl.textContent = texto || "Nube Conectada";
    } else if (estado === "syncing") {
      icon.classList.add("fa-cloud-arrow-up", "text-indigo-500", "animate-pulse");
      if (textEl) textEl.textContent = texto || "Sincronizando...";
    } else {
      icon.classList.add("fa-cloud", "text-amber-500");
      if (textEl) textEl.textContent = texto || "Modo Local Seguro";
    }
  }

  async recuperarClaveFirebase() {
    const user = (document.getElementById("loginUsername")?.value || "").trim();
    if (!user || !user.includes("@")) {
      alert("Por favor ingrese su correo electrónico institucional en el campo superior (Usuario / Correo) y vuelva a pulsar '¿Olvidó su clave?' para enviarle un enlace de restablecimiento.");
      const uInput = document.getElementById("loginUsername");
      if (uInput) uInput.focus();
      return;
    }

    if (!window.firebaseService) {
      alert("El servicio de Firebase no está activo.");
      return;
    }

    try {
      this.showToast("Enviando enlace seguro de recuperación...", "info");
      await window.firebaseService.sendPasswordReset(user);
      this.showToast("Enlace de restablecimiento enviado. Revise su bandeja o carpeta de spam.", "success");
    } catch (e) {
      this.showToast("No se pudo enviar el correo: " + e.message, "error");
    }
  }

  guardarAjustesFirebase() {
    const projectId = (document.getElementById("fbProjectId")?.value || "").trim();
    const apiKey = (document.getElementById("fbApiKey")?.value || "").trim();
    const authDomain = (document.getElementById("fbAuthDomain")?.value || "").trim();
    const storageBucket = (document.getElementById("fbStorageBucket")?.value || "").trim();

    if (!projectId || !apiKey) {
      this.showToast("Ingrese al menos el Project ID y el API Key de Firebase.", "warning");
      return;
    }

    const config = {
      projectId: projectId,
      apiKey: apiKey,
      authDomain: authDomain || (projectId + ".firebaseapp.com"),
      storageBucket: storageBucket || (projectId + ".appspot.com")
    };

    if (window.firebaseService) {
      window.firebaseService.saveConfig(config);
      window.firebaseService.init().then((ok) => {
        if (ok) {
          this.sincronizarConFirebase();
        }
      });
      this.showToast("Configuración de Firebase guardada. Sincronizando automáticamente...", "success");
    }
  }

  async probarConexionFirebase() {
    if (!window.firebaseService) {
      this.showToast("El servicio de Firebase no está disponible.", "error");
      return;
    }
    this.showToast("Comprobando conexión con Google Firebase...", "info");
    const ok = await window.firebaseService.init();
    if (ok) {
      this.showToast("✅ Conexión con Firebase exitosa.", "success");
    } else {
      this.showToast("No se pudo conectar a Firebase. Verifique Project ID y API Key.", "error");
    }
  }

  async sincronizarConFirebase() {
    if (!window.firebaseService) return;
    this.showToast("Iniciando sincronización completa con Firestore Cloud...", "info");
    try {
      await window.firebaseService.fullSync((msg) => this.showToast(msg, "info"));
      this.showToast("✅ Sincronización exitosa con Firebase Cloud.", "success");
      this.refreshCurrentModuleView();
    } catch (err) {
      this.showToast("Error en sincronización: " + err.message, "error");
    }
  }

  cargarAjustesFirebaseUI() {
    if (!window.firebaseService) return;
    const cfg = window.firebaseService.getConfig();
    if (cfg) {
      const inProj = document.getElementById("fbProjectId");
      const inKey = document.getElementById("fbApiKey");
      const inAuth = document.getElementById("fbAuthDomain");
      const inBucket = document.getElementById("fbStorageBucket");
      if (inProj) inProj.value = cfg.projectId || "";
      if (inKey) inKey.value = cfg.apiKey || "";
      if (inAuth) inAuth.value = cfg.authDomain || "";
      if (inBucket) inBucket.value = cfg.storageBucket || "";
    }
  }

  guardarAjustesNube() {
    const endpoint = (document.getElementById("masterCloudEndpoint")?.value || "").trim();
    const apiKey = (document.getElementById("masterCloudApiKey")?.value || "").trim();
    const chkEl = document.getElementById("masterCloudAutoSync");
    const auto = chkEl ? chkEl.checked : true;

    const s = window.db.getSettings();
    s.cloudSyncEndpoint = endpoint;
    s.cloudSyncApiKey = apiKey;
    s.cloudSyncAuto = auto;
    window.db.saveSettings(s);
    this.showToast("Configuración de Live Cloud Sync guardada.", "success");
    if (endpoint) {
      this.sincronizarConNube(false);
    }
  }

  async probarConexionNube() {
    let endpoint = (document.getElementById("masterCloudEndpoint")?.value || "").trim();
    const apiKey = (document.getElementById("masterCloudApiKey")?.value || "").trim();

    // Corrección automática de posibles errores tipográficos en el dominio
    if (endpoint.includes("supabasc.co")) {
      endpoint = endpoint.replace("supabasc.co", "supabase.co");
      const inEl = document.getElementById("masterCloudEndpoint");
      if (inEl) inEl.value = endpoint;
    }

    if (!endpoint && window.location.protocol.startsWith("http")) {
      endpoint = window.location.origin + "/api/cloud_sync";
      const inEl = document.getElementById("masterCloudEndpoint");
      if (inEl) inEl.value = endpoint;
    }
    if (!endpoint) {
      alert("Por favor ingrese la URL del endpoint de sincronización.");
      return;
    }

    this.showToast("Verificando enlace con el servidor central...", "info");
    this.cargarAjustesFirebaseUI();
    this.actualizarIndicadorNube("syncing", "Verificando...");

    try {
      let testUrl = endpoint;
      const headers = { "Content-Type": "application/json" };

      if (endpoint.includes("supabase.co")) {
        const baseUrl = endpoint.replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
        // El endpoint /auth/v1/health o /storage/v1/bucket es el estándar oficial para verificar conectividad con Supabase Cloud
        testUrl = baseUrl + "/auth/v1/health";
        if (apiKey) {
          headers["apikey"] = apiKey;
          headers["Authorization"] = "Bearer " + apiKey;
        }
      }

      const resp = await fetch(testUrl, { method: "GET", headers: headers });
      if (resp.ok) {
        let serverName = "Servidor Central";
        if (endpoint.includes("supabase.co")) {
          serverName = "Supabase Cloud (PostgreSQL)";
        } else {
          const info = await resp.json().catch(() => ({}));
          serverName = info.server || "Paolo Aldea Hub";
        }
        this.cargarAjustesFirebaseUI();
    this.actualizarIndicadorNube("online", "Nube Conectada");
        this.showToast("¡Conexión establecida con éxito con " + serverName + "!", "success");
      } else {
        throw new Error("HTTP " + resp.status + " - Verifique su API Key o URL.");
      }
    } catch (e) {
      this.cargarAjustesFirebaseUI();
    this.actualizarIndicadorNube("offline", "Servidor No Responde");
      this.showToast("No se pudo conectar al endpoint: " + e.message, "error");
    }
  }

  async _ensureCloudSyncToken() {
    if (!window.__ENTERPRISE_CLOUD__ || !window.PaoloCloudDataSync) return "";
    let token =
      typeof window.PaoloCloudDataSync.getToken === "function"
        ? window.PaoloCloudDataSync.getToken()
        : "";
    if (token) return token;
    if (!navigator.onLine || !window.PaoloAuthService) return "";
    try {
      const raw = sessionStorage.getItem("PA_SYNC_REAUTH");
      if (!raw) return "";
      const creds = JSON.parse(raw);
      if (!creds || !creds.u || !creds.p) return "";
      const cloud = await window.PaoloAuthService.cloudLogin(creds.u, creds.p);
      if (cloud && cloud.ok && cloud.syncToken) {
        window.PaoloCloudDataSync.setToken(cloud.syncToken);
        if (cloud.directory && typeof window.PaoloAuthService.hydrateLocalWorkers === "function") {
          window.PaoloAuthService.hydrateLocalWorkers(cloud.directory);
        }
        return cloud.syncToken;
      }
    } catch (e) {
      console.warn("[Sync] Reauth token:", e && e.message);
    }
    return "";
  }

  async sincronizarConNube(silent = false) {
    // Preferir syncToken + app_records (CloudDataSync) — canónico multi-dispositivo.
    if (window.__ENTERPRISE_CLOUD__ && window.PaoloCloudDataSync) {
      let token = await this._ensureCloudSyncToken();
      if (token) {
        this.cargarAjustesFirebaseUI();
        this.actualizarIndicadorNube("syncing", "Sincronizando...");
        try {
          // Push primero: evita que un pull borre ediciones locales aún no subidas.
          if (typeof window.PaoloCloudDataSync.flushDirty === "function") {
            await window.PaoloCloudDataSync.flushDirty();
          }
          await window.PaoloCloudDataSync.pushAllLocal();
          await window.PaoloCloudDataSync.pullAndMerge();
          this.actualizarIndicadorNube("online", "Nube sincronizada");
          if (!silent) this.showToast("Sincronización automática completada en este equipo.", "success");
          if (window.kpiDashboard && typeof window.kpiDashboard.refresh === "function") {
            window.kpiDashboard.refresh();
          }
          if (window.alerts && typeof window.alerts.evaluateAlerts === "function") {
            window.alerts.evaluateAlerts();
          }
          this.refreshCurrentModuleView();
          if (window.AttendanceModule) {
            if (typeof window.AttendanceModule.renderWorkerSelectorDropdown === "function") {
              window.AttendanceModule.renderWorkerSelectorDropdown();
            }
            if (typeof window.AttendanceModule.renderWorkersList === "function") {
              window.AttendanceModule.renderWorkersList();
            }
            if (typeof window.AttendanceModule.renderAdminAttendanceTable === "function") {
              window.AttendanceModule.renderAdminAttendanceTable();
            }
            if (typeof window.AttendanceModule.renderAdminKpis === "function") {
              window.AttendanceModule.renderAdminKpis();
            }
            if (typeof window.AttendanceModule.updateAnchorOfficeVisibility === "function") {
              window.AttendanceModule.updateAnchorOfficeVisibility();
            }
            if (typeof window.AttendanceModule.ensurePrivilegedSupervision === "function") {
              window.AttendanceModule.ensurePrivilegedSupervision(false);
            }
          }
        } catch (e) {
          this.actualizarIndicadorNube("offline", "Sync pendiente");
          if (!silent) {
            this.showToast("No se pudo sincronizar: " + (e.message || "error"), "warning");
          }
        }
        return;
      }
    }

    // Modo B Zero-Trust: outbox/Realtime — no usar tabla legada sync_multi_sede_hub
    if (window.__ENTERPRISE_CLOUD__ && window.PaoloSyncManager && typeof window.PaoloSyncManager.flush === "function") {
      this.cargarAjustesFirebaseUI();
      this.actualizarIndicadorNube("syncing", "Sincronizando...");
      try {
        await window.PaoloSyncManager.flush();
        this.actualizarIndicadorNube("online", "Enterprise Sync");
        if (!silent) this.showToast("Sincronización enterprise (outbox) completada.", "success");
        if (window.kpiDashboard && typeof window.kpiDashboard.refresh === "function") {
          window.kpiDashboard.refresh();
        }
        this.refreshCurrentModuleView();
      } catch (e) {
        this.actualizarIndicadorNube("offline", "Sync pendiente");
        if (!silent) {
          this.showToast("Sync enterprise no disponible: " + (e.message || "error"), "warning");
        }
      }
      return;
    }

    const sSettings = window.db ? window.db.getSettings() : {};
    let endpoint = (document.getElementById("masterCloudEndpoint")?.value || sSettings.cloudSyncEndpoint || "").trim();
    const apiKey = (document.getElementById("masterCloudApiKey")?.value || sSettings.cloudSyncApiKey || "").trim();

    if (endpoint.includes("supabasc.co")) {
      endpoint = endpoint.replace("supabasc.co", "supabase.co");
      const inEl = document.getElementById("masterCloudEndpoint");
      if (inEl) inEl.value = endpoint;
    }

    if (!endpoint && window.location.protocol.startsWith("http")) {
      endpoint = window.location.origin + "/api/cloud_sync";
      const inEl = document.getElementById("masterCloudEndpoint");
      if (inEl) inEl.value = endpoint;
    }
    if (!endpoint) {
      if (!silent) alert("Debe configurar primero la URL del endpoint en el panel de Ajustes.");
      return;
    }

    // Supabase directo vía sync_multi_sede_hub fue retirado (schema inseguro eliminado).
    if (/supabase\.co/i.test(endpoint)) {
      this.cargarAjustesFirebaseUI();
      this.actualizarIndicadorNube("offline", "Hub legado retirado");
      if (!silent) {
        this.showToast(
          "El sync por sync_multi_sede_hub fue retirado. Use Modo B (Netlify + migración Zero-Trust) o el hub local /api/cloud_sync.",
          "warning"
        );
      }
      return;
    }

    this.cargarAjustesFirebaseUI();
    this.actualizarIndicadorNube("syncing", "Sincronizando...");
    if (!silent) this.showToast("Iniciando sincronización bidireccional Multi-Sede...", "info");

    try {
      const payload = window.db.exportSyncPackage();
      const headers = {
        "Content-Type": "application/json"
      };

      if (apiKey) {
        headers["Authorization"] = "Bearer " + apiKey;
        headers["apikey"] = apiKey;
      }

      // Hub local de despacho (/api/cloud_sync) o servidor intermedio LAN
      const localTok = window.__LOCAL_SERVER_API_KEY__ || sessionStorage.getItem("PA_LOCAL_API_TOKEN") || "";
      if (localTok && !headers.Authorization) {
        headers.Authorization = "Bearer " + localTok;
      }
      const res = await fetch(endpoint, {
        method: "POST",
        headers: headers,
        credentials: "same-origin",
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        let cloudData = await res.json();
        // Semana 4: ACK liviano → hidratar con stream /api/cloud_snapshot (sin 2.ª serialización)
        if (cloudData && cloudData.ackOnly) {
          const snapUrl = endpoint.replace(/\/api\/cloud_sync.*/i, "/api/cloud_snapshot");
          const snapRes = await fetch(snapUrl, { method: "GET", headers: headers, credentials: "same-origin" });
          if (!snapRes.ok) {
            throw new Error("Snapshot cloud no disponible (HTTP " + snapRes.status + "). Sync cancelado para no aplicar solo tombstones.");
          }
          const snap = await snapRes.json();
          cloudData = {
            protocol: cloudData.protocol || "LEX_MULTI_SEDE_SYNC_V2",
            status: "ok",
            data: snap,
            deletedIds: (snap && snap._deletedIds) || cloudData.deletedIds || {}
          };
        }
        if (cloudData && (cloudData.data || cloudData.deletedIds)) {
          const stats = window.db.mergeSyncPackage(cloudData);
          if (!silent) {
            this.showToast("Sincronización Multi-Sede exitosa (+" + stats.totalAdded + " nuevos, " + stats.totalUpdated + " actualizados).", "success");
          }
          if (window.kpiDashboard && typeof window.kpiDashboard.refresh === "function") {
            window.kpiDashboard.refresh();
          }
          this.refreshCurrentModuleView();
        }
        if (window.firebaseService && window.firebaseService.hasCredentials() && !window.firebaseService.isSyncing) {
          window.firebaseService.fullSync(null, true).catch(() => {});
        }
        this.cargarAjustesFirebaseUI();
        this.actualizarIndicadorNube("online", "Nube Conectada");
      } else {
        throw new Error("HTTP " + res.status);
      }
    } catch (e) {
      // Si el endpoint local no responde pero Firebase Cloud sí está configurado, respaldar en Firestore
      if (window.firebaseService && window.firebaseService.hasCredentials()) {
        try {
          await window.firebaseService.fullSync(null, true);
          this.cargarAjustesFirebaseUI();
          this.actualizarIndicadorNube("online", "Firebase Conectado");
          if (!silent) {
            this.showToast("¡Sincronización con Firebase Cloud completada!", "success");
          }
          this.refreshCurrentModuleView();
          return;
        } catch (_) {}
      }
      this.cargarAjustesFirebaseUI();
      this.actualizarIndicadorNube("offline", "Modo Local");
      if (!silent) {
        this.showToast("Sincronización en la nube no disponible. Operando en modo local seguro.", "warning");
      }
    }
  }

    async guardarCredencialesSuperAdmin() {
    try {
      const inUser = document.getElementById("superAdminNewUser");
      const inPass = document.getElementById("superAdminNewPass");
      const inConf = document.getElementById("superAdminConfirmPass");

      const newUser = (inUser?.value || "").trim();
      const newPass = (inPass?.value || "").trim();
      const confPass = (inConf?.value || "").trim();

      if (!newUser) {
        this.showToast("El usuario de Super Administrador no puede estar vac\u00EDo.", "error");
        return;
      }

      if (!window.db.isSuperAdmin()) {
        this.showToast("Solo el Super Administrador puede modificar estas credenciales.", "error");
        return;
      }
      if (newPass) {
        const _pwErr2 = this._validatePasswordPolicy(newPass);
        if (_pwErr2) {
          this.showToast(_pwErr2, "error");
          return;
        }
        if (newPass !== confPass) {
          this.showToast("Las contrase\u00F1as no coinciden. Verifique la confirmaci\u00F3n.", "error");
          return;
        }
      }

      const s = window.db ? window.db.getSettings() : {};
      s.adminUser = newUser;

      if (newPass) {
        s.adminPasswordHash = await window.hashSecret(newPass);
        delete s.adminPassword;
      }

      window.db.saveSettings(s);

      // Sincronizar en la colecci\u00F3n workers para el Super Administrador WRK-000
      const workers = window.db ? window.db.getRaw("workers") : [];
      let wrk = workers.find(w => w.id === "WRK-000" || w.rol === "super_admin");
      if (wrk) {
        wrk.usuario = newUser;
        wrk.username = newUser;
        if (newPass) wrk.passwordHash = s.adminPasswordHash;
        window.db.save("workers", workers);
      }

      // Sincronizar sesi\u00F3n actual si el usuario activo es Super Admin
      const currentUser = window.db ? window.db.getCurrentUser() : null;
      if (currentUser && (currentUser.rol === "super_admin" || currentUser.id === "WRK-000")) {
        currentUser.usuario = newUser;
        currentUser.username = newUser;
        window.db.setCurrentUser(currentUser);
        sessionStorage.setItem("PAOLO ALDEA_AUTH_USER", currentUser.nombre);
      }

      // Sincronizar automáticamente con el archivo central en disco
      try {
        if (typeof this.subirDatosANube === "function") {
          this.subirDatosANube(true);
        }
      } catch (_) {}

      if (inPass) inPass.value = "";
      if (inConf) inConf.value = "";

      this.showToast(`\u00A1Credenciales de Super Admin actualizadas con \u00E9xito! Usuario: \u00AB${newUser}\u00BB.`, "success");
    } catch (err) {
      console.error("Error al guardar credenciales super admin:", err);
      this.showToast("Error al guardar credenciales: " + err.message, "error");
    }
  }

  async guardarCredencialesMaestras() {
    const inPass = document.getElementById("masterNewPassword");
    const inPin = document.getElementById("masterNewPin");
    const newPass = (inPass?.value || "").trim();
    const newPin = (inPin?.value || "").trim();

    if (!newPass && !newPin) {
      alert("Ingrese una nueva clave o PIN para actualizar.");
      return;
    }

    if (!window.db.isSuperAdmin()) { this.showToast("Solo el Super Administrador puede modificar las credenciales maestras.", "error"); return; }
    if (newPass) { const e1 = this._validatePasswordPolicy(newPass); if (e1) { this.showToast(e1, "error"); return; } }
    if (newPin && (!/^\d{6,10}$/.test(newPin) || /^(\d)\1+$/.test(newPin) || "0123456789".includes(newPin) || "9876543210".includes(newPin))) {
      this.showToast("El PIN debe tener de 6 a 10 digitos y no ser una secuencia o repeticion.", "error");
      return;
    }
    const s = window.db.getSettings();
    if (newPass) s.masterPasswordHash = await window.hashSecret(newPass);
    if (newPin) s.masterPinHash = await window.hashSecret(newPin);
    delete s.masterPassword;
    delete s.masterPin;
    window.db.saveSettings(s);

    if (inPass) inPass.value = "";
    if (inPin) inPin.value = "";
    this.showToast("¡Credenciales maestras del Socio Fundador actualizadas con éxito de forma criptográfica.", "success");
  }

  // =========================================================================
  // GESTIÓN OFICIAL DE ROLES Y PERMISOS GRANULARES (RBAC)
  // =========================================================================

  // =========================================================================
  // HISTORIAL DE OPERACIONES & TRAZABILIDAD POR SEDE Y USUARIO
  // =========================================================================
  renderMasterHistorial() {
    const tbody = document.getElementById("historialTableBody");
    if (!tbody || !window.db) return;

    // Filtros activos
    const selSede = document.getElementById("historialFiltroSede");
    const selUsuario = document.getElementById("historialFiltroUsuario");
    const selAccion = document.getElementById("historialFiltroAccion");
    const selModulo = document.getElementById("historialFiltroModulo");
    const inTexto = document.getElementById("historialBuscadorTexto");

    const fSede = selSede?.value || "todas";
    const fUsuario = selUsuario?.value || "todos";
    const fAccion = selAccion?.value || "todas";
    const fModulo = selModulo?.value || "todos";
    const fTexto = (inTexto?.value || "").toLowerCase().trim();

    // Obtener registros de auditoria
    let logs = [];
    try {
      logs = window.db.getRaw("auditoria") || [];
    } catch (_) {
      logs = [];
    }

    if (!Array.isArray(logs)) logs = [];

    // Poblar dinamicamente selector de usuarios si solo tiene la opcion default
    if (selUsuario && selUsuario.options.length <= 1) {
      const userMap = new Map();
      logs.forEach(l => {
        if (l.usuarioNombre) {
          const val = l.usuarioId || l.usuarioNombre;
          if (!userMap.has(val)) {
            userMap.set(val, { nombre: l.usuarioNombre, rol: l.usuarioRol || "operador" });
          }
        }
      });

      // Incluir tambien personal registrado
      try {
        const personalList = window.db.getRaw("personal") || [];
        personalList.forEach(p => {
          const val = p.id || p.dni || p.nombre;
          if (p.nombre && !userMap.has(val)) {
            userMap.set(val, { nombre: p.nombre, rol: p.cargo || p.rol || "personal" });
          }
        });
      } catch (_) {}

      userMap.forEach((uInfo, val) => {
        const opt = document.createElement("option");
        opt.value = val;
        opt.textContent = `👤 ${uInfo.nombre} (${uInfo.rol})`;
        selUsuario.appendChild(opt);
      });
      if (fUsuario !== "todos") selUsuario.value = fUsuario;
    }

    // Filtrar auditoria
    const filtered = logs.filter(l => {
      // 1. Filtro Sede
      if (fSede !== "todas") {
        const itemSede = (l.sede || "").toLowerCase().trim();
        if (itemSede !== fSede.toLowerCase().trim()) return false;
      }

      // 2. Filtro Usuario
      if (fUsuario !== "todos") {
        const uId = String(l.usuarioId || "").toLowerCase().trim();
        const uNom = String(l.usuarioNombre || "").toLowerCase().trim();
        const target = fUsuario.toLowerCase().trim();
        if (uId !== target && uNom !== target) return false;
      }

      // 3. Filtro Accion
      if (fAccion !== "todas") {
        const itemAcc = String(l.accion || "").toUpperCase().trim();
        if (itemAcc !== fAccion.toUpperCase().trim()) return false;
      }

      // 4. Filtro Modulo
      if (fModulo !== "todos") {
        const itemMod = String(l.modulo || "").toLowerCase().trim();
        if (itemMod !== fModulo.toLowerCase().trim()) return false;
      }

      // 5. Busqueda de texto libre
      if (fTexto) {
        const searchable = `${l.id || ""} ${l.modulo || ""} ${l.registroId || ""} ${l.usuarioNombre || ""} ${l.usuarioRol || ""} ${l.detalles || ""} ${l.sede || ""}`.toLowerCase();
        if (!searchable.includes(fTexto)) return false;
      }

      return true;
    });

    // Actualizar Tarjetas KPI
    const kpiTotal = document.getElementById("historialKpiTotal");
    const kpiCrear = document.getElementById("historialCrear") || document.getElementById("historialKpiCrear");
    const kpiEditar = document.getElementById("historialEditar") || document.getElementById("historialKpiEditar");
    const kpiEliminar = document.getElementById("historialEliminar") || document.getElementById("historialKpiEliminar");
    const contador = document.getElementById("historialContadorFiltrados");

    const totalCrear = filtered.filter(i => String(i.accion).toUpperCase() === "CREAR").length;
    const totalEditar = filtered.filter(i => String(i.accion).toUpperCase() === "EDITAR").length;
    const totalEliminar = filtered.filter(i => String(i.accion).toUpperCase() === "ELIMINAR").length;

    if (kpiTotal) kpiTotal.textContent = filtered.length;
    if (kpiCrear) kpiCrear.textContent = totalCrear;
    if (kpiEditar) kpiEditar.textContent = totalEditar;
    if (kpiEliminar) kpiEliminar.textContent = totalEliminar;
    if (contador) contador.textContent = `Mostrando ${filtered.length} de ${logs.length} eventos registrados`;

    // Renderizar Filas de la Tabla
    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="p-8 text-center text-slate-400">
            <div class="flex flex-col items-center justify-center gap-2">
              <i class="fa-solid fa-clock-rotate-left text-3xl text-slate-300"></i>
              <p class="font-bold text-slate-600">No se encontraron operaciones registradas</p>
              <p class="text-xs text-slate-400">Intente modificando los filtros de sede, usuario o tipo de acción.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    // Mapa de iconos y nombres de modulos
    const moduloMeta = {
      casos: { label: "Expedientes", icon: "fa-scale-balanced", color: "text-amber-600" },
      caja_chica: { label: "Caja Chica", icon: "fa-wallet", color: "text-emerald-600" },
      citas: { label: "Citas & Agenda", icon: "fa-calendar-check", color: "text-blue-600" },
      presupuestos: { label: "Presupuestos", icon: "fa-file-invoice-dollar", color: "text-indigo-600" },
      inventario: { label: "Inventario", icon: "fa-boxes-stacked", color: "text-purple-600" },
      documentos: { label: "Mesa de Partes", icon: "fa-file-lines", color: "text-cyan-600" },
      personal: { label: "Personal", icon: "fa-users", color: "text-teal-600" },
      asistencia: { label: "Asistencia", icon: "fa-user-clock", color: "text-orange-600" },
      sistema: { label: "Configuración", icon: "fa-gear", color: "text-slate-600" }
    };

    tbody.innerHTML = filtered.map(item => {
      // Formateo de fecha y hora
      let fechaHoraHtml = "-";
      try {
        const d = new Date(item.timestamp);
        if (!isNaN(d.getTime())) {
          const fStr = d.toLocaleDateString("es-PE", { year: "numeric", month: "2-digit", day: "2-digit" });
          const hStr = d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
          fechaHoraHtml = `<div class="font-bold text-slate-800 font-mono text-[11px]">${fStr}</div><div class="text-[10px] text-slate-400 font-mono">${hStr}</div>`;
        }
      } catch (_) {}

      // Sede badge
      const sedeKey = (item.sede || "challhuahuacho").toLowerCase();
      const sedeBadge = (typeof window.renderSedeBadge === "function") 
        ? window.renderSedeBadge(sedeKey) 
        : `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">${escapeHtml(sedeKey)}</span>`;

      // Badge de Accion
      let accionBadge = "";
      const act = String(item.accion || "").toUpperCase();
      if (act === "CREAR") {
        accionBadge = `<span class="inline-flex items-center gap-1 text-[10px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full"><i class="fa-solid fa-plus-circle text-emerald-600"></i> AGREGÓ</span>`;
      } else if (act === "EDITAR") {
        accionBadge = `<span class="inline-flex items-center gap-1 text-[10px] font-black text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full"><i class="fa-solid fa-pen-to-square text-amber-600"></i> MODIFICÓ</span>`;
      } else if (act === "ELIMINAR") {
        accionBadge = `<span class="inline-flex items-center gap-1 text-[10px] font-black text-rose-800 bg-rose-100 border border-rose-300 px-2 py-0.5 rounded-full"><i class="fa-solid fa-trash-can text-rose-600"></i> ELIMINÓ</span>`;
      } else {
        accionBadge = `<span class="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded-full">${escapeHtml(act)}</span>`;
      }

      // Modulo
      const modKey = (item.modulo || "general").toLowerCase();
      const modInfo = moduloMeta[modKey] || { label: modKey, icon: "fa-folder", color: "text-slate-600" };
      const moduloHtml = `<div class="flex items-center gap-1.5 font-bold text-slate-700"><i class="fa-solid ${modInfo.icon} ${modInfo.color}"></i> <span>${escapeHtml(modInfo.label)}</span></div>`;

      // Usuario
      const uNombre = escapeHtml(item.usuarioNombre || "Usuario");
      const uRol = escapeHtml(item.usuarioRol || "operador");
      const uHtml = `
        <div>
          <div class="font-bold text-slate-900">${uNombre}</div>
          <div class="text-[10px] text-slate-500 flex items-center gap-1">
            <span class="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500"></span> ${uRol}
          </div>
        </div>
      `;

      // Registro ID
      const regIdHtml = `<code class="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono text-[10.5px] font-bold border border-slate-200">${escapeHtml(item.registroId || '-')}</code>`;

      // Detalle
      const detalleHtml = `<div class="text-slate-700 font-medium leading-relaxed max-w-md line-clamp-2" title="${escapeHtml(item.detalles || '')}">${escapeHtml(item.detalles || '-')}</div>`;

      // Boton Detalle
      const safeId = escapeHtml(item.id);
      const btnDetalle = `
        <button type="button" onclick="window.app.abrirDetalleAuditoria(${jsStr(safeId)})" class="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition cursor-pointer" title="Ver detalles técnicos y metadata">
          <i class="fa-solid fa-eye text-xs"></i>
        </button>
      `;

      return `
        <tr class="hover:bg-slate-50/80 transition border-b border-slate-100">
          <td class="p-3">${fechaHoraHtml}</td>
          <td class="p-3">${sedeBadge}</td>
          <td class="p-3">${uHtml}</td>
          <td class="p-3 text-center">${accionBadge}</td>
          <td class="p-3">${moduloHtml}</td>
          <td class="p-3">${regIdHtml}</td>
          <td class="p-3">${detalleHtml}</td>
          <td class="p-3 text-center">${btnDetalle}</td>
        </tr>
      `;
    }).join("");
  }

  limpiarFiltrosHistorial() {
    const selSede = document.getElementById("historialFiltroSede");
    const selUsuario = document.getElementById("historialFiltroUsuario");
    const selAccion = document.getElementById("historialFiltroAccion");
    const selModulo = document.getElementById("historialFiltroModulo");
    const inTexto = document.getElementById("historialBuscadorTexto");

    if (selSede) selSede.value = "todas";
    if (selUsuario) selUsuario.value = "todos";
    if (selAccion) selAccion.value = "todas";
    if (selModulo) selModulo.value = "todos";
    if (inTexto) inTexto.value = "";

    this.renderMasterHistorial();
    this.showToast("Filtros de auditoría restablecidos.", "info");
  }

  abrirDetalleAuditoria(auditId) {
    if (!window.db) return;
    const logs = window.db.getRaw("auditoria") || [];
    const item = logs.find(l => l.id === auditId);
    if (!item) {
      this.showToast("Registro de auditoría no encontrado.", "warning");
      return;
    }

    const modalId = document.getElementById("modalDetalleAuditId");
    const mFecha = document.getElementById("modalAuditFecha");
    const mSede = document.getElementById("modalAuditSede");
    const mUsuario = document.getElementById("modalAuditUsuario");
    const mAccion = document.getElementById("modalAuditAccion");
    const mModulo = document.getElementById("modalAuditModulo");
    const mRegId = document.getElementById("modalAuditRegistroId");
    const mDetalles = document.getElementById("modalAuditDetalles");
    const mJson = document.getElementById("modalAuditJson");

    if (modalId) modalId.textContent = item.id;
    let fechaStr = item.timestamp;
    try {
      const d = new Date(item.timestamp);
      if (!isNaN(d.getTime())) {
        fechaStr = d.toLocaleString("es-PE", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
      }
    } catch (_) {}

    if (mFecha) mFecha.textContent = fechaStr;
    if (mSede) mSede.textContent = (item.sede || "todas").toUpperCase();
    if (mUsuario) mUsuario.textContent = `${item.usuarioNombre || 'Usuario'} (${item.usuarioRol || 'operador'})`;
    if (mAccion) {
      const act = String(item.accion || "").toUpperCase();
      mAccion.textContent = act;
      mAccion.className = act === "CREAR" ? "font-bold text-emerald-600" : (act === "EDITAR" ? "font-bold text-amber-600" : "font-bold text-rose-600");
    }
    if (mModulo) mModulo.textContent = (item.modulo || "general").toUpperCase();
    if (mRegId) mRegId.textContent = item.registroId || "-";
    if (mDetalles) mDetalles.textContent = item.detalles || "Sin detalles descriptivos.";
    if (mJson) {
      const payload = item.metadata || { id: item.id, registroId: item.registroId, accion: item.accion, modulo: item.modulo };
      mJson.textContent = JSON.stringify(payload, null, 2);
    }

    const modal = document.getElementById("modalDetalleAuditoria");
    if (modal) modal.classList.remove("hidden");
  }

  exportarHistorialExcel() {
    if (!window.db) return;
    const allLogs = window.db.getRaw("auditoria") || [];
    if (!allLogs || allLogs.length === 0) {
      this.showToast("No existen registros en el historial de auditoría.", "warning");
      return;
    }

    const selSede = document.getElementById("historialFiltroSede")?.value || "todas";
    const selUsuario = document.getElementById("historialFiltroUsuario")?.value || "todos";
    const selAccion = document.getElementById("historialFiltroAccion")?.value || "todas";
    const selModulo = document.getElementById("historialFiltroModulo")?.value || "todos";
    const inTexto = (document.getElementById("historialBuscadorTexto")?.value || "").toLowerCase().trim();

    const filtered = allLogs.filter(l => {
      if (selSede !== "todas" && (l.sede || "").toLowerCase() !== selSede.toLowerCase()) return false;
      if (selUsuario !== "todos") {
        const uId = String(l.usuarioId || "").toLowerCase();
        const uNom = String(l.usuarioNombre || "").toLowerCase();
        if (uId !== selUsuario.toLowerCase() && uNom !== selUsuario.toLowerCase()) return false;
      }
      if (selAccion !== "todas" && String(l.accion || "").toUpperCase() !== selAccion.toUpperCase()) return false;
      if (selModulo !== "todos" && String(l.modulo || "").toLowerCase() !== selModulo.toLowerCase()) return false;
      if (inTexto) {
        const s = `${l.id || ""} ${l.modulo || ""} ${l.registroId || ""} ${l.usuarioNombre || ""} ${l.usuarioRol || ""} ${l.detalles || ""}`.toLowerCase();
        if (!s.includes(inTexto)) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      this.showToast("No hay registros que coincidan con los filtros para exportar.", "warning");
      return;
    }

    const headers = ["ID Auditoría", "Fecha y Hora", "Sede", "Usuario Responsable", "Rol", "Acción", "Módulo", "Registro Afectado", "Detalle de la Operación"];
    const rows = filtered.map(l => [
      `"${(l.id || '').replace(/"/g, '""')}"`,
      `"${(l.timestamp || '').replace(/"/g, '""')}"`,
      `"${(l.sede || '').replace(/"/g, '""')}"`,
      `"${(l.usuarioNombre || '').replace(/"/g, '""')}"`,
      `"${(l.usuarioRol || '').replace(/"/g, '""')}"`,
      `"${(l.accion || '').replace(/"/g, '""')}"`,
      `"${(l.modulo || '').replace(/"/g, '""')}"`,
      `"${(l.registroId || '').replace(/"/g, '""')}"`,
      `"${(l.detalles || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map(r => r.join(";"))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dStr = new Date().toISOString().split("T")[0];
    a.href = url;
    a.download = `HISTORIAL_AUDITORIA_SEDES_${dStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.showToast(`Historial exportado con éxito (${filtered.length} eventos).`, "success");
  }

  renderRolesYPermisos() {
    if (!window.db) return;
    const allWorkers = window.db.getRaw("workers") || [];
    const searchVal = (document.getElementById("searchRolesPermisos")?.value || "").toLowerCase().trim();
    const filterSede = document.getElementById("filterSedeRolesPermisos")?.value || "ALL";

    // Contenedores de las 4 columnas oficiales solicitadas
    const colSocio = document.getElementById("rolesColSocio");
    const colAbogado = document.getElementById("rolesColAbogado");
    const colAsistenteLegal = document.getElementById("rolesColAsistenteLegal");
    const colAsistenteAdmin = document.getElementById("rolesColAsistenteAdmin");

    // Badges de conteo
    const badgeSocio = document.getElementById("badgeCountSocio");
    const badgeAbogado = document.getElementById("badgeCountAbogado");
    const badgeAsistenteLegal = document.getElementById("badgeCountAsistenteLegal");
    const badgeAsistenteAdmin = document.getElementById("badgeCountAsistenteAdmin");
    const totalBadge = document.getElementById("rolesTotalBadge");

    if (!colSocio || !colAbogado || !colAsistenteLegal || !colAsistenteAdmin) return;

    // Asegurar que todos los colaboradores tengan permisos asignados
    allWorkers.forEach(w => {
      if (!w.permisos) {
        w.permisos = window.db.getDefaultPermissionsForRole(w.rol);
      }
    });

    // Filtrado de colaboradores
    const filtered = allWorkers.filter(w => {
      const matchSearch = !searchVal ||
        (w.nombre && w.nombre.toLowerCase().includes(searchVal)) ||
        (w.dni && w.dni.toLowerCase().includes(searchVal)) ||
        (w.cargo && w.cargo.toLowerCase().includes(searchVal)) ||
        (w.usuario && w.usuario.toLowerCase().includes(searchVal));

      const matchSede = (filterSede === "ALL") || (window.db.normalizeSede(w.sede) === filterSede);
      return matchSearch && matchSede;
    });

    if (totalBadge) {
      totalBadge.textContent = `${filtered.length} ${filtered.length === 1 ? 'Colaborador' : 'Colaboradores'} con Roles`;
    }

    // Agrupación estricta en las 4 categorías solicitadas
    const groups = {
      socio: [],
      abogado: [],
      asistente_legal: [],
      asistente_admin: []
    };

    filtered.forEach(w => {
      const cat = window.db.getRoleCategorySlug ? window.db.getRoleCategorySlug(w.rol) : "abogado";
      if (cat === "super_admin" || cat === "admin" || cat === "socio") {
        groups.socio.push(w);
      } else if (groups[cat]) {
        groups[cat].push(w);
      } else {
        groups.abogado.push(w);
      }
    });

    if (badgeSocio) badgeSocio.textContent = groups.socio.length;
    if (badgeAbogado) badgeAbogado.textContent = groups.abogado.length;
    if (badgeAsistenteLegal) badgeAsistenteLegal.textContent = groups.asistente_legal.length;
    if (badgeAsistenteAdmin) badgeAsistenteAdmin.textContent = groups.asistente_admin.length;

    // Renderizado de tarjeta individual de colaborador
    const renderCard = (w) => {
      const isActivo = (w.activo !== false);
      const sedeKey = window.db.normalizeSede(w.sede);
      const sedeCfg = window.SEDES_CONFIG ? window.SEDES_CONFIG[sedeKey] : null;
      const sedeLabel = sedeCfg ? sedeCfg.nombreCorto : (w.sede === "todas" ? "Nacional" : w.sede);
      const initials = (w.nombre || "").split(" ").map(p => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "WR";

      // Conteo de permisos activos
      let permsCount = 0;
      if (w.permisos) {
        Object.values(w.permisos).forEach(m => {
          if (m && typeof m === "object") {
            Object.values(m).forEach(val => { if (val === true) permsCount++; });
          }
        });
      }

      return `
        <div class="p-3 bg-white rounded-xl border border-slate-200 hover:border-slate-300 shadow-2xs transition-all space-y-2">
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <div class="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                ${initials}
              </div>
              <div class="min-w-0">
                <h4 class="font-bold text-slate-900 text-xs truncate" title="${escapeHtml(w.nombre)}">${escapeHtml(w.nombre)}</h4>
                <div class="text-[10px] text-slate-500 font-mono">DNI: ${escapeHtml(w.dni || '—')}</div>
              </div>
            </div>
            <span class="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 ${isActivo ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}">
              ${isActivo ? 'Activo' : 'Baja'}
            </span>
          </div>

          <div class="text-[11px] text-slate-600 font-medium truncate" title="${escapeHtml(w.cargo)}">
            ${escapeHtml(w.cargo)}
          </div>

          <div class="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
            <span class="inline-flex items-center gap-1 font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
              <i class="fa-solid fa-location-dot text-amber-500 text-[9px]"></i> ${sedeLabel}
            </span>
            <span class="font-mono text-[9.5px] bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded font-bold border border-emerald-200">
              ${permsCount} privilegios
            </span>
          </div>

          <div class="pt-1.5">
            <button onclick="window.app.openPermissionsModal(${jsStr(w.id)})" class="w-full py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-[11px] transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer">
              <i class="fa-solid fa-sliders text-emerald-400 text-[10px]"></i> Gestionar Permisos
            </button>
          </div>
        </div>
      `;
    };

    const emptyHtml = `<div class="text-center py-8 text-slate-400 text-[11px] italic">Sin colaboradores asignados en este grupo</div>`;

    colSocio.innerHTML = groups.socio.length ? groups.socio.map(renderCard).join("") : emptyHtml;
    colAbogado.innerHTML = groups.abogado.length ? groups.abogado.map(renderCard).join("") : emptyHtml;
    colAsistenteLegal.innerHTML = groups.asistente_legal.length ? groups.asistente_legal.map(renderCard).join("") : emptyHtml;
    colAsistenteAdmin.innerHTML = groups.asistente_admin.length ? groups.asistente_admin.map(renderCard).join("") : emptyHtml;
  }

  filterRolesYPermisos() {
    this.renderRolesYPermisos();
  }

  openPermissionsModal(workerId) {
    if (!window.db) return;
    const allWorkers = window.db.getRaw("workers") || [];
    const worker = allWorkers.find(w => w.id === workerId);
    if (!worker) {
      this.showToast("Colaborador no encontrado en el padrón.", "error");
      return;
    }

    const idInput = document.getElementById("permModalWorkerId");
    const nombreEl = document.getElementById("permModalWorkerNombre");
    const dniEl = document.getElementById("permModalWorkerDni");
    const rolSelect = document.getElementById("permModalWorkerRol");
    const sedeSelect = document.getElementById("permModalWorkerSede");
    const subtitleEl = document.getElementById("permModalWorkerSubtitle");

    if (idInput) idInput.value = worker.id;
    if (nombreEl) nombreEl.textContent = worker.nombre;
    if (dniEl) dniEl.textContent = `DNI: ${worker.dni || '—'} | Cargo: ${worker.cargo || '—'}`;
    if (subtitleEl) subtitleEl.textContent = `Configuración individual de permisos para ${worker.nombre}`;

    const normRol = window.db.normalizeRole ? window.db.normalizeRole(worker.rol) : "abogado";
    const catSlug = window.db.getRoleCategorySlug ? window.db.getRoleCategorySlug(worker.rol) : normRol;
    if (rolSelect) rolSelect.value = normRol;
    if (sedeSelect) sedeSelect.value = window.db.normalizeSede(worker.sede);

    if (!worker.permisos) {
      worker.permisos = window.db.getDefaultPermissionsForRole(catSlug);
    }

    this.renderPermissionsMatrixRows(worker.permisos);
    this.showModal("modalGestionPermisosWorker");
  }

  renderPermissionsMatrixRows(permisos) {
    const tbody = document.getElementById("tbodyWorkerPermisosMatrix");
    if (!tbody) return;

    const modules = [
      { id: "casos", name: "Expedientes y Casos Litigiosos", icon: "fa-gavel" },
      { id: "caja_chica", name: "Caja Chica y Centros de Costo", icon: "fa-cash-register" },
      { id: "presupuestos", name: "Presupuestos y Finanzas", icon: "fa-file-invoice-dollar" },
      { id: "citas", name: "Agenda de Citas y Audiencias", icon: "fa-calendar-days" },
      { id: "asistencia", name: "Control de Asistencia", icon: "fa-user-clock" },
      { id: "documentos", name: "Documentos & Archivo Digital", icon: "fa-folder-open" },
      { id: "inventario", name: "Inventario Patrimonial ABC", icon: "fa-boxes-packing" },
      { id: "personal", name: "Gestión de Personal", icon: "fa-users" },
      { id: "kpis", name: "KPIs y Tablero Ejecutivo", icon: "fa-chart-pie" },
      { id: "configuracion", name: "Configuración y Ajustes", icon: "fa-sliders" }
    ];

    const actions = [
      { key: "read", label: "Ver" },
      { key: "create", label: "Crear" },
      { key: "update", label: "Editar" },
      { key: "delete", label: "Eliminar" },
      { key: "export", label: "Exportar" }
    ];

    tbody.innerHTML = modules.map(m => {
      const modPerms = (permisos && permisos[m.id]) ? permisos[m.id] : {};
      return `
        <tr class="hover:bg-slate-50 transition border-b border-slate-100">
          <td class="py-2.5 px-3 font-semibold text-slate-800 flex items-center gap-2">
            <i class="fa-solid ${m.icon} text-slate-400 text-xs w-4 text-center"></i>
            <span>${m.name}</span>
          </td>
          ${actions.map(a => {
            const isChecked = modPerms[a.key] === true;
            return `
              <td class="py-2.5 px-2 text-center">
                <input type="checkbox" id="perm_${m.id}_${a.key}" data-module="${m.id}" data-action="${a.key}" ${isChecked ? 'checked' : ''} class="perm-checkbox w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer">
              </td>
            `;
          }).join("")}
        </tr>
      `;
    }).join("");
  }

  onPermModalRoleChange(newRole) {
    if (confirm(`¿Desea cargar los permisos predeterminados del rol «${window.db.getRoleLabel(newRole)}» para esta asignación?`)) {
      this.applyRoleDefaultsToPermModal();
    }
  }

  applyRoleDefaultsToPermModal() {
    const rolSelect = document.getElementById("permModalWorkerRol");
    if (!rolSelect || !window.db) return;
    const catSlug = rolSelect.value;
    const defaults = window.db.getDefaultPermissionsForRole(catSlug);
    this.renderPermissionsMatrixRows(defaults);
    this.showToast(`Perfil por defecto cargado para «${window.db.getRoleLabel(catSlug)}».`, "info");
  }

  toggleAllPermCheckboxes(checked) {
    document.querySelectorAll(".perm-checkbox").forEach(chk => {
      chk.checked = !!checked;
    });
  }

  saveWorkerPermissions() {
    const idInput = document.getElementById("permModalWorkerId");
    const rolSelect = document.getElementById("permModalWorkerRol");
    const sedeSelect = document.getElementById("permModalWorkerSede");
    if (!idInput || !window.db) return;

    const workerId = idInput.value;
    const allWorkers = window.db.getRaw("workers") || [];
    const worker = allWorkers.find(w => w.id === workerId);
    if (!worker) {
      this.showToast("Colaborador no encontrado.", "error");
      return;
    }

    const newRol = rolSelect ? rolSelect.value : worker.rol;
    const newSede = sedeSelect ? sedeSelect.value : worker.sede;

    // Recolectar matriz de permisos (merge: no borrar personal/kpis ni otras claves previas)
    const newPermisos = { ...(worker.permisos || {}) };
    const modules = ["casos", "caja_chica", "presupuestos", "citas", "asistencia", "documentos", "inventario", "configuracion", "personal", "kpis"];
    const actions = ["read", "create", "update", "delete", "export"];

    modules.forEach(m => {
      newPermisos[m] = { ...(newPermisos[m] || {}) };
      actions.forEach(a => {
        const chk = document.getElementById(`perm_${m}_${a}`);
        if (chk) newPermisos[m][a] = chk.checked;
      });
    });

    worker.rol = newRol;
    worker.sede = newSede;
    worker.permisos = newPermisos;
    worker.updatedAt = new Date().toISOString();

    window.db.update("workers", workerId, {
      rol: newRol,
      sede: newSede,
      permisos: newPermisos,
      updatedAt: worker.updatedAt
    });

    // Si es el usuario actual en sesión, actualizar sesión en vivo
    const currentUser = window.db.getCurrentUser();
    if (currentUser && currentUser.id === workerId) {
      currentUser.rol = newRol;
      currentUser.sede = newSede;
      currentUser.permisos = newPermisos;
      window.db.setCurrentUser(currentUser);
      this.applySettingsToUI();
      if (typeof this.renderDynamicSidebarModules === "function") this.renderDynamicSidebarModules();
    }

    this.closeModal("modalGestionPermisosWorker");
    this.showToast(`Permisos granulares guardados exitosamente para ${worker.nombre}.`, "success");
    this.renderRolesYPermisos();
    if (this.currentTab === "personal") this.renderPersonal();
  }

  initHeartbeatNotifier() {
    const badge = document.getElementById("heartbeatNotifierBadge");
    if (badge) {
      badge.className = "hidden";
    }
  }




  async updateStorageQuotaDisplay() {
    try {
      const widget = document.getElementById("storageQuotaWidget");
      const textEl = document.getElementById("storageQuotaText");
      const barEl = document.getElementById("storageQuotaBar");
      const iconEl = document.getElementById("storageQuotaIcon");
      if (!textEl || !barEl) return;

      let usedBytes = 0;
      let totalQuota = 50 * 1024 * 1024;

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const val = localStorage.getItem(key) || "";
        usedBytes += (key.length + val.length) * 2;
      }

      if (navigator.storage && navigator.storage.estimate) {
        try {
          const estimate = await navigator.storage.estimate();
          if (estimate.usage) {
            usedBytes = Math.max(usedBytes, estimate.usage);
          }
          if (estimate.quota) {
            totalQuota = Math.min(estimate.quota, 100 * 1024 * 1024);
          }
        } catch (_) {}
      }

      const usedMB = (usedBytes / (1024 * 1024)).toFixed(1);
      const percent = Math.min(Math.round((usedBytes / totalQuota) * 100), 100);

      textEl.textContent = `${usedMB} MB`;
      barEl.style.width = `${Math.max(percent, 5)}%`;

      if (percent > 85) {
        barEl.className = "h-full bg-rose-500 transition-all duration-500";
        if (iconEl) iconEl.className = "fa-solid fa-triangle-exclamation text-rose-500 text-xs animate-bounce";
      } else if (percent > 65) {
        barEl.className = "h-full bg-amber-500 transition-all duration-500";
        if (iconEl) iconEl.className = "fa-solid fa-hard-drive text-amber-500 text-xs";
      } else {
        barEl.className = "h-full bg-emerald-500 transition-all duration-500";
        if (iconEl) iconEl.className = "fa-solid fa-hard-drive text-slate-500 text-xs";
      }
    } catch (e) {
      console.warn("Error calculando cuota de almacenamiento:", e);
    }
  }

  mostrarDetalleAlmacenamiento() {
    let breakdown = [];
    const collections = ["casos", "caja_chica", "citas", "inventario", "documentos", "presupuestos", "workers", "attendance"];
    let totalItems = 0;

    collections.forEach(col => {
      const items = window.db ? window.db.getRaw(col) : [];
      const count = Array.isArray(items) ? items.length : 0;
      totalItems += count;
      const jsonLen = JSON.stringify(items).length;
      const kb = (jsonLen / 1024).toFixed(1);
      breakdown.push(`• ${col}: ${count} registros (${kb} KB)`);
    });

    const isCrypto = window.legalCrypto && window.legalCrypto.hasActiveKey();
    const cryptoStatus = isCrypto ? "🟢 Cifrado Militar AES-256-GCM Activo (Sesión Segura)" : "⚪ Sesión Estándar";

    const msg = `AUDITORÍA DE ALMACENAMIENTO LOCAL & PERSISTENCIA\n\n` +
      `Estado de Seguridad: ${cryptoStatus}\n\n` +
      `Detalle por Módulo:\n${breakdown.join('\n')}\n\n` +
      `Total Registros: ${totalItems}\n\n` +
      `¿Desea descargar una Copia de Seguridad JSON completa en este momento?`; // replaced msg





    if (confirm(msg)) {
      if (window.db && typeof window.db.exportAllDataJson === "function") {
        window.db.exportAllDataJson();
      } else if (window.excelExporter) {
        window.excelExporter.exportMasterWorkbook();
      }
    }
  }

  // Hook para carga dinámica de vistas modulares mediante ComponentLoader
  async loadViewModule(viewId) {
    if (window.componentLoader) {
      return await window.componentLoader.ensureViewLoaded(viewId);
    }
    return document.getElementById("view-" + viewId);
  }
}

function openAlertsFromDeepLink() {
  try {
    const params = new URLSearchParams(window.location.search || "");
    const open = params.get("open");
    if (open === "alerts" && window.alerts && typeof window.alerts.openDrawer === "function") {
      window.alerts.openDrawer();
      params.delete("open");
      const next = params.toString();
      const url = window.location.pathname + (next ? "?" + next : "") + (window.location.hash || "");
      window.history.replaceState({}, "", url);
    }
  } catch (_) {}
}

async function bootLegalApp() {
  if (!window.app && typeof LegalApp === "function") {
    try {
      window.app = new LegalApp();
      await window.app.init();
      openAlertsFromDeepLink();
    } catch (e) {
      console.error("Error al inicializar LegalApp:", e);
    }
  }
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data && event.data.type === "PA_OPEN_ALERTS" && window.alerts && typeof window.alerts.openDrawer === "function") {
      window.alerts.openDrawer();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootLegalApp);
} else {
  bootLegalApp();
}

window.LegalApp = LegalApp;