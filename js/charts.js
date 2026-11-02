/**
 * PAOLO ALDEA & ABOGADOS - Power BI Style KPI & Chart Engine
 * Especializado para: PAOLO ALDEA & ABOGADOS (Sede Challhuahuacho)
 * Control de Gestión Operativa & Administrativa - Enfoque Ingeniería Industrial
 */

class KpiDashboard {
  constructor() {
    this.charts = {};
    this.activeTimeFilter = "all";       // 'all' | 'month' | '30days'
    this.activeCenterFilter = "challhuahuacho"; // 'all' | 'challhuahuacho' | 'cotabambas'
  }

  init() {
    this.renderMetrics();
    this.renderCharts();
  }

  // Segmentador 1: Período de Tiempo (Acumulado Total, Este Mes, Últimos 30 Días)
  setTimeFilter(filter) {
    this.activeTimeFilter = filter;
    document.querySelectorAll(".slicer-time-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.time === filter);
    });
    this.refresh();

    const names = {
      all: "Acumulado Total (Todo el historial)",
      month: "Este Mes en curso",
      "30days": "Últimos 30 Días"
    };
    if (window.app && window.app.showToast) {
      window.app.showToast(`Filtro de período: ${names[filter] || filter}`, "info");
    }
  }

  // Segmentador 2: Centro de Control (Todos, Sede Challhuahuacho, Juzgados Cotabambas)
  setCenterFilter(center) {
    this.activeCenterFilter = center;
    document.querySelectorAll(".slicer-center-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.center === center);
    });
    this.refresh();

    const names = {
      all: "Consolidado General (Todos los Centros)",
      challhuahuacho: "Sede Challhuahuacho (Operaciones Despacho)",
      cotabambas: "Juzgados de Cotabambas / Tambobamba"
    };
    if (window.app && window.app.showToast) {
      window.app.showToast(`Centro de control: ${names[center] || center}`, "info");
    }
  }

  refresh() {
    this.renderMetrics();
    this.updateCharts();
  }

  // Lógica de filtrado por fecha
  matchTime(dateStr) {
    if (!dateStr || this.activeTimeFilter === "all") return true;
    const now = new Date();
    const itemDate = new Date(dateStr + "T00:00:00");
    if (isNaN(itemDate.getTime())) return true;

    if (this.activeTimeFilter === "month") {
      return itemDate.getFullYear() === now.getFullYear() && itemDate.getMonth() === now.getMonth();
    }
    if (this.activeTimeFilter === "30days") {
      const diffDays = (now.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays >= -2 && diffDays <= 30; // incluye días cercanos
    }
    return true;
  }

  // Lógica de filtrado por Centro de Control
  matchCenter(item, moduleType) {
    if (this.activeCenterFilter === "all") return true;
    const target = this.activeCenterFilter;

    if (moduleType === "caja") {
      const text = `${item.centroCosto || ''} ${item.concepto || ''} ${item.categoria || ''}`.toLowerCase();
      if (target === "challhuahuacho") {
        return text.includes("challhuahuacho") || text.includes("sede") || text.includes("operaciones") || text.includes("fijo") || text.includes("claro") || text.includes("internet") || text.includes("starlink") || text.includes("útiles");
      }
      if (target === "cotabambas") {
        return text.includes("cotabambas") || text.includes("tambobamba") || text.includes("procesal") || text.includes("judicial") || text.includes("arancel");
      }
    }

    if (moduleType === "casos") {
      const text = `${item.organoJurisdiccional || ''} ${item.sede || ''} ${item.expediente || ''} ${item.materia || ''}`.toLowerCase();
      if (target === "challhuahuacho") {
        return text.includes("challhuahuacho") || text.includes("sede") || !text.includes("tambobamba");
      }
      if (target === "cotabambas") {
        return text.includes("cotabambas") || text.includes("tambobamba") || text.includes("juzgado");
      }
    }

    if (moduleType === "citas") {
      const text = `${item.modalidad || ''} ${item.lugar || ''} ${item.motivo || ''}`.toLowerCase();
      if (target === "challhuahuacho") {
        return text.includes("challhuahuacho") || text.includes("sede") || text.includes("meet") || text.includes("zoom");
      }
      if (target === "cotabambas") {
        return text.includes("cotabambas") || text.includes("tambobamba") || text.includes("juzgado") || text.includes("notaría");
      }
    }

    return true;
  }

  getFilteredCaja() {
    return window.db.get("caja_chica").filter(t => this.matchTime(t.fecha) && this.matchCenter(t, "caja"));
  }

  getFilteredCasos() {
    return window.db.get("casos").filter(c => this.matchTime(c.fechaInicio) && this.matchCenter(c, "casos"));
  }

  getFilteredCitas() {
    return window.db.get("citas").filter(c => this.matchTime(c.fecha) && this.matchCenter(c, "citas"));
  }

  renderMetrics() {
    const settings = window.db.getSettings();
    const caja = this.getFilteredCaja();
    const casos = this.getFilteredCasos();
    const citas = this.getFilteredCitas();
    const inv = window.db.get("inventario");
    const docs = window.db.get("documentos");

    const curr = settings.currency || "S/";

    // 1. Métricas de Caja Chica & Costos con filtrado dinámico
    const totalIngresos = caja.filter(t => t.tipo === "Ingreso").reduce((sum, t) => sum + Number(t.monto || 0), 0);
    const totalEgresos = caja.filter(t => t.tipo === "Egreso").reduce((sum, t) => sum + Number(t.monto || 0), 0);
    const saldoNeto = totalIngresos - totalEgresos;

    // 2. Métricas de Litigios & Productividad (Ingeniería Industrial & Control Procesal)
    const totalCasos = casos.length;
    const casosTramite = casos.filter(c => {
      const e = (c.estado || "").toLowerCase();
      return e.includes("trámite") || e.includes("tramite") || e.includes("activo") || e.includes("en curso");
    }).length;

    // Casos con resolución de fondo definitiva (Ganados vs Perdidos)
    const casosGanados = casos.filter(c => {
      const e = (c.estado || "").toLowerCase();
      return e.includes("ganado") || (e.includes("concluido") && !e.includes("desfavorable") && !e.includes("perdido"));
    }).length;
    const casosPerdidos = casos.filter(c => {
      const e = (c.estado || "").toLowerCase();
      return e.includes("perdido") || e.includes("desfavorable");
    }).length;
    const casosResueltosTotal = casosGanados + casosPerdidos;

    // Tasa de éxito real: Casos Ganados sobre Casos Resueltos Definitivos
    const tasaExito = casosResueltosTotal > 0 
      ? Math.round((casosGanados / casosResueltosTotal) * 100) 
      : (totalCasos > 0 ? Math.round((casosGanados / totalCasos) * 100) : 0);
    const totalHonorarios = casos.reduce((acc, c) => acc + Number(c.honorarios || 0), 0);

    // Tiempos medios de ciclo de proceso (Lead Time dinámico basado en hitos procesales)
    const tiemposCiclo = casos.filter(c => c.fechaInicio).map(c => {
      const start = new Date(c.fechaInicio).getTime();
      const end = c.fechaFin ? new Date(c.fechaFin).getTime() : Date.now();
      const diffDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
      return diffDays;
    });
    const avgCiclo = tiemposCiclo.length > 0 ? Math.round(tiemposCiclo.reduce((a, b) => a + b, 0) / tiemposCiclo.length) : 0;

    // 3. Valorización de Inventario (Método ABC)
    const valorTotalInv = inv.reduce((sum, i) => sum + (Number(i.stock || 0) * Number(i.costoUnitario || 0)), 0);
    const itemsClaseA = inv.filter(i => (i.clasificacionABC || "").includes("Clase A")).length;

    // 4. Alertas Perentorias
    const alertData = (window.alerts && window.alerts.alerts) || {};
    const urgentCount = alertData.urgent ? alertData.urgent.length : 0;

    // Inyectar en el DOM con formato contable pulido
    const elSaldo = document.getElementById("kpiSaldoCaja");
    const elIngresos = document.getElementById("kpiTotalIngresos");
    const elEgresos = document.getElementById("kpiTotalEgresos");
    const elCasosTramite = document.getElementById("kpiCasosActivos");
    const elTasaExito = document.getElementById("kpiTasaExito");
    const elAlertas = document.getElementById("kpiAlertasFatales");
    const elCitas = document.getElementById("kpiCitasMes");
    const elHonorarios = document.getElementById("kpiCarteraHonorarios");
    const elTotalDocs = document.getElementById("kpiTotalDocs");
    const elAvgCiclo = document.getElementById("kpiAvgCiclo");
    const elValorInv = document.getElementById("kpiValorInventario");

    if (elSaldo) elSaldo.textContent = `${curr} ${saldoNeto.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (elIngresos) elIngresos.textContent = `+${curr} ${totalIngresos.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
    if (elEgresos) elEgresos.textContent = `-${curr} ${totalEgresos.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
    if (elCasosTramite) elCasosTramite.textContent = casosTramite;
    if (elTasaExito) elTasaExito.textContent = totalCasos > 0 ? `${tasaExito}% de éxito` : "Sin casos";
    if (elAlertas) elAlertas.textContent = urgentCount;
    if (elCitas) elCitas.textContent = citas.length;
    if (elHonorarios) elHonorarios.textContent = `${curr} ${totalHonorarios.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
    if (elTotalDocs) elTotalDocs.textContent = docs.length;
    if (elAvgCiclo) elAvgCiclo.textContent = avgCiclo > 0 ? `${avgCiclo} días promedio` : "N/D";
    if (elValorInv) elValorInv.textContent = `${curr} ${valorTotalInv.toLocaleString('es-PE', { minimumFractionDigits: 2 })} (${itemsClaseA} Clase A)`;
  }

  renderCharts() {
    this.createCashflowChart();
    this.createCasesByMatterChart();
    this.createCostCentersChart();
    this.createAppointmentsChart();
  }

  updateCharts() {
    this.destroyCharts();
    this.renderCharts();
  }

  destroyCharts() {
    Object.values(this.charts).forEach(c => {
      if (c && typeof c.destroy === 'function') {
        c.destroy();
      }
    });
    this.charts = {};
  }

  // Gráfico 1: Flujo Financiero Sede Challhuahuacho
  createCashflowChart() {
    const ctx = document.getElementById("chartCashflow");
    if (!ctx) return;

    const caja = this.getFilteredCaja();
    const monthsMap = {};

    caja.forEach(t => {
      const d = new Date(t.fecha + "T00:00:00");
      const monthKey = !isNaN(d.getTime()) ? d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }) : 'Actual';
      if (!monthsMap[monthKey]) {
        monthsMap[monthKey] = { ingresos: 0, egresos: 0 };
      }
      if (t.tipo === "Ingreso") {
        monthsMap[monthKey].ingresos += Number(t.monto || 0);
      } else {
        monthsMap[monthKey].egresos += Number(t.monto || 0);
      }
    });

    const labels = Object.keys(monthsMap);
    const ingresosData = labels.map(k => monthsMap[k].ingresos);
    const egresosData = labels.map(k => monthsMap[k].egresos);

    this.charts.cashflow = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels.length ? labels : ['Sin datos en período'],
        datasets: [
          {
            label: 'Ingresos / Provisiones',
            data: ingresosData.length ? ingresosData : [0],
            backgroundColor: '#059669',
            borderRadius: 6,
            barPercentage: 0.6,
          },
          {
            label: 'Egresos Operativos',
            data: egresosData.length ? egresosData : [0],
            backgroundColor: '#DC2626',
            borderRadius: 6,
            barPercentage: 0.6,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { boxWidth: 12, font: { family: "'Plus Jakarta Sans', sans-serif", size: 11, weight: '600' } }
          },
          tooltip: {
            callbacks: {
              label: (context) => ` ${context.dataset.label}: ${window.db.getSettings().currency} ${Number(context.raw).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 } } },
          y: {
            grid: { color: '#E2E8F0' },
            ticks: {
              font: { size: 10 },
              callback: (value) => `${window.db.getSettings().currency} ${value}`
            }
          }
        }
      }
    });
  }

  // Gráfico 2: Litigios por Materia Jurídica
  createCasesByMatterChart() {
    const ctx = document.getElementById("chartMatters");
    if (!ctx) return;

    const casos = this.getFilteredCasos();
    const counts = {};

    casos.forEach(c => {
      const mat = c.materia || "Otras";
      counts[mat] = (counts[mat] || 0) + 1;
    });

    const labels = Object.keys(counts);
    const data = Object.values(counts);

    const colors = [
      '#1E3A8A', // Civil / Comercial
      '#DC2626', // Penal
      '#D97706', // Laboral Minero
      '#059669', // Corporativo
      '#7C3AED', // Familia
      '#0284C7'  // Constitucional / Ambiental
    ];

    this.charts.matters = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels.length ? labels : ['Sin expedientes'],
        datasets: [{
          data: data.length ? data : [1],
          backgroundColor: colors.slice(0, Math.max(1, labels.length)),
          hoverOffset: 6,
          borderWidth: 2,
          borderColor: '#FFFFFF'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: {
            position: 'right',
            labels: {
              boxWidth: 11,
              font: { family: "'Plus Jakarta Sans', sans-serif", size: 10, weight: '500' },
              padding: 8
            }
          }
        }
      }
    });
  }

  // Gráfico 3: Egresos por Centro de Costo (Enfoque Ingeniería Industrial)
  createCostCentersChart() {
    const ctx = document.getElementById("chartExpensesCategory");
    if (!ctx) return;

    const caja = this.getFilteredCaja().filter(t => t.tipo === "Egreso");
    const costMap = {};

    caja.forEach(t => {
      const cc = t.centroCosto || t.categoria || "Gasto Operativo";
      costMap[cc] = (costMap[cc] || 0) + Number(t.monto || 0);
    });

    const sorted = Object.entries(costMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const labels = sorted.map(i => i[0]);
    const values = sorted.map(i => i[1]);

    this.charts.expenses = new Chart(ctx, {
      type: 'bar',
      indexAxis: 'y',
      data: {
        labels: labels.length ? labels : ['Sin egresos en filtro'],
        datasets: [{
          label: 'Monto Gastado (S/)',
          data: values.length ? values : [0],
          backgroundColor: '#3B82F6',
          borderRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => ` ${window.db.getSettings().currency} ${Number(context.raw).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: '#E2E8F0' },
            ticks: {
              font: { size: 10 },
              callback: (val) => `${window.db.getSettings().currency} ${val}`
            }
          },
          y: { grid: { display: false }, ticks: { font: { size: 9.5, weight: '600' } } }
        }
      }
    });
  }

  // Gráfico 4: Cumplimiento y Estado de Citas / Audiencias
  createAppointmentsChart() {
    const ctx = document.getElementById("chartAppointments");
    if (!ctx) return;

    const citas = this.getFilteredCitas();
    const states = { "Confirmada": 0, "Pendiente": 0, "Atendida": 0, "Cancelada": 0 };

    citas.forEach(c => {
      if (states[c.estado] !== undefined) {
        states[c.estado]++;
      } else {
        states["Pendiente"]++;
      }
    });

    this.charts.citas = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: Object.keys(states),
        datasets: [{
          label: 'Citas',
          data: Object.values(states),
          backgroundColor: ['#2563EB', '#F59E0B', '#10B981', '#94A3B8'],
          borderRadius: 6,
          barPercentage: 0.5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11, weight: '600' } } },
          y: {
            grid: { color: '#E2E8F0' },
            ticks: { stepSize: 1, precision: 0 }
          }
        }
      }
    });
  }
}

// Instancia global
window.kpiDashboard = new KpiDashboard();
