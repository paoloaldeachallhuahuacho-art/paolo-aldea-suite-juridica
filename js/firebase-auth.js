/**
 * PAOLO ALDEA & ABOGADOS - Firebase Cloud Authentication & Firestore Sync Engine
 * Módulo Oficial de Seguridad Backend y Sincronización Multi-Dispositivo en Tiempo Real
 */

class FirebaseLegalService {
  constructor() {
    this.app = null;
    this.auth = null;
    this.firestore = null;
    this.currentUser = null;
    this.isInitialized = false;
    this.isSyncing = false;
    this.configKey = "PAOLO_ALDEA_FIREBASE_CONFIG";
    this._syncedItemSignatures = new Map();
    this._syncedTombstoneSignatures = new Set();
  }

  /**
   * Carga la configuración guardada de Firebase
   */
  getConfig() {
    try {
      const saved = localStorage.getItem(this.configKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.apiKey && parsed.projectId) return parsed;
      }
    } catch (e) {
      console.warn("[Firebase] Error al leer configuración local:", e);
    }
    const settings = window.db ? window.db.getSettings() : {};
    if (settings && settings.firebaseConfig && settings.firebaseConfig.apiKey && settings.firebaseConfig.projectId) {
      return settings.firebaseConfig;
    }
    return null;
  }

  /**
   * Indica si existen credenciales válidas configuradas para Firebase
   */
  hasCredentials() {
    const cfg = this.getConfig();
    return !!(cfg && cfg.apiKey && cfg.projectId);
  }

  /**
   * Guarda la configuración de Firebase
   */
  saveConfig(config) {
    try {
      const cleanConfig = {
        ...config,
        autoSync: config.autoSync !== false,
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem(this.configKey, JSON.stringify(cleanConfig));
      const settings = window.db ? window.db.getSettings() : {};
      settings.firebaseConfig = cleanConfig;
      if (window.db) window.db.saveSettings(settings);
      this.isInitialized = false;
      return true;
    } catch (e) {
      console.error("[Firebase] Error guardando config:", e);
      return false;
    }
  }

  /**
   * Inicializa Firebase si está disponible la librería y la configuración
   */
  async init() {
    if (this.isInitialized && this.firestore) return true;

    if (typeof firebase === "undefined") {
      console.info("[Firebase] SDK no cargado en este momento. Funcionando en modo local.");
      return false;
    }

    const config = this.getConfig();
    if (!config || !config.apiKey || !config.projectId) {
      return false;
    }

    try {
      if (!firebase.apps || !firebase.apps.length) {
        this.app = firebase.initializeApp(config);
      } else {
        this.app = firebase.app();
      }

      this.auth = firebase.auth ? firebase.auth() : null;
      this.firestore = firebase.firestore ? firebase.firestore() : null;

      // Habilitar persistencia offline en Firestore si está disponible
      if (this.firestore && !this._persistenceAttempted) {
        this._persistenceAttempted = true;
        try {
          await this.firestore.enablePersistence({ synchronizeTabs: true });
        } catch (err) {
          if (err.code !== "failed-precondition" && err.code !== "unimplemented") {
            console.warn("[Firebase] Persistencia offline no disponible:", err.message);
          }
        }
      }

      this.isInitialized = true;
      console.info("[Firebase] Conexión exitosa con el proyecto:", config.projectId);
      return true;
    } catch (e) {
      console.error("[Firebase] Error durante la inicialización:", e);
      return false;
    }
  }

  /**
   * Verifica si Firebase está configurado y listo
   */
  isReady() {
    return this.isInitialized && this.firestore !== null;
  }

  /**
   * Inicia sesión con Correo Electrónico y Contraseña (Autenticación Real en Servidores de Google)
   */
  async loginWithEmail(email, password) {
    if (!this.isReady()) {
      const initialized = await this.init();
      if (!initialized || !this.auth) {
        throw new Error("El servicio de Firebase no está configurado. Ingrese las credenciales en el Panel de Administración.");
      }
    }

    try {
      const userCredential = await this.auth.signInWithEmailAndPassword(email.trim(), password);
      this.currentUser = userCredential.user;

      const token = await this.currentUser.getIdToken();
      sessionStorage.setItem("PAOLO_ALDEA_FIREBASE_TOKEN", token);

      if (window.db && typeof window.db.addAuditLog === "function") {
        window.db.addAuditLog({
          modulo: "SEGURIDAD",
          accion: "LOGIN_FIREBASE_SUCCESS",
          detalles: `Inicio de sesión seguro en Firebase para ${email} (UID: ${this.currentUser.uid})`,
          usuario: email
        });
      }

      return {
        success: true,
        user: this.currentUser,
        email: this.currentUser.email,
        uid: this.currentUser.uid
      };
    } catch (error) {
      console.error("[Firebase Auth Error]:", error);
      let mensajeAmigable = "Error al iniciar sesión en Firebase.";
      switch (error.code) {
        case "auth/invalid-email":
          mensajeAmigable = "El formato de correo institucional no es válido.";
          break;
        case "auth/user-not-found":
          mensajeAmigable = "No existe ningún usuario registrado con este correo.";
          break;
        case "auth/wrong-password":
        case "auth/invalid-credential":
          mensajeAmigable = "Contraseña incorrecta. Verifique sus credenciales.";
          break;
        case "auth/too-many-requests":
          mensajeAmigable = "Acceso bloqueado temporalmente por demasiados intentos fallidos. Espere unos minutos.";
          break;
        case "auth/network-request-failed":
          mensajeAmigable = "Sin conexión a internet para validar el acceso en Firebase.";
          break;
        default:
          mensajeAmigable = error.message;
      }
      throw new Error(mensajeAmigable);
    }
  }

  /**
   * Cierra la sesión en Firebase y limpia credenciales temporales
   */
  async logout() {
    if (this.auth) {
      try {
        await this.auth.signOut();
      } catch (_) {}
    }
    this.currentUser = null;
    sessionStorage.removeItem("PAOLO_ALDEA_FIREBASE_TOKEN");
  }

  /**
   * Envía correo de restablecimiento seguro de contraseña
   */
  async sendPasswordReset(email) {
    if (!this.isReady()) {
      const ok = await this.init();
      if (!ok) throw new Error("Firebase no está configurado.");
    }
    if (!this.auth) throw new Error("Firebase Auth no disponible.");
    await this.auth.sendPasswordResetEmail(email.trim());
    return true;
  }

  /**
   * Escucha cambios en el estado de autenticación de Firebase
   */
  onAuthStateChanged(callback) {
    if (this.auth) {
      return this.auth.onAuthStateChanged((user) => {
        this.currentUser = user;
        callback(user);
      });
    }
  }

  /**
   * Sube una colección local a Cloud Firestore en bloques seguros (<= 450 ops por batch)
   * utilizando Sincronización Delta O(Δ) para omitir documentos que no han cambiado.
   */
  async syncCollectionToCloud(collectionName, items = [], deletedIds = [], forceFull = false) {
    if (!this.isReady() || !this.firestore) {
      throw new Error("Firestore no está conectado.");
    }

    const colRef = this.firestore.collection(collectionName);
    const deletedSet = new Set((deletedIds || []).map(String));
    const operations = [];
    const pendingSignatures = [];

    // 1. Preparar eliminaciones (tombstones) solo si no se enviaron ya en esta sesión
    deletedSet.forEach((delId) => {
      if (delId) {
        const tombKey = `${collectionName}:${delId}`;
        if (forceFull || !this._syncedTombstoneSignatures.has(tombKey)) {
          operations.push({ type: "delete", ref: colRef.doc(delId), tombKey });
        }
      }
    });

    // 2. Preparar escrituras / actualizaciones únicamente de documentos nuevos o modificados (Delta Sync)
    let count = 0;
    for (const item of items) {
      if (!item) continue;
      const docId = String(item.id || item.codigo || item.dni || `DOC-${count}`).replace(/\//g, "_");
      if (deletedSet.has(docId)) continue;

      const serialized = JSON.stringify(item);
      const sigKey = `${collectionName}:${docId}`;
      const signature = `${item.updatedAt || ""}_${serialized.length}`;

      if (!forceFull && this._syncedItemSignatures.get(sigKey) === signature) {
        count++;
        continue;
      }

      const docRef = colRef.doc(docId);
      const cleanItem = JSON.parse(serialized);
      // Nunca sincronizar secretos de autenticación a la nube
      if (collectionName === "workers") {
        delete cleanItem.password;
        delete cleanItem.pin;
        delete cleanItem.clave;
        delete cleanItem.passwordPlain;
        delete cleanItem.pinPlain;
        delete cleanItem.passwordHash;
        delete cleanItem.pinHash;
      }
      operations.push({
        type: "set",
        ref: docRef,
        sigKey,
        signature,
        data: {
          ...cleanItem,
          id: item.id || docId,
          updatedAt: item.updatedAt || new Date().toISOString(),
          _updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }
      });
      count++;
    }

    if (operations.length === 0) {
      return count;
    }

    // 3. Ejecutar en bloques de 450 para respetar el límite de 500 de Firestore
    const CHUNK_SIZE = 450;
    for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
      const chunk = operations.slice(i, i + CHUNK_SIZE);
      const batch = this.firestore.batch();
      chunk.forEach((op) => {
        if (op.type === "delete") {
          batch.delete(op.ref);
        } else {
          batch.set(op.ref, op.data, { merge: true });
        }
      });
      await batch.commit();
      chunk.forEach((op) => {
        if (op.type === "delete" && op.tombKey) {
          this._syncedTombstoneSignatures.add(op.tombKey);
        } else if (op.sigKey && op.signature) {
          this._syncedItemSignatures.set(op.sigKey, op.signature);
        }
      });
    }

    return count;
  }

  /**
   * Sincronización Delta Rápida O(Δ) para una única colección tras crear/editar/eliminar un registro
   */
  async syncCollectionDelta(collectionName) {
    if (!collectionName || collectionName === "auditoria" || collectionName === "settings") return false;
    if (this.isSyncing || !this.hasCredentials()) return false;

    if (!this.isReady()) {
      const ok = await this.init();
      if (!ok) return false;
    }

    await this.ensureAuthSession();

    try {
      const localItems = window.db ? window.db.getRaw(collectionName) : [];
      const localTombstones = (window.db && typeof window.db._loadTombstones === "function")
        ? window.db._loadTombstones()
        : {};
      const colTombstones = Array.isArray(localTombstones[collectionName]) ? localTombstones[collectionName] : [];
      if (colTombstones.length > 0) {
        await this.saveTombstonesToCloud(localTombstones);
      }
      await this.syncCollectionToCloud(collectionName, localItems, colTombstones, false);
      return true;
    } catch (e) {
      console.warn(`[Firebase DeltaSync] Error sincronizando ${collectionName}:`, e);
      return false;
    }
  }

  /**
   * Descarga una colección completa desde Cloud Firestore
   */
  async loadCollectionFromCloud(collectionName) {
    if (!this.isReady() || !this.firestore) {
      throw new Error("Firestore no está conectado.");
    }
    const snap = await this.firestore.collection(collectionName).get();
    const items = [];
    snap.forEach((doc) => {
      const data = doc.data() || {};
      delete data._updatedAt;
      items.push({ ...data, id: data.id || doc.id });
    });
    return items;
  }

  /**
   * Descarga y fusiona el registro de eliminaciones (Tombstones) desde Firestore
   */
  async loadTombstonesFromCloud() {
    if (!this.isReady() || !this.firestore) return {};
    try {
      const doc = await this.firestore.collection("_meta").doc("tombstones").get();
      if (doc.exists) {
        const data = doc.data() || {};
        return data.deletedIds || {};
      }
    } catch (e) {
      console.warn("[Firebase] No se pudieron leer tombstones remotos:", e);
    }
    return {};
  }

  /**
   * Sube el registro de eliminaciones (Tombstones) a Firestore
   */
  async saveTombstonesToCloud(deletedIds = {}) {
    if (!this.isReady() || !this.firestore) return;
    try {
      await this.firestore.collection("_meta").doc("tombstones").set({
        deletedIds: deletedIds,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.warn("[Firebase] No se pudieron guardar tombstones remotos:", e);
    }
  }

  /**
   * Garantiza sesión Firebase Auth real (email/password u OAuth).
   * Semana 2: se eliminó signInAnonymously — sin sesión nominal no hay sync a Firestore.
   */
  async ensureAuthSession() {
    if (!this.auth) return false;
    if (this.auth.currentUser) {
      if (this.auth.currentUser.isAnonymous) {
        try { await this.auth.signOut(); } catch (_) {}
        this.currentUser = null;
        return false;
      }
      this.currentUser = this.auth.currentUser;
      return true;
    }
    return false;
  }

  /** Devuelve ID token actual para proxies Netlify (Telegram, etc.). */
  async getIdToken(forceRefresh = false) {
    if (!(await this.ensureAuthSession())) return null;
    try {
      return await this.auth.currentUser.getIdToken(!!forceRefresh);
    } catch (_) {
      return null;
    }
  }

  /**
   * Sincronización bidireccional integral del despacho (GET -> Merge Determinista con Tombstones -> Batch Push)
   */
  async fullSync(onProgress = null, silent = false) {
    if (this.isSyncing) return null;
    if (!this.hasCredentials()) {
      if (!silent) throw new Error("Firebase no está configurado. Ingrese Project ID y API Key.");
      return null;
    }

    if (!this.isReady()) {
      const ok = await this.init();
      if (!ok) {
        if (!silent) throw new Error("No se pudo inicializar Firebase Cloud.");
        return null;
      }
    }

    const authed = await this.ensureAuthSession();
    if (!authed) {
      if (!silent) throw new Error("Firebase Auth requerido: inicie sesión con correo institucional (Anonymous Auth deshabilitado).");
      return null;
    }

    this.isSyncing = true;
    try {
      const collections = ["casos", "caja_chica", "citas", "inventario", "documentos", "presupuestos", "workers", "attendance"];
      const remoteDataMap = {};

      // 1. Descargar tombstones y colecciones remotas primero (evita pisar cambios de otras sedes/usuarios)
      const remoteTombstones = await this.loadTombstonesFromCloud();

      for (const col of collections) {
        if (onProgress && !silent) onProgress(`Descargando ${col} desde Firestore...`);
        const remoteItems = await this.loadCollectionFromCloud(col);
        remoteDataMap[col] = remoteItems;
      }

      // 2. Fusionar en DataManager usando Last-Write-Wins y Tombstones
      let mergeStats = { totalAdded: 0, totalUpdated: 0, totalDeleted: 0 };
      if (window.db && typeof window.db.mergeSyncPackage === "function") {
        mergeStats = window.db.mergeSyncPackage({
          protocol: "FIREBASE_FIRESTORE_SYNC_V2",
          timestamp: new Date().toISOString(),
          data: remoteDataMap,
          deletedIds: remoteTombstones
        });
      }

      // 3. Subir las colecciones ya consolidadas y los tombstones actualizados a Firestore
      const localTombstones = (window.db && typeof window.db._loadTombstones === "function")
        ? window.db._loadTombstones()
        : {};

      await this.saveTombstonesToCloud(localTombstones);

      const results = {};
      for (const col of collections) {
        if (onProgress && !silent) onProgress(`Subiendo ${col} consolidado a Firestore...`);
        const consolidatedLocal = window.db ? window.db.getRaw(col) : [];
        const colTombstones = Array.isArray(localTombstones[col]) ? localTombstones[col] : [];
        results[col] = await this.syncCollectionToCloud(col, consolidatedLocal, colTombstones);
      }

      return {
        collections: results,
        mergeStats
      };
    } finally {
      this.isSyncing = false;
    }
  }
}

// Instancia global
window.firebaseService = new FirebaseLegalService();
