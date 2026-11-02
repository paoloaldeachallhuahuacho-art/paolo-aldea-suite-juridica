/**
 * PAOLO ALDEA & ABOGADOS - Inventory & Assets Controller (Ingeniería Industrial)
 * Controlador Especializado para la Gestión Patrimonial de Bienes,
 * Clasificación ABC (Enfoque Logístico Remoto Challhuahuacho / Sede Nacional),
 * Puntos de Reorden y Valorización Patrimonial.
 */

class InventoryController {
  constructor(appContext = null) {
    this.app = appContext || window.app;
  }

  setContext(app) {
    this.app = app;
  }

  /**
   * Determina o valida la clasificación ABC según criticidad operativa y valor
   * Clase A: Críticos / Alto Valor (Tokens SINOE, Modems Claro, Expedientes originales)
   * Clase B: Valor Moderado (Tratados y biblioteca jurídica)
   * Clase C: Consumibles / Alta Reposición (Papel bond membretado, tóners, sellos)
   */
  classifyABC(item, allItems = null) {
    if (!item) return "Clase C (Consumible / Reposición)";
    const cat = String(item.categoria || "").toLowerCase();
    const nombre = String(item.nombre || "").toLowerCase();
    const costo = (typeof window.parseMoney === "function") ? window.parseMoney(item.costoUnitario) : (parseFloat(item.costoUnitario) || 0);
    const stock = parseFloat(item.stock) || 1;
    const itemVal = costo * stock;

    // Criticidad operativa directa (Regla de oro de despacho jurídico)
    if (nombre.includes("token") || nombre.includes("sinoe") || nombre.includes("router") || nombre.includes("expediente original")) {
      return "Clase A (Crítico / Alto Valor)";
    }

    // Análisis Pareto Multicriterio Dinámico (Ingeniería Industrial: 80% / 15% / 5%)
    if (Array.isArray(allItems) && allItems.length > 0) {
      const totalInventoryVal = allItems.reduce((acc, it) => {
        const c = (typeof window.parseMoney === "function") ? window.parseMoney(it.costoUnitario) : (parseFloat(it.costoUnitario) || 0);
        const s = parseFloat(it.stock) || 0;
        return acc + (c * s);
      }, 0);
      if (totalInventoryVal > 0) {
        const sorted = [...allItems].map(it => {
          const c = (typeof window.parseMoney === "function") ? window.parseMoney(it.costoUnitario) : (parseFloat(it.costoUnitario) || 0);
          const s = parseFloat(it.stock) || 0;
          return { id: it.id, val: c * s };
        }).sort((a, b) => b.val - a.val);

        let cumulative = 0;
        for (const it of sorted) {
          cumulative += it.val;
          const pct = (cumulative / totalInventoryVal) * 100;
          if (it.id === item.id) {
            if (pct <= 80 || (itemVal / totalInventoryVal) >= 0.15) return "Clase A (Crítico / Alto Valor)";
            if (pct <= 95) return "Clase B (Valor Moderado)";
            return "Clase C (Consumible / Reposición)";
          }
        }
      }
    }

    if (itemVal >= 1000 || costo >= 500) {
      return "Clase A (Crítico / Alto Valor)";
    }
    if (cat.includes("biblioteca") || cat.includes("mueble") || itemVal >= 250 || costo >= 100) {
      return "Clase B (Valor Moderado)";
    }
    return "Clase C (Consumible / Reposición)";
  }

  /**
   * Cálculo de alertas de punto de reorden (Lead Time logístico Challhuahuacho - 5 días)
   */
  checkStockStatus(stock, puntoReorden) {
    const s = parseFloat(stock) || 0;
    const r = parseFloat(puntoReorden) || 0;

    if (s <= 0) {
      return {
        estado: "Agotado",
        badgeClass: "bg-rose-950/80 text-rose-300 border border-rose-500/50 font-black animate-pulse",
        requierePedido: true,
        icon: "fa-solid fa-triangle-exclamation"
      };
    }
    if (s <= r) {
      return {
        estado: "Bajo Stock",
        badgeClass: "bg-amber-950/80 text-amber-300 border border-amber-500/40 font-bold",
        requierePedido: true,
        icon: "fa-solid fa-bell"
      };
    }
    return {
      estado: "Stock Normal",
      badgeClass: "bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 font-semibold",
      requierePedido: false,
      icon: "fa-solid fa-check"
    };
  }

  /**
   * Cálculo de Valorización Patrimonial Total y por Categoría
   */
  calculateValuation(items) {
    let valorTotal = 0;
    let totalItems = 0;
    let countClaseA = 0;
    let countBajoStock = 0;
    const porCategoria = {};

    if (!Array.isArray(items)) {
      return { valorTotal: 0, totalItems: 0, countClaseA: 0, countBajoStock: 0, porCategoria: {} };
    }

    items.forEach(it => {
      if (!it) return;
      const stock = parseFloat(it.stock) || 0;
      const costo = parseFloat(it.costoUnitario) || 0;
      const subtotal = stock * costo;
      const cat = it.categoria || "Otros";

      valorTotal += subtotal;
      totalItems += stock;

      const abc = this.classifyABC(it, items);
      if (abc.includes("Clase A")) countClaseA++;

      const stockStatus = this.checkStockStatus(stock, it.puntoReorden);
      if (stockStatus.requierePedido) countBajoStock++;

      porCategoria[cat] = (porCategoria[cat] || 0) + subtotal;
    });

    return {
      valorTotal: Math.round(valorTotal * 100) / 100,
      totalItems,
      countClaseA,
      countBajoStock,
      porCategoria
    };
  }

  /**
   * Filtrado multi-criterio de inventario
   */
  filterInventory(items, searchVal = "", categoria = "ALL", clasificacion = "ALL", sede = "ALL") {
    if (!Array.isArray(items)) return [];
    const q = (searchVal || "").toLowerCase().trim();

    return items.filter(it => {
      if (!it) return false;

      if (sede !== "ALL" && sede !== "todas") {
        const itemSede = window.db ? window.db.normalizeSede(it.sede) : (it.sede || "");
        if (itemSede !== sede) return false;
      }

      if (categoria !== "ALL" && it.categoria !== categoria) return false;

      if (clasificacion !== "ALL") {
        const itemABC = this.classifyABC(it);
        if (!itemABC.includes(clasificacion)) return false;
      }

      if (q) {
        const str = [it.codigo, it.nombre, it.categoria, it.ubicacion, it.responsable].filter(Boolean).join(" ").toLowerCase();
        if (!str.includes(q)) return false;
      }

      return true;
    });
  }

  /**
   * Validación formal de datos de inventario
   */
  validateInventoryItem(data) {
    const errors = [];
    if (!data.nombre || data.nombre.trim().length < 3) {
      errors.push("El nombre o descripción del bien es obligatorio.");
    }
    if (!data.categoria) {
      errors.push("Debe seleccionar una categoría patrimonial.");
    }
    if (isNaN(data.stock) || parseInt(data.stock, 10) < 0) {
      errors.push("El stock debe ser un número entero mayor o igual a cero.");
    }
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Acoplar al ámbito global
window.InventoryController = InventoryController;
window.inventoryController = new InventoryController();
