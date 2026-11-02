/**
 * PAOLO ALDEA & ABOGADOS - Data Engine & LocalStorage Manager
 * Especializado para: PAOLO ALDEA & ABOGADOS (Sede Challhuahuacho)
 * Control de Gestión Operativa & Administrativa - Enfoque Ingeniería Industrial
 */

// Helpers para fechas relativas en tiempo real
function getRelativeDateStr(daysOffset = 0, hour = 10, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return `${year}-${month}-${day}T${hh}:${mm}`;
}

// Generador universal de identificadores únicos no colisionantes
function generateUniqueId(prefix = "ID") {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    const part = crypto.randomUUID().replace(/-/g, "").substring(0, 8);
    return `${prefix}-${part.toUpperCase()}`;
  }
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  const time = Date.now().toString(36).toUpperCase();
  return `${prefix}-${time}-${rand}`;
}
window.generateUniqueId = generateUniqueId;

// Generador de Hash SHA-256 para seguridad de credenciales en navegador
// SHA-256 sincrono (respaldo cuando crypto.subtle no esta disponible, p. ej. HTTP en red local)
function sha256Sync(ascii) {
  const rotr = (n, x) => (x >>> n) | (x << (32 - n));
  const K = [];
  const H = [];
  const isPrime = n => { for (let i = 2, s = Math.sqrt(n); i <= s; i++) if (n % i === 0) return false; return true; };
  const frac = x => ((x - Math.floor(x)) * 4294967296) | 0;
  for (let c = 2, n = 0; n < 64; c++) if (isPrime(c)) { if (n < 8) H[n] = frac(Math.pow(c, 1 / 2)); K[n] = frac(Math.pow(c, 1 / 3)); n++; }
  const bytes = Array.from(new TextEncoder().encode(String(ascii)));
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bitLen >>> (i * 8)) & 255);
  for (let off = 0; off < bytes.length; off += 64) {
    const w = new Array(64);
    for (let i = 0; i < 16; i++) w[i] = (bytes[off + i * 4] << 24) | (bytes[off + i * 4 + 1] << 16) | (bytes[off + i * 4 + 2] << 8) | bytes[off + i * 4 + 3];
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(7, w[i - 15]) ^ rotr(18, w[i - 15]) ^ (w[i - 15] >>> 3);
      const s1 = rotr(17, w[i - 2]) ^ rotr(19, w[i - 2]) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d2, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + w[i]) | 0;
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d2 + t1) | 0; d2 = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d2) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  return H.map(x => (x >>> 0).toString(16).padStart(8, "0")).join("");
}
window.sha256Sync = sha256Sync;

async function sha256Hex(message) {
  if (typeof crypto !== "undefined" && crypto.subtle && typeof TextEncoder !== "undefined") {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  }
  return sha256Sync(message);
}
window.sha256Hex = sha256Hex;

// ---- Almacenamiento seguro de secretos: PBKDF2-SHA256 con sal aleatoria por credencial ----
const PBKDF2_ITERATIONS = 210000;
const _toB64 = (u8) => btoa(String.fromCharCode(...u8));
const _fromB64 = (b64) => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
async function _pbkdf2(plain, salt, iterations) {
  if (!(typeof crypto !== "undefined" && crypto.subtle)) {
    throw new Error("Contexto no seguro: use HTTPS o localhost para gestionar credenciales.");
  }
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(String(plain)), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256));
}
async function hashSecret(plain) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await _pbkdf2(plain, salt, PBKDF2_ITERATIONS);
  return "pbkdf2$" + PBKDF2_ITERATIONS + "$" + _toB64(salt) + "$" + _toB64(bits);
}
function _safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
/** Verifica una credencial contra un hash PBKDF2 o un hash SHA-256 heredado (se recomienda re-hashear con isLegacySecret). */
async function verifySecret(plain, stored) {
  if (!stored || typeof stored !== "string") return false;
  if (stored.startsWith("pbkdf2$")) {
    const [, iter, saltB64, hashB64] = stored.split("$");
    try {
      const bits = await _pbkdf2(plain, _fromB64(saltB64), parseInt(iter, 10));
      return _safeEqual(_toB64(bits), hashB64);
    } catch (e) { return false; }
  }
  return _safeEqual(await sha256Hex(plain), stored);
}
const isLegacySecret = (stored) => !!stored && !String(stored).startsWith("pbkdf2$");
window.hashSecret = hashSecret;
window.verifySecret = verifySecret;
window.isLegacySecret = isLegacySecret;

// Parser numérico financiero universal (Previene truncamiento por comas o símbolos monetarios)
function parseMoney(val) {
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const clean = String(val).replace(/[^0-9.-]/g, "");
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
}
window.parseMoney = parseMoney;

/**
 * ==============================================================================
 * MOTOR CRIPTOGRÁFICO PROFESIONAL - Web Crypto API (AES-256-GCM + PBKDF2)
 * Protege el Secreto Profesional Legal garantizando confidencialidad de datos.
 * Compatible hacia atrás: detecta automáticamente si el dato está en texto plano o cifrado.
 * ==============================================================================
 */
class LegalCryptoEngine {
  constructor() {
    this.sessionKey = null;
    this.legacyKey = null;
    this.legacySalt = new TextEncoder().encode("PAOLO_ALDEA_LEGALTECH_SALT_COTABAMBAS_2026");
    this.salt = this._getOrCreateDynamicSalt();
    this.enabled = true;
  }

  _getOrCreateDynamicSalt() {
    const SALT_KEY = "PAOLO_ALDEA_CRYPTO_DYNAMIC_SALT_V2";
    try {
      const savedB64 = localStorage.getItem(SALT_KEY);
      if (savedB64 && savedB64.length >= 16) {
        return new Uint8Array(atob(savedB64).split("").map(c => c.charCodeAt(0)));
      }
      if (typeof window !== "undefined" && window.crypto && window.crypto.getRandomValues) {
        const randomBytes = window.crypto.getRandomValues(new Uint8Array(32));
        const b64 = btoa(String.fromCharCode(...randomBytes));
        localStorage.setItem(SALT_KEY, b64);
        return randomBytes;
      }
    } catch (e) {}
    return this.legacySalt;
  }

  async deriveSessionKey(passphrase) {
    if (!passphrase || typeof window === "undefined" || !window.crypto || !window.crypto.subtle) return null;
    try {
      const enc = new TextEncoder();
      const baseKey = await window.crypto.subtle.importKey(
        "raw",
        enc.encode(passphrase),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
      );
      const derived = await window.crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          salt: this.salt,
          iterations: 100000,
          hash: "SHA-256"
        },
        baseKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
      );
      this.sessionKey = derived;

      // Derivar también clave legacy para compatibilidad retroactiva transparente
      try {
        this.legacyKey = await window.crypto.subtle.deriveKey(
          {
            name: "PBKDF2",
            salt: this.legacySalt,
            iterations: 100000,
            hash: "SHA-256"
          },
          baseKey,
          { name: "AES-GCM", length: 256 },
          false,
          ["encrypt", "decrypt"]
        );
      } catch (_) {}

      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("PAOLO_ALDEA_CRYPTO_ACTIVE", "true");
      }
      return derived;
    } catch (err) {
      console.warn("LegalCryptoEngine: Error al derivar clave de sesión:", err);
      return null;
    }
  }

  async encryptText(plainText) {
    if (!this.sessionKey || !window.crypto || !window.crypto.subtle || !this.enabled) {
      return plainText;
    }
    try {
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const enc = new TextEncoder();
      const cipherBuffer = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        this.sessionKey,
        enc.encode(plainText)
      );
      const ivB64 = btoa(String.fromCharCode(...iv));
      const cipherB64 = btoa(String.fromCharCode(...new Uint8Array(cipherBuffer)));
      return `ENC:AES256GCM:${ivB64}:${cipherB64}`;
    } catch (err) {
      console.warn("LegalCryptoEngine: Error en cifrado AES-256-GCM:", err);
      return plainText;
    }
  }

  async decryptText(encryptedStr) {
    if (!encryptedStr || typeof encryptedStr !== "string" || !encryptedStr.startsWith("ENC:AES256GCM:")) {
      return encryptedStr;
    }
    if (!this.sessionKey || !window.crypto || !window.crypto.subtle) {
      return encryptedStr;
    }
    try {
      const parts = encryptedStr.split(":");
      if (parts.length < 4) return encryptedStr;
      const iv = new Uint8Array(atob(parts[2]).split("").map(c => c.charCodeAt(0)));
      const cipherBytes = new Uint8Array(atob(parts[3]).split("").map(c => c.charCodeAt(0)));
      try {
        const decryptedBuffer = await window.crypto.subtle.decrypt(
          { name: "AES-GCM", iv: iv },
          this.sessionKey,
          cipherBytes
        );
        return new TextDecoder().decode(decryptedBuffer);
      } catch (primaryErr) {
        if (this.legacyKey) {
          const fallbackBuffer = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv },
            this.legacyKey,
            cipherBytes
          );
          return new TextDecoder().decode(fallbackBuffer);
        }
        throw primaryErr;
      }
    } catch (err) {
      console.warn("LegalCryptoEngine: Error en descifrado AES-256-GCM:", err);
      return encryptedStr;
    }
  }

  isEncrypted(value) {
    return typeof value === "string" && value.startsWith("ENC:AES256GCM:");
  }

  hasActiveKey() {
    return !!this.sessionKey;
  }
}

window.LegalCryptoEngine = LegalCryptoEngine;
window.legalCrypto = new LegalCryptoEngine();

function getRelativeDateOnlyStr(daysOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Próximo viernes a las 15:00 hrs para Directorio Semanal
function getNextFridayDateStr(hour = 15, minute = 0) {
  const d = new Date();
  const dayOfWeek = d.getDay(); // 0: Dom, 1: Lun, 2: Mar, 3: Mie, 4: Jue, 5: Vie, 6: Sab
  let diff = (5 - dayOfWeek + 7) % 7;
  if (diff === 0 && (d.getHours() > hour || (d.getHours() === hour && d.getMinutes() >= minute))) {
    diff = 7;
  }
  d.setDate(d.getDate() + diff);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return `${year}-${month}-${day}T${hh}:${mm}`;
}

// =========================================================================
// CATÁLOGO OFICIAL DE SEDES NACIONALES (Arquitectura Multi-Sede)
// PAOLO ALDEA & ABOGADOS: Miraflores, Abancay, Cusco, Huaraz, Challhuahuacho
// =========================================================================
const SEDES_CONFIG = {
  todas: {
    id: "todas",
    codigo: "NAC",
    nombre: "Consolidado Nacional — Todas las Sedes",
    nombreCorto: "Consolidado Nacional",
    region: "Perú / Cobertura Nacional",
    direccion: "Sede Central & Red Descentralizada Nacional",
    telefono: "+51 943 410 215 / Central Despacho",
    color: "#D97706",
    badgeBg: "bg-amber-950/80",
    badgeBorder: "border-amber-500/40",
    badgeText: "text-amber-300",
    lat: -12.1226280,
    lon: -77.0114260,
    radio: 500000
  },
  miraflores: {
    id: "miraflores",
    codigo: "MIR",
    nombre: "Sede Miraflores (Lima)",
    nombreCorto: "Miraflores",
    region: "Lima Metropolitana",
    direccion: "Av. Rep\u00FAblica de Panam\u00E1 / Miraflores - Lima (-12.1226280, -77.0114260)",
    telefono: "+51 (01) 445-8920 / Central Lima",
    color: "#2563EB",
    badgeBg: "bg-blue-950/80",
    badgeBorder: "border-blue-500/40",
    badgeText: "text-blue-300",
    lat: -12.1226280,
    lon: -77.0114260,
    radio: 100
  },
  abancay: {
    id: "abancay",
    codigo: "ABN",
    nombre: "Sede Abancay",
    nombreCorto: "Abancay",
    region: "Apur\u00EDmac",
    direccion: "Abancay, Apur\u00EDmac (-13.6356460, -72.8776140)",
    telefono: "+51 (083) 321-456 / Central Abancay",
    color: "#059669",
    badgeBg: "bg-emerald-950/80",
    badgeBorder: "border-emerald-500/40",
    badgeText: "text-emerald-300",
    lat: -13.6356460,
    lon: -72.8776140,
    radio: 100
  },
  cusco: {
    id: "cusco",
    codigo: "CUZ",
    nombre: "Sede Cusco",
    nombreCorto: "Cusco",
    region: "Cusco",
    direccion: "Av. de la Cultura / Wanchaq, Cusco (-13.5227850, -71.9699630)",
    telefono: "+51 (084) 245-789 / Central Cusco",
    color: "#7C3AED",
    badgeBg: "bg-purple-950/80",
    badgeBorder: "border-purple-500/40",
    badgeText: "text-purple-300",
    lat: -13.5227850,
    lon: -71.9699630,
    radio: 100
  },
  huaraz: {
    id: "huaraz",
    codigo: "HRZ",
    nombre: "Sede Huaraz",
    nombreCorto: "Huaraz",
    region: "\u00C1ncash",
    direccion: "Jr. Gabino Uribe 650, Huaraz 02001, \u00C1ncash",
    telefono: "+51 (043) 421-980 / Central Huaraz",
    color: "#D97706",
    badgeBg: "bg-amber-950/80",
    badgeBorder: "border-amber-500/40",
    badgeText: "text-amber-300",
    lat: -9.530500,
    lon: -77.524200,
    radio: 100
  },
  challhuahuacho: {
    id: "challhuahuacho",
    codigo: "CHL",
    nombre: "Sede Challhuahuacho",
    nombreCorto: "Challhuahuacho",
    region: "Cotabambas, Apur\u00EDmac",
    direccion: "Av. Los Mineros Mz. D Lt. 4, Challhuahuacho, Cotabambas - Apur\u00EDmac",
    telefono: "+51 943 410 215 / Central Challhuahuacho",
    color: "#DB2777",
    badgeBg: "bg-pink-950/80",
    badgeBorder: "border-pink-500/40",
    badgeText: "text-pink-300",
    lat: -14.116667,
    lon: -72.245000,
    radio: 100
  }
};

// Cargar personalizaciones guardadas de sedes si existen
try {
  const customSedesStr = localStorage.getItem("PAOLO_ALDEA_SEDES_CUSTOM");
  if (customSedesStr) {
    const custom = JSON.parse(customSedesStr);
    Object.keys(custom).forEach(k => {
      if (SEDES_CONFIG[k]) {
        SEDES_CONFIG[k] = { ...SEDES_CONFIG[k], ...custom[k] };
      }
    });
  }
} catch (e) {}

window.SEDES_CONFIG = SEDES_CONFIG;

window.renderSedeBadge = function(sedeKey) {
  const norm = window.db ? window.db.normalizeSede(sedeKey) : (sedeKey || "challhuahuacho");
  const cfg = (window.SEDES_CONFIG && window.SEDES_CONFIG[norm]) ? window.SEDES_CONFIG[norm] : {
    codigo: "CHL",
    nombreCorto: "Challhuahuacho",
    badgeBg: "bg-pink-950/80",
    badgeBorder: "border-pink-500/40",
    badgeText: "text-pink-300"
  };
  return `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${cfg.badgeBg} ${cfg.badgeText} border ${cfg.badgeBorder}" title="${cfg.nombreCorto}">
    <i class="fa-solid fa-location-dot text-[8px]"></i> ${cfg.nombreCorto}
  </span>`;
};

const DEFAULT_SETTINGS = {
  firmName: "PAOLO ALDEA & ABOGADOS",
  firmBranch: "Sede Challhuahuacho - Cotabambas, Apurímac",
  managingAttorney: "Dr. Paolo Aldea Quincho",
  firmLicense: "CAL / CAA - Registro Profesional",
  adminOfficer: "Ing. Yimer Damián Soto",
  adminTitle: "Ingeniería Industrial",
  userPhoto: "",
  firmAddress: "Av. Los Mineros Mz. D Lt. 4, Challhuahuacho, Cotabambas - Apurímac",
  firmPhone: "+51 943 410 215 / Central Challhuahuacho",
  currency: "S/",
  currencyName: "Soles (PEN)",
  pushTopic: "aldea_aldea_challhuahuacho",
  pushAutoSend: false,
  pushAnonymize: true,
  telegramToken: "",
  telegramChatId: "",
  adminUser: "",
  adminPasswordHash: "",
  bossPasswordHash: "",
  requireLogin: true,
  authBootstrapped: false,
  directorioMeetUrl: "https://meet.google.com/paolo-aldea-jur",
  // Parámetros de Geolocalización y Control de Asistencia (Geofencing)
  oficinaLat: -14.116667,
  oficinaLon: -72.245000,
  oficinaRadioMetros: 100,
  oficinaNombre: "Sede Central Challhuahuacho - Cotabambas",
  geofenceEnabled: true,
  toleranciaMinutosTardanza: 15,
  diasLaborables: "Lunes a Viernes",
  horaEntradaDefecto: "07:00",
  horaSalidaDefecto: "20:00",
  masterPasswordHash: "",
  masterPinHash: "",
  cloudSyncEndpoint: "https://cznxzrwhogyobpqmfxnk.supabase.co",
  cloudSyncApiKey: "",
  cloudSyncAuto: true,
  firebaseConfig: {
    projectId: "paolo-aldea-juridico-3c5cb",
    authDomain: "paolo-aldea-juridico-3c5cb.firebaseapp.com",
    storageBucket: "paolo-aldea-juridico-3c5cb.appspot.com",
    apiKey: ""
  }
};

const DEMO_CAJA_CHICA = [];
const DEMO_CASOS = [];
const DEMO_CITAS = [];
const DEMO_INVENTARIO = [];
const DEMO_DOCUMENTOS = [];
const DEMO_PRESUPUESTOS = [];
const DEMO_ATTENDANCE = [];

/** Hashes SHA-256 históricos publicados en versiones anteriores — se revocan en migración. */
const REVOKED_LEGACY_SECRET_HASHES = new Set([
  "d9fa2472ffaa2fbb086d70bc76ec5a6bcbe372b66236b2b7371ee389e782b3d3",
  "3a7bd2fa14ef97b5e4785fcba724ebf5d22fb74bb32a6774e502c5ee151d3840",
  "cfd06587c478ecbe546a39d892ee90b8f10667f70b4a44b1c8f855bc93766624",
  "21cedfef481c0e0cc8aa08897ca0232f065269c8a2ad607f79e9f019f0808fb8"
]);

/** Borrón y cuenta nueva: sin usuarios ni credenciales preinstaladas. */
const SYSTEM_WORKERS = [];
const DEMO_WORKERS = [];

const INITIAL_CAJA_CHICA = [];
const INITIAL_CASOS = [];
const INITIAL_CITAS = [];
const INITIAL_INVENTARIO = [];
const INITIAL_DOCUMENTOS = [];
const INITIAL_PRESUPUESTOS = [];
const INITIAL_WORKERS = DEMO_WORKERS;
const INITIAL_ATTENDANCE = [];


/**
 * Capa de Abstracción de Almacenamiento Seguro (SafeStorageAdapter)
 * Semana 4: IndexedDB es la fuente de verdad; localStorage es espejo/cache con debounce.
 * Detección y auto-reparación de corrupción JSON; stubs cuando supera cuota.
 */
class SafeStorageAdapter {
  constructor(prefix = "PAOLO ALDEA_PAOLO_ALDEA_") {
    this.prefix = prefix;
    this.dbName = "PaoloAldeaJuridicoDB_v2";
    this.dbVersion = 3;
    this.storeName = "collections";
    this.idb = null;
    this.memoryCache = new Map();
    this.pendingQueue = [];
    /** @type {"indexeddb"|"localStorage"} */
    this.primaryStore = "indexeddb";
    this._lsMirrorTimers = new Map();
    this._lsMirrorDelayMs = 180;
    this._crossTabRefreshTimer = null;
    this._legacyDbNames = ["PaoloAldeaJuridicoDB", "PaoloAldeaJuridicoDB_v1"];
    this.readyPromise = new Promise((resolve) => {
      this._resolveReady = resolve;
    });
    this.initIndexedDB();
    this.setupCrossTabCacheSync();
    this.purgeLegacyIndexedDB();
  }

  /**
   * Elimina bases IndexedDB antiguas (auditoría: purge no borraba v2 / nombres viejos).
   */
  purgeLegacyIndexedDB() {
    if (typeof window === "undefined" || !window.indexedDB || !window.indexedDB.deleteDatabase) return;
    this._legacyDbNames.forEach((name) => {
      try {
        window.indexedDB.deleteDatabase(name);
      } catch (_) {}
    });
  }

  /**
   * Sincroniza la caché en memoria entre pestañas (evento storage) con debounce.
   */
  setupCrossTabCacheSync() {
    if (typeof window === "undefined") return;
    window.addEventListener("storage", (e) => {
      if (!e.key || !e.key.startsWith(this.prefix) || e.key.endsWith("_BACKUP")) return;
      const collectionKey = e.key.substring(this.prefix.length);
      if (!e.newValue) {
        this.memoryCache.delete(collectionKey);
        return;
      }
      try {
        const parsed = JSON.parse(e.newValue);
        if (parsed && !parsed._storedInIndexedDB) {
          this.memoryCache.set(collectionKey, parsed);
        } else if (parsed && parsed._storedInIndexedDB) {
          // Stub: otra pestaña escribió en IDB; rehidratar esa clave
          this._rehydrateKeyFromIdb(collectionKey);
        }
        clearTimeout(this._crossTabRefreshTimer);
        this._crossTabRefreshTimer = setTimeout(() => {
          if (window.app && typeof window.app.refreshCurrentModuleView === "function") {
            window.app.refreshCurrentModuleView();
          }
        }, 250);
      } catch (_) {}
    });
  }

  _rehydrateKeyFromIdb(key) {
    if (!this.idb) return;
    try {
      const tx = this.idb.transaction(this.storeName, "readonly");
      const req = tx.objectStore(this.storeName).get(key);
      req.onsuccess = () => {
        const rec = req.result;
        if (rec && rec.data !== undefined) {
          this.memoryCache.set(key, rec.data);
        }
      };
    } catch (_) {}
  }

  clearAll() {
    this.memoryCache.clear();
    const defaultCollections = ["caja_chica", "casos", "citas", "inventario", "documentos", "presupuestos", "workers", "attendance"];
    defaultCollections.forEach(col => {
      try {
        localStorage.removeItem(this.prefix + col);
        localStorage.removeItem(this.prefix + col + "_BACKUP");
      } catch (_) {}
    });
    if (this.idb) {
      try {
        const tx = this.idb.transaction(this.storeName, "readwrite");
        tx.objectStore(this.storeName).clear();
      } catch (_) {}
    }
  }

  initIndexedDB() {
    if (typeof window === "undefined" || !window.indexedDB) {
      console.info("SafeStorageAdapter: IndexedDB no disponible, operando en modo memoria y LocalStorage.");
      if (this._resolveReady) this._resolveReady(false);
      return;
    }
    try {
      const request = window.indexedDB.open(this.dbName, this.dbVersion);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: "key" });
        }
      };
      request.onsuccess = (e) => {
        this.idb = e.target.result;
        if (this.pendingQueue.length > 0) {
          const queue = [...this.pendingQueue];
          this.pendingQueue = [];
          queue.forEach(item => this.mirrorToIndexedDB(item.key, item.data));
        }
        this.hydrateFromIndexedDB().finally(() => {
          if (this._resolveReady) this._resolveReady(true);
        });
      };
      request.onerror = (e) => {
        console.warn("SafeStorageAdapter: Error de acceso a IndexedDB:", e);
        if (this._resolveReady) this._resolveReady(false);
      };
    } catch (err) {
      console.warn("SafeStorageAdapter: Fallo al abrir IndexedDB:", err);
      if (this._resolveReady) this._resolveReady(false);
    }
  }

  mirrorToIndexedDB(key, data) {
    if (!this.idb) {
      this.pendingQueue.push({ key, data });
      return;
    }
    try {
      const tx = this.idb.transaction(this.storeName, "readwrite");
      const store = tx.objectStore(this.storeName);
      store.put({ key: key, data: data, updatedAt: Date.now() });
    } catch (err) {
      console.warn("SafeStorageAdapter: Error al sincronizar con IndexedDB:", err);
    }
  }

  async hydrateFromIndexedDB() {
    if (!this.idb) return;
    return new Promise((resolve) => {
      try {
        const tx = this.idb.transaction(this.storeName, "readonly");
        const store = tx.objectStore(this.storeName);
        const req = store.getAll();
        req.onsuccess = () => {
          const results = req.result || [];
          if (results.length > 0) {
            // IndexedDB es primario: siempre gana sobre el espejo localStorage
            results.forEach(rec => {
              if (rec && rec.key && rec.data !== undefined) {
                this.memoryCache.set(rec.key, rec.data);
                this._scheduleLocalStorageMirror(rec.key, rec.data, true);
              }
            });
          } else {
            // Migración inicial: LocalStorage → IndexedDB
            const defaultCollections = ["caja_chica", "casos", "citas", "inventario", "documentos", "presupuestos", "workers", "attendance", "settings"];
            defaultCollections.forEach(col => {
              try {
                const raw = localStorage.getItem(this.prefix + col);
                if (raw) {
                  const parsed = JSON.parse(raw);
                  if (parsed && !parsed._storedInIndexedDB) {
                    this.mirrorToIndexedDB(col, parsed);
                    this.memoryCache.set(col, parsed);
                  }
                }
              } catch (e) {}
            });
          }
          try {
            localStorage.setItem(this.prefix + "_STORAGE_PRIMARY", "indexeddb");
          } catch (_) {}
          resolve();
        };
        req.onerror = () => resolve();
      } catch (err) {
        console.warn("SafeStorageAdapter: Error en hidratación IndexedDB:", err);
        resolve();
      }
    });
  }

  /**
   * Espejo localStorage con debounce. Colecciones grandes → stub cuando IDB está activo.
   */
  _scheduleLocalStorageMirror(key, items, forceStub = false) {
    if (typeof localStorage === "undefined") return;
    const prev = this._lsMirrorTimers.get(key);
    if (prev) clearTimeout(prev);
    const timer = setTimeout(() => {
      this._lsMirrorTimers.delete(key);
      this._writeLocalStorageMirror(key, items, forceStub);
    }, this._lsMirrorDelayMs);
    this._lsMirrorTimers.set(key, timer);
  }

  _writeLocalStorageMirror(key, items, forceStub = false) {
    const fullKey = this.prefix + key;
    const backupKey = fullKey + "_BACKUP";
    const SMALL_KEYS = new Set(["settings"]);
    try {
      const jsonStr = JSON.stringify(items);
      const preferStub = forceStub || (this.idb && !SMALL_KEYS.has(key) && jsonStr.length >= 48000);
      if (preferStub) {
        localStorage.setItem(fullKey, JSON.stringify({
          _storedInIndexedDB: true,
          primary: "indexeddb",
          count: Array.isArray(items) ? items.length : 1,
          updatedAt: Date.now()
        }));
        try { localStorage.removeItem(backupKey); } catch (_) {}
        return true;
      }
      localStorage.setItem(fullKey, jsonStr);
      if (!this.idb || jsonStr.length < 120000) {
        localStorage.setItem(backupKey, jsonStr);
      } else {
        try { localStorage.removeItem(backupKey); } catch (_) {}
      }
      return true;
    } catch (e) {
      if (e.name === "QuotaExceededError" || e.code === 22) {
        console.warn(`SafeStorageAdapter: Cuota LocalStorage superada para '${key}'. Datos en IndexedDB.`);
        try {
          localStorage.removeItem(backupKey);
          localStorage.setItem(fullKey, JSON.stringify({
            _storedInIndexedDB: true,
            primary: "indexeddb",
            count: Array.isArray(items) ? items.length : 1,
            updatedAt: Date.now()
          }));
        } catch (_) {}
        return true;
      }
      return false;
    }
  }

  save(key, items) {
    // 1. RAM inmediata
    this.memoryCache.set(key, items);

    // 2. IndexedDB = fuente de verdad (inmediato)
    this.mirrorToIndexedDB(key, items);

    // 3. localStorage espejo diferido (reduce thrash cross-tab y cuota)
    this._scheduleLocalStorageMirror(key, items, false);
    return true;
  }

  load(key, fallback = []) {
    // 1. Memoria (hidratada desde IndexedDB al arrancar)
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key);
    }

    const fullKey = this.prefix + key;
    const backupKey = fullKey + "_BACKUP";

    // 2. LocalStorage (solo si no es stub de IDB)
    try {
      const raw = localStorage.getItem(fullKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && !parsed._storedInIndexedDB) {
          this.memoryCache.set(key, parsed);
          if (this.idb) this.mirrorToIndexedDB(key, parsed);
          return parsed;
        }
        if (parsed && parsed._storedInIndexedDB) {
          this._rehydrateKeyFromIdb(key);
        }
      }
    } catch (e) {
      console.warn(`SafeStorageAdapter: Error de lectura LocalStorage (${key}):`, e);
    }

    // 3. Backup localStorage
    try {
      const rawBackup = localStorage.getItem(backupKey);
      if (rawBackup) {
        const recovered = JSON.parse(rawBackup);
        if (recovered && !recovered._storedInIndexedDB) {
          this.memoryCache.set(key, recovered);
          return recovered;
        }
      }
    } catch (e) {}

    this.memoryCache.set(key, fallback);
    return fallback;
  }

  async checkHealth() {
    return {
      indexedDBActive: !!this.idb,
      primaryStore: this.idb ? "indexeddb" : "localStorage",
      dbName: this.dbName,
      dbVersion: this.dbVersion,
      cachedKeysCount: this.memoryCache.size,
      cachedKeys: Array.from(this.memoryCache.keys()),
      localStoragePrefix: this.prefix
    };
  }

  pruneOldCaches() {
    try {
      sessionStorage.clear();
    } catch (e) {}
  }
}


class DataManager {
  ready() {
    return this.storage ? this.storage.readyPromise : Promise.resolve(true);
  }

  async checkStorageHealth() {
    const health = this.storage ? await this.storage.checkHealth() : { error: "No storage adapter" };
    const collections = ["caja_chica", "casos", "citas", "inventario", "documentos", "presupuestos", "attendance", "workers"];
    const stats = {};
    collections.forEach(col => {
      const items = this.getRaw(col);
      stats[col] = Array.isArray(items) ? items.length : (items ? 1 : 0);
    });
    return {
      ...health,
      collectionsStats: stats,
      activeUser: this.getCurrentUser(),
      activeSede: this.getActiveSede(),
      timestamp: new Date().toISOString()
    };
  }

  constructor() {
    this.STORAGE_KEY_PREFIX = "PAOLO ALDEA_PAOLO_ALDEA_";
    this.storage = new SafeStorageAdapter(this.STORAGE_KEY_PREFIX);
    this.init();
  }

  init() {
    // Garantía absoluta de inicio en Modo Producción Cero Kilómetros (Sin registros de prueba)
    const ZERO_KM_PROD_KEY = 'PAOLO_ALDEA_ROOT_MASTER_CLEAN_2026_V2';
    if (!localStorage.getItem(this.STORAGE_KEY_PREFIX + ZERO_KM_PROD_KEY)) {
      this.clearAllOperationalData(true);
      localStorage.setItem(this.STORAGE_KEY_PREFIX + ZERO_KM_PROD_KEY, 'true');
    }
    // Flag de inicialización limpia
    const CLEAN_KEY = "PROD_CLEAN_DATABASE_V3_100_PERCENT_EMPTY";
    if (!localStorage.getItem(this.STORAGE_KEY_PREFIX + CLEAN_KEY)) {
      // Blindaje de contingencia: solo purgar datos si no existen causas u operaciones activas
      const existingCasos = this.getRaw("casos");
      const existingCaja = this.getRaw("caja_chica");
      if ((!existingCasos || existingCasos.length === 0) && (!existingCaja || existingCaja.length === 0)) {
        this.clearAllOperationalData(true);
      }
      localStorage.setItem(this.STORAGE_KEY_PREFIX + CLEAN_KEY, "true");
    }

    if (!localStorage.getItem(this.STORAGE_KEY_PREFIX + "settings")) {
      localStorage.setItem(this.STORAGE_KEY_PREFIX + "settings", JSON.stringify(DEFAULT_SETTINGS));
    }
    if (!localStorage.getItem(this.STORAGE_KEY_PREFIX + "caja_chica")) {
      localStorage.setItem(this.STORAGE_KEY_PREFIX + "caja_chica", JSON.stringify([]));
    }
    if (!localStorage.getItem(this.STORAGE_KEY_PREFIX + "casos")) {
      localStorage.setItem(this.STORAGE_KEY_PREFIX + "casos", JSON.stringify([]));
    }
    if (!localStorage.getItem(this.STORAGE_KEY_PREFIX + "citas")) {
      localStorage.setItem(this.STORAGE_KEY_PREFIX + "citas", JSON.stringify([]));
    }
    if (!localStorage.getItem(this.STORAGE_KEY_PREFIX + "inventario")) {
      localStorage.setItem(this.STORAGE_KEY_PREFIX + "inventario", JSON.stringify([]));
    }
    if (!localStorage.getItem(this.STORAGE_KEY_PREFIX + "documentos")) {
      localStorage.setItem(this.STORAGE_KEY_PREFIX + "documentos", JSON.stringify([]));
    }
    if (!localStorage.getItem(this.STORAGE_KEY_PREFIX + "presupuestos")) {
      localStorage.setItem(this.STORAGE_KEY_PREFIX + "presupuestos", JSON.stringify([]));
    }
    if (!localStorage.getItem(this.STORAGE_KEY_PREFIX + "workers")) {
      localStorage.setItem(this.STORAGE_KEY_PREFIX + "workers", JSON.stringify([]));
    }
    if (!localStorage.getItem(this.STORAGE_KEY_PREFIX + "attendance")) {
      localStorage.setItem(this.STORAGE_KEY_PREFIX + "attendance", JSON.stringify(DEMO_ATTENDANCE));
    }

    // Auto-migración y saneamiento multi-sede
    this.migrateMultiSede();
    this.enforceCredentialCleanSlate();
  }

  // Vacía todas las colecciones operativas para uso real personal
  clearAllOperationalData(force = false) {
    if (!force && !this.isSuperAdmin()) {
      return this._denyAccess("sistema", "delete", null, "Solo el Super Administrador puede vaciar los datos operativos.");
    }
    if (!force) {
      this.logAudit("VACIAR_DATOS", "sistema", "-", "El Super Administrador vacio todas las tablas operativas (la bitacora se conserva).", null, null);
    }
    const prevFlag = this._isMergingSync;
    this._isMergingSync = true;
    try {
      if (this.storage && typeof this.storage.clearAll === "function") {
        this.storage.clearAll();
      }
      this.save("caja_chica", []);
      this.save("casos", []);
      this.save("citas", []);
      this.save("inventario", []);
      this.save("documentos", []);
      this.save("presupuestos", []);
      this.save("attendance", []);
      this.save("workers", []);
    } finally {
      this._isMergingSync = prevFlag;
    }
  }

  /** True si aún no existe ningún usuario con credencial usable (instalación virgen o post-borrón). */
  needsAuthBootstrap() {
    const settings = this.getSettings() || {};
    if (settings.authBootstrapped === true) {
      const workers = this.getRaw("workers") || [];
      const hasCred = workers.some(w => w && w.activo !== false && (w.passwordHash || w.pinHash));
      return !hasCred;
    }
    const workers = this.getRaw("workers") || [];
    return !workers.some(w => w && w.activo !== false && (w.passwordHash || w.pinHash));
  }

  /** Elimina password/pin en claro y revoca hashes publicados en el código fuente. */
  sanitizeWorkerCredentials(worker) {
    if (!worker || typeof worker !== "object") return worker;
    const cleaned = { ...worker };
    delete cleaned.password;
    delete cleaned.pin;
    delete cleaned.clave;
    delete cleaned.passwordPlain;
    delete cleaned.pinPlain;
    if (cleaned.passwordHash && REVOKED_LEGACY_SECRET_HASHES.has(String(cleaned.passwordHash))) {
      cleaned.passwordHash = "";
    }
    if (cleaned.pinHash && REVOKED_LEGACY_SECRET_HASHES.has(String(cleaned.pinHash))) {
      cleaned.pinHash = "";
    }
    return cleaned;
  }

  /** Migración única: borra secretos en claro, revoca hashes legacy y deja el sistema listo para bootstrap. */
  enforceCredentialCleanSlate() {
    const FLAG = "AUTH_CLEAN_SLATE_NO_DEFAULTS_V1";
    if (localStorage.getItem(this.STORAGE_KEY_PREFIX + FLAG) === "true") return;
    const prevFlag = this._isMergingSync;
    this._isMergingSync = true;
    try {
      const workers = (this.getRaw("workers") || []).map(w => this.sanitizeWorkerCredentials(w));
      this.save("workers", workers);

      const s = { ...this.getSettings() };
      for (const k of ["adminPasswordHash", "masterPasswordHash", "bossPasswordHash", "masterPinHash"]) {
        if (s[k] && REVOKED_LEGACY_SECRET_HASHES.has(String(s[k]))) s[k] = "";
      }
      delete s.adminPassword;
      delete s.masterPassword;
      delete s.bossPassword;
      delete s.masterPin;
      const hasUsableCred = workers.some(w => w && w.activo !== false && w.passwordHash);
      s.authBootstrapped = !!hasUsableCred;
      if (!hasUsableCred) {
        s.adminUser = s.adminUser || "";
        s.adminPasswordHash = "";
        s.masterPasswordHash = "";
        s.bossPasswordHash = "";
      }
      this.saveSettings(s);
    } finally {
      this._isMergingSync = prevFlag;
      localStorage.setItem(this.STORAGE_KEY_PREFIX + FLAG, "true");
    }
  }

  // Sistema configurado en Modo Producción Cero Kilómetros (Sin datos de ejemplo)
  loadDemoExamples() {
    console.info("[DataManager] Modo Producción Activo: La carga de datos de ejemplo está desactivada permanentemente.");
  }

  loadDemoData() {
    this.loadDemoExamples();
  }

  migratePresupuestosIds(items) {
    if (!Array.isArray(items) || items.length === 0) return items;
    let modified = false;
    items.forEach((item, idx) => {
      if (!item.id || item.id.startsWith("PRE-") || !item.id.startsWith("CH-")) {
        const detected = typeof detectCentroCostoAndPcge === "function" ? detectCentroCostoAndPcge(item) : { centroCosto: "CC-LIT", clasePcge: "63" };
        const num = item.correlativo || (item.id && /^PRE-(\d+)$/.test(item.id) ? parseInt(item.id.replace("PRE-", ""), 10) : idx + 1);
        item.centroCosto = item.centroCosto || detected.centroCosto;
        item.clasePcge = item.clasePcge || detected.clasePcge;
        item.correlativo = num;
        item.id = `CH-${item.centroCosto}-${item.clasePcge}-${String(num).padStart(3, "0")}`;
        modified = true;
      }
    });
    if (modified) {
      this._persist("presupuestos", items);
    }
    return items;
  }

  // Migración automática para asegurar campo 'sede' en cada colección y colaboradores de las 5 sedes
  migrateMultiSede() {
    const collections = ["caja_chica", "casos", "citas", "inventario", "documentos", "presupuestos", "attendance", "workers"];
    collections.forEach(col => {
      try {
        const raw = localStorage.getItem(this.STORAGE_KEY_PREFIX + col);
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list) && list.length > 0) {
            let modified = false;
            list.forEach(item => {
              if (item && !item.sede) {
                item.sede = this.normalizeSede(item.sedeId || "challhuahuacho");
                modified = true;
              }
            });
            if (modified) {
              localStorage.setItem(this.STORAGE_KEY_PREFIX + col, JSON.stringify(list));
            }
          }
        }
      } catch (e) {
        console.warn(`Error en saneamiento multi-sede de ${col}:`, e);
      }
    });

    // Ya no se re-siembran usuarios ni hashes por defecto: el bootstrap crea el primer Super Admin
    try {
      const rawWorkers = localStorage.getItem(this.STORAGE_KEY_PREFIX + 'workers');
      if (!rawWorkers) {
        localStorage.setItem(this.STORAGE_KEY_PREFIX + 'workers', JSON.stringify([]));
      }
    } catch (e) {}

    // Limpieza única garantizada de ejemplos para iniciar en blanco total
    const PURGE_KEY = 'PAOLO_ALDEA_PURGED_CLEAN_2026_EMPTY_PRODUCTION_V3';
    if (!localStorage.getItem(this.STORAGE_KEY_PREFIX + PURGE_KEY)) {
      const existingCasos = this.getRaw('casos');
      const existingCaja = this.getRaw('caja_chica');
      if ((!existingCasos || existingCasos.length === 0) && (!existingCaja || existingCaja.length === 0)) {
        this.clearAllOperationalData(true);
      }
      localStorage.setItem(this.STORAGE_KEY_PREFIX + PURGE_KEY, 'true');
    }

    // Sembrar auditoría inicial si está vacía
    try {
      const currentAudit = this.getRaw('auditoria');
      if (!currentAudit) {
        this.save('auditoria', []);
      }
    } catch(e) {}
  }

  // =========================================================================
  // GESTIÓN DE SEGURIDAD Y CONTROL DE ACCESO MULTI-SEDE (RBAC)
  // =========================================================================
  normalizeRole(rawRole) {
    const r = String(rawRole || "").toLowerCase().trim();
    if (r === "super_admin" || r === "superadmin" || r === "super admin" || r === "root" || r === "master" || r === "super") {
      return "super_admin";
    }
    if (r === "socio" || r === "socio_principal" || r === "socio principal" || r === "director" || r === "socia") {
      return "socio";
    }
    if (r === "admin" || r === "administrador" || r === "administradora" || r === "jefe" || r === "gerente") {
      return "admin";
    }
    if (r === "abogado" || r === "abogada" || r === "asociado" || r === "asociada" || r === "litigante" || r === "abogado litigante asociado") {
      return "abogado";
    }
    if (r === "asistente_admin" || r === "asistente administrativo" || r === "administrativo" || r === "asistente_administrativo") {
      return "asistente_admin";
    }
    return "asistente_legal";
  }

  getUserRole(user = null) {
    const u = user || this.getCurrentUser();
    return this.normalizeRole(u?.rol);
  }

  isSuperAdmin(user = null) {
    const u = user || this.getCurrentUser();
    if (!u) return false;
    // Solo el rol super_admin verificado o la cuenta raiz WRK-000. Nunca por nombre, DNI ni alias.
    return this.getUserRole(u) === "super_admin" || u.id === "WRK-000";
  }

  getRoleLabel(role) {
    const cat = this.getRoleCategorySlug(role);
    if (cat === "super_admin") return "Super Administrador";
    if (cat === "socio") return "Socio Principal / Titular";
    if (cat === "admin") return "Administrador de Sede";
    if (cat === "abogado") return "Abogado Asociado / Líder de Caso";
    if (cat === "asistente_legal") return "Asistente Legal / Practicante";
    if (cat === "asistente_admin") return "Personal Administrativo / Recepción";
    return "Abogado Asociado / Líder de Caso";
  }

  getRoleCategorySlug(role) {
    const r = String(role || "").toLowerCase().trim();
    if (r === "super_admin" || r === "superadmin" || r === "super admin" || r === "root" || r === "master" || r === "super") {
      return "super_admin";
    }
    if (r === "socio" || r.includes("socio") || r.includes("director") || r.includes("principal")) {
      return "socio";
    }
    if (r === "admin" || r.includes("administrador") || r.includes("jefe") || r.includes("gerente")) {
      return "admin";
    }
    if (r === "abogado" || r.includes("abogad") || r.includes("litigante") || r.includes("asociad") || r.includes("lider") || r.includes("líder")) {
      return "abogado";
    }
    if (r === "asistente_legal" || r.includes("legal") || r.includes("practicante") || r.includes("bachiller") || r.includes("sec. notarial")) {
      return "asistente_legal";
    }
    if (r === "asistente_admin" || r === "colaborador" || r.includes("recepcion") || r.includes("recepción") || r.includes("logistica") || r.includes("logística") || r.includes("asistente")) {
      return "asistente_admin";
    }
    return "asistente_legal";
  }

  getDefaultPermissionsForRole(role) {
    const cat = this.getRoleCategorySlug(role);
    if (cat === "super_admin") {
      return {
        kpis: { read: true, create: true, update: true, delete: true, export: true },
        casos: { read: true, create: true, update: true, delete: true, export: true },
        caja_chica: { read: true, create: true, update: true, delete: true, export: true },
        presupuestos: { read: true, create: true, update: true, delete: true, export: true },
        citas: { read: true, create: true, update: true, delete: true, export: true },
        asistencia: { read: true, create: true, update: true, delete: true, export: true },
        documentos: { read: true, create: true, update: true, delete: true, export: true },
        personal: { read: true, create: true, update: true, delete: true, export: true },
        inventario: { read: true, create: true, update: true, delete: true, export: true },
        master_admin: { read: true, create: true, update: true, delete: true, export: true },
        configuracion: { read: true, create: true, update: true, delete: true, export: true }
      };
    }
    if (cat === "socio") {
      return {
        kpis: { read: true, create: true, update: true, delete: true, export: true },
        casos: { read: true, create: true, update: true, delete: true, export: true },
        caja_chica: { read: true, create: true, update: true, delete: true, export: true },
        presupuestos: { read: true, create: true, update: true, delete: true, export: true },
        citas: { read: true, create: true, update: true, delete: true, export: true },
        asistencia: { read: true, create: true, update: true, delete: true, export: true },
        documentos: { read: true, create: true, update: true, delete: true, export: true },
        personal: { read: true, create: true, update: true, delete: true, export: true },
        inventario: { read: true, create: true, update: true, delete: true, export: true },
        master_admin: { read: false, create: false, update: false, delete: false, export: false },
        configuracion: { read: false, create: false, update: false, delete: false, export: false }
      };
    }
    if (cat === "admin") {
      return {
        kpis: { read: true, create: true, update: true, delete: false, export: true },
        casos: { read: true, create: true, update: true, delete: false, export: true },
        caja_chica: { read: true, create: true, update: true, delete: true, export: true },
        presupuestos: { read: true, create: true, update: true, delete: false, export: true },
        citas: { read: true, create: true, update: true, delete: false, export: true },
        asistencia: { read: true, create: true, update: true, delete: true, export: true },
        documentos: { read: true, create: true, update: true, delete: false, export: true },
        personal: { read: true, create: true, update: true, delete: false, export: true },
        inventario: { read: true, create: true, update: true, delete: true, export: true },
        master_admin: { read: false, create: false, update: false, delete: false, export: false },
        configuracion: { read: false, create: false, update: false, delete: false, export: false }
      };
    }
    if (cat === "abogado") {
      return {
        kpis: { read: true, create: true, update: true, delete: false, export: true },
        casos: { read: true, create: true, update: true, delete: false, export: true },
        caja_chica: { read: true, create: false, update: false, delete: false, export: false },
        presupuestos: { read: true, create: false, update: false, delete: false, export: false },
        citas: { read: true, create: true, update: true, delete: false, export: true },
        asistencia: { read: true, create: true, update: false, delete: false, export: false },
        documentos: { read: true, create: true, update: true, delete: false, export: true },
        personal: { read: true, create: false, update: false, delete: false, export: false },
        inventario: { read: true, create: false, update: false, delete: false, export: false },
        master_admin: { read: false, create: false, update: false, delete: false, export: false },
        configuracion: { read: false, create: false, update: false, delete: false, export: false }
      };
    }
    if (cat === "asistente_legal") {
      return {
        kpis: { read: false, create: false, update: false, delete: false, export: false },
        casos: { read: true, create: true, update: true, delete: false, export: false },
        caja_chica: { read: false, create: false, update: false, delete: false, export: false },
        presupuestos: { read: false, create: false, update: false, delete: false, export: false },
        citas: { read: true, create: true, update: true, delete: false, export: false },
        asistencia: { read: true, create: true, update: false, delete: false, export: false },
        documentos: { read: true, create: true, update: false, delete: false, export: true },
        personal: { read: true, create: false, update: false, delete: false, export: false },
        inventario: { read: false, create: false, update: false, delete: false, export: false },
        master_admin: { read: false, create: false, update: false, delete: false, export: false },
        configuracion: { read: false, create: false, update: false, delete: false, export: false }
      };
    }
    // asistente_admin / recepcion
    return {
      kpis: { read: false, create: false, update: false, delete: false, export: false },
      casos: { read: true, create: false, update: false, delete: false, export: false },
      caja_chica: { read: true, create: true, update: true, delete: false, export: true },
      presupuestos: { read: true, create: true, update: false, delete: false, export: false },
      citas: { read: true, create: true, update: true, delete: false, export: false },
      asistencia: { read: true, create: true, update: true, delete: false, export: true },
      documentos: { read: true, create: true, update: false, delete: false, export: false },
      personal: { read: true, create: false, update: false, delete: false, export: false },
      inventario: { read: true, create: true, update: true, delete: false, export: true },
      master_admin: { read: false, create: false, update: false, delete: false, export: false },
      configuracion: { read: false, create: false, update: false, delete: false, export: false }
    };
  }

  getRoleBadge(role) {
    const norm = this.normalizeRole(role);
    if (norm === "super_admin") {
      return `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-amber-500/30 via-red-500/20 to-amber-500/30 text-amber-300 border border-amber-400 shadow-sm"><i class="fa-solid fa-crown text-[9px] text-amber-400 animate-pulse"></i> Super Admin</span>`;
    }
    if (norm === "socio") {
      return `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm"><i class="fa-solid fa-user-tie text-[9px] text-amber-400"></i> Socio Principal</span>`;
    }
    if (norm === "admin") {
      return `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/50 shadow-sm"><i class="fa-solid fa-shield-halved text-[9px] text-purple-400"></i> Administrador</span>`;
    }
    if (norm === "abogado") {
      return `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/50 shadow-sm"><i class="fa-solid fa-scale-balanced text-[9px] text-blue-400"></i> Abogado Litigante</span>`;
    }
    if (norm === "asistente_admin") {
      return `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/50 shadow-sm"><i class="fa-solid fa-calculator text-[9px] text-teal-400"></i> Asistente Admin</span>`;
    }
    return `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm"><i class="fa-solid fa-book-bookmark text-[9px] text-emerald-400"></i> Asistente Legal</span>`;
  }

  canAccessModule(user, moduleName) {
    const role = this.getUserRole(user);

    // 1. REGLA CRÍTICA DE GOBIERNO Y CIBERSEGURIDAD:
    // El Control Total ('master_admin', 'configuracion', 'roles_permisos') es EXCLUSIVO del Super Admin.
    if (moduleName === "master_admin" || moduleName === "configuracion" || moduleName === "roles_permisos") {
      return role === "super_admin" || this.isSuperAdmin(user);
    }

    // 2. El Super Administrador tiene acceso total e irrestricto
    if (role === "super_admin" || this.isSuperAdmin(user)) {
      return true;
    }

    // 3. MATRIZ DINÁMICA DE PERMISOS POR ROL (GOBIERNO CENTRAL)
    // Las modificaciones realizadas en el Panel Master se aplican inmediatamente
    if (typeof this.getModulesConfig === "function") {
      const modules = this.getModulesConfig();
      const modConfig = modules.find(m => m.id === moduleName);
      if (modConfig) {
        if (modConfig.enabled === false) return false;
        if (Array.isArray(modConfig.rolesAllowed)) {
          // Si el rol no está en la matriz permitida, se bloquea el acceso en tiempo real
          if (!modConfig.rolesAllowed.includes(role)) {
            if (role === "admin" || role === "socio") {
              return modConfig.rolesAllowed.includes("admin") || modConfig.rolesAllowed.includes("socio");
            }
            return false;
          }
        }
      }
    }

    // 4. Autoridad unica: permisos propios del usuario o matriz por rol (misma logica que la capa de datos)
    return this.canDo(user, "read", moduleName);
  }

  /** Modulo RBAC asociado a cada coleccion de datos (null = sin control por modulo). */
  _collectionModule(collectionName) {
    return ({
      casos: "casos", caja_chica: "caja_chica", presupuestos: "presupuestos", citas: "citas",
      documentos: "documentos", inventario: "inventario", workers: "personal", attendance: "asistencia"
    })[collectionName] || null;
  }

  /**
   * Autoridad unica de permisos: ¿puede el usuario realizar 'action' (read|create|update|delete|export) en el modulo?
   * super_admin/WRK-000: todo. Modulos de gobierno: solo super_admin. Resto: permisos del usuario o matriz por rol.
   */
  canDo(user, action, moduleName) {
    const u = user || this.getCurrentUser();
    if (!u) return false;
    const role = this.getUserRole(u);
    if (role === "super_admin" || u.id === "WRK-000") return true;
    if (moduleName === "master_admin" || moduleName === "configuracion" || moduleName === "roles_permisos") return false;
    // El Gobierno Central (Panel Master) puede deshabilitar un modulo o limitar los roles que lo usan
    if (typeof this.getModulesConfig === "function") {
      const modConfig = this.getModulesConfig().find(m => m.id === moduleName);
      if (modConfig) {
        if (modConfig.enabled === false) return false;
        if (Array.isArray(modConfig.rolesAllowed) && !modConfig.rolesAllowed.includes(role)) {
          const adminLike = (role === "admin" || role === "socio") && (modConfig.rolesAllowed.includes("admin") || modConfig.rolesAllowed.includes("socio"));
          if (!adminLike) return false;
        }
      }
    }
    const own = u.permisos && u.permisos[moduleName];
    const defaults = this.getDefaultPermissionsForRole(role)[moduleName];
    // Los permisos propios nunca pueden superar a la matriz del rol en acciones destructivas
    if (own && typeof own[action] === "boolean") {
      if (own[action] && (action === "delete") && !(defaults && defaults[action])) return false;
      return own[action];
    }
    return !!(defaults && defaults[action]);
  }

  hasPermission(user, action, moduleName = null) {
    const u = user || this.getCurrentUser();
    if (!u) return false;
    const role = this.getUserRole(u);
    if (role === "super_admin" || u.id === "WRK-000") return true;
    if (moduleName === "master_admin" || moduleName === "configuracion" || moduleName === "roles_permisos") return false;
    if (moduleName && ["read", "create", "update", "delete", "export"].includes(action)) {
      return this.canDo(u, action, moduleName);
    }
    const actionMap = {
      view_casos: ["casos", "read"], create_caso: ["casos", "create"], edit_caso: ["casos", "update"],
      delete_caso: ["casos", "delete"], export_casos: ["casos", "export"],
      view_caja: ["caja_chica", "read"], add_caja: ["caja_chica", "create"], edit_caja: ["caja_chica", "update"], delete_caja: ["caja_chica", "delete"],
      view_citas: ["citas", "read"], create_cita: ["citas", "create"], edit_cita: ["citas", "update"], delete_cita: ["citas", "delete"],
      view_docs: ["documentos", "read"], upload_doc: ["documentos", "create"], delete_doc: ["documentos", "delete"],
      view_inventario: ["inventario", "read"], add_inventario: ["inventario", "create"],
      view_personal: ["personal", "read"], punch_attendance: ["asistencia", "create"]
    };
    if (actionMap[action]) return this.canDo(u, actionMap[action][1], actionMap[action][0]);
    return false;
  }

  _denyAccess(collectionName, action, id, reason) {
    const msg = reason || ("Acceso denegado: su rol no permite '" + action + "' en " + collectionName + ".");
    console.error(msg);
    try { this.logAudit("DENEGADO", collectionName, id || "-", msg, null, { action }); } catch (e) {}
    if (typeof window !== "undefined" && window.app && typeof window.app.showToast === "function") {
      window.app.showToast(msg, "error");
    }
    return false;
  }

  /** Verificacion RBAC por operacion individual (add/update/delete). true = permitido. */
  _rbacCheck(collectionName, action, id = null) {
    if (collectionName === "auditoria") {
      return action === "create" ? true : this._denyAccess(collectionName, action, id, "La bitacora de auditoria es inmutable: no se puede editar ni eliminar.");
    }
    const mod = this._collectionModule(collectionName);
    if (!mod) return true;
    const user = this.getCurrentUser();
    if (!user) return true; // arranque/seed sin sesion
    if (this.canDo(user, action, mod)) return true;
    if (collectionName === "workers" && action === "update" && id && user.id === id) return true; // perfil propio (campos privilegiados se filtran)
    return this._denyAccess(collectionName, action, id);
  }

  /** Guardia para escrituras masivas (save): calcula diferencias y exige permiso por tipo de cambio y sede. */
  _rbacGuardSave(collectionName, items) {
    if (this._isMergingSync || this._trusted) return true;
    const user = this.getCurrentUser();
    if (!user || !Array.isArray(items)) return true;
    const old = this.getRaw(collectionName);
    if (!Array.isArray(old)) return true;

    if (collectionName === "auditoria") {
      const ids = new Set(items.map(i => i && i.id));
      if (old.some(o => o && !ids.has(o.id))) return this._denyAccess(collectionName, "delete", null, "La bitacora de auditoria es inmutable.");
      return true;
    }
    const mod = this._collectionModule(collectionName);
    if (!mod) return true;
    if (this.isSuperAdmin(user)) return true;

    const oldMap = new Map(old.map(o => [o && o.id, o]));
    const newMap = new Map(items.map(o => [o && o.id, o]));
    const isGlobal = this.isGlobalAdmin(user);
    const mySede = this.normalizeSede(user.sede);
    const sedeOk = (rec) => isGlobal || this.normalizeSede(rec.sede || rec.sedeId) === mySede;

    for (const [id, o] of oldMap) {
      if (!newMap.has(id)) {
        if (!this.canDo(user, "delete", mod) || !sedeOk(o)) return this._denyAccess(collectionName, "delete", id);
      }
    }
    for (const [id, n] of newMap) {
      if (!oldMap.has(id)) {
        if (!this.canDo(user, "create", mod) || !sedeOk(n)) return this._denyAccess(collectionName, "create", id);
      } else if (JSON.stringify(oldMap.get(id)) !== JSON.stringify(n)) {
        const own = collectionName === "workers" && id === user.id;
        if (own) {
          const o = oldMap.get(id);
          if (["rol", "permisos", "sede", "activo"].some(k => JSON.stringify(o[k]) !== JSON.stringify(n[k])) && !this.canDo(user, "update", mod)) {
            return this._denyAccess(collectionName, "update", id, "No puede modificar su propio rol, sede ni permisos.");
          }
          continue;
        }
        if (!this.canDo(user, "update", mod) || !sedeOk(oldMap.get(id))) return this._denyAccess(collectionName, "update", id);
      }
    }
    return true;
  }

  getCurrentUser() {
    // 1. Verificación obligatoria de sesión activa autenticada
    const isLoggedIn = sessionStorage.getItem("PAOLO ALDEA_AUTH_LOGGED_IN") === "true" ||
                       localStorage.getItem("PAOLO ALDEA_AUTH_LOGGED_IN") === "true";
    if (!isLoggedIn) {
      return null;
    }

    let candidate = null;
    try {
      const stored = sessionStorage.getItem("PAOLO ALDEA_AUTH_USER_OBJ") || localStorage.getItem("PAOLO ALDEA_AUTH_USER_OBJ");
      if (stored) candidate = JSON.parse(stored);
    } catch (e) {}

    // Verificación criptográfica de firma de sesión (Previene escalada por manipulación de localStorage en DevTools)
    const storedSig = sessionStorage.getItem("PAOLO ALDEA_AUTH_SIG") || localStorage.getItem("PAOLO ALDEA_AUTH_SIG");
    const testId = candidate?.id || (candidate?.rol === "super_admin" ? "WRK-000" : null) || "WRK-ANON";
    const testRole = candidate?.rol || "asistente";
    const expectedSig = this._sessionSig(testId, testRole);
    if (!storedSig || storedSig !== expectedSig) {
      return null;
    }

    const workers = this.getRaw("workers") || [];
    const sessionUserStr = (sessionStorage.getItem("PAOLO ALDEA_AUTH_USER") || localStorage.getItem("PAOLO ALDEA_AUTH_USER") || "").trim();

    // 2. Resolución estricta contra la nómina: el rol/sede siempre salen de workers[], nunca del objeto de sesión
    const candidateId = candidate?.id || candidate?.dni || candidate?.usuario || sessionUserStr;
    if (candidateId) {
      const idLower = String(candidateId).toLowerCase().trim();
      const verified = workers.find(w =>
        (w.id && w.id.toLowerCase() === idLower) ||
        (w.dni && w.dni.toLowerCase() === idLower) ||
        (w.usuario && w.usuario.toLowerCase() === idLower) ||
        (w.nombre && w.nombre.toLowerCase().trim() === idLower) ||
        (w.email && w.email.toLowerCase().trim() === idLower)
      );

      if (verified && verified.activo !== false && (verified.passwordHash || verified.pinHash)) {
        return {
          id: verified.id,
          dni: verified.dni,
          nombre: verified.nombre,
          cargo: verified.cargo,
          rol: this.normalizeRole(verified.rol),
          sede: this.normalizeSede(verified.sede),
          email: verified.email,
          usuario: verified.usuario || verified.dni,
          username: verified.usuario || verified.nombre,
          foto: candidate?.foto || verified.foto || "",
          permisos: verified.permisos || null
        };
      }
    }

    // 3. Sesión inválida o sin credencial registrada → revocar
    return null;
  }

  /** Firma de sesion: SHA-256(id:rol:secreto-aleatorio-de-la-instalacion). El secreto nunca viaja en el codigo. */
  _sessionSig(id, role) {
    let pepper = localStorage.getItem("PA_SESSION_PEPPER");
    if (!pepper) {
      const rnd = crypto.getRandomValues(new Uint8Array(32));
      pepper = Array.from(rnd, b => b.toString(16).padStart(2, "0")).join("");
      localStorage.setItem("PA_SESSION_PEPPER", pepper);
    }
    return "AUTH_SIG_" + window.sha256Sync(id + ":" + role + ":" + pepper).slice(0, 40);
  }

  setCurrentUser(userObj) {
    if (userObj) {
      if (userObj.sede) userObj.sede = this.normalizeSede(userObj.sede);
      if (userObj.rol) userObj.rol = this.normalizeRole(userObj.rol);
      const serialized = JSON.stringify(userObj);
      const displayName = userObj.nombre || userObj.username || userObj.usuario || "Usuario";
      sessionStorage.setItem("PAOLO ALDEA_AUTH_USER_OBJ", serialized);
      sessionStorage.setItem("PAOLO ALDEA_AUTH_USER", displayName);
      localStorage.setItem("PAOLO ALDEA_AUTH_USER_OBJ", serialized);
      localStorage.setItem("PAOLO ALDEA_AUTH_USER", displayName);

      // Generar y almacenar firma criptográfica de sesión
      const authSig = this._sessionSig(userObj.id || "WRK-000", userObj.rol || "asistente");
      sessionStorage.setItem("PAOLO ALDEA_AUTH_SIG", authSig);
      localStorage.setItem("PAOLO ALDEA_AUTH_SIG", authSig);

      // Si es colaborador regular, su sede activa queda estrictamente forzada a su sede asignada
      if (!this.isGlobalAdmin(userObj)) {
        sessionStorage.setItem("PAOLO ALDEA_ACTIVE_SEDE", userObj.sede);
        localStorage.setItem("PAOLO ALDEA_ACTIVE_SEDE", userObj.sede);
      }
    } else {
      sessionStorage.removeItem("PAOLO ALDEA_AUTH_USER_OBJ");
      sessionStorage.removeItem("PAOLO ALDEA_AUTH_USER");
      sessionStorage.removeItem("PAOLO ALDEA_AUTH_SIG");
      localStorage.removeItem("PAOLO ALDEA_AUTH_USER_OBJ");
      localStorage.removeItem("PAOLO ALDEA_AUTH_USER");
      localStorage.removeItem("PAOLO ALDEA_AUTH_SIG");
    }
  }

  isGlobalAdmin(user = null) {
    const u = user || this.getCurrentUser();
    if (!u) return false;
    const rol = this.getUserRole(u);
    if (rol === "super_admin" || rol === "socio" || u.id === "WRK-000") return true;
    if (rol !== "admin") return false;
    const sede = this.normalizeSede(u.sede);
    return sede === "todas" || sede === "global";
  }

  normalizeSede(raw) {
    if (!raw) return "challhuahuacho";
    const s = String(raw).toLowerCase().trim();
    if (s === "todas" || s === "global" || s === "all" || s === "consolidado") return "todas";
    if (s.includes("miraflor")) return "miraflores";
    if (s.includes("abancay")) return "abancay";
    if (s.includes("cusco") || s.includes("cuzco")) return "cusco";
    if (s.includes("huaraz")) return "huaraz";
    if (s.includes("challhua") || s.includes("cotabamba") || s.includes("chalhua")) return "challhuahuacho";
    return "challhuahuacho";
  }

  getActiveSede() {
    const user = this.getCurrentUser();
    // RESTRICCIÓN ESTRICTA DE SEGURIDAD:
    // El trabajador regular NUNCA puede consultar ni alternar a otra sede
    if (!user) return this.normalizeSede(null); // sin sesion: sede por defecto, sin acceso global
    if (!this.isGlobalAdmin(user)) {
      return this.normalizeSede(user.sede);
    }
    const stored = sessionStorage.getItem("PAOLO ALDEA_ACTIVE_SEDE") || localStorage.getItem("PAOLO ALDEA_ACTIVE_SEDE");
    return stored ? this.normalizeSede(stored) : "todas";
  }

  setActiveSede(sedeId) {
    const user = this.getCurrentUser();
    if (!this.isGlobalAdmin(user)) {
      console.warn("Intento denegado: El colaborador no cuenta con permisos de Administrador Global para cambiar de sede.");
      return false;
    }
    const normalized = this.normalizeSede(sedeId);
    sessionStorage.setItem("PAOLO ALDEA_ACTIVE_SEDE", normalized);
    localStorage.setItem("PAOLO ALDEA_ACTIVE_SEDE", normalized);
    return true;
  }

  getRaw(collectionName) {
    try {
      const data = this.storage ? this.storage.load(collectionName, []) : JSON.parse(localStorage.getItem(this.STORAGE_KEY_PREFIX + collectionName) || "[]");
      if (!data) return [];
      if (collectionName === "presupuestos" && Array.isArray(data)) {
        return this.migratePresupuestosIds(data);
      }
      return data;
    } catch (e) {
      console.error(`Error loading raw collection ${collectionName}:`, e);
      return [];
    }
  }

  get(collectionName, bypassSedeFilter = false) {
    const raw = this.getRaw(collectionName);
    if (!Array.isArray(raw)) return raw;
    if (bypassSedeFilter) return raw;

    const activeSede = this.getActiveSede();
    const user = this.getCurrentUser();
    const isGlobal = this.isGlobalAdmin(user);

    // Si es administrador global y seleccionó 'todas', ve el consolidado general
    if (isGlobal && activeSede === "todas") {
      return raw;
    }

    // Filtrado transparente y automático por la sede activa o sede asignada al colaborador
    return raw.filter(item => {
      if (!item) return false;
      const itemSede = this.normalizeSede(item.sede || item.sedeId);
      if (collectionName === "workers" && itemSede === "todas") return true;
      return itemSede === activeSede;
    });
  }

  setRaw(collectionName, items) { return this.save(collectionName, items); }
  saveRaw(collectionName, items) {
    return this.save(collectionName, items);
  }

  save(collectionName, items) {
    if (!this._rbacGuardSave(collectionName, items)) return false;
    return this._persist(collectionName, items);
  }

  _persist(collectionName, items) {
    try {
      let ok = true;
      if (this.storage) {
        ok = this.storage.save(collectionName, items);
      } else {
        localStorage.setItem(this.STORAGE_KEY_PREFIX + collectionName, JSON.stringify(items));
      }

      // Sincronizacion instantanea multi-sede al agregar, editar o eliminar (Supabase / Hub Local + Firebase Firestore Delta O(Δ))
      if (!this._isMergingSync && collectionName !== 'auditoria' && typeof window !== 'undefined') {
        if (!this._dirtyCollections) this._dirtyCollections = new Set();
        this._dirtyCollections.add(collectionName);
        clearTimeout(this._cloudSyncDebounce);
        this._cloudSyncDebounce = setTimeout(async () => {
          const colsToSync = Array.from(this._dirtyCollections || []);
          this._dirtyCollections.clear();

          if (window.app && typeof window.app.sincronizarConNube === 'function') {
            window.app.sincronizarConNube(true);
          }
          if (window.firebaseService && typeof window.firebaseService.hasCredentials === 'function' && window.firebaseService.hasCredentials()) {
            if (typeof window.firebaseService.syncCollectionDelta === 'function' && colsToSync.length > 0) {
              for (const col of colsToSync) {
                await window.firebaseService.syncCollectionDelta(col).catch(err => console.warn('[Firebase DeltaSync]:', err));
              }
            } else {
              window.firebaseService.fullSync(null, true).catch(err => console.warn('[Firebase AutoSync]:', err));
            }
          }
        }, 400);
      }

      return ok;
    } catch (e) {
      console.error('Error saving collection ' + collectionName + ':', e);
      return false;
    }
  }

  add(collectionName, item) {
    if (!this._rbacCheck(collectionName, "create")) return null;
    const user = this.getCurrentUser();
    const isGlobal = this.isGlobalAdmin(user);
    const userRole = this.getUserRole(user);
    const canManageWorkers = collectionName === "workers" && (isGlobal || userRole === "admin" || userRole === "socio" || userRole === "super_admin" || this.hasPermission(user, "create", "personal"));

    // Blindaje de seguridad en inserción:
    // Un colaborador solo puede registrar información en su propia sede asignada
    if (collectionName === "workers" && canManageWorkers && item.sede) {
      item.sede = this.normalizeSede(item.sede);
    } else if (!isGlobal && !canManageWorkers) {
      item.sede = this.normalizeSede(user.sede);
    } else {
      if (!item.sede || item.sede === "todas") {
        const active = this.getActiveSede();
        item.sede = active === "todas" ? "challhuahuacho" : active;
      } else {
        item.sede = this.normalizeSede(item.sede);
      }
    }

    const nowIso = new Date().toISOString();
    if (!item.createdAt) item.createdAt = nowIso;
    item.updatedAt = nowIso;

    const list = this.getRaw(collectionName);
    list.unshift(item);
    this._persist(collectionName, list);

    if (collectionName !== "auditoria") {
      let desc = "";
      if (collectionName === "casos") desc = `Expediente: ${item.expediente || item.id} • ${item.caratula || item.cliente || ''}`;
      else if (collectionName === "caja_chica") desc = `${item.tipo || 'Gasto'}: ${item.concepto || ''} • S/ ${Number(item.monto || 0).toFixed(2)}`;
      else if (collectionName === "citas") desc = `Cita con ${item.cliente || ''} • ${item.motivo || ''} (${item.fechaHora || ''})`;
      else if (collectionName === "inventario") desc = `Activo: ${item.nombre || item.item || ''} (${item.categoria || ''})`;
      else if (collectionName === "documentos") desc = `Documento: ${item.titulo || item.nombre || item.id}`;
      else if (collectionName === "presupuestos") desc = `Partida: ${item.nombre || item.id} • S/ ${Number(item.montoPresupuestado || 0).toFixed(2)}`;
      else if (collectionName === "workers") desc = `Colaborador: ${item.nombre || ''} (${item.cargo || item.rol || ''})`;
      else desc = `Nuevo registro creado en ${collectionName} (${item.id || '-'})`;

      this.logAudit("CREAR", collectionName, item.id, desc, item.sede, { item });
    }

    return item;
  }

  update(collectionName, id, updatedFields) {
    if (!this._rbacCheck(collectionName, "update", id)) return null;
    if (collectionName === "workers") {
      const _cu = this.getCurrentUser();
      if (_cu && !this.canDo(_cu, "update", "personal")) {
        // Perfil propio: se eliminan campos privilegiados (anti-escalada)
        updatedFields = { ...updatedFields };
        ["rol", "permisos", "sede", "activo", "id"].forEach(k => delete updatedFields[k]);
      }
    }
    const user = this.getCurrentUser();
    const isGlobal = this.isGlobalAdmin(user);
    const userRole = this.getUserRole(user);
    const canManageWorkers = collectionName === "workers" && (isGlobal || userRole === "admin" || userRole === "socio" || userRole === "super_admin" || this.hasPermission(user, "update", "personal") || (user && user.id === id));
    const list = this.getRaw(collectionName);
    const index = list.findIndex(i => i.id === id);
    if (index === -1) return null;

    const currentItem = list[index];
    const currentItemSede = this.normalizeSede(currentItem.sede || currentItem.sedeId);

    // RESTRICCIÓN DE SEGURIDAD: Bloquear edición entre distintas sedes
    if (!isGlobal && !canManageWorkers && currentItemSede !== this.normalizeSede(user.sede)) {
      console.error("Acceso denegado: No tiene permisos para modificar registros de otra sede.");
      return null;
    }

    if (!isGlobal && !canManageWorkers) {
      updatedFields.sede = currentItemSede; // No puede reasignar sede
    } else if (updatedFields.sede) {
      updatedFields.sede = this.normalizeSede(updatedFields.sede);
    }

    updatedFields.updatedAt = new Date().toISOString();
    const changedKeys = Object.keys(updatedFields).filter(k => k !== "id" && k !== "updatedAt" && updatedFields[k] !== currentItem[k]);
    list[index] = { ...list[index], ...updatedFields };
    this._persist(collectionName, list);

    if (collectionName !== "auditoria") {
      let desc = `Campos modificados: ${changedKeys.join(", ") || "datos generales"}`;
      if (collectionName === "casos") desc += ` (Exp. ${list[index].expediente || id})`;
      else if (collectionName === "caja_chica") desc += ` (${list[index].concepto || id} - S/ ${Number(list[index].monto || 0).toFixed(2)})`;
      else if (collectionName === "citas") desc += ` (Cliente: ${list[index].cliente || id})`;
      
      this.logAudit("EDITAR", collectionName, id, desc, list[index].sede || currentItemSede, {
        camposModificados: changedKeys,
        updatedFields
      });
    }

    return list[index];
  }

  delete(collectionName, id) {
    if (!this._rbacCheck(collectionName, "delete", id)) return false;
    const user = this.getCurrentUser();
    const isGlobal = this.isGlobalAdmin(user);
    const userRole = this.getUserRole(user);
    const canManageWorkers = collectionName === "workers" && (isGlobal || userRole === "admin" || userRole === "socio" || userRole === "super_admin" || this.hasPermission(user, "delete", "personal"));
    let list = this.getRaw(collectionName);
    const index = list.findIndex(i => i.id === id);
    if (index === -1) return false;

    const currentItem = list[index];
    const currentItemSede = this.normalizeSede(currentItem.sede || currentItem.sedeId);

    // RESTRICCIÓN DE SEGURIDAD: Bloquear eliminación en otra sede
    if (!isGlobal && !canManageWorkers && currentItemSede !== this.normalizeSede(user.sede)) {
      console.error("Acceso denegado: No tiene permisos para eliminar registros de otra sede.");
      return false;
    }

    this._recordTombstone(collectionName, id);
    list.splice(index, 1);
    this._persist(collectionName, list);

    if (collectionName !== "auditoria") {
      let desc = `Registro eliminado con ID ${id}`;
      if (collectionName === "casos") desc = `Expediente eliminado: ${currentItem.expediente || id} (${currentItem.caratula || currentItem.cliente || ''})`;
      else if (collectionName === "caja_chica") desc = `Gasto/Ingreso eliminado: ${currentItem.concepto || id} (S/ ${Number(currentItem.monto || 0).toFixed(2)})`;
      else if (collectionName === "citas") desc = `Cita cancelada/eliminada: ${currentItem.cliente || id} (${currentItem.fechaHora || ''})`;
      else if (collectionName === "inventario") desc = `Activo eliminado: ${currentItem.nombre || id}`;

      this.logAudit("ELIMINAR", collectionName, id, desc, currentItemSede, { deletedItem: currentItem });
    }

    return true;
  }

  // =========================================================================
  // MOTOR DE AUDITORÍA, HISTORIAL Y TRAZABILIDAD POR SEDE Y USUARIO
  // =========================================================================
  logAudit(action, collectionName, recordId, details = "", sede = null, metadata = null) {
    try {
      const user = this.getCurrentUser() || {
        id: "SISTEMA",
        nombre: "Sistema (sin sesion)",
        rol: "sistema",
        sede: "challhuahuacho"
      };

      const auditList = this.getRaw("auditoria") || [];
      const auditEntry = {
        id: "AUD-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4).toUpperCase(),
        timestamp: new Date().toISOString(),
        accion: action, // "CREAR", "EDITAR", "ELIMINAR"
        modulo: collectionName,
        registroId: String(recordId || "-"),
        sede: this.normalizeSede(sede || user.sede || this.getActiveSede()),
        usuarioId: user.id || user.dni || "WRK-000",
        usuarioNombre: user.nombre || user.usuario || user.username || "Super Administrador",
        usuarioRol: user.rol || "admin",
        detalles: details || `${action} en ${collectionName} (${recordId || '-'})`,
        metadata: metadata || null
      };

      auditList.unshift(auditEntry);
      if (auditList.length > 1000) auditList.length = 1000;
      this._persist("auditoria", auditList);
      return auditEntry;
    } catch (e) {
      console.warn("Error al registrar auditoría en DataManager:", e);
      return null;
    }
  }

  addAuditLog(entry = {}) {
    return this.logAudit(
      entry.accion || "EVENTO",
      entry.modulo || "sistema",
      entry.registroId || "-",
      entry.detalles || "",
      entry.sede || null,
      entry
    );
  }

  generateInitialAuditLogs() {
    return [];
  }

  getSettings() {
    try {
      const s = localStorage.getItem(this.STORAGE_KEY_PREFIX + "settings");
      const parsed = s ? { ...DEFAULT_SETTINGS, ...JSON.parse(s) } : { ...DEFAULT_SETTINGS };
      // Nunca reinyectar hashes por defecto: si faltan, quedan vacíos hasta el bootstrap
      if (!parsed.adminPasswordHash) parsed.adminPasswordHash = "";
      if (!parsed.masterPasswordHash) parsed.masterPasswordHash = "";
      if (!parsed.bossPasswordHash) parsed.bossPasswordHash = "";
      if (!parsed.masterPinHash) parsed.masterPinHash = "";
      for (const k of ["adminPasswordHash", "masterPasswordHash", "bossPasswordHash", "masterPinHash"]) {
        if (parsed[k] && REVOKED_LEGACY_SECRET_HASHES.has(String(parsed[k]))) parsed[k] = "";
      }
      delete parsed.adminPassword;
      delete parsed.masterPassword;
      delete parsed.bossPassword;
      delete parsed.masterPin;
      if (parsed.firmPhone && (parsed.firmPhone.includes("984 521 890") || parsed.firmPhone.includes("984 567 890") || parsed.firmPhone.includes("421-9876"))) {
        parsed.firmPhone = "+51 943 410 215 / Central Despacho";
      }
      return parsed;
    } catch (e) {
      return { ...DEFAULT_SETTINGS };
    }
  }

  saveSettings(settings) {
    try {
      localStorage.setItem(this.STORAGE_KEY_PREFIX + "settings", JSON.stringify(settings));
      return true;
    } catch (e) {
      return false;
    }
  }

  async exportAllDataJson() {
    let pdfRecords = [];
    if (window.pdfDb) {
      try {
        const rawPdfs = await window.pdfDb.getAllPdfs();
        const blobToB64 = (b) => new Promise((resolve) => {
          if (!b || !(b instanceof Blob)) return resolve(null);
          const reader = new FileReader();
          reader.onloadend = () => {
            const res = reader.result;
            if (typeof res === "string") {
              const idx = res.indexOf(",");
              resolve(idx >= 0 ? res.substring(idx + 1) : res);
            } else {
              resolve(null);
            }
          };
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(b);
        });

        pdfRecords = await Promise.all(rawPdfs.map(async (p) => {
          const exportItem = { casoId: p.casoId };
          for (const docKey of ["resolucion", "expediente"]) {
            if (p[docKey]) {
              exportItem[docKey] = {
                name: p[docKey].name || p[docKey].fileName,
                fileName: p[docKey].fileName || p[docKey].name,
                size: p[docKey].size || 0,
                type: p[docKey].type || "application/pdf",
                savedAt: p[docKey].savedAt || new Date().toISOString()
              };
              if (p[docKey].blob instanceof Blob) {
                exportItem[docKey].base64 = await blobToB64(p[docKey].blob);
              } else if (p[docKey].dataUrl) {
                exportItem[docKey].base64 = p[docKey].dataUrl.split(",")[1] || "";
              }
            }
          }
          return exportItem;
        }));
      } catch (e) {
        console.warn("No se pudieron recopilar archivos PDF para el backup:", e);
      }
    }

    const fullBackup = {
      backupDate: new Date().toISOString(),
      backupVersion: "2026.11-enterprise-production",
      system: "PAOLO ALDEA & ASOCIADOS (Sistema Jurídico Nacional Multi-Sede)",
      settings: this.getSettings(),
      caja_chica: this.getRaw("caja_chica"),
      casos: this.getRaw("casos"),
      citas: this.getRaw("citas"),
      inventario: this.getRaw("inventario"),
      documentos: this.getRaw("documentos"),
      presupuestos: this.getRaw("presupuestos"),
      workers: this.getRaw("workers"),
      attendance: this.getRaw("attendance"),
      auditoria: this.getRaw("auditoria"),
      archivos_pdf: pdfRecords
    };
    const blob = new Blob([JSON.stringify(fullBackup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const nowStr = new Date().toISOString().slice(0, 10);
    a.download = "Respaldo_Maestro_PAOLO_ALDEA_" + nowStr + ".json";
    a.click();
    URL.revokeObjectURL(url);
    return {
      success: true,
      pdfCount: pdfRecords.length
    };
  }

  async importDataJson(jsonString) {
    return this.importAllDataJson(jsonString);
  }

  async importAllDataJson(jsonString) {
    if (!this.isSuperAdmin()) {
      return { success: false, error: "Solo el Super Administrador puede restaurar copias de seguridad." };
    }
    this._trusted = true;
    try {
      const data = JSON.parse(jsonString);
      if (!data || typeof data !== "object") throw new Error("Archivo de copia de seguridad no válido.");

      if (data.settings) this.saveSettings(data.settings);
      if (Array.isArray(data.caja_chica)) this.save("caja_chica", data.caja_chica);
      if (Array.isArray(data.casos)) this.save("casos", data.casos);
      if (Array.isArray(data.citas)) this.save("citas", data.citas);
      if (Array.isArray(data.inventario)) this.save("inventario", data.inventario);
      if (Array.isArray(data.documentos)) this.save("documentos", data.documentos);
      if (Array.isArray(data.presupuestos)) this.save("presupuestos", data.presupuestos);
      if (Array.isArray(data.workers)) this.save("workers", data.workers);
      if (Array.isArray(data.attendance)) this.save("attendance", data.attendance);
      if (Array.isArray(data.auditoria)) this.save("auditoria", data.auditoria);

      let restoredPdfCount = 0;
      if (Array.isArray(data.archivos_pdf) && data.archivos_pdf.length > 0 && window.pdfDb) {
        restoredPdfCount = await window.pdfDb.restorePdfs(data.archivos_pdf);
      }

      return { success: true, restoredPdfCount };
    } catch (e) {
      return { success: false, error: e.message };
    } finally {
      this._trusted = false;
    }
  }

  // =========================================================================
  // GESTIÓN DINÁMICA DE MÓDULOS & APARTADOS (PANEL CONTROL TOTAL SOCIO FUNDADOR)
  // =========================================================================
  getDefaultModulesConfig() {
    return [
      { id: "kpis", label: "KPIs Power BI & Procesos", icon: "fa-chart-line", iconColor: "text-amber-400", category: "Control Ejecutivo", enabled: true, isCustom: false, rolesAllowed: ["socio", "admin", "abogado"] },
      { id: "casos", label: "Casos & Expedientes", icon: "fa-gavel", iconColor: "text-blue-400", category: "Litigios & Diligencias", enabled: true, isCustom: false, rolesAllowed: ["socio", "admin", "abogado", "asistente_legal"] },
      { id: "citas", label: "Agenda Citas & Audiencias", icon: "fa-calendar-check", iconColor: "text-emerald-400", category: "Litigios & Diligencias", enabled: true, isCustom: false, rolesAllowed: ["socio", "admin", "abogado", "asistente_legal", "asistente_admin"] },
      { id: "documentos", label: "Gestión Documental", icon: "fa-file-contract", iconColor: "text-cyan-400", category: "Litigios & Diligencias", enabled: true, isCustom: false, rolesAllowed: ["socio", "admin", "abogado", "asistente_legal", "asistente_admin"] },
      { id: "personal", label: "Gestión de Personal", icon: "fa-id-card-clip", iconColor: "text-indigo-400", category: "Personal & Asistencia", enabled: true, isCustom: false, rolesAllowed: ["socio", "admin", "abogado", "asistente_legal", "asistente_admin"] },
      { id: "asistencia", label: "Control de Asistencia", icon: "fa-user-clock", iconColor: "text-amber-400", category: "Personal & Asistencia", enabled: true, isCustom: false, rolesAllowed: ["socio", "admin", "abogado", "asistente_legal", "asistente_admin"] },
      { id: "caja_chica", label: "Caja Chica & Centros de Costo", icon: "fa-cash-register", iconColor: "text-green-400", category: "Costos & Almacén Sede", enabled: true, isCustom: false, rolesAllowed: ["socio", "admin", "asistente_admin", "abogado"] },
      { id: "presupuestos", label: "Presupuestos & Proyecciones", icon: "fa-file-invoice-dollar", iconColor: "text-amber-500", category: "Costos & Almacén Sede", enabled: true, isCustom: false, rolesAllowed: ["socio", "admin"] },
      { id: "inventario", label: "Inventario ABC & Archivo", icon: "fa-boxes-packing", iconColor: "text-orange-400", category: "Costos & Almacén Sede", enabled: true, isCustom: false, rolesAllowed: ["socio", "admin", "asistente_admin"] },
      { id: "configuracion", label: "Ajustes & Respaldo Local", icon: "fa-sliders", iconColor: "text-slate-400", category: "Administración", enabled: true, isCustom: false, rolesAllowed: ["socio", "admin"] }
    ];
  }

  getModulesConfig() {
    const s = this.getSettings();
    if (s.modulesConfig && Array.isArray(s.modulesConfig) && s.modulesConfig.length > 0) {
      let modified = false;
      s.modulesConfig.forEach(m => {
        if (m && m.id === "asistencia" && m.label !== "Control de Asistencia") {
          m.label = "Control de Asistencia";
          modified = true;
        }
      });
      if (modified) {
        this.saveSettings(s);
      }
      return s.modulesConfig;
    }
    return this.getDefaultModulesConfig();
  }

  saveModulesConfig(modules) {
    const s = this.getSettings();
    s.modulesConfig = modules;
    this.saveSettings(s);
  }

  getCustomSedes() {
    const s = this.getSettings();
    return (s.customSedes && Array.isArray(s.customSedes)) ? s.customSedes : [];
  }

  saveCustomSedes(sedes) {
    const s = this.getSettings();
    s.customSedes = sedes;
    this.saveSettings(s);
    if (window.SEDES_CONFIG) {
      sedes.forEach(cs => {
        window.SEDES_CONFIG[cs.id] = cs;
      });
    }
  }

  // =========================================================================
  // MOTOR DE SINCRONIZACIÓN MULTI-SEDE (100% OPERATIVO EN RED / OFFLINE)
  // =========================================================================
    _loadTombstones() {
    try {
      const raw = localStorage.getItem("PAOLO_ALDEA_TOMBSTONES");
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }

  _recordTombstone(collectionName, id) {
    try {
      const tombstones = this._loadTombstones();
      if (!tombstones[collectionName]) tombstones[collectionName] = [];
      const strId = String(id);
      if (!tombstones[collectionName].includes(strId)) {
        tombstones[collectionName].push(strId);
        if (tombstones[collectionName].length > 500) {
          tombstones[collectionName].shift();
        }
        localStorage.setItem("PAOLO_ALDEA_TOMBSTONES", JSON.stringify(tombstones));
      }
    } catch (_) {}
  }

  exportSyncPackage(sedeKey = null) {
    const active = sedeKey || this.getActiveSede();
    const currentUser = this.getCurrentUser();
    const collections = ["caja_chica", "casos", "citas", "inventario", "documentos", "presupuestos", "attendance", "workers", "auditoria"];
    const payload = {
      protocol: "LEX_MULTI_SEDE_SYNC_V1",
      timestamp: new Date().toISOString(),
      sedeOrigen: active,
      emisor: currentUser ? (currentUser.nombre || currentUser.nombres || "Usuario") : "Sede " + active,
      data: {}
    };

    collections.forEach(col => {
      payload.data[col] = this.get(col, true) || [];
    });
    payload.deletedIds = this._loadTombstones();

    return payload;
  }

  mergeSyncPackage(pkg) {
    if (!pkg || (!pkg.data && !pkg.deletedIds)) {
      throw new Error('Paquete de sincronización no válido o dañado.');
    }

    this._isMergingSync = true;
    try {
      const collections = ['caja_chica', 'casos', 'citas', 'inventario', 'documentos', 'presupuestos', 'attendance', 'workers', 'auditoria'];
      const stats = {
        totalAdded: 0,
        totalUpdated: 0,
        totalDeleted: 0,
        details: {}
      };

      const incomingTombstones = pkg.deletedIds || {};
      const localTombstones = this._loadTombstones();

      collections.forEach(col => {
        let currentList = this.getRaw(col) || [];
        const incomingDeletions = Array.isArray(incomingTombstones[col]) ? incomingTombstones[col] : [];

        // 1. Reconciliacion de Eliminaciones en tiempo real entre sedes
        if (incomingDeletions.length > 0) {
          const toDeleteSet = new Set(incomingDeletions.map(String));
          const initialLen = currentList.length;
          currentList = currentList.filter(item => item && item.id && !toDeleteSet.has(String(item.id)));
          const deletedCount = initialLen - currentList.length;
          stats.totalDeleted += deletedCount;

          if (!localTombstones[col]) localTombstones[col] = [];
          incomingDeletions.forEach(delId => {
            if (!localTombstones[col].includes(String(delId))) {
              localTombstones[col].push(String(delId));
            }
          });
        }

        const activeTombstonesSet = new Set((localTombstones[col] || []).map(String));
        const currentMap = new Map();
        currentList.forEach((item, idx) => {
          if (item && item.id) {
            currentMap.set(String(item.id), idx);
          }
        });

        const pkgData = (pkg.data && pkg.data.data && !Array.isArray(pkg.data.workers)) ? pkg.data.data : pkg.data;
        const rawIncoming = pkgData ? pkgData[col] : null;
        const incomingList = Array.isArray(rawIncoming)
          ? rawIncoming
          : (rawIncoming && typeof rawIncoming === "object" && rawIncoming.id ? [rawIncoming] : []);
        let added = 0;
        let updated = 0;

        if (incomingList.length > 0) {
          incomingList.forEach(incomingItem => {
            if (!incomingItem || !incomingItem.id) return;
            const key = String(incomingItem.id);

            // Si el registro fue eliminado en cualquier sede, no resucitar
            if (activeTombstonesSet.has(key)) return;

            if (currentMap.has(key)) {
              const idx = currentMap.get(key);
              const existing = currentList[idx];
              const incomingTime = new Date(incomingItem.updatedAt || incomingItem.fechaModificacion || incomingItem.fecha || incomingItem.timestamp || 0).getTime();
              const existingTime = new Date(existing.updatedAt || existing.fechaModificacion || existing.fecha || existing.timestamp || 0).getTime();

              if (incomingTime >= existingTime) {
                const merged = Object.assign({}, existing, incomingItem);
                // Credenciales locales nunca se pisan con el hub (hashes no viajan a la nube)
                if (col === "workers") {
                  if (existing.passwordHash) merged.passwordHash = existing.passwordHash;
                  if (existing.pinHash) merged.pinHash = existing.pinHash;
                  delete merged.password;
                  delete merged.pin;
                  delete merged.clave;
                }
                currentList[idx] = merged;
                updated++;
              }
            } else {
              const toAdd = (col === "workers")
                ? (() => { const w = { ...incomingItem }; delete w.password; delete w.pin; delete w.clave; delete w.passwordHash; delete w.pinHash; return w; })()
                : incomingItem;
              currentList.push(toAdd);
              currentMap.set(key, currentList.length - 1);
              added++;
            }
          });
        }

        this.save(col, currentList);
        stats.totalAdded += added;
        stats.totalUpdated += updated;
        stats.details[col] = { added, updated, deleted: incomingDeletions.length };
      });

      try {
        localStorage.setItem('PAOLO_ALDEA_TOMBSTONES', JSON.stringify(localTombstones));
      } catch (_) {}

      return stats;
    } finally {
      this._isMergingSync = false;
    }
  }
}

// Instancia global del DataManager
window.db = new DataManager();

// =========================================================================
// MOTOR DE ALMACENAMIENTO LOCAL DE ARCHIVOS PDF (IndexedDB)
// =========================================================================
class PdfDatabase {
  constructor() {
    this.dbName = "PaoloAldeaPro_PdfStore";
    this.storeName = "casos_pdf";
    this.db = null;
    this.init();
  }

  init() {
    if (!window.indexedDB) return;
    try {
      const req = window.indexedDB.open(this.dbName, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: "casoId" });
        }
      };
      req.onsuccess = (e) => {
        this.db = e.target.result;
      };
    } catch (e) {
      console.warn("IndexedDB no disponible:", e);
    }
  }

  async getDb() {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const req = window.indexedDB.open(this.dbName, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: "casoId" });
        }
      };
      req.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };
      req.onerror = (e) => reject(e);
    });
  }

  dataUrlToBlob(dataUrl) {
    if (!dataUrl || typeof dataUrl !== "string") return null;
    try {
      const parts = dataUrl.split(",");
      const mime = parts[0].match(/:(.*?);/)?.[1] || "application/pdf";
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new Blob([u8arr], { type: mime });
    } catch (err) {
      console.warn("Aviso al convertir DataUrl a Blob:", err);
      return null;
    }
  }

  async savePdf(casoId, arg1, arg2) {
    let tipoDoc = "resolucion";
    let fileObj = null;
    if (typeof arg1 === "string" && (typeof arg2 === "object" || arg2 instanceof Blob)) {
      tipoDoc = arg1;
      fileObj = arg2;
    } else if (typeof arg2 === "string" && (typeof arg1 === "object" || arg1 instanceof Blob)) {
      tipoDoc = arg2;
      fileObj = arg1;
    } else {
      fileObj = arg1;
      tipoDoc = arg2 || "resolucion";
    }

    if (!fileObj) throw new Error("No se proporcionÃ³ archivo o Blob para almacenamiento.");

    let blob = null;
    let fileName = fileObj.name || fileObj.fileName || `${tipoDoc}.pdf`;
    let fileSize = fileObj.size || 0;
    let fileType = fileObj.type || "application/pdf";

    if (fileObj instanceof Blob) {
      blob = fileObj;
    } else if (fileObj.blob instanceof Blob) {
      blob = fileObj.blob;
    } else if (fileObj.dataUrl) {
      blob = this.dataUrlToBlob(fileObj.dataUrl);
    }

    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readwrite");
      const store = tx.objectStore(this.storeName);
      const getReq = store.get(casoId);
      getReq.onsuccess = () => {
        const record = getReq.result || { casoId: casoId };
        record[tipoDoc] = {
          name: fileName,
          fileName: fileName,
          size: fileSize || (blob ? blob.size : 0),
          type: fileType,
          blob: blob, // Almacenamiento directo como BLOB para cero saturaciÃ³n de V8 Heap
          savedAt: new Date().toISOString()
        };
        store.put(record);
        resolve(true);
      };
      getReq.onerror = (e) => reject(e);
    });
  }

  async getPdf(casoId, tipoDoc = "resolucion") {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readonly");
      const store = tx.objectStore(this.storeName);
      const req = store.get(casoId);
      req.onsuccess = () => {
        if (req.result && req.result[tipoDoc]) {
          const rec = req.result[tipoDoc];
          // Compatibilidad retroactiva: convertir legacy dataUrl a Blob si no existiese blob
          if (!rec.blob && rec.dataUrl) {
            rec.blob = this.dataUrlToBlob(rec.dataUrl);
          }
          resolve(rec);
        } else {
          resolve(null);
        }
      };
      req.onerror = (e) => reject(e);
    });
  }

  async deletePdf(casoId, tipoDoc) {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readwrite");
      const store = tx.objectStore(this.storeName);
      const getReq = store.get(casoId);
      getReq.onsuccess = () => {
        if (getReq.result) {
          const record = getReq.result;
          delete record[tipoDoc];
          store.put(record);
        }
        resolve(true);
      };
      getReq.onerror = (e) => reject(e);
    });
  }

  async getAllPdfs() {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readonly");
      const store = tx.objectStore(this.storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = (e) => reject(e);
    });
  }

  async restorePdfs(pdfRecords) {
    if (!Array.isArray(pdfRecords) || pdfRecords.length === 0) return 0;
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readwrite");
      const store = tx.objectStore(this.storeName);
      let count = 0;
      pdfRecords.forEach(item => {
        if (item && item.casoId) {
          const toStore = { casoId: item.casoId };
          for (const docKey of ["resolucion", "expediente"]) {
            if (item[docKey]) {
              let blob = item[docKey].blob;
              if (!(blob instanceof Blob) && item[docKey].base64) {
                blob = this.dataUrlToBlob("data:" + (item[docKey].type || "application/pdf") + ";base64," + item[docKey].base64);
              } else if (!(blob instanceof Blob) && item[docKey].dataUrl) {
                blob = this.dataUrlToBlob(item[docKey].dataUrl);
              }
              toStore[docKey] = {
                name: item[docKey].name || item[docKey].fileName || (docKey + ".pdf"),
                fileName: item[docKey].fileName || item[docKey].name || (docKey + ".pdf"),
                size: item[docKey].size || (blob ? blob.size : 0),
                type: item[docKey].type || "application/pdf",
                savedAt: item[docKey].savedAt || new Date().toISOString(),
                blob: blob
              };
            }
          }
          store.put(toStore);
          count++;
        }
      });
      tx.oncomplete = () => resolve(count);
      tx.onerror = (e) => reject(e);
    });
  }
}

// Instancia global de almacenamiento PDF en IndexedDB
window.pdfDb = new PdfDatabase();
