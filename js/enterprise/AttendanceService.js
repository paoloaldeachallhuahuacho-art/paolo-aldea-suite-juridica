/**
 * AttendanceService — GPS client + validación Edge (no confiar Haversine local).
 */
(function (global) {
  function getPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("Geolocalización no disponible"));
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 10000
      });
    });
  }

  async function punch({ branchId, eventType, workerCode }) {
    const pos = await getPosition();
    const coords = pos.coords;
    const spoof = !!(coords && (coords.mocked === true || coords.isMocked === true));
    const accessToken = global.PaoloAuthService ? global.PaoloAuthService.getAccessToken() : null;
    const payload = {
      id: "ATT-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      branch_id: branchId,
      event_type: eventType,
      client_ts: new Date().toISOString(),
      lat: coords.latitude,
      lon: coords.longitude,
      accuracy_m: coords.accuracy,
      spoof_suspected: spoof,
      worker_code: workerCode || null
    };

    if (!global.PaoloEnterpriseConfig || !global.PaoloEnterpriseConfig.isEnterprise()) {
      return { ok: true, offline: true, localOnly: true, payload };
    }

    if (!accessToken) {
      throw new Error("Sesión Supabase requerida para marcar asistencia en la nube.");
    }

    const headers = {
      "Content-Type": "application/json",
      Authorization: "Bearer " + accessToken
    };

    const res = await fetch("/.netlify/functions/attendance-validate", {
      method: "POST",
      headers,
      credentials: "same-origin",
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      const err = new Error(data.error || "Marcaje rechazado por el servidor");
      err.payload = data;
      throw err;
    }
    return data;
  }

  global.PaoloAttendanceService = { punch, getPosition };
})(typeof window !== "undefined" ? window : globalThis);
