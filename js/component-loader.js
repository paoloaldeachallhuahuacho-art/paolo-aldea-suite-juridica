/**
 * PAOLO ALDEA & ABOGADOS - Dynamic Component & View Loader
 * Permite la carga asíncrona y modular de vistas desde views/*.html
 * con caché en memoria y resiliencia para ejecución offline/PWA.
 */

class ComponentLoader {
  constructor() {
    this.viewsCache = new Map();
    this.loadedViews = new Set();
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
}

// Acoplar al ámbito global
window.ComponentLoader = ComponentLoader;
window.componentLoader = new ComponentLoader();
