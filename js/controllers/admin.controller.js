/**
 * PAOLO ALDEA & ABOGADOS - Master Admin & Governance Controller
 * Controlador Especializado para el Gobierno del Despacho, Gestión Multi-Sede,
 * Matriz Granular de Permisos RBAC y Diagnóstico de Salud de la Infraestructura.
 */

class AdminController {
  constructor(appContext = null) {
    this.app = appContext || window.app;
  }

  setContext(app) {
    this.app = app;
  }

  /**
   * Catálogo Oficial de Sedes y Perímetros de Operación
   */
  getOfficialSedes() {
    return [
      { id: "challhuahuacho", nombre: "Sede Operativa Challhuahuacho (Cotabambas)", ciudad: "Challhuahuacho", departamento: "Apurímac", esMatriz: true },
      { id: "miraflores", nombre: "Sede Corporativa Miraflores (Lima)", ciudad: "Lima", departamento: "Lima", esMatriz: false },
      { id: "abancay", nombre: "Sede Departamental Abancay", ciudad: "Abancay", departamento: "Apurímac", esMatriz: false },
      { id: "cusco", nombre: "Sede Regional Cusco", ciudad: "Cusco", departamento: "Cusco", esMatriz: false },
      { id: "huaraz", nombre: "Sede Sierra Huaraz", ciudad: "Huaraz", departamento: "Áncash", esMatriz: false }
    ];
  }

  /**
   * Genera la matriz de permisos por defecto según el rol asignado
   */
  getDefaultPermissionsForRole(role) {
    const r = String(role || "").toLowerCase().trim();
    const modules = ["casos", "caja_chica", "citas", "inventario", "documentos", "presupuestos", "asistencia", "kpis"];

    if (r === "super_admin" || r === "socio") {
      const perms = {};
      modules.forEach(m => {
        perms[m] = { ver: true, crear: true, editar: true, eliminar: true, exportar: true };
      });
      return perms;
    }

    if (r === "admin") {
      const perms = {};
      modules.forEach(m => {
        perms[m] = { ver: true, crear: true, editar: true, eliminar: (m !== "asistencia"), exportar: true };
      });
      return perms;
    }

    if (r === "abogado") {
      return {
        casos: { ver: true, crear: true, editar: true, eliminar: false, exportar: true },
        caja_chica: { ver: true, crear: true, editar: false, eliminar: false, exportar: false },
        citas: { ver: true, crear: true, editar: true, eliminar: false, exportar: true },
        inventario: { ver: true, crear: false, editar: false, eliminar: false, exportar: false },
        documentos: { ver: true, crear: true, editar: true, eliminar: false, exportar: true },
        presupuestos: { ver: true, crear: false, editar: false, eliminar: false, exportar: false },
        asistencia: { ver: true, crear: true, editar: false, eliminar: false, exportar: false },
        kpis: { ver: true, crear: false, editar: false, eliminar: false, exportar: true }
      };
    }

    if (r === "asistente_admin") {
      return {
        casos: { ver: true, crear: false, editar: false, eliminar: false, exportar: false },
        caja_chica: { ver: true, crear: true, editar: true, eliminar: false, exportar: true },
        citas: { ver: true, crear: true, editar: true, eliminar: false, exportar: true },
        inventario: { ver: true, crear: true, editar: true, eliminar: false, exportar: true },
        documentos: { ver: true, crear: true, editar: false, eliminar: false, exportar: true },
        presupuestos: { ver: true, crear: true, editar: false, eliminar: false, exportar: true },
        asistencia: { ver: true, crear: true, editar: false, eliminar: false, exportar: false },
        kpis: { ver: true, crear: false, editar: false, eliminar: false, exportar: false }
      };
    }

    // Por defecto asistente_legal / practicante
    return {
      casos: { ver: true, crear: true, editar: true, eliminar: false, exportar: false },
      caja_chica: { ver: false, crear: false, editar: false, eliminar: false, exportar: false },
      citas: { ver: true, crear: true, editar: true, eliminar: false, exportar: false },
      inventario: { ver: true, crear: false, editar: false, eliminar: false, exportar: false },
      documentos: { ver: true, crear: true, editar: true, eliminar: false, exportar: false },
      presupuestos: { ver: false, crear: false, editar: false, eliminar: false, exportar: false },
      asistencia: { ver: true, crear: true, editar: false, eliminar: false, exportar: false },
      kpis: { ver: false, crear: false, editar: false, eliminar: false, exportar: false }
    };
  }

  /**
   * Consulta diagnóstica del estado de salud del servidor y almacenamiento local
   */
  async getSystemDiagnostics() {
    const localHealth = window.db ? await window.db.checkStorageHealth() : null;
    let serverHealth = { status: "offline" };

    try {
      const resp = await fetch("/api/health");
      if (resp.ok) {
        serverHealth = await resp.json();
      }
    } catch (e) {}

    return {
      timestamp: new Date().toISOString(),
      localStorage: localHealth,
      serverLocal: serverHealth,
      online: navigator.onLine,
      userAgent: navigator.userAgent
    };
  }
}

// Acoplar al ámbito global
window.AdminController = AdminController;
window.adminController = new AdminController();
