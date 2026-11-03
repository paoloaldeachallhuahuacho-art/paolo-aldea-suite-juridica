/**
 * AttendanceService — GPS client + validación Edge (syncToken o JWT).
 */
(function (global) {
  function edgeUrl(name) {
    return (global.PaoloEnterpriseConfig && global.PaoloEnterpriseConfig.edgeUrl)
      ? global.PaoloEnterpriseConfig.edgeUrl(name)
      : "/api/" + name;
  }

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

  function authHeaders() {
    const headers = { "Content-Type": "application/json" };
    const jwt = global.PaoloAuthService && global.PaoloAuthService.getAccessToken
      ? global.PaoloAuthService.getAccessToken()
      : null;
    const sync =
      global.PaoloCloudDataSync && typeof global.PaoloCloudDataSync.getToken === "function"
        ? global.PaoloCloudDataSync.getToken()
        : "";
    if (jwt) headers.Authorization = "Bearer " + jwt;
    else if (sync) headers.Authorization = "Bearer " + sync;
    return { headers, syncToken: sync || null, hasAuth: !!(jwt || sync) };
  }

  async function punch({ branchId, eventType, workerCode }) {
    const pos = await getPosition();
    const coords = pos.coords;
    const spoof = !!(coords && (coords.mocked === true || coords.isMocked === true));
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

    const auth = authHeaders();
    if (!auth.hasAuth) {
      throw new Error("Sesión requerida para marcar asistencia en la nube. Vuelva a iniciar sesión.");
    }
    if (auth.syncToken && !auth.headers.Authorization.includes("eyJ")) {
      payload.syncToken = auth.syncToken;
    }

    const res = await fetch(edgeUrl("attendance-validate"), {
      method: "POST",
      headers: auth.headers,
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
