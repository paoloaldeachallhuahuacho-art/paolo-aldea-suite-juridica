/**
 * AuthService — Supabase Auth + claims role/branch_id
 */
(function (global) {
  let client = null;
  let session = null;

  function getClient() {
    if (client) return client;
    const cfg = global.__ENV || {};
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) return null;
    if (!global.supabase || typeof global.supabase.createClient !== "function") {
      console.warn("[AuthService] supabase-js no cargado");
      return null;
    }
    client = global.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
    return client;
  }

  async function init() {
    const c = getClient();
    if (!c) return null;
    const { data } = await c.auth.getSession();
    session = data && data.session ? data.session : null;
    c.auth.onAuthStateChange((_evt, s) => { session = s; });
    return session;
  }

  async function signIn(email, password) {
    const c = getClient();
    if (!c) throw new Error("Supabase no configurado");
    const { data, error } = await c.auth.signInWithPassword({ email, password });
    if (error) throw error;
    session = data.session;
    return session;
  }

  async function signOut() {
    const c = getClient();
    if (c) await c.auth.signOut();
    session = null;
  }

  function getAccessToken() {
    return session && session.access_token ? session.access_token : null;
  }

  function getClaims() {
    const u = session && session.user;
    if (!u) return null;
    const meta = u.app_metadata || {};
    return {
      uid: u.id,
      email: u.email,
      role: meta.role || "abogado",
      branch_id: meta.branch_id || "challhuahuacho"
    };
  }

  function isSuperAdmin() {
    const c = getClaims();
    return !!(c && c.role === "super_admin");
  }

  /** Consulta si la firma ya tiene Super Admin en la nube (multi-dispositivo). */
  async function fetchFirmBootstrapped() {
    try {
      const res = await fetch("/api/auth-firm-status", { credentials: "same-origin" });
      if (!res.ok) return null;
      const data = await res.json();
      return !!(data && data.bootstrapped);
    } catch (_) {
      return null;
    }
  }

  async function pushCloudBootstrap(workerPayload) {
    const res = await fetch("/api/auth-bootstrap", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(workerPayload || {})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error((data && data.error) || ("HTTP " + res.status));
      err.status = res.status;
      err.body = data;
      throw err;
    }
    return data;
  }

  async function postLogin(body) {
    const res = await fetch("/api/auth-login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error((data && data.error) || ("HTTP " + res.status));
      err.status = res.status;
      err.body = data;
      throw err;
    }
    return data;
  }

  async function cloudLogin(usuario, password) {
    const challenge = await postLogin({ usuario, phase: "challenge" });
    const proofs = {};
    const checks = (challenge && challenge.checks) || [];
    for (const check of checks) {
      if (!check || !check.field) continue;
      if (check.scheme === "pbkdf2" && typeof global.deriveSecretProof === "function") {
        proofs[check.field] = await global.deriveSecretProof(password, check.salt, check.iterations);
      } else if (check.scheme === "sha256" && typeof global.sha256Hex === "function") {
        proofs[check.field] = await global.sha256Hex(password);
      }
    }
    return postLogin({ usuario, proofs });
  }

  async function upsertStaffCloud(workerPayload) {
    let syncToken = "";
    try {
      syncToken =
        (global.PaoloCloudDataSync && typeof global.PaoloCloudDataSync.getToken === "function"
          ? global.PaoloCloudDataSync.getToken()
          : "") ||
        sessionStorage.getItem("PA_SYNC_TOKEN") ||
        localStorage.getItem("PA_SYNC_TOKEN") ||
        "";
    } catch (_) {}
    if (!syncToken) {
      const err = new Error("Sesión cloud requerida para sincronizar personal.");
      err.status = 401;
      throw err;
    }
    const res = await fetch("/api/auth-staff-upsert", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...(workerPayload || {}), syncToken })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error((data && data.error) || ("HTTP " + res.status));
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function hydrateLocalWorkers(directory) {
    if (!global.db || !Array.isArray(directory) || !directory.length) return;
    const previous = (global.db.getRaw && global.db.getRaw("workers")) || [];
    const prevById = new Map(previous.filter((w) => w && w.id != null).map((w) => [String(w.id), w]));
    let tombstones = new Set();
    try {
      const raw = localStorage.getItem("PAOLO_ALDEA_TOMBSTONES");
      const all = raw ? JSON.parse(raw) : {};
      tombstones = new Set((all.workers || []).map(String));
    } catch (_) {}

    const cleaned = directory
      .filter((w) => w && w.id != null && !tombstones.has(String(w.id)))
      .map((w) => {
        const cloud = global.db.sanitizeWorkerCredentials
          ? global.db.sanitizeWorkerCredentials(w)
          : { ...w };
        const prev = prevById.get(String(cloud.id));
        if (!prev) {
          if (!cloud.foto) {
            try {
              const stored = localStorage.getItem("PAOLO_ALDEA_USER_PHOTO_" + cloud.id);
              if (stored) cloud.foto = stored;
            } catch (_) {}
          }
          return cloud;
        }
        const localTs = Math.max(
          Date.parse(prev.updatedAt || 0) || 0,
          Date.parse(prev.updated_at || 0) || 0
        );
        const cloudTs = Math.max(
          Date.parse(cloud.updatedAt || 0) || 0,
          Date.parse(cloud.updated_at || 0) || 0,
          Date.parse(cloud.server_ts || 0) || 0
        );
        // Edición local más reciente gana (no pisar personal/cargo/teléfono recién guardados).
        let base;
        if (localTs > cloudTs) {
          base = global.db.sanitizeWorkerCredentials
            ? global.db.sanitizeWorkerCredentials({ ...cloud, ...prev })
            : { ...cloud, ...prev };
        } else {
          base = { ...cloud };
          // Conservar foto y campos locales ricos si la nube viene incompleta.
          if (!base.foto && prev.foto) base.foto = prev.foto;
          if (!base.telefono && prev.telefono) base.telefono = prev.telefono;
          if (!base.email && prev.email) base.email = prev.email;
          if (!base.cargo && prev.cargo) base.cargo = prev.cargo;
        }
        // Nunca borrar hashes locales: el directorio nube a menudo los envía vacíos.
        if (!base.passwordHash && prev.passwordHash) base.passwordHash = prev.passwordHash;
        if (!base.pinHash && prev.pinHash) base.pinHash = prev.pinHash;
        if (!base.permisos && prev.permisos) base.permisos = prev.permisos;
        if (!base.foto) {
          try {
            const stored = localStorage.getItem("PAOLO_ALDEA_USER_PHOTO_" + base.id);
            if (stored) base.foto = stored;
          } catch (_) {}
        }
        return base;
      });

    // Conservar locales activos que aún no están en la nube (evita "parpadeo" de borrados).
    previous.forEach((w) => {
      if (!w || w.id == null) return;
      const id = String(w.id);
      if (tombstones.has(id)) return;
      if (w.activo === false || w.activo === "false") return;
      if (cleaned.some((c) => String(c.id) === id)) return;
      cleaned.push(
        global.db.sanitizeWorkerCredentials ? global.db.sanitizeWorkerCredentials(w) : { ...w }
      );
    });

    global.db._trusted = true;
    try {
      global.db.save("workers", cleaned);
      const s = global.db.getSettings();
      s.authBootstrapped = true;
      const admin = cleaned.find(
        (w) => w && (w.rol === "super_admin" || w.role === "super_admin" || w.id === "WRK-000")
      );
      const boss =
        cleaned.find((w) => w && (w.rol === "socio" || w.role === "socio")) ||
        cleaned.find((w) => w && (w.rol === "admin" || w.role === "admin")) ||
        admin;
      if (admin) {
        s.adminUser = admin.usuario || s.adminUser;
        if (admin.passwordHash) {
          s.adminPasswordHash = admin.passwordHash;
          s.masterPasswordHash = admin.passwordHash;
        }
      }
      // Clave de supervisión de jefes disponible offline tras el primer login/sync.
      if (boss && boss.passwordHash) {
        s.bossPasswordHash = boss.passwordHash;
      } else if (admin && admin.passwordHash && !s.bossPasswordHash) {
        s.bossPasswordHash = admin.passwordHash;
      }
      global.db.saveSettings(s);
    } finally {
      global.db._trusted = false;
    }
  }

  global.PaoloAuthService = {
    init,
    signIn,
    signOut,
    getClient,
    getAccessToken,
    getClaims,
    isSuperAdmin,
    getSession: () => session,
    fetchFirmBootstrapped,
    pushCloudBootstrap,
    cloudLogin,
    upsertStaffCloud,
    hydrateLocalWorkers
  };
})(typeof window !== "undefined" ? window : globalThis);
