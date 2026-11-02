/**
 * PAOLO ALDEA & ABOGADOS - Dynamic Component & View Loader
 * Permite la carga asíncrona y modular de vistas desde views/*.html
 * con caché en memoria y resiliencia para ejecución offline/PWA.
 */

class ComponentLoader {
  constructor() {
    this.viewsCache = new Map();
    this.loadedViews = new Set();
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

    try {
      let html = this.viewsCache.get(viewId);
      if (!html) {
        const resp = await fetch(`views/view-${viewId}.html`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        html = await resp.text();
        this.viewsCache.set(viewId, html);
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
    }
    return null;
  }

  /**
   * Inyecta todos los modales desde views/view-modals.html (una sola vez).
   */
  async ensureModalsLoaded() {
    if (this._modalsLoaded || document.getElementById("modalMasterAuth")) {
      this._modalsLoaded = true;
      return true;
    }
    if (this._modalsPromise) return this._modalsPromise;

    this._modalsPromise = (async () => {
      try {
        const resp = await fetch("views/view-modals.html");
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const html = await resp.text();
        const wrap = document.createElement("div");
        wrap.innerHTML = html.trim();
        const frag = document.createDocumentFragment();
        while (wrap.firstChild) frag.appendChild(wrap.firstChild);
        document.body.appendChild(frag);
        this._modalsLoaded = true;
        return true;
      } catch (err) {
        console.warn("[ComponentLoader] No se pudieron cargar modales externos:", err);
        this._modalsPromise = null;
        return false;
      }
    })();

    return this._modalsPromise;
  }
}

// Acoplar al ámbito global
window.ComponentLoader = ComponentLoader;
window.componentLoader = new ComponentLoader();
