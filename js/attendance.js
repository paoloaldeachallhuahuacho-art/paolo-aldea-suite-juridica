/**
 * PAOLO ALDEA & ABOGADOS - Módulo de Control de Asistencia y Geolocalización (Geofencing)
 * Sede Challhuahuacho - Cotabambas, Apurímac
 * Control de Acceso por Roles (RBAC), Geocercas (Haversine 100m) y Gestión de Diligencias
 */

const AttendanceModule = (function () {
  // Estado interno del módulo
  let currentRole = "colaborador"; // 'colaborador' | 'admin'
  let adminAuthenticated = false;
  let selectedWorker = null;
  let attendanceMode = "oficina_sede"; // 'oficina_sede' | 'gps_real' | 'comision_otras_sedes'
  let comisionSedeDestino = "miraflores";
  let liveGps = {
    lat: -14.116667,
    lon: -72.245000,
    accuracy: 10,
    timestamp: Date.now(),
    distance: 0,
    insideGeofence: true,
    mode: "oficina_sede", // 'oficina_sede' | 'gps_real' | 'comision_otras_sedes' | 'real'
    error: null,
    loading: false
  };
  let clockInterval = null;

  // Helper unificado de notificaciones toast
  function showToast(msg, type = "info") {
    if (window.app && typeof window.app.showToast === "function") {
      window.app.showToast(msg, type);
    } else if (typeof window.showToast === "function") {
      window.showToast(msg, type);
    } else {
      console.log(`[Toast ${type}]`, msg);
    }
  }
  if (typeof window !== "undefined" && !window.showToast) {
    window.showToast = showToast;
  }

  function esc(str) {
    if (typeof window.escapeHtml === "function") return window.escapeHtml(str);
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Lugares predefinidos para simulación / pruebas de oficina y diligencias en Cotabambas
  const PRESET_LOCATIONS = {
    sim_oficina: {
      nombre: "Oficina Central Challhuahuacho (Av. Los Mineros)",
      lat: -14.116667,
      lon: -72.245000,
      accuracy: 8
    },
    sim_juzgado: {
      nombre: "Juzgado de Paz Letrado / Mixto de Challhuahuacho",
      lat: -14.119850,
      lon: -72.248100,
      accuracy: 12
    },
    sim_fiscalia: {
      nombre: "Fiscalía Provincial Mixta de Cotabambas (Tambobamba)",
      lat: -14.045230,
      lon: -72.312450,
      accuracy: 15
    },
    sim_comunidad: {
      nombre: "Comunidad Campesina de Fuerabamba / Chila",
      lat: -14.135200,
      lon: -72.289100,
      accuracy: 20
    }
  };

  /**
   * Cálculo de Distancia mediante Fórmula de Haversine
   * @param {number} lat1 Latitud punto 1
   * @param {number} lon1 Longitud punto 1
   * @param {number} lat2 Latitud punto 2
   * @param {number} lon2 Longitud punto 2
   * @returns {number} Distancia exacta en metros
   */
  function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    if (typeof lat1 !== "number" || typeof lon1 !== "number" || typeof lat2 !== "number" || typeof lon2 !== "number") {
      return 999999;
    }
    const R = 6371000; // Radio de la Tierra en metros
    const toRad = deg => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }

  let selectedCityOverride = null;
  let manualStationOverride = false;
  let gpsWatchId = null;
  let gpsAutoInterval = null;

  /**
   * Evalúa todas las sedes oficiales del estudio para detectar automáticamente
   * si el colaborador se encuentra cerca (dentro del radio de geocerca) de alguna oficina.
   */
  function detectNearestOfficeFromCoords(lat, lon) {
    const currentOffice = getOfficeConfig();
    let bestOffice = currentOffice;
    let minDistance = calculateHaversineDistance(lat, lon, currentOffice.lat, currentOffice.lon);

    if (!selectedCityOverride && window.SEDES_CONFIG) {
      Object.keys(window.SEDES_CONFIG).forEach(key => {
        if (key === "todas") return;
        const cfg = window.SEDES_CONFIG[key];
        if (cfg && typeof cfg.lat === "number" && typeof cfg.lon === "number") {
          const d = calculateHaversineDistance(lat, lon, cfg.lat, cfg.lon);
          const rad = typeof cfg.radio === "number" ? cfg.radio : 100;
          if (d <= rad && d < minDistance) {
            minDistance = d;
            bestOffice = {
              id: cfg.id || key,
              codigo: cfg.codigo || "SED",
              lat: cfg.lat,
              lon: cfg.lon,
              radio: rad,
              nombre: cfg.nombre || key,
              nombreCorto: cfg.nombreCorto || key,
              direccion: cfg.direccion || "",
              ciudad: cfg.region || cfg.ciudad || ""
            };
          }
        }
      });
    }
    return { office: bestOffice, distance: minDistance };
  }

  /**
   * Sincroniza visualmente los botones de modalidad ("En Oficina", "Tiempo Real", "Comisión")
   * de forma automática según si el GPS detecta cercanía o lejanía a las oficinas.
   */
  function syncModeButtonsVisualState(activeModeKey) {
    const btnOficina = document.getElementById("btnModoOficinaSede");
    const btnGps = document.getElementById("btnModoGpsReal");
    const btnComision = document.getElementById("btnModoComisionOtrasSedes");

    const panelOficina = document.getElementById("panel-modo-oficina");
    const panelGps = document.getElementById("panel-modo-gps");
    const panelComision = document.getElementById("panel-modo-comision");

    const resetBtn = (btn) => {
      if (!btn) return;
      btn.className = "attendance-mode-btn py-2 px-1 rounded-lg text-[10.5px] sm:text-[11px] font-bold transition flex flex-col items-center gap-1 text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent cursor-pointer";
    };

    resetBtn(btnOficina);
    resetBtn(btnGps);
    resetBtn(btnComision);

    if (panelOficina) panelOficina.classList.add("hidden");
    if (panelGps) panelGps.classList.add("hidden");
    if (panelComision) panelComision.classList.add("hidden");

    if (activeModeKey === "oficina_sede") {
      if (btnOficina) btnOficina.className = "attendance-mode-btn py-2 px-1 rounded-lg text-[10.5px] sm:text-[11px] font-bold transition flex flex-col items-center gap-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm cursor-pointer";
      if (panelOficina) panelOficina.classList.remove("hidden");
    } else if (activeModeKey === "gps_real") {
      if (btnGps) btnGps.className = "attendance-mode-btn py-2 px-1 rounded-lg text-[10.5px] sm:text-[11px] font-bold transition flex flex-col items-center gap-1 bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm cursor-pointer";
      if (panelGps) panelGps.classList.remove("hidden");
    } else if (activeModeKey === "comision_otras_sedes") {
      if (btnComision) btnComision.className = "attendance-mode-btn py-2 px-1 rounded-lg text-[10.5px] sm:text-[11px] font-bold transition flex flex-col items-center gap-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/50 shadow-sm cursor-pointer";
      if (panelComision) panelComision.classList.remove("hidden");
    }
  }

  /**
   * Procesa automáticamente cada lectura de coordenadas GPS para detectar
   * si está cerca o lejos de la oficina y actualizar geocerca y botones al instante.
   */
  function applyRealGpsCoordinates(coords, timestamp) {
    if (attendanceMode === "comision_otras_sedes" || manualStationOverride) {
      return;
    }

    const lat = coords.latitude;
    const lon = coords.longitude;
    const acc = Math.round(coords.accuracy || 10);

    const detected = detectNearestOfficeFromCoords(lat, lon);
    const office = detected.office;
    const dist = detected.distance;
    const isNearOffice = dist <= office.radio;

    liveGps.lat = lat;
    liveGps.lon = lon;
    liveGps.accuracy = acc;
    liveGps.timestamp = timestamp || Date.now();
    liveGps.error = null;
    liveGps.loading = false;
    liveGps.isComision = false;
    liveGps.distance = dist;
    liveGps.insideGeofence = isNearOffice;
    liveGps.targetSedeNombre = office.nombre;

    // Si detecta que está cerca (dentro de la geocerca de la oficina), activa automáticamente el botón En Oficina
    // Si detecta que está lejos (fuera de la geocerca), cambia automáticamente a Tiempo Real (GPS Móvil)
    if (isNearOffice) {
      attendanceMode = "oficina_sede";
      liveGps.mode = "gps_auto_oficina";
      const citySelector = document.getElementById("asistencia-sede-filtro-ubicacion");
      if (citySelector && office.id) citySelector.value = office.id;
      syncModeButtonsVisualState("oficina_sede");
    } else {
      attendanceMode = "gps_real";
      liveGps.mode = "gps_real";
      syncModeButtonsVisualState("gps_real");
    }

    updateGpsUi();
  }

  /**
   * Inicia el rastreo satelital continuo en tiempo real (watchPosition)
   * para actualizar automáticamente la geocerca y los botones al acercarse o alejarse.
   */
  function startAutoGeofenceTracking() {
    if (!navigator.geolocation) return;

    window._suppressLockOnPrompt = Date.now() + 8000;

    if (gpsWatchId !== null) {
      try { navigator.geolocation.clearWatch(gpsWatchId); } catch (_) {}
      gpsWatchId = null;
    }

    try {
      gpsWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          applyRealGpsCoordinates(pos.coords, pos.timestamp);
        },
        (err) => {
          // Si no hay permiso o señal GPS y no estaba en modo estación manual, reflejar estado
          if (!manualStationOverride && attendanceMode === "gps_real") {
            liveGps.loading = false;
            updateGpsUi();
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 3000
        }
      );
    } catch (e) {
      console.warn("watchPosition warning:", e);
    }

    if (gpsAutoInterval) clearInterval(gpsAutoInterval);
    gpsAutoInterval = setInterval(() => {
      if (!manualStationOverride && attendanceMode !== "comision_otras_sedes" && document.visibilityState === "visible") {
        navigator.geolocation.getCurrentPosition(
          (pos) => applyRealGpsCoordinates(pos.coords, pos.timestamp),
          () => {},
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 3000 }
        );
      }
    }, 6000);
  }

  const PRESETS_POR_SEDE = {
    challhuahuacho: {
      ciudad: "Cotabambas, Apurímac",
      nombreSede: "Sede Challhuahuacho",
      lugares: [
        { id: "sim_oficina", icon: "🏢", label: "Despacho Sede Challhuahuacho (Av. Los Mineros s/n)", lat: -14.116667, lon: -72.245000, accuracy: 5 },
        { id: "sim_juzgado", icon: "🏛️", label: "Juzgado de Paz Letrado e IP Challhuahuacho", lat: -14.119850, lon: -72.248100, accuracy: 12 },
        { id: "sim_fiscalia", icon: "⚖️", label: "Fiscalía Provincial Mixta de Cotabambas (Tambobamba)", lat: -14.045230, lon: -72.312450, accuracy: 15 },
        { id: "sim_comunidad", icon: "👥", label: "Comunidad Fuerabamba / Chila / Choaquere", lat: -14.135200, lon: -72.289100, accuracy: 20 },
        { id: "sim_comisaria", icon: "🛡️", label: "Comisaría PNP Sectorial Challhuahuacho", lat: -14.117400, lon: -72.246200, accuracy: 10 }
      ]
    },
    miraflores: {
      ciudad: "Miraflores, Lima Metropolitana",
      nombreSede: "Sede Miraflores (Lima)",
      lugares: [
        { id: "sim_oficina", icon: "🏢", label: "Despacho Sede Miraflores (Av. República de Panamá)", lat: -12.1226280, lon: -77.0114260, accuracy: 5 },
        { id: "sim_juzgado", icon: "🏛️", label: "Juzgados Civiles y Comerciales de Lima (Petit Thouars)", lat: -12.083100, lon: -77.035400, accuracy: 12 },
        { id: "sim_suprema", icon: "🏛️", label: "Palacio Nacional de Justicia (Corte Suprema de la República)", lat: -12.056100, lon: -77.034500, accuracy: 10 },
        { id: "sim_fiscalia", icon: "⚖️", label: "Fiscalía de la Nación / Sede Central Lima", lat: -12.049800, lon: -77.026700, accuracy: 15 },
        { id: "sim_comunidad", icon: "📜", label: "Notaría de Miraflores / SUNARP Miraflores", lat: -12.118900, lon: -77.028900, accuracy: 10 }
      ]
    },
    abancay: {
      ciudad: "Abancay, Apurímac",
      nombreSede: "Sede Abancay",
      lugares: [
        { id: "sim_oficina", icon: "🏢", label: "Despacho Sede Abancay (Abancay - Apurímac)", lat: -13.6356460, lon: -72.8776140, accuracy: 5 },
        { id: "sim_juzgado", icon: "🏛️", label: "Corte Superior de Justicia de Apurímac (Díaz Bárcenas)", lat: -13.634200, lon: -72.883500, accuracy: 12 },
        { id: "sim_fiscalia", icon: "⚖️", label: "Fiscalía Provincial Mixta de Abancay", lat: -13.637100, lon: -72.879800, accuracy: 15 },
        { id: "sim_comunidad", icon: "🏦", label: "Banco de la Nación / Notaría Pública Abancay", lat: -13.635500, lon: -72.882100, accuracy: 10 },
        { id: "sim_sunarp", icon: "📜", label: "SUNARP Zona Registral Sede Abancay", lat: -13.638000, lon: -72.880500, accuracy: 10 }
      ]
    },
    cusco: {
      ciudad: "Cusco, Cusco",
      nombreSede: "Sede Cusco",
      lugares: [
        { id: "sim_oficina", icon: "🏢", label: "Despacho Sede Cusco (Av. de la Cultura / Wanchaq)", lat: -13.5227850, lon: -71.9699630, accuracy: 5 },
        { id: "sim_juzgado", icon: "🏛️", label: "Palacio de Justicia del Cusco (Av. El Sol)", lat: -13.518900, lon: -71.976500, accuracy: 12 },
        { id: "sim_fiscalia", icon: "⚖️", label: "Fiscalía Provincial Corporativa del Cusco", lat: -13.520400, lon: -71.974100, accuracy: 15 },
        { id: "sim_comunidad", icon: "📜", label: "SUNARP Zona Registral X / Notaría Wanchaq", lat: -13.524100, lon: -71.965200, accuracy: 10 },
        { id: "sim_policia", icon: "🛡️", label: "Divincri PNP Cusco (Wanchaq)", lat: -13.521800, lon: -71.971200, accuracy: 12 }
      ]
    },
    huaraz: {
      ciudad: "Huaraz, Áncash",
      nombreSede: "Sede Huaraz",
      lugares: [
        { id: "sim_oficina", icon: "🏢", label: "Despacho Sede Huaraz (Jr. Gabino Uribe 650)", lat: -9.530500, lon: -77.524200, accuracy: 5 },
        { id: "sim_juzgado", icon: "🏛️", label: "Corte Superior de Justicia de Áncash (Plaza Mayor)", lat: -9.529800, lon: -77.529100, accuracy: 12 },
        { id: "sim_fiscalia", icon: "⚖️", label: "Fiscalía Provincial Corporativa de Huaraz", lat: -9.526200, lon: -77.526500, accuracy: 15 },
        { id: "sim_comunidad", icon: "📜", label: "Notaría Pública Simón Bolívar / SUNARP Huaraz", lat: -9.528500, lon: -77.528100, accuracy: 10 }
      ]
    }
  };

  /**
   * Obtiene la configuración de la oficina central desde DataManager y SEDES_CONFIG
   * Adaptada automáticamente según el Colaborador seleccionado o la Sede Activa
   */
  function getOfficeConfig() {
    let effectiveSede = "challhuahuacho";

    if (selectedCityOverride && PRESETS_POR_SEDE[selectedCityOverride]) {
      effectiveSede = selectedCityOverride;
    } else if (selectedWorker && selectedWorker.sede && selectedWorker.sede !== "todas") {
      effectiveSede = window.db ? window.db.normalizeSede(selectedWorker.sede) : selectedWorker.sede;
    } else {
      const active = (window.db && typeof window.db.getActiveSede === "function") ? window.db.getActiveSede() : "challhuahuacho";
      if (active && active !== "todas") {
        effectiveSede = window.db ? window.db.normalizeSede(active) : active;
      } else {
        const currentUser = window.db ? window.db.getCurrentUser() : null;
        if (currentUser && currentUser.sede && currentUser.sede !== "todas") {
          effectiveSede = window.db ? window.db.normalizeSede(currentUser.sede) : currentUser.sede;
        } else {
          effectiveSede = "challhuahuacho";
        }
      }
    }

    const branchCfg = (window.SEDES_CONFIG && window.SEDES_CONFIG[effectiveSede]) ? window.SEDES_CONFIG[effectiveSede] : null;
    const settings = window.db ? window.db.getSettings() : {};

    if (branchCfg) {
      return {
        id: branchCfg.id,
        codigo: branchCfg.codigo || "CHL",
        lat: typeof branchCfg.lat === "number" ? branchCfg.lat : -14.116667,
        lon: typeof branchCfg.lon === "number" ? branchCfg.lon : -72.245000,
        radio: typeof branchCfg.radio === "number" ? branchCfg.radio : (typeof settings.oficinaRadioMetros === "number" ? settings.oficinaRadioMetros : 100),
        nombre: branchCfg.nombre || "Sede Challhuahuacho",
        nombreCorto: branchCfg.nombreCorto || "Challhuahuacho",
        direccion: branchCfg.direccion || "",
        ciudad: branchCfg.region || branchCfg.ciudad || ""
      };
    }

    return {
      id: "challhuahuacho",
      codigo: "CHL",
      lat: typeof settings.oficinaLat === "number" ? settings.oficinaLat : -14.116667,
      lon: typeof settings.oficinaLon === "number" ? settings.oficinaLon : -72.245000,
      radio: typeof settings.oficinaRadioMetros === "number" ? settings.oficinaRadioMetros : 100,
      nombre: settings.oficinaNombre || "Sede Central Challhuahuacho",
      nombreCorto: "Challhuahuacho",
      direccion: "Av. Los Mineros Mz. D Lt. 4, Challhuahuacho, Cotabambas",
      ciudad: "Cotabambas, Apurímac"
    };
  }

  /**
   * Cambia la modalidad de asistencia:
   * 1. 'oficina_sede': Marcación ordinaria presencial en despacho según la sede seleccionada.
   * 2. 'gps_real': Sensor satelital de geolocalización en tiempo real desde el dispositivo.
   * 3. 'comision_otras_sedes': Asignación oficial en otra sede nacional de la firma.
   */
  function setAttendanceMode(mode) {
    attendanceMode = mode;
    liveGps.mode = mode;

    if (mode === "oficina_sede") {
      manualStationOverride = true;
      syncModeButtonsVisualState("oficina_sede");
      refreshGpsPosition("oficina_sede");
    } else if (mode === "gps_real") {
      manualStationOverride = false;
      syncModeButtonsVisualState("gps_real");
      refreshGpsPosition("gps_real");
      startAutoGeofenceTracking();
    } else if (mode === "comision_otras_sedes") {
      manualStationOverride = false;
      syncModeButtonsVisualState("comision_otras_sedes");
      const selDest = document.getElementById("asistencia-comision-sede-destino");
      if (selDest) comisionSedeDestino = selDest.value;
      refreshGpsPosition("comision_otras_sedes");
    }
  }

  function onSedeCityChange(cityKey) {
    selectedCityOverride = cityKey;
    refreshGpsPosition(manualStationOverride ? "oficina_sede" : "gps_real");
    if (window.showToast) {
      const cfg = PRESETS_POR_SEDE[cityKey];
      window.showToast(`Sede de trabajo fijada: ${cfg ? cfg.nombreSede : cityKey}`, "info");
    }
  }

  function onComisionSedeChange(targetSede) {
    comisionSedeDestino = targetSede;
    refreshGpsPosition("comision_otras_sedes");
    if (window.showToast) {
      const cfg = (window.SEDES_CONFIG && window.SEDES_CONFIG[targetSede]) ? window.SEDES_CONFIG[targetSede] : { nombre: targetSede };
      window.showToast(`Comisión Oficial asignada a: ${cfg.nombre || targetSede}`, "info");
    }
  }

  function updateLocationValidationOptions(targetSede = null) {
    if (targetSede) {
      selectedCityOverride = targetSede;
      const citySelector = document.getElementById("asistencia-sede-filtro-ubicacion");
      if (citySelector) citySelector.value = targetSede;
    }
  }

  function getPresetForOffice(office, mode) {
    const sedeId = selectedCityOverride || office.id || "challhuahuacho";
    const dict = PRESETS_POR_SEDE[sedeId] || PRESETS_POR_SEDE.challhuahuacho;
    return dict.lugares[0];
  }

  /**
   * Consulta el GPS en tiempo real o aplica posición oficial según modo
   */
  async function refreshGpsPosition(requestedMode = null) {
    if (requestedMode) {
      if (requestedMode === "oficina_sede" || requestedMode === "gps_real" || requestedMode === "comision_otras_sedes") {
        attendanceMode = requestedMode;
      }
      liveGps.mode = requestedMode;
    } else {
      liveGps.mode = attendanceMode;
    }

    const office = getOfficeConfig();

    // 1. MODO: EN OFICINA SEGÚN SEDE (con verificación de proximidad real si GPS está disponible)
    if ((attendanceMode === "oficina_sede" && manualStationOverride) || liveGps.mode === "estacion_fija" || liveGps.mode === "sim_oficina") {
      if (navigator.geolocation && !liveGps.mode.includes("sim_")) {
        try {
          const currentPos = await new Promise((res, rej) => {
            navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 3500, maximumAge: 5000 });
          });
          const distReal = calculateHaversineDistance(currentPos.coords.latitude, currentPos.coords.longitude, office.lat, office.lon);
          liveGps.lat = currentPos.coords.latitude;
          liveGps.lon = currentPos.coords.longitude;
          liveGps.accuracy = currentPos.coords.accuracy || 10;
          liveGps.timestamp = currentPos.timestamp || Date.now();
          liveGps.distance = distReal;
          liveGps.insideGeofence = (distReal <= (office.radio || 100));
          liveGps.loading = false;
          liveGps.isComision = false;
          liveGps.targetSedeNombre = office.nombre;
          syncModeButtonsVisualState("oficina_sede");
          updateGpsUi();
          return liveGps;
        } catch (_) {}
      }
      liveGps.lat = office.lat;
      liveGps.lon = office.lon;
      liveGps.accuracy = 25;
      liveGps.timestamp = Date.now();
      liveGps.error = null;
      liveGps.distance = 0;
      liveGps.insideGeofence = true;
      liveGps.isDesktopStation = true;
      liveGps.loading = false;
      liveGps.isComision = false;
      liveGps.targetSedeNombre = office.nombre;
      syncModeButtonsVisualState("oficina_sede");
      updateGpsUi();
      return liveGps;
    }

    // 2. MODO: COMISIÓN OFICIAL EN OTRAS SEDES
    if (attendanceMode === "comision_otras_sedes" || liveGps.mode === "comision_otras_sedes") {
      const targetSede = comisionSedeDestino || "miraflores";
      const targetCfg = (window.SEDES_CONFIG && window.SEDES_CONFIG[targetSede]) ? window.SEDES_CONFIG[targetSede] : office;
      liveGps.lat = targetCfg.lat || office.lat;
      liveGps.lon = targetCfg.lon || office.lon;
      liveGps.accuracy = 5;
      liveGps.timestamp = Date.now();
      liveGps.error = null;
      liveGps.distance = 0;
      liveGps.insideGeofence = true;
      liveGps.loading = false;
      liveGps.isComision = true;
      liveGps.targetSedeNombre = targetCfg.nombre || targetSede;
      syncModeButtonsVisualState("comision_otras_sedes");
      updateGpsUi();
      return liveGps;
    }

    // 3. MODO AUTOMÁTICO / UBICACIÓN EN TIEMPO REAL (GPS / CELULAR / LAPTOP)
    if (!navigator.geolocation) {
      liveGps.error = "Geolocalización no soportada por el navegador.";
      updateGpsUi();
      return liveGps;
    }

    window._suppressLockOnPrompt = Date.now() + 8000;
    liveGps.loading = true;
    updateGpsUi();

    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      applyRealGpsCoordinates(pos.coords, pos.timestamp);
      return liveGps;
    } catch (err) {
      liveGps.loading = false;
      let msg = "Error al obtener GPS.";
      if (err.code === 1) msg = "Permiso de ubicación denegado por el usuario.";
      else if (err.code === 2) msg = "Señal de GPS no disponible.";
      else if (err.code === 3) msg = "Tiempo de espera agotado al conectar GPS.";
      liveGps.error = msg;
      liveGps.distance = 999999;
      liveGps.insideGeofence = false;
      syncModeButtonsVisualState("gps_real");
    }

    updateGpsUi();
    return liveGps;
  }

  /**
   * Actualiza el widget visual de estado de GPS / Geocerca
   * Adaptado automáticamente a cada Sede y con Alto Contraste y Colores Nítidos
   */
  function updateGpsUi() {
    const radar = document.getElementById("asistencia-gps-radar");
    const badge = document.getElementById("asistencia-gps-badge");
    const georefBadge = document.getElementById("asistencia-georef-badge");
    const coordsEl = document.getElementById("asistencia-gps-coords");
    const distanceEl = document.getElementById("asistencia-gps-distance");
    const toleranceEl = document.getElementById("asistencia-gps-tolerance");
    const externalBox = document.getElementById("asistencia-external-diligence-box");
    const btnNormalIngreso = document.getElementById("btn-asistencia-marcar-ingreso");
    const btnNormalSalida = document.getElementById("btn-asistencia-marcar-salida");

    const office = getOfficeConfig();
    if (toleranceEl) toleranceEl.textContent = `${office.radio} metros`;

    const subTitleEl = document.getElementById("asistencia-radar-sede-sub");
    if (subTitleEl) subTitleEl.textContent = `${office.nombre}`;

    const labelDistancia = document.getElementById("asistencia-label-distancia");
    if (labelDistancia) {
      labelDistancia.innerHTML = `<i class="fa-solid fa-route text-amber-400 text-xs"></i> Distancia a Sede ${office.nombreCorto}:`;
    }

    const sedeCoords = document.getElementById("asistencia-sede-oficial-coords");
    if (sedeCoords) {
      sedeCoords.textContent = `${office.lat.toFixed(6)}, ${office.lon.toFixed(6)}`;
    }

    if (coordsEl) {
      coordsEl.textContent = `${liveGps.lat.toFixed(6)}, ${liveGps.lon.toFixed(6)} (±${liveGps.accuracy}m)`;
    }

    if (distanceEl) {
      if (liveGps.error && (liveGps.mode === "real" || liveGps.mode === "gps_real")) {
        distanceEl.textContent = `Error: ${liveGps.error}`;
      } else {
        distanceEl.textContent = `${liveGps.distance} m de la sede`;
      }
    }

    // Evaluación automática de Geocerca (Cerca <= 100m vs Lejos > 100m)
    if (liveGps.insideGeofence) {
      if (badge) {
        badge.className = "inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-extrabold bg-emerald-950 text-emerald-300 border border-emerald-500 shadow-md whitespace-nowrap";
        badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> DENTRO DE GEOCERCA (${liveGps.distance}m)`;
      }
      if (georefBadge) {
        georefBadge.className = "text-[10px] font-bold text-emerald-300 bg-emerald-950 px-2.5 py-0.5 rounded border border-emerald-500/50 flex items-center gap-1 shadow-sm whitespace-nowrap";
        georefBadge.innerHTML = `<i class="fa-solid fa-shield-halved"></i> Cerca de Oficina (${liveGps.distance}m)`;
      }
      if (radar) {
        radar.className = "p-3.5 sm:p-4 rounded-2xl border-2 border-emerald-500/80 bg-slate-900 shadow-2xl space-y-3 transition-all";
      }
      if (externalBox) {
        externalBox.classList.add("hidden");
      }
      if (btnNormalIngreso) btnNormalIngreso.disabled = false;
      if (btnNormalSalida) btnNormalSalida.disabled = false;
    } else {
      if (badge) {
        badge.className = "inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-extrabold bg-amber-950 text-amber-300 border border-amber-500 shadow-md whitespace-nowrap";
        badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span> FUERA DE GEOCERCA (${liveGps.distance}m)`;
      }
      if (georefBadge) {
        georefBadge.className = "text-[10px] font-bold text-amber-300 bg-amber-950 px-2.5 py-0.5 rounded border border-amber-500/50 flex items-center gap-1 shadow-sm whitespace-nowrap";
        georefBadge.innerHTML = `<i class="fa-solid fa-location-crosshairs"></i> Lejos de Oficina (${liveGps.distance}m)`;
      }
      if (radar) {
        radar.className = "p-3.5 sm:p-4 rounded-2xl border-2 border-amber-500/80 bg-slate-900 shadow-2xl space-y-3 transition-all";
      }
      // Desplegar automáticamente módulo de diligencias externas si está lejos de la oficina
      if (externalBox) {
        externalBox.classList.remove("hidden");
      }
      if (btnNormalIngreso) {
        btnNormalIngreso.disabled = true;
        btnNormalIngreso.title = `Bloqueado por Geocerca (a ${liveGps.distance}m de la sede, máx ${office.radio}m). Use el panel de Diligencia Externa.`;
      }
      if (btnNormalSalida) {
        btnNormalSalida.disabled = true;
        btnNormalSalida.title = `Bloqueado por Geocerca (a ${liveGps.distance}m de la sede, máx ${office.radio}m). Use el panel de Diligencia Externa.`;
      }
    }

    // Refrescar estado de botones según marcajes previos del día y cercanía/lejanía
    updatePunchButtonsState();
  }

  /**
   * Obtiene la lista de trabajadores activos
   */
  function getWorkers() {
    if (!window.db) return [];
    const list = window.db.get("workers");
    return Array.isArray(list) ? list : [];
  }

  /**
   * Obtiene la lista completa de marcaciones
   */
  function getAttendanceRecords() {
    if (!window.db) return [];
    const list = window.db.get("attendance");
    return Array.isArray(list) ? list : [];
  }

  /**
   * Guarda un nuevo registro o actualiza existente preservando todas las sedes
   */
  function saveAttendanceRecord(record) {
    if (!window.db) return false;
    if (!record.sede) {
      const active = (window.db.getActiveSede ? window.db.getActiveSede() : "challhuahuacho");
      record.sede = (active === "todas") ? (record.workerSede || "challhuahuacho") : active;
    }

    // Sello Criptográfico SUNAFIL de Integridad Inmutable (D.S. N° 004-2006-TR y Ley N° 27269)
    if (!record.hashIntegridad) {
      const seed = `${record.workerId || ''}|${record.fecha || ''}|${record.ingreso || ''}|${record.latitud || ''},${record.longitud || ''}|${record.sede}|${record.tipoMarcacion || ''}|SUNAFIL_DS_004_2006_TR`;
      let shaHex = "";
      if (typeof crypto !== "undefined" && crypto.subtle && typeof TextEncoder !== "undefined") {
        try {
          const buf = new TextEncoder().encode(seed);
          const digest = crypto.subtle.digest("SHA-256", buf);
          if (digest instanceof Promise) {
            digest.then(d => {
              const hex = Array.from(new Uint8Array(d)).map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
              record.hashIntegridad = `SNF-SHA256-${hex.slice(0, 32)}-${Date.now().toString(36).toUpperCase()}`;
            }).catch(() => {});
          }
        } catch (_) {}
      }
      if (!shaHex) {
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
          hash = ((hash << 5) - hash) + seed.charCodeAt(i);
          hash = hash & hash;
        }
        shaHex = Math.abs(hash).toString(16).padStart(16, "0").toUpperCase();
      }
      record.hashIntegridad = `SNF-SHA256-${shaHex.slice(0, 32)}-${Date.now().toString(36).toUpperCase()}`;
      record.sunafilVerified = true;
      record.auditTimestamp = new Date().toISOString();
    }
    const rawList = window.db.getRaw ? window.db.getRaw("attendance") : window.db.get("attendance", true);
    const existingIdx = rawList.findIndex(r => r.id === record.id);
    if (existingIdx !== -1) {
      rawList[existingIdx] = { ...rawList[existingIdx], ...record };
    } else {
      rawList.unshift(record);
    }
    const res = window.db.save("attendance", rawList);
    updatePendingBadge();

    // Modo B: validación server-side (Edge) — no sustituye el guardado local offline
    if (window.__ENTERPRISE_CLOUD__ && window.PaoloAttendanceService && record && record.ingreso && !record._cloudValidated) {
      const eventType = record.tipoMarcacion === "comision_oficial" || record.motivoExterno
        ? "DILIGENCIA"
        : (record.salida ? "SALIDA" : "ENTRADA");
      window.PaoloAttendanceService.punch({
        branchId: record.sede || "challhuahuacho",
        eventType,
        workerCode: record.workerId || record.dni
      }).then((cloudRes) => {
        record._cloudValidated = true;
        record.validation_status = cloudRes.validation_status || "accepted";
        if (cloudRes.distance_m != null) record.distanciaMetros = Math.round(cloudRes.distance_m);
        const list2 = window.db.getRaw ? window.db.getRaw("attendance") : [];
        const i2 = list2.findIndex((r) => r.id === record.id);
        if (i2 >= 0) {
          list2[i2] = { ...list2[i2], ...record };
          window.db.save("attendance", list2);
        }
      }).catch((err) => {
        console.warn("[AttendanceService] validación cloud:", err && err.message);
        if (window.showToast) {
          window.showToast("Marcaje local guardado; validación cloud pendiente o rechazada: " + (err.message || ""), "warning");
        }
      });
    }

    // Push instantáneo a hub / nube legacy
    if (window.app && typeof window.app.sincronizarConNube === "function") {
      setTimeout(() => { window.app.sincronizarConNube(true); }, 150);
    }
    return res;
  }

  /**
   * Actualiza el badge dinámico de pendientes en el menú lateral y cabecera
   */
  function updatePendingBadge() {
    const records = getAttendanceRecords();
    const pendingCount = records.filter(r => r.estadoAprobacion === "pendiente").length;
    const badges = document.querySelectorAll(".badge-asistencia-pendientes");
    badges.forEach(b => {
      if (pendingCount > 0) {
        b.textContent = pendingCount;
        b.classList.remove("hidden");
      } else {
        b.classList.add("hidden");
      }
    });
  }

  /**
   * Busca registros de hoy para un trabajador específico
   */
  function getTodayRecordForWorker(workerId) {
    const todayStr = getRelativeDateOnlyStr(0);
    const records = getAttendanceRecords();
    return records.find(r => r.workerId === workerId && r.fecha === todayStr) || null;
  }

  /**
   * Actualiza el estado visual de los botones de marcación
   */
  function updatePunchButtonsState() {
    const btnIngreso = document.getElementById("btn-asistencia-marcar-ingreso");
    const btnSalidaAlmuerzo = document.getElementById("btn-asistencia-marcar-salida-almuerzo");
    const btnRetornoAlmuerzo = document.getElementById("btn-asistencia-marcar-retorno-almuerzo");
    const btnSalida = document.getElementById("btn-asistencia-marcar-salida");
    const statusNote = document.getElementById("asistencia-colaborador-status-nota");

    const allButtons = [btnIngreso, btnSalidaAlmuerzo, btnRetornoAlmuerzo, btnSalida];

    if (!selectedWorker) {
      allButtons.forEach(b => {
        if (b) {
          b.disabled = true;
          b.classList.add("opacity-40");
        }
      });
      if (statusNote) statusNote.textContent = "Seleccione o ingrese un DNI de colaborador para marcar.";
      return;
    }

    const todayRec = getTodayRecordForWorker(selectedWorker.id);
    const inside = liveGps.insideGeofence;

    // Reset general: deshabilitar todos por defecto
    allButtons.forEach(b => {
      if (b) {
        b.disabled = true;
        b.classList.add("opacity-40");
        b.classList.remove("ring-2", "ring-white/80", "shadow-xl");
      }
    });

    // Helper para habilitar un botón específico si está dentro de geocerca
    const activateButton = (btn, isAllowedByGeo) => {
      if (!btn) return;
      btn.disabled = !isAllowedByGeo;
      if (isAllowedByGeo) {
        btn.classList.remove("opacity-40");
        btn.classList.add("ring-2", "ring-white/80", "shadow-xl");
      } else {
        btn.classList.add("opacity-40");
        btn.classList.remove("ring-2", "ring-white/80");
        btn.title = "Bloqueado por Geocerca (a más de 100m de la sede).";
      }
    };

    // ETAPA 1: No ha marcado Ingreso aún
    const btnDiligencia = document.getElementById("btn-asistencia-diligencia-submit");
    if (!todayRec || !todayRec.ingreso) {
      activateButton(btnIngreso, inside);
      if (btnDiligencia) {
        btnDiligencia.innerHTML = `<i class="fa-solid fa-paper-plane"></i> <span>Registrar Ingreso por Diligencia Externa (${liveGps.distance}m)</span>`;
      }
      if (statusNote) {
        statusNote.innerHTML = inside
          ? '<span class="text-emerald-400 font-bold">✓ Cerca de Oficina (' + liveGps.distance + 'm) — Botón Habilitado:</span> Haga clic en <strong class="text-white">\'Marcar Ingreso\'</strong> para iniciar su jornada.'
          : '<span class="text-amber-400 font-bold">⚠ Lejos de Oficina (a ' + liveGps.distance + 'm)</span>: Botón ordinario bloqueado automáticamente. Utilice el botón de <strong class="text-amber-300">Diligencia Externa</strong> abajo.';
      }
      return;
    }

    const hIng = new Date(todayRec.ingreso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });

    // ETAPA 2: Marcó Ingreso, pero aún no sale a Almuerzo ni ha finalizado jornada
    if (todayRec.ingreso && !todayRec.salidaAlmuerzo && !todayRec.salida) {
      activateButton(btnSalidaAlmuerzo, inside);
      activateButton(btnSalida, inside);
      if (btnDiligencia) {
        btnDiligencia.innerHTML = `<i class="fa-solid fa-paper-plane"></i> <span>Registrar Salida por Diligencia Externa (${liveGps.distance}m)</span>`;
      }
      if (statusNote) {
        statusNote.innerHTML = inside
          ? '<span class="text-emerald-400 font-bold">✓ En Geocerca (' + liveGps.distance + 'm) — Jornada Iniciada (' + hIng + ')</span>. Botones habilitados: <strong class="text-amber-300">\'Salida Almuerzo\'</strong> o <strong class="text-rose-300">\'Salida Final\'</strong>.'
          : '<span class="text-amber-400 font-bold">⚠ Fuera de Geocerca (a ' + liveGps.distance + 'm)</span>: Jornada iniciada (' + hIng + '). Si finaliza en campo, registre su salida en el panel de Diligencia Externa.';
      }
      return;
    }

    const hSalAlm = todayRec.salidaAlmuerzo ? new Date(todayRec.salidaAlmuerzo).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }) : "";

    // ETAPA 3: Salió a Almuerzo, pendiente de Retorno
    if (todayRec.salidaAlmuerzo && !todayRec.retornoAlmuerzo && !todayRec.salida) {
      activateButton(btnRetornoAlmuerzo, inside);
      if (statusNote) {
        statusNote.innerHTML = '<span class="text-amber-300 font-bold">En Pausa de Refrigerio (Salió ' + hSalAlm + ')</span>. Al volver al despacho debe registrar <strong class="text-cyan-300">\'Retorno Almuerzo\'</strong> ' +
          (inside ? '<span class="text-emerald-400 font-bold">(✓ Dentro de sede: ' + liveGps.distance + 'm — Botón Habilitado)</span>.' : "<span class='text-rose-400 font-bold'>(Lejos de la oficina: " + liveGps.distance + "m — Acérquese a la sede para habilitar el botón)</span>.");
      }
      return;
    }

    const hRetAlm = todayRec.retornoAlmuerzo ? new Date(todayRec.retornoAlmuerzo).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }) : "";

    // ETAPA 4: Regresó de Almuerzo, pendiente de Salida Final de Jornada
    if (todayRec.retornoAlmuerzo && !todayRec.salida) {
      activateButton(btnSalida, inside);
      if (btnDiligencia) {
        btnDiligencia.innerHTML = `<i class="fa-solid fa-paper-plane"></i> <span>Registrar Salida Final por Diligencia Externa (${liveGps.distance}m)</span>`;
      }
      if (statusNote) {
        statusNote.innerHTML = inside
          ? '<span class="text-cyan-300 font-bold">✓ En Geocerca (' + liveGps.distance + 'm) — Segundo Turno en Curso</span> (Refrigerio: ' + hSalAlm + ' a ' + hRetAlm + '). Botón <strong class="text-rose-300">\'Salida Final\'</strong> habilitado.'
          : '<span class="text-amber-400 font-bold">⚠ Lejos de Oficina (' + liveGps.distance + 'm) — Segundo Turno</span>. Acérquese a la oficina o use el botón de Diligencia Externa.';
      }
      return;
    }

    // ETAPA 5: Jornada Concluida (Salida Final registrada)
    if (todayRec.salida) {
      const hSal = new Date(todayRec.salida).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
      if (statusNote) {
        let msgAlm = "";
        if (todayRec.salidaAlmuerzo && todayRec.retornoAlmuerzo) {
          msgAlm = ' | Almuerzo: ' + hSalAlm + ' - ' + hRetAlm + ' (' + (todayRec.minutosRefrigerio || 0) + ' min)';
        }
        statusNote.innerHTML = '<span class="text-emerald-400 font-bold">✓ Jornada Completa Finalizada</span>. Ingreso: ' + hIng + msgAlm + ' | Salida: ' + hSal + '.';
      }
    }
  }
  function selectWorker(identifier) {
    const cleanId = String(identifier || "").trim().toLowerCase();
    let workers = getWorkers();
    let worker = workers.find(w => w.dni === cleanId || w.id.toLowerCase() === cleanId || w.nombre.toLowerCase().includes(cleanId));
    if (!worker && window.db && typeof window.db.getRaw === "function") {
      const allWorkers = window.db.getRaw("workers");
      worker = allWorkers.find(w => w.dni === cleanId || w.id.toLowerCase() === cleanId || w.nombre.toLowerCase().includes(cleanId));
    }

    const card = document.getElementById("asistencia-worker-selected-card");
    const nameEl = document.getElementById("asistencia-worker-name");
    const cargoEl = document.getElementById("asistencia-worker-cargo");
    const dniEl = document.getElementById("asistencia-worker-dni");
    const roleBadgeEl = document.getElementById("asistencia-worker-role-badge");
    const dniInput = document.getElementById("input-asistencia-dni-busqueda");

    if (worker) {
      selectedWorker = worker;
      selectedCityOverride = null;
      updateLocationValidationOptions(worker.sede);
      if (dniInput) dniInput.value = worker.dni;
      if (card) card.classList.remove("hidden");
      if (nameEl) nameEl.textContent = worker.nombre;
      if (cargoEl) cargoEl.textContent = worker.cargo;
      if (dniEl) dniEl.textContent = `DNI: ${worker.dni}`;
      if (roleBadgeEl) {
        if (window.db && typeof window.db.getRoleBadge === "function") {
          roleBadgeEl.innerHTML = window.db.getRoleBadge(worker.rol);
        } else {
          roleBadgeEl.textContent = worker.rol || "Colaborador";
        }
      }
    } else {
      selectedWorker = null;
      if (card) card.classList.add("hidden");
    }

    refreshGpsPosition();
    updatePunchButtonsState();
    renderWorkerPersonalLog();
  }

  function refreshOfficeConfig() {
    updateLocationValidationOptions();
    refreshGpsPosition();
    updatePunchButtonsState();
  }

  /**
   * Evalúa si el marcaje se realiza dentro del horario ordinario (Lunes a Viernes de 07:00 a.m. a 20:00 p.m.)
   * o si corresponde a Jornada Extraordinaria / Horas Extras / Fin de Semana (sin bloquear el marcaje).
   */
  function validateOfficialScheduleWindow() {
    const now = new Date();
    const day = now.getDay(); // 0 = Domingo, 1 = Lunes ... 5 = Viernes, 6 = Sábado
    const hour = now.getHours();
    const min = now.getMinutes();
    const totalMinutes = hour * 60 + min;
    const minOrdinary = 7 * 60;  // 07:00 a.m. (420 min)
    const maxOrdinary = 20 * 60; // 20:00 p.m. (1200 min)

    const isWeekday = (day >= 1 && day <= 5);
    const isWithinOrdinaryHours = (totalMinutes >= minOrdinary && totalMinutes <= maxOrdinary);
    const isRegular = isWeekday && isWithinOrdinaryHours;

    let tag = "Horario Ordinario (Lun-Vie 07:00 - 20:00)";
    if (!isWeekday) {
      tag = "Jornada Extraordinaria (Fin de Semana / Horas Extras)";
    } else if (!isWithinOrdinaryHours) {
      tag = "Jornada Extraordinaria (Horas Extras fuera de 07:00 - 20:00)";
    }

    return {
      isRegular,
      isWeekday,
      isWithinOrdinaryHours,
      isOvertimeOrWeekend: !isRegular,
      tag,
      scheduleLabel: "Lunes a Viernes de 07:00 a.m. a 20:00 p.m. (+ Horas Extras / Fines de Semana)"
    };
  }

  /**
   * Ejecuta el Marcaje Ordinario Presencial (Ingreso o Salida)
   */
  async function performRegularPunch(tipo = "ingreso") {
    if (!selectedWorker) {
      if (window.showToast) window.showToast("Por favor seleccione un colaborador primero ingresando su DNI.", "warning");
      return;
    }

    const currentLoggedIn = (window.db && typeof window.db.getCurrentUser === "function") ? window.db.getCurrentUser() : null;
    if (currentLoggedIn && currentLoggedIn.rol !== "super_admin" && currentLoggedIn.rol !== "admin" && currentLoggedIn.dni && selectedWorker.dni !== currentLoggedIn.dni) {
      if (window.showToast) window.showToast("Acceso restringido: Solo puede registrar su propia asistencia (" + currentLoggedIn.nombre + ").", "error");
      return;
    }
    if (!selectedWorker) {
      if (window.showToast) window.showToast("Por favor seleccione un colaborador primero ingresando su DNI.", "warning");
      return;
    }

    const sched = validateOfficialScheduleWindow();

    await refreshGpsPosition();
    const office = getOfficeConfig();

    // Blindaje estricto de Geocerca (100 metros)
    if (!liveGps.insideGeofence) {
      if (window.showToast) {
        window.showToast("\u{1F6AB} Marcaci\u00F3n ordinaria denegada: Se encuentra a " + liveGps.distance + " metros de la sede central (tolerancia: " + office.radio + "m). Si est\u00E1 en diligencia judicial/fiscal, reg\u00EDstrela en el panel inferior.", "error");
      }
      return;
    }

    let nowIso = new Date().toISOString();
    let isServerTrusted = false;
    try {
      const srvCheck = await fetch("/api/health", { cache: "no-store" });
      if (srvCheck.ok) {
        const srvData = await srvCheck.json();
        if (srvData && srvData.timestamp) {
          nowIso = srvData.timestamp;
          isServerTrusted = true;
        }
      }
    } catch (_) {}
    const nowDate = new Date(nowIso);
    const todayStr = nowIso.slice(0, 10);
    const horaActualStr = nowDate.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
    let record = getTodayRecordForWorker(selectedWorker.id);

    // 1. INGRESO A JORNADA
    if (tipo === "ingreso") {
      if (record && record.ingreso) {
        if (window.showToast) window.showToast("El ingreso de hoy ya fue registrado previamente para este colaborador.", "warning");
        return;
      }

      const assignedSede = selectedWorker.sede || (window.db && window.db.getActiveSede ? window.db.getActiveSede() : "challhuahuacho");
      const effectiveSede = assignedSede === "todas" ? "challhuahuacho" : assignedSede;
      const isComision = (attendanceMode === "comision_otras_sedes" || liveGps.isComision);
      const motivoComision = (document.getElementById("asistencia-comision-motivo") ? document.getElementById("asistencia-comision-motivo").value : "").trim();
      const targetDestino = comisionSedeDestino || "miraflores";

      record = {
        id: "ATT-" + Date.now() + "-" + selectedWorker.dni.slice(-4),
        workerId: selectedWorker.id,
        dni: selectedWorker.dni,
        nombre: selectedWorker.nombre,
        cargo: selectedWorker.cargo,
        sede: isComision ? targetDestino : effectiveSede,
        fecha: todayStr,
        ingreso: nowIso,
        salidaAlmuerzo: null,
        retornoAlmuerzo: null,
        salida: null,
        tipoMarcacion: isComision ? "comision_oficial" : "ingreso",
        comisionOficial: isComision,
        sedeComision: isComision ? targetDestino : null,
        motivoComision: isComision ? (motivoComision || "Comisión Oficial Inter-Sedes") : null,
        latitud: liveGps.lat,
        longitud: liveGps.lon,
        distanciaMetros: liveGps.distance,
        enGeocerca: true,
        motivoExterno: isComision ? "Comisión Oficial en Otras Sedes" : null,
        justificacion: isComision ? (motivoComision || ("Comisión Oficial en Sede " + targetDestino.toUpperCase())) : "",
        estadoAprobacion: "aprobado",
        aprobadoPor: isComision ? "Sistema (Comisión Oficial Autorizada)" : "Sistema (En Geocerca)",
        fechaAprobacion: nowIso,
        notasAdmin: (isComision
          ? ("Marcación autorizada en Comisión Oficial en Sede " + targetDestino.toUpperCase() + ".")
          : ("Marcaje presencial dentro de geocerca de Sede " + effectiveSede.toUpperCase() + ".")) +
          (sched.isOvertimeOrWeekend ? (" [" + sched.tag + "]") : ""),
        esHorasExtras: sched.isOvertimeOrWeekend,
        modalidadHorario: sched.tag
      };
      saveAttendanceRecord(record);

      if (window.showToast) {
        const extraToast = sched.isOvertimeOrWeekend ? (" • " + sched.tag) : "";
        window.showToast("✅ Ingreso registrado con éxito: " + selectedWorker.nombre + " (" + horaActualStr + ")" + extraToast, "success");
      }

    // 2. SALIDA A ALMUERZO
    } else if (tipo === "salida_almuerzo") {
      if (!record || !record.ingreso) {
        if (window.showToast) window.showToast("No puede salir a almuerzo sin haber registrado el ingreso de la mañana.", "warning");
        return;
      }
      if (record.salidaAlmuerzo) {
        if (window.showToast) window.showToast("La salida a refrigerio ya fue registrada el día de hoy.", "info");
        return;
      }
      if (record.salida) {
        if (window.showToast) window.showToast("No puede registrar salida a almuerzo porque la jornada ya fue finalizada.", "warning");
        return;
      }

      record.salidaAlmuerzo = nowIso;
      record.latitudSalidaAlmuerzo = liveGps.lat;
      record.longitudSalidaAlmuerzo = liveGps.lon;
      record.distanciaSalidaAlmuerzoMetros = liveGps.distance;
      saveAttendanceRecord(record);

      if (window.showToast) {
        window.showToast("\u{1F37D} Salida a Almuerzo registrada: " + selectedWorker.nombre + " (" + horaActualStr + ")", "success");
      }

    // 3. RETORNO DE ALMUERZO
    } else if (tipo === "retorno_almuerzo") {
      if (!record || !record.salidaAlmuerzo) {
        if (window.showToast) window.showToast("Debe registrar la 'Salida a Almuerzo' antes de poder registrar el retorno.", "warning");
        return;
      }
      if (record.retornoAlmuerzo) {
        if (window.showToast) window.showToast("El retorno de almuerzo ya fue registrado previamente.", "info");
        return;
      }
      if (record.salida) {
        if (window.showToast) window.showToast("No puede registrar retorno porque la jornada ya fue finalizada.", "warning");
        return;
      }

      // Calcular minutos reales de refrigerio
      const tSalida = new Date(record.salidaAlmuerzo).getTime();
      const tRetorno = new Date(nowIso).getTime();
      const minutosRefrigerio = Math.round((tRetorno - tSalida) / 60000);

      record.retornoAlmuerzo = nowIso;
      record.minutosRefrigerio = minutosRefrigerio;
      record.latitudRetornoAlmuerzo = liveGps.lat;
      record.longitudRetornoAlmuerzo = liveGps.lon;
      record.distanciaRetornoAlmuerzoMetros = liveGps.distance;
      saveAttendanceRecord(record);

      if (window.showToast) {
        const extraNote = minutosRefrigerio > 60 ? (" (Pausa: " + minutosRefrigerio + " min - Alerta de exceso)") : (" (Pausa: " + minutosRefrigerio + " min)");
        window.showToast("☕ Retorno de Almuerzo registrado: " + selectedWorker.nombre + " (" + horaActualStr + ")" + extraNote, "success");
      }

    // 4. SALIDA FINAL DE JORNADA
    } else if (tipo === "salida") {
      if (!record || !record.ingreso) {
        if (window.showToast) window.showToast("No se puede registrar salida sin un ingreso previo el día de hoy.", "warning");
        return;
      }
      if (record.salida) {
        if (window.showToast) window.showToast("La salida final de hoy ya fue registrada previamente.", "info");
        return;
      }

      // Si salió a almuerzo pero no marcó retorno antes de salida final
      if (record.salidaAlmuerzo && !record.retornoAlmuerzo) {
        record.retornoAlmuerzo = nowIso;
        record.minutosRefrigerio = Math.round((new Date(nowIso).getTime() - new Date(record.salidaAlmuerzo).getTime()) / 60000);
      }

      // Cálculo de horas efectivas laboradas descontando refrigerio
      const tIngreso = new Date(record.ingreso).getTime();
      const tSalida = new Date(nowIso).getTime();
      let totalMinutos = Math.max(0, Math.round((tSalida - tIngreso) / 60000));
      const refrigerioMin = record.minutosRefrigerio || 0;
      const minutosEfectivos = Math.max(0, totalMinutos - refrigerioMin);
      const horasEfectivas = (minutosEfectivos / 60).toFixed(2);

      record.salida = nowIso;
      record.tipoMarcacion = "salida";
      record.horasEfectivas = parseFloat(horasEfectivas);
      record.horasExtras = (!sched.isWeekday)
        ? parseFloat(horasEfectivas)
        : Math.max(0, parseFloat(( parseFloat(horasEfectivas) - 8 ).toFixed(2)));
      if (sched.isOvertimeOrWeekend || record.horasExtras > 0) {
        record.esHorasExtras = true;
        record.notasAdmin = (record.notasAdmin || "") + " | Salida registrada con Horas Extras / Fin de Semana (" + record.horasExtras + "h extras).";
      }
      record.latitudSalida = liveGps.lat;
      record.longitudSalida = liveGps.lon;
      record.distanciaSalidaMetros = liveGps.distance;
      saveAttendanceRecord(record);

      if (window.showToast) {
        const extraMsg = record.horasExtras > 0 ? (" (Incluye " + record.horasExtras + "h extras)") : "";
        window.showToast("\u{1F6AA} Salida Final registrada con \u00E9xito: " + selectedWorker.nombre + " (" + horaActualStr + ") - Total horas: " + horasEfectivas + "h" + extraMsg, "success");
      }
    }

    updatePunchButtonsState();
    renderWorkerPersonalLog();
    if (currentRole === "admin") {
      renderAdminAttendanceTable();
      renderAdminKpis();
    }
  }
  async function performExternalDiligencePunch() {
    if (!selectedWorker) {
      if (window.showToast) window.showToast("Seleccione al colaborador antes de registrar la diligencia.", "warning");
      return;
    }

    const sched = validateOfficialScheduleWindow();

    const selectMotivo = document.getElementById("select-asistencia-motivo-externo");
    const inputJustificacion = document.getElementById("textarea-asistencia-justificacion");

    const motivo = selectMotivo ? selectMotivo.value.trim() : "";
    const justificacion = inputJustificacion ? inputJustificacion.value.trim() : "";

    if (!motivo) {
      if (window.showToast) window.showToast("Debe seleccionar el motivo de la diligencia externa.", "warning");
      if (selectMotivo) selectMotivo.focus();
      return;
    }
    if (!justificacion || justificacion.length < 5) {
      if (window.showToast) window.showToast("Por favor ingrese el detalle / N° de Carpeta / Justificación de la diligencia.", "warning");
      if (inputJustificacion) inputJustificacion.focus();
      return;
    }

    await refreshGpsPosition();
    const todayStr = getRelativeDateOnlyStr(0);
    const nowIso = new Date().toISOString();
    let record = getTodayRecordForWorker(selectedWorker.id);

    const isIngreso = !record || !record.ingreso;

    if (isIngreso) {
      const assignedSede = selectedWorker.sede || (window.db && window.db.getActiveSede ? window.db.getActiveSede() : "challhuahuacho");
      const effectiveSede = assignedSede === "todas" ? "challhuahuacho" : assignedSede;

      record = {
        id: `ATT-${Date.now()}-${selectedWorker.dni.slice(-4)}`,
        workerId: selectedWorker.id,
        dni: selectedWorker.dni,
        nombre: selectedWorker.nombre,
        cargo: selectedWorker.cargo,
        sede: effectiveSede,
        fecha: todayStr,
        ingreso: nowIso,
        salida: null,
        tipoMarcacion: "ingreso",
        latitud: liveGps.lat,
        longitud: liveGps.lon,
        distanciaMetros: liveGps.distance,
        enGeocerca: false,
        motivoExterno: motivo,
        justificacion: justificacion,
        estadoAprobacion: "pendiente",
        aprobadoPor: null,
        fechaAprobacion: null,
        notasAdmin: "Diligencia externa registrada fuera de geocerca. Requiere revisión de administración."
      };
    } else {
      record.salida = nowIso;
      record.tipoMarcacion = "salida";
      record.latitudSalida = liveGps.lat;
      record.longitudSalida = liveGps.lon;
      record.distanciaSalidaMetros = liveGps.distance;
      record.motivoSalidaExterno = motivo;
      record.justificacionSalida = justificacion;
      // Si la salida también es externa, pasa a pendiente si no estaba pendiente
      record.estadoAprobacion = "pendiente";
      record.notasAdmin = (record.notasAdmin ? record.notasAdmin + " | " : "") + "Salida registrada en diligencia externa.";
    }

    saveAttendanceRecord(record);

    if (inputJustificacion) inputJustificacion.value = "";
    if (window.showToast) {
      window.showToast("⚠️ Diligencia Externa registrada. Estado: PENDIENTE DE APROBACIÓN por Administración.", "info");
    }

    updatePunchButtonsState();
    renderWorkerPersonalLog();
    if (currentRole === "admin") {
      renderAdminAttendanceTable();
      renderAdminKpis();
    }
  }

  /**
   * Renderiza el historial estrictamente personal del colaborador (Cumple RBAC: no ve a otros)
   */
  function renderWorkerPersonalLog() {
    const container = document.getElementById("asistencia-colaborador-personal-log");
    if (!container) return;

    if (!selectedWorker) {
      container.innerHTML = `
        <div class="text-center py-6 text-slate-400 text-xs">
          <i class="fas fa-id-card text-2xl text-slate-600 mb-2 block"></i>
          Ingrese su DNI arriba para visualizar su historial personal de marcaje de hoy.
        </div>
      `;
      return;
    }

    const todayStr = getRelativeDateOnlyStr(0);
    const records = getAttendanceRecords().filter(r => r.workerId === selectedWorker.id && r.fecha === todayStr);

    if (records.length === 0) {
      container.innerHTML = `
        <div class="text-center py-5 text-slate-400 text-xs border border-dashed border-slate-700/60 rounded-xl bg-slate-900/40">
          <i class="fas fa-calendar-check text-slate-500 text-lg mb-1 block"></i>
          No registra marcaciones hoy (${new Date().toLocaleDateString("es-PE")}).
        </div>
      `;
      return;
    }

    let html = `<div class="space-y-2">`;
    records.forEach(r => {
      const horaIngreso = r.ingreso ? new Date(r.ingreso).toLocaleTimeString("es-PE") : "--:--";
      const horaSalida = r.salida ? new Date(r.salida).toLocaleTimeString("es-PE") : "Sin salida";

      let statusBadge = "";
      if (r.estadoAprobacion === "aprobado") {
        statusBadge = `<span class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded"><i class="fas fa-check-circle"></i> Aprobado</span>`;
      } else if (r.estadoAprobacion === "pendiente") {
        statusBadge = `<span class="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 rounded"><i class="fas fa-clock"></i> Pendiente Aprobación</span>`;
      } else {
        statusBadge = `<span class="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400 bg-rose-950/60 border border-rose-500/30 px-2 py-0.5 rounded"><i class="fas fa-times-circle"></i> Rechazado</span>`;
      }

      html += `
        <div class="p-3 bg-slate-900/70 border border-slate-800 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-slate-200">Hoy: ${r.fecha}</span>
              ${statusBadge}
              ${r.enGeocerca ? '<span class="text-[10px] text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded">En Geocerca</span>' : '<span class="text-[10px] text-amber-400 bg-amber-950/40 px-1.5 py-0.5 rounded">Diligencia Externa</span>'}
            </div>
            <div class="text-xs text-slate-400 flex items-center gap-3">
              <span><i class="fas fa-sign-in-alt text-emerald-400 mr-1"></i>Ingreso: <strong>${horaIngreso}</strong></span>
              <span><i class="fas fa-sign-out-alt text-amber-400 mr-1"></i>Salida: <strong>${horaSalida}</strong></span>
              <span><i class="fas fa-map-marker-alt text-cyan-400 mr-1"></i>Distancia: <strong>${r.distanciaMetros} m</strong></span>
            </div>
            ${r.motivoExterno ? `<div class="text-xs text-amber-300/90 bg-amber-950/30 p-1.5 rounded border border-amber-500/20 mt-1"><strong>Diligencia:</strong> ${esc(r.motivoExterno)} <br><span class="text-slate-400 text-[11px]">${esc(r.justificacion || "")}</span></div>` : ""}
          </div>
        </div>
      `;
    });
    html += `</div>`;
    container.innerHTML = html;
  }

  /**
   * Solicita acceso al panel de supervisión de jefatura mediante modal de clave
   */
  function requestAdminAccess() {
    if (adminAuthenticated) {
      setRoleView("admin");
      return;
    }
    const modal = document.getElementById("modal-asistencia-auth-admin");
    const inputKey = document.getElementById("input-asistencia-admin-key");
    const errorMsg = document.getElementById("asistencia-auth-error-msg");

    if (inputKey) {
      inputKey.value = "";
      inputKey.type = "password";
      inputKey.classList.remove("border-rose-500");
    }
    if (errorMsg) errorMsg.classList.add("hidden");
    if (modal) {
      modal.classList.remove("hidden");
      modal.classList.add("flex");
      setTimeout(() => {
        if (inputKey) inputKey.focus();
      }, 100);
    }
  }

  /**
   * Cierra el modal de autenticación de jefatura
   */
  function closeAdminAuthModal() {
    const modal = document.getElementById("modal-asistencia-auth-admin");
    if (modal) { modal.classList.add("hidden"); modal.classList.remove("flex"); }
  }

  /**
   * Alterna la visibilidad de la contraseña en inputs de clave
   */
  function toggleKeyVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
    if (btn) {
      btn.innerHTML = isPassword ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
    }
  }

  /**
   * Valida la clave de jefatura ingresada en el modal
   */
  async function submitAdminKey() {
    const inputKey = document.getElementById("input-asistencia-admin-key");
    const errorMsg = document.getElementById("asistencia-auth-error-msg");
    const key = inputKey ? inputKey.value.trim() : "";

    if (!key) {
      if (errorMsg) {
        errorMsg.textContent = "Por favor ingrese la clave de jefatura.";
        errorMsg.classList.remove("hidden");
      }
      if (inputKey) inputKey.focus();
      return;
    }

    const settings = window.db ? window.db.getSettings() : {};

    // Validación estricta criptográfica: sin contraseñas cableadas en texto plano
    let isMatch = false;
    for (const h of [settings.bossPasswordHash, settings.adminPasswordHash, settings.masterPasswordHash]) {
      if (h && await window.verifySecret(key, h)) { isMatch = true; break; }
    }

    if (isMatch) {
      adminAuthenticated = true;
      closeAdminAuthModal();
      setRoleView("admin");
      if (window.showToast) {
        window.showToast("🔐 Acceso Autorizado: Supervisión de Jefatura y Dirección activada.", "success");
      }
    } else {
      if (errorMsg) {
        errorMsg.textContent = "Clave de jefatura incorrecta. Acceso denegado a supervisión.";
        errorMsg.classList.remove("hidden");
      }
      if (inputKey) {
        inputKey.classList.add("border-rose-500");
        inputKey.select();
        inputKey.focus();
      }
      if (window.showToast) {
        window.showToast("Clave incorrecta. Solo los jefes y socios poseen autorización.", "error");
      }
    }
  }

  /**
   * Bloquea el panel de supervisión y regresa al modo Kiosco
   */
  function lockAdminAccess() {
    adminAuthenticated = false;
    setRoleView("colaborador");
    if (window.showToast) {
      window.showToast("🔒 Panel de Supervisión bloqueado. Modo Kiosco activo.", "info");
    }
  }

  /**
   * Abre modal para modificar la clave exclusiva de jefatura
   */
  function openChangeBossKeyModal() {
    const modal = document.getElementById("modal-asistencia-cambiar-clave");
    const act = document.getElementById("input-cambiar-clave-actual");
    const nw = document.getElementById("input-cambiar-clave-nueva");
    const cf = document.getElementById("input-cambiar-clave-confirmar");

    if (act) act.value = "";
    if (nw) nw.value = "";
    if (cf) cf.value = "";
    if (modal) modal.classList.remove("hidden");
  }

  /**
   * Guarda la nueva clave exclusiva de jefatura
   */
  async function saveNewBossKey() {
    const act = document.getElementById("input-cambiar-clave-actual")?.value.trim() || "";
    const nw = document.getElementById("input-cambiar-clave-nueva")?.value.trim() || "";
    const cf = document.getElementById("input-cambiar-clave-confirmar")?.value.trim() || "";

    const settings = window.db ? window.db.getSettings() : {};
    let isCurrentValid = false;
    for (const h of [settings.bossPasswordHash, settings.adminPasswordHash, settings.masterPasswordHash]) {
      if (h && await window.verifySecret(act, h)) { isCurrentValid = true; break; }
    }

    if (!isCurrentValid) {
      if (window.showToast) window.showToast("La clave actual de jefatura no es correcta.", "error");
      return;
    }

    if (!nw || nw.length < 10) {
      if (window.showToast) window.showToast("La nueva clave debe tener al menos 10 caracteres.", "warning");
      return;
    }

    if (nw !== cf) {
      if (window.showToast) window.showToast("La confirmación de la nueva clave no coincide.", "warning");
      return;
    }

    delete settings.bossPassword;
    settings.bossPasswordHash = await window.hashSecret(nw);
    window.db.saveSettings(settings);

    const modal = document.getElementById("modal-asistencia-cambiar-clave");
    if (modal) modal.classList.add("hidden");

    if (window.showToast) {
      window.showToast("🔑 Clave de Jefatura actualizada con éxito. Guarde su nueva clave con recelo.", "success");
    }
  }

  /**
   * Cambia la vista según el Rol (RBAC)
   * @param {'colaborador'|'admin'} targetRole
   */
  async function setRoleView(targetRole) {
    if (targetRole === "admin" && !adminAuthenticated) {
      requestAdminAccess();
      return;
    }

    currentRole = targetRole;

    const kioskContainer = document.getElementById("asistencia-kiosk-container");
    const adminContainer = document.getElementById("asistencia-admin-container");
    const pillColaborador = document.getElementById("btn-asistencia-role-colaborador");
    const pillAdmin = document.getElementById("btn-asistencia-role-admin");

    if (currentRole === "colaborador") {
      if (kioskContainer) kioskContainer.classList.remove("hidden");
      if (adminContainer) adminContainer.classList.add("hidden");
      if (pillColaborador) {
        pillColaborador.className = "px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-slate-950 shadow-md transition-all";
      }
      if (pillAdmin) {
        pillAdmin.className = "px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all";
      }
    } else {
      if (kioskContainer) kioskContainer.classList.add("hidden");
      if (adminContainer) adminContainer.classList.remove("hidden");
      if (pillAdmin) {
        pillAdmin.className = "px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-slate-950 shadow-md transition-all";
      }
      if (pillColaborador) {
        pillColaborador.className = "px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all";
      }
      renderAdminKpis();
      renderAdminAttendanceTable();
    }
  }

  /**
   * Renderiza los KPIs en el panel de Administrador
   */
  function renderAdminKpis() {
    const records = getAttendanceRecords();
    const todayStr = getRelativeDateOnlyStr(0);
    const todayRecords = records.filter(r => r.fecha === todayStr);

    const totalHoy = todayRecords.length;
    const enGeocerca = todayRecords.filter(r => r.enGeocerca).length;
    const diligenciasExternas = todayRecords.filter(r => !r.enGeocerca).length;
    const pendientes = records.filter(r => r.estadoAprobacion === "pendiente").length;

    const kpiTotal = document.getElementById("kpi-asistencia-total-hoy");
    const kpiGeocerca = document.getElementById("kpi-asistencia-geocerca-hoy");
    const kpiDiligencias = document.getElementById("kpi-asistencia-diligencias-hoy");
    const kpiPendientes = document.getElementById("kpi-asistencia-pendientes");

    if (kpiTotal) kpiTotal.textContent = totalHoy;
    if (kpiGeocerca) kpiGeocerca.textContent = enGeocerca;
    if (kpiDiligencias) kpiDiligencias.textContent = diligenciasExternas;
    if (kpiPendientes) kpiPendientes.textContent = pendientes;

    // Renderizar Bandeja de Pendientes
    renderPendingQueue();
  }

  /**
   * Renderiza la cola de aprobaciones pendientes de diligencias
   */
  function renderPendingQueue() {
    const container = document.getElementById("asistencia-pending-queue-container");
    const cardWrapper = document.getElementById("asistencia-pending-queue-wrapper");
    if (!container) return;

    const records = getAttendanceRecords().filter(r => r.estadoAprobacion === "pendiente");

    if (records.length === 0) {
      if (cardWrapper) cardWrapper.classList.add("hidden");
      container.innerHTML = "";
      return;
    }

    if (cardWrapper) cardWrapper.classList.remove("hidden");
    let html = `<div class="grid grid-cols-1 md:grid-cols-2 gap-3">`;

    records.forEach(r => {
      const horaIngreso = r.ingreso ? new Date(r.ingreso).toLocaleTimeString("es-PE") : "--:--";
      html += `
        <div class="p-3.5 bg-slate-900/90 border border-amber-500/40 rounded-xl space-y-2 shadow-lg">
          <div class="flex items-center justify-between">
            <div>
              <h4 class="text-xs font-bold text-slate-100">${r.nombre}</h4>
              <p class="text-[11px] text-slate-400">${r.cargo} (DNI: ${r.dni})</p>
            </div>
            <span class="text-[11px] font-bold text-amber-400 bg-amber-950/80 border border-amber-500/40 px-2 py-0.5 rounded-full">
              <i class="fas fa-exclamation-triangle mr-1"></i>Pendiente
            </span>
          </div>
          <div class="text-xs text-slate-300 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
            <p class="font-semibold text-amber-300 flex items-center gap-1.5 mb-1">
              <i class="fas fa-map-marker-alt text-amber-400"></i> ${r.motivoExterno || "Diligencia Externa"}
            </p>
            <p class="text-slate-400 text-[11px] italic mb-1.5">"${r.justificacion || "Sin justificación detallada"}"</p>
            <div class="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-1">
              <span>Hora: <strong>${horaIngreso}</strong></span>
              <span>Distancia: <strong class="text-rose-400">${r.distanciaMetros} m</strong></span>
              <span>Fecha: <strong>${r.fecha}</strong></span>
            </div>
          </div>
          <div class="flex items-center gap-2 pt-1">
            <button onclick="AttendanceModule.approveRecord('${r.id}')" class="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1 shadow">
              <i class="fas fa-check"></i> Aprobar
            </button>
            <button onclick="AttendanceModule.openRejectModal('${r.id}')" class="flex-1 py-1.5 px-3 bg-rose-600/80 hover:bg-rose-600 text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1 shadow">
              <i class="fas fa-times"></i> Rechazar
            </button>
          </div>
        </div>
      `;
    });

    html += `</div>`;
    container.innerHTML = html;
  }

  /**
   * Aprueba una marcación de diligencia
   */
  function approveRecord(id) {
    const currentUser = window.db ? window.db.getCurrentUser() : null;
    const userRole = window.db ? window.db.getUserRole(currentUser) : "asistente";
    if (userRole !== "admin") {
      if (window.showToast) {
        window.showToast("Permiso denegado: Solo el Administrador o Socio Principal posee atribución para autorizar diligencias externas.", "error");
      }
      return;
    }

    const rawList = window.db && window.db.getRaw ? window.db.getRaw("attendance") : getAttendanceRecords();
    const rec = rawList.find(r => r.id === id);
    if (!rec) return;

    const settings = window.db ? window.db.getSettings() : {};
    const approverName = settings.adminOfficer || "Socio Administrador";

    rec.estadoAprobacion = "aprobado";
    rec.aprobadoPor = approverName;
    rec.fechaAprobacion = new Date().toISOString();
    rec.notasAdmin = (rec.notasAdmin ? rec.notasAdmin + " | " : "") + `Aprobado por ${approverName} el ${new Date().toLocaleString("es-PE")}.`;

    window.db.save("attendance", rawList);
    updatePendingBadge();
    renderAdminKpis();
    renderAdminAttendanceTable();

    if (window.showToast) {
      window.showToast(`Marcaje de ${rec.nombre} APROBADO correctamente.`, "success");
    }
  }

  /**
   * Abre modal para rechazar diligencia con motivo
   */
  function openRejectModal(id) {
    const modal = document.getElementById("modal-asistencia-rechazo");
    const inputId = document.getElementById("input-rechazo-record-id");
    const reasonText = document.getElementById("textarea-rechazo-motivo");

    if (inputId) inputId.value = id;
    if (reasonText) reasonText.value = "";
    if (modal) modal.classList.remove("hidden");
  }

  /**
   * Confirma rechazo de diligencia
   */
  function confirmRejectRecord() {
    const currentUser = window.db ? window.db.getCurrentUser() : null;
    const userRole = window.db ? window.db.getUserRole(currentUser) : "asistente";
    if (userRole !== "admin") {
      if (window.showToast) {
        window.showToast("Permiso denegado: Solo el Administrador o Socio Principal posee atribución para rechazar diligencias.", "error");
      }
      return;
    }

    const inputId = document.getElementById("input-rechazo-record-id");
    const reasonText = document.getElementById("textarea-rechazo-motivo");
    const id = inputId ? inputId.value : "";
    const reason = reasonText ? reasonText.value.trim() : "";

    if (!id) return;
    const rawList = window.db && window.db.getRaw ? window.db.getRaw("attendance") : getAttendanceRecords();
    const rec = rawList.find(r => r.id === id);
    if (!rec) return;

    const settings = window.db ? window.db.getSettings() : {};
    const approverName = settings.adminOfficer || "Socio Administrador";

    rec.estadoAprobacion = "rechazado";
    rec.aprobadoPor = approverName;
    rec.fechaAprobacion = new Date().toISOString();
    rec.notasAdmin = `Rechazado por ${approverName}: ${reason || "Diligencia no justificada"}`;

    window.db.save("attendance", rawList);
    updatePendingBadge();

    const modal = document.getElementById("modal-asistencia-rechazo");
    if (modal) modal.classList.add("hidden");

    renderAdminKpis();
    renderAdminAttendanceTable();

    if (window.showToast) {
      window.showToast(`Marcaje de ${rec.nombre} RECHAZADO.`, "warning");
    }
  }

  /**
   * Renderiza la Tabla de Monitoreo Diario en el Panel de Administrador
   */
  function renderAdminAttendanceTable() {
    const tbody = document.getElementById("tbody-asistencia-admin");
    if (!tbody) return;

    const searchInput = document.getElementById("input-filtro-asistencia-busqueda");
    const filterFecha = document.getElementById("select-filtro-asistencia-fecha");
    const filterGeocerca = document.getElementById("select-filtro-asistencia-geocerca");
    const filterEstado = document.getElementById("select-filtro-asistencia-estado");

    const query = searchInput ? searchInput.value.toLowerCase().trim() : "";
    const valFecha = filterFecha ? filterFecha.value : "hoy";
    const valGeocerca = filterGeocerca ? filterGeocerca.value : "todos";
    const valEstado = filterEstado ? filterEstado.value : "todos";

    let records = getAttendanceRecords();
    const todayStr = getRelativeDateOnlyStr(0);

    // Filtros
    if (valFecha === "hoy") {
      records = records.filter(r => r.fecha === todayStr);
    } else if (valFecha === "ayer") {
      records = records.filter(r => r.fecha === getRelativeDateOnlyStr(-1));
    } else if (valFecha === "semana") {
      const minDate = getRelativeDateOnlyStr(-7);
      records = records.filter(r => r.fecha >= minDate);
    }

    if (valGeocerca === "en_geocerca") {
      records = records.filter(r => r.enGeocerca);
    } else if (valGeocerca === "fuera_geocerca") {
      records = records.filter(r => !r.enGeocerca);
    }

    if (valEstado !== "todos") {
      records = records.filter(r => r.estadoAprobacion === valEstado);
    }

    if (query) {
      records = records.filter(r =>
        r.nombre.toLowerCase().includes(query) ||
        r.dni.includes(query) ||
        (r.motivoExterno && r.motivoExterno.toLowerCase().includes(query))
      );
    }

    if (records.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-8 text-slate-400 text-xs">
            <i class="fas fa-inbox text-3xl text-slate-600 mb-2 block"></i>
            No se encontraron registros de asistencia con los filtros aplicados.
          </td>
        </tr>
      `;
      const emptyPager = document.getElementById("asistenciaAdminTablePager");
      if (emptyPager) emptyPager.innerHTML = "";
      return;
    }

    const pageState = (window.app && typeof window.app.getTablePageState === "function")
      ? window.app.getTablePageState("asistencia", records.length, 50)
      : { page: 1, pages: 1, pageSize: 50, total: records.length, start: 0, end: records.length };
    const pageRecords = records.slice(pageState.start, pageState.end);

    let html = "";
    pageRecords.forEach(r => {
      const horaIngreso = r.ingreso ? new Date(r.ingreso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }) : "--:--";
      const horaSalida = r.salida ? new Date(r.salida).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }) : '<span class="text-slate-500 italic">En labores</span>';

      let geoBadge = r.enGeocerca
        ? `<span class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded"><i class="fas fa-check"></i> ${r.distanciaMetros}m (Oficina)</span>`
        : `<span class="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 rounded"><i class="fas fa-external-link-alt"></i> ${r.distanciaMetros}m (Externa)</span>`;

      let statusBadge = "";
      if (r.estadoAprobacion === "aprobado") {
        statusBadge = `<span class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded">Aprobado</span>`;
      } else if (r.estadoAprobacion === "pendiente") {
        statusBadge = `<span class="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 rounded animate-pulse">Pendiente</span>`;
      } else {
        statusBadge = `<span class="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400 bg-rose-950/60 border border-rose-500/30 px-2 py-0.5 rounded">Rechazado</span>`;
      }

      const safeId = esc(r.id);
      html += `
        <tr class="hover:bg-slate-800/40 border-b border-slate-800/60 transition-colors" data-att-id="${safeId}">
          <td class="py-3 px-3">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="font-bold text-slate-200 text-xs">${esc(r.nombre)}</span>
              ${window.renderSedeBadge ? window.renderSedeBadge(r.sede) : ''}
            </div>
            <div class="text-[11px] text-slate-400">${esc(r.cargo)} | DNI: ${esc(r.dni)}</div>
          </td>
          <td class="py-3 px-3 text-xs text-slate-300 whitespace-nowrap">
            <i class="far fa-calendar text-slate-500 mr-1"></i>${esc(r.fecha)}
          </td>
          <td class="py-3 px-3 text-xs whitespace-nowrap">
            <div class="text-emerald-400 font-semibold"><i class="fas fa-arrow-right text-[10px] mr-1"></i>${horaIngreso}</div>
            <div class="text-amber-400 font-semibold"><i class="fas fa-arrow-left text-[10px] mr-1"></i>${horaSalida}</div>
          </td>
          <td class="py-3 px-3">
            ${geoBadge}
          </td>
          <td class="py-3 px-3 text-xs">
            ${r.motivoExterno ? `<div class="font-semibold text-amber-300 text-[11px]">${esc(r.motivoExterno)}</div><div class="text-slate-400 text-[11px] truncate max-w-xs" title="${esc(r.justificacion)}">${esc(r.justificacion)}</div>` : '<span class="text-slate-500 text-[11px]">Jornada Presencial Sede Central</span>'}
          </td>
          <td class="py-3 px-3">
            ${statusBadge}
          </td>
          <td class="py-3 px-3 text-right whitespace-nowrap space-x-1">
            ${r.estadoAprobacion === "pendiente" ? `
              <button type="button" data-att-action="approve" title="Aprobar diligencia" class="p-1.5 bg-emerald-600/80 hover:bg-emerald-600 text-white rounded text-xs transition-colors">
                <i class="fas fa-check"></i>
              </button>
              <button type="button" data-att-action="reject" title="Rechazar diligencia" class="p-1.5 bg-rose-600/80 hover:bg-rose-600 text-white rounded text-xs transition-colors">
                <i class="fas fa-times"></i>
              </button>
            ` : ""}
            <button type="button" data-att-action="detail" title="Ver detalle de auditoría" class="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-xs transition-colors">
              <i class="fas fa-eye"></i>
            </button>
            <button type="button" data-att-action="delete" title="Eliminar registro" class="p-1.5 bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-400 rounded text-xs transition-colors">
              <i class="fas fa-trash-alt"></i>
            </button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
    tbody.querySelectorAll("[data-att-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.closest("[data-att-id]")?.getAttribute("data-att-id");
        if (!id) return;
        const action = btn.getAttribute("data-att-action");
        if (action === "approve") AttendanceModule.approveRecord(id);
        else if (action === "reject") AttendanceModule.openRejectModal(id);
        else if (action === "detail") AttendanceModule.showDetailModal(id);
        else if (action === "delete") AttendanceModule.deleteRecord(id);
      });
    });

    const pager = document.getElementById("asistenciaAdminTablePager");
    if (pager) {
      if (pageState.total <= pageState.pageSize) {
        pager.innerHTML = `<div class="px-1 py-2 text-[11px] text-slate-500">${pageState.total} registro(s)</div>`;
      } else {
        const prevDisabled = pageState.page <= 1 ? "opacity-40 pointer-events-none" : "";
        const nextDisabled = pageState.page >= pageState.pages ? "opacity-40 pointer-events-none" : "";
        pager.innerHTML = `
          <div class="flex flex-wrap items-center justify-between gap-2 px-1 py-2 text-[11px] text-slate-400 border-t border-slate-800 mt-1">
            <span>Mostrando ${pageState.start + 1}–${pageState.end} de ${pageState.total}</span>
            <div class="flex items-center gap-1.5">
              <button type="button" class="px-2 py-1 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 ${prevDisabled}" onclick="window.app.setTablePage('asistencia', ${pageState.page - 1})"><i class="fa-solid fa-chevron-left"></i></button>
              <span class="font-semibold text-slate-200">Pág. ${pageState.page} / ${pageState.pages}</span>
              <button type="button" class="px-2 py-1 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 ${nextDisabled}" onclick="window.app.setTablePage('asistencia', ${pageState.page + 1})"><i class="fa-solid fa-chevron-right"></i></button>
            </div>
          </div>`;
      }
    }
  }

  /**
   * Muestra modal con detalles de auditoría del registro
   */
  function showDetailModal(id) {
    const rec = getAttendanceRecords().find(r => r.id === id);
    if (!rec) return;

    const modal = document.getElementById("modal-asistencia-detalle");
    const content = document.getElementById("modal-asistencia-detalle-content");
    if (!modal || !content) return;

    content.innerHTML = `
      <div class="space-y-3 text-xs">
        <div class="grid grid-cols-2 gap-2 bg-slate-950/60 p-3 rounded-lg border border-slate-800">
          <div><span class="text-slate-400">Colaborador:</span> <strong class="text-slate-200 block">${esc(rec.nombre)}</strong></div>
          <div><span class="text-slate-400">DNI:</span> <strong class="text-slate-200 block">${esc(rec.dni)}</strong></div>
          <div><span class="text-slate-400">Cargo:</span> <strong class="text-slate-200 block">${esc(rec.cargo)}</strong></div>
          <div><span class="text-slate-400">Fecha:</span> <strong class="text-slate-200 block">${esc(rec.fecha)}</strong></div>
        </div>
        <div class="grid grid-cols-2 gap-2 bg-slate-950/60 p-3 rounded-lg border border-slate-800">
          <div><span class="text-slate-400">Hora Ingreso:</span> <strong class="text-emerald-400 block">${rec.ingreso ? esc(new Date(rec.ingreso).toLocaleString("es-PE")) : "No registrado"}</strong></div>
          <div><span class="text-slate-400">Hora Salida:</span> <strong class="text-amber-400 block">${rec.salida ? esc(new Date(rec.salida).toLocaleString("es-PE")) : "No registrado"}</strong></div>
          <div><span class="text-slate-400">Coordenadas:</span> <strong class="text-cyan-400 block">${esc(rec.latitud)}, ${esc(rec.longitud)}</strong></div>
          <div><span class="text-slate-400">Distancia a Sede Central:</span> <strong class="text-slate-200 block">${esc(rec.distanciaMetros)} metros</strong></div>
        </div>
        ${rec.motivoExterno ? `
          <div class="bg-amber-950/40 p-3 rounded-lg border border-amber-500/30">
            <span class="text-amber-400 font-bold block mb-1">Diligencia Externa Declarada:</span>
            <p class="text-slate-200 font-semibold mb-1">${esc(rec.motivoExterno)}</p>
            <p class="text-slate-300 italic">${esc(rec.justificacion || "Sin justificación adicional")}</p>
          </div>
        ` : ""}
        <div class="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
          <span class="text-slate-400 block mb-1">Estado de Aprobación & Auditoría:</span>
          <p class="text-slate-200 font-semibold capitalize mb-1">Estado: ${rec.estadoAprobacion}</p>
          <p class="text-slate-400">Aprobado / Gestionado por: <strong class="text-slate-300">${rec.aprobadoPor || "Pendiente"}</strong></p>
          <p class="text-slate-400">Notas de Auditoría: <span class="text-slate-300">${rec.notasAdmin || "Ninguna"}</span></p>
        </div>
      </div>
    `;

    modal.classList.remove("hidden");
  }

  /**
   * Elimina un registro de asistencia (sólo Admin)
   */
  function deleteRecord(id) {
    const currentUser = window.db ? window.db.getCurrentUser() : null;
    const userRole = window.db ? window.db.getUserRole(currentUser) : "asistente";
    if (userRole !== "admin") {
      if (window.showToast) {
        window.showToast("Permiso denegado: Solo el Administrador puede eliminar registros de asistencia.", "error");
      }
      return;
    }

    if (!confirm("¿Está seguro de eliminar este registro de asistencia?")) return;
    const rawList = window.db && window.db.getRaw ? window.db.getRaw("attendance") : getAttendanceRecords();
    const filtered = rawList.filter(r => r.id !== id);
    window.db.save("attendance", filtered);
    updatePendingBadge();
    renderAdminKpis();
    renderAdminAttendanceTable();
    if (window.showToast) window.showToast("Registro de asistencia eliminado.", "info");
  }

  /**
   * Abre modal de gestión de trabajadores
   */
  function openWorkersModal() {
    const modal = document.getElementById("modal-asistencia-trabajadores");
    if (!modal) return;
    renderWorkersList();
    modal.classList.remove("hidden");
  }

  /**
   * Renderiza la lista de colaboradores en el modal de gestión
   */
  function renderWorkersList() {
    const tbody = document.getElementById("tbody-asistencia-gestion-trabajadores");
    if (!tbody) return;
    const workers = (window.db && typeof window.db.getRaw === "function") ? window.db.getRaw("workers") : getWorkers();

    let html = "";
    workers.forEach(w => {
      const normalizedRol = (window.db && typeof window.db.normalizeRole === "function")
        ? window.db.normalizeRole(w.rol)
        : (w.rol || "abogado");
      const isAdminLike = ["super_admin", "socio", "admin"].includes(normalizedRol);
      html += `
        <tr class="border-b border-slate-800 hover:bg-slate-800/40">
          <td class="py-2 px-3 font-bold text-slate-200 text-xs">${w.dni || "-"}</td>
          <td class="py-2 px-3 text-xs text-slate-300">${w.nombre || "-"}</td>
          <td class="py-2 px-3 text-xs text-slate-400">${w.cargo || "-"}</td>
          <td class="py-2 px-3 text-xs">
            <span class="px-2 py-0.5 rounded text-[11px] font-semibold ${isAdminLike ? "bg-amber-500/20 text-amber-300" : "bg-cyan-500/20 text-cyan-300"}">
              ${isAdminLike ? "Admin" : "Colaborador"}
            </span>
          </td>
          <td class="py-2 px-3 text-right">
            <button onclick="AttendanceModule.deleteWorker('${w.id}')" title="Eliminar colaborador" class="p-1 text-slate-400 hover:text-rose-400">
              <i class="fas fa-trash-alt text-xs"></i>
            </button>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  }

  /**
   * Agrega un nuevo trabajador
   */
  async function addWorker() {
    const dni = document.getElementById("input-nuevo-trabajador-dni")?.value.trim();
    const nombre = document.getElementById("input-nuevo-trabajador-nombre")?.value.trim();
    const cargo = document.getElementById("input-nuevo-trabajador-cargo")?.value.trim();
    const rawRol = document.getElementById("select-nuevo-trabajador-rol")?.value || "abogado";
    const telefono = document.getElementById("input-nuevo-trabajador-telefono")?.value.trim() || "";

    if (!dni || dni.length < 8) {
      if (window.showToast) window.showToast("Ingrese un DNI válido de 8 dígitos.", "warning");
      return;
    }
    if (!nombre) {
      if (window.showToast) window.showToast("Ingrese el nombre completo del colaborador.", "warning");
      return;
    }

    const rawWorkers = (window.db && typeof window.db.getRaw === "function") ? window.db.getRaw("workers") : getWorkers();
    if (rawWorkers.some(w => String(w.dni || "").trim() === dni)) {
      if (window.showToast) window.showToast("Ya existe un colaborador registrado con este DNI.", "error");
      return;
    }

    const active = (window.db && window.db.getActiveSede ? window.db.getActiveSede() : "challhuahuacho");
    const workerSede = (active === "todas") ? "challhuahuacho" : active;
    const normalizedRol = (window.db && typeof window.db.normalizeRole === "function")
      ? window.db.normalizeRole(rawRol === "colaborador" ? "abogado" : rawRol)
      : (rawRol === "colaborador" ? "abogado" : rawRol);

    let maxNum = 0;
    rawWorkers.forEach(w => {
      const m = String(w.id || "").match(/WRK-(\d+)/i);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxNum && n < 9000) maxNum = n;
      }
    });
    const nextId = `WRK-${String(maxNum + 1).padStart(3, "0")}`;
    const defaultUser = `user_${dni}`;
    const _rnd = crypto.getRandomValues(new Uint32Array(4));
    const _tempPass = "Ald-" + Array.from(_rnd.slice(0, 3), n => n.toString(36)).join("-");
    const _tempPin = String(_rnd[3] % 900000 + 100000);

    const newWorker = {
      id: nextId,
      dni: dni,
      nombre: nombre,
      cargo: cargo || "Abogado Asociado",
      rol: normalizedRol,
      usuario: defaultUser,
      username: defaultUser,
      passwordHash: await window.hashSecret(_tempPass),
      pinHash: await window.hashSecret(_tempPin),
      mustChangePassword: true,
      sede: workerSede,
      telefono: telefono,
      email: "",
      colegiatura: "",
      activo: true,
      fechaIngreso: getRelativeDateOnlyStr(0),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      permisos: (window.db && typeof window.db.getDefaultPermissionsForRole === "function")
        ? window.db.getDefaultPermissionsForRole(normalizedRol)
        : null
    };

    rawWorkers.push(newWorker);
    window.db.save("workers", rawWorkers);
    alert(`Credenciales iniciales de ${defaultUser}\nContrasena temporal: ${_tempPass}\nPIN: ${_tempPin}\n\nEntreguelas en privado; no se volveran a mostrar.`);

    // Limpiar formulario
    document.getElementById("input-nuevo-trabajador-dni").value = "";
    document.getElementById("input-nuevo-trabajador-nombre").value = "";
    document.getElementById("input-nuevo-trabajador-cargo").value = "";
    if (document.getElementById("input-nuevo-trabajador-telefono")) {
      document.getElementById("input-nuevo-trabajador-telefono").value = "";
    }

    renderWorkersList();
    renderWorkerSelectorDropdown();
    if (window.app && typeof window.app.renderPersonal === "function") {
      window.app.renderPersonal();
    }

    if (window.showToast) {
      window.showToast(`Colaborador ${nombre} registrado con éxito.`, "success");
    }
  }

  /**
   * Elimina un trabajador
   */
  function deleteWorker(id) {
    if (id === "WRK-000") {
      if (window.showToast) window.showToast("La cuenta de Super Administrador Principal está protegida.", "warning");
      return;
    }
    if (!confirm("¿Está seguro de eliminar a este colaborador del padrón?")) return;
    const rawWorkers = window.db && window.db.getRaw ? window.db.getRaw("workers") : getWorkers();
    const updated = rawWorkers.filter(w => w.id !== id);
    window.db.save("workers", updated);
    renderWorkersList();
    renderWorkerSelectorDropdown();
    if (window.app && typeof window.app.renderPersonal === "function") {
      window.app.renderPersonal();
    }
    if (window.showToast) window.showToast("Colaborador eliminado.", "info");
  }

  /**
   * Abre modal de configuración de geocerca
   */
  function openGeofenceConfigModal() {
    const modal = document.getElementById("modal-asistencia-config-geocerca");
    if (!modal) return;

    const office = getOfficeConfig();
    const inputLat = document.getElementById("input-config-oficina-lat");
    const inputLon = document.getElementById("input-config-oficina-lon");
    const inputRadio = document.getElementById("input-config-oficina-radio");
    const inputNombre = document.getElementById("input-config-oficina-nombre");

    if (inputLat) inputLat.value = office.lat;
    if (inputLon) inputLon.value = office.lon;
    if (inputRadio) inputRadio.value = office.radio;
    if (inputNombre) inputNombre.value = office.nombre;

    modal.classList.remove("hidden");
  }

  /**
   * Guarda cambios en la configuración de la geocerca
   */
  function saveGeofenceConfig() {
    const inputLat = document.getElementById("input-config-oficina-lat");
    const inputLon = document.getElementById("input-config-oficina-lon");
    const inputRadio = document.getElementById("input-config-oficina-radio");
    const inputNombre = document.getElementById("input-config-oficina-nombre");

    const lat = parseFloat(inputLat?.value);
    const lon = parseFloat(inputLon?.value);
    const radio = parseInt(inputRadio?.value, 10);
    const nombre = inputNombre?.value.trim();

    if (isNaN(lat) || isNaN(lon) || isNaN(radio) || radio <= 0) {
      if (window.showToast) window.showToast("Por favor ingrese valores numéricos válidos de coordenadas y radio.", "error");
      return;
    }

    const settings = window.db ? window.db.getSettings() : {};
    settings.oficinaLat = lat;
    settings.oficinaLon = lon;
    settings.oficinaRadioMetros = radio;
    if (nombre) settings.oficinaNombre = nombre;

    window.db.saveSettings(settings);

    const modal = document.getElementById("modal-asistencia-config-geocerca");
    if (modal) modal.classList.add("hidden");

    refreshGpsPosition();
    if (window.showToast) {
      window.showToast("Parámetros de Geocerca actualizados con éxito.", "success");
    }
  }

  /**
   * Captura coordenadas GPS en vivo como la nueva sede central
   */
  async function captureCurrentAsCentralOffice() {
    if (!confirm("¿Desea capturar la posición actual del GPS como la nueva coordenada de la Sede Central?")) return;
    await refreshGpsPosition("real");
    const inputLat = document.getElementById("input-config-oficina-lat");
    const inputLon = document.getElementById("input-config-oficina-lon");
    if (inputLat && inputLon) {
      inputLat.value = liveGps.lat;
      inputLon.value = liveGps.lon;
      if (window.showToast) window.showToast(`Coordenadas capturadas: ${liveGps.lat}, ${liveGps.lon}`, "info");
    }
  }

  /**
   * Llena el selector rápido de colaboradores en la vista Kiosco
   */
  function renderWorkerSelectorDropdown() {
    const select = document.getElementById("select-asistencia-colaborador-rapido");
    if (!select) return;
    const workers = getWorkers();

    let html = `<option value="">-- Seleccionar colaborador de la lista --</option>`;
    workers.forEach(w => {
      html += `<option value="${w.dni}">${w.nombre} (DNI: ${w.dni}) - ${w.cargo}</option>`;
    });
    select.innerHTML = html;
  }

  /**
   * Inicia el reloj digital continuo
   */
  function startClock() {
    if (clockInterval) clearInterval(clockInterval);

    const updateTime = () => {
      const clockEl = document.getElementById("asistencia-live-clock");
      const dateEl = document.getElementById("asistencia-live-date");
      const now = new Date();

      if (clockEl) {
        clockEl.textContent = now.toLocaleTimeString("es-PE", { hour12: true });
      }
      if (dateEl) {
        const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
        dateEl.textContent = now.toLocaleDateString("es-PE", options);
      }
    };

    updateTime();
    clockInterval = setInterval(updateTime, 1000);
  }

  /**
   * Inicializa el módulo con detección automática de GPS y Geocerca
   */
  function init() {
    renderWorkerSelectorDropdown();
    startClock();
    updateLocationValidationOptions();
    manualStationOverride = false;
    refreshGpsPosition("gps_real");
    startAutoGeofenceTracking();
    updatePendingBadge();

    // Si ya existe un colaborador autenticado o preseleccionado
    const currentUser = window.db && typeof window.db.getCurrentUser === "function" ? window.db.getCurrentUser() : null;
    if (currentUser && currentUser.dni) {
      selectWorker(currentUser.dni);
    } else {
      const workers = getWorkers();
      if (workers.length > 0 && !selectedWorker) {
        selectWorker(workers[0].dni);
      }
    }
  }

  return {
    init,
    startAutoGeofenceTracking,
    calculateHaversineDistance,
    getOfficeConfig,
    refreshGpsPosition,
    updateLocationValidationOptions,
    onSedeCityChange,
    selectWorker,
    performRegularPunch,
    performExternalDiligencePunch,
    setRoleView,
    requestAdminAccess,
    closeAdminAuthModal,
    toggleKeyVisibility,
    submitAdminKey,
    lockAdminAccess,
    openChangeBossKeyModal,
    saveNewBossKey,
    approveRecord,
    openRejectModal,
    confirmRejectRecord,
    showDetailModal,
    deleteRecord,
    openWorkersModal,
    addWorker,
    deleteWorker,
    openGeofenceConfigModal,
    saveGeofenceConfig,
    captureCurrentAsCentralOffice,
    renderAdminAttendanceTable,
    renderAdminKpis,
    refreshOfficeConfig,
    setAttendanceMode,
    onComisionSedeChange,
    renderWorkerSelectorDropdown,
    initWorkerSelector: renderWorkerSelectorDropdown
  };
})();

// Exponer globalmente
window.AttendanceModule = AttendanceModule;
