/**
 * PAOLO ALDEA & ABOGADOS - Dynamic Component & View Loader
 * Permite la carga asíncrona y modular de vistas desde views/*.html
 * con caché en memoria y resiliencia para ejecución offline/PWA.
 */

class ComponentLoader {
  constructor() {
    this.viewsCache = new Map();
    this.loadedViews = new Set();
    this._inflightViews = new Map();
    this._modalsLoaded = false;
    this._modalsPromise = null;
  }

  /**
   * Verifica si una vista ya existe en el DOM
   */
  isViewMounted(viewId) {
    return !!document.getElementById("view-" + viewId);
  }

  /**
   * Carga una vista modular de forma dinámica si no está presente en el DOM
   */
  async ensureViewLoaded(viewId, containerSelector = "main") {
    const fullId = "view-" + viewId;
    const existing = document.getElementById(fullId);
    if (existing) {
      this.loadedViews.add(viewId);
      return existing;
    }

    if (this._inflightViews.has(viewId)) {
      return this._inflightViews.get(viewId);
    }

    const job = (async () => {
      try {
        // Re-check after await race
        const again = document.getElementById(fullId);
        if (again) {
          this.loadedViews.add(viewId);
          return again;
        }

        let html = this.viewsCache.get(viewId);
        if (!html) {
          const resp = await fetch(`views/view-${viewId}.html`);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          html = await resp.text();
          this.viewsCache.set(viewId, html);
        }

        const still = document.getElementById(fullId);
        if (still) {
          this.loadedViews.add(viewId);
          return still;
        }

        const container = document.querySelector(containerSelector) || document.body;
        const tempWrapper = document.createElement("div");
        tempWrapper.innerHTML = html.trim();
        const newElement = tempWrapper.firstElementChild;
        if (newElement) {
          container.appendChild(newElement);
          this.loadedViews.add(viewId);
          return newElement;
        }
      } catch (err) {
        console.warn(`[ComponentLoader] No se pudo cargar vista externa para '${viewId}':`, err);
      } finally {
        this._inflightViews.delete(viewId);
      }
      return null;
    })();

    this._inflightViews.set(viewId, job);
    return job;
  }

  /**
   * Modales críticos: si falta alguno, hay que reinyectar (p. ej. SW cache parcial o DOM limpio).
   */
  _criticalModalsPresent() {
    return !!(
      document.getElementById("modalMasterAuth") &&
      document.getElementById("modalCajaChica") &&
      document.getElementById("modalFlujoCajaChica") &&
      document.getElementById("modalCaso") &&
      document.getElementById("modalPersonal")
    );
  }

  /**
   * Inyecta todos los modales desde views/view-modals.html (una sola vez, con auto-reparación).
   */
  async ensureModalsLoaded() {
    if (this._criticalModalsPresent()) {
      this._modalsLoaded = true;
      return true;
    }
    // Faltan modales críticos: invalidar caché en memoria y volver a inyectar.
    this._modalsLoaded = false;
    if (this._modalsPromise) return this._modalsPromise;

    this._modalsPromise = (async () => {
      try {
        const resp = await fetch("views/view-modals.html?v=20261103_despacho_admin", { cache: "no-store" });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const html = await resp.text();
        const wrap = document.createElement("div");
        wrap.innerHTML = html.trim();

        // Solo agregar nodos cuyo id aún no exista (evita duplicar al reparar).
        const frag = document.createDocumentFragment();
        let added = 0;
        while (wrap.firstChild) {
          const node = wrap.firstChild;
          wrap.removeChild(node);
          if (node.nodeType === 1 && node.id && document.getElementById(node.id)) {
            continue;
          }
          frag.appendChild(node);
          added += 1;
        }
        if (added) document.body.appendChild(frag);
        this._modalsLoaded = this._criticalModalsPresent();
        if (!this._modalsLoaded) {
          console.warn("[ComponentLoader] Modales críticos aún incompletos tras la inyección.");
        }
        return this._modalsLoaded;
      } catch (err) {
        console.warn("[ComponentLoader] No se pudieron cargar modales externos:", err);
        this._modalsPromise = null;
        return false;
      } finally {
        // Permitir reintento si falló la reparación.
        if (!this._modalsLoaded) this._modalsPromise = null;
      }
    })();

    return this._modalsPromise;
  }
}

// Acoplar al ámbito global
window.ComponentLoader = ComponentLoader;
window.componentLoader = new ComponentLoader();
