/**
 * KPIs Power BI — Asistencia del personal (semana / mes)
 * Solo panel Supervisión Jefes. Usa Chart.js lazy + matriz HTML.
 */
(function (global) {
  const LATE_HOUR = 9;
  const LATE_MINUTE = 15;
  const WORKDAY_START = 0; // lunes

  const state = {
    mode: "week", // week | month
    offset: 0,
    sede: "ALL",
    charts: {}
  };

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function toIsoDate(d) {
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function parseIso(iso) {
    if (!iso) return null;
    const d = new Date(String(iso).slice(0, 10) + "T12:00:00");
    return isNaN(d.getTime()) ? null : d;
  }

  function startOfWeek(base) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    const day = d.getDay(); // 0=dom
    const diff = (day === 0 ? -6 : WORKDAY_START + 1 - day);
    d.setDate(d.getDate() + diff);
    return d;
  }

  function getRange() {
    const now = new Date();
    if (state.mode === "week") {
      const start = startOfWeek(now);
      start.setDate(start.getDate() + state.offset * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { start, end, label: formatWeekLabel(start, end) };
    }
    const start = new Date(now.getFullYear(), now.getMonth() + state.offset, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + state.offset + 1, 0);
    const label = start.toLocaleDateString("es-PE", { month: "long", year: "numeric" });
    return { start, end, label: label.charAt(0).toUpperCase() + label.slice(1) };
  }

  function formatWeekLabel(start, end) {
    const opts = { day: "2-digit", month: "short" };
    return (
      "Semana " +
      start.toLocaleDateString("es-PE", opts) +
      " – " +
      end.toLocaleDateString("es-PE", opts) +
      " " +
      end.getFullYear()
    );
  }

  function eachDay(start, end) {
    const out = [];
    const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    while (cur <= last) {
      out.push(toIsoDate(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }

  function isWorkday(iso) {
    const d = parseIso(iso);
    if (!d) return false;
    const day = d.getDay();
    return day !== 0 && day !== 6;
  }

  function getRecords() {
    if (!global.db || typeof global.db.get !== "function") return [];
    const list = global.db.get("attendance");
    return Array.isArray(list) ? list : [];
  }

  function getWorkers() {
    if (!global.db || typeof global.db.get !== "function") return [];
    const list = global.db.get("workers");
    if (!Array.isArray(list)) return [];
    return list.filter((w) => w && w.activo !== false && w.activo !== "false");
  }

  function matchSede(item) {
    if (state.sede === "ALL" || state.sede === "todas") return true;
    const sede = global.db && global.db.normalizeSede
      ? global.db.normalizeSede(item.sede || item.sedeId)
      : String(item.sede || "");
    return sede === state.sede;
  }

  function inRange(iso, start, end) {
    const d = parseIso(iso);
    if (!d) return false;
    const t = d.getTime();
    return t >= start.getTime() && t <= end.getTime() + 12 * 3600 * 1000;
  }

  function isLate(ingresoIso) {
    if (!ingresoIso) return false;
    const d = new Date(ingresoIso);
    if (isNaN(d.getTime())) return false;
    const mins = d.getHours() * 60 + d.getMinutes();
    return mins > LATE_HOUR * 60 + LATE_MINUTE;
  }

  function hoursWorked(rec) {
    if (!rec || !rec.ingreso || !rec.salida) return 0;
    const a = new Date(rec.ingreso).getTime();
    const b = new Date(rec.salida).getTime();
    if (isNaN(a) || isNaN(b) || b <= a) return 0;
    let ms = b - a;
    if (rec.salidaAlmuerzo && rec.retornoAlmuerzo) {
      const s = new Date(rec.salidaAlmuerzo).getTime();
      const r = new Date(rec.retornoAlmuerzo).getTime();
      if (!isNaN(s) && !isNaN(r) && r > s) ms -= r - s;
    }
    return Math.max(0, ms / 3600000);
  }

  function modalityOf(rec) {
    const t = String(rec.tipoMarcacion || "").toLowerCase();
    if (t.includes("comision")) return "comision";
    if (t.includes("gps") || t.includes("movil") || t.includes("móvil")) return "gps";
    if (rec.enGeocerca === false) return "externa";
    return "oficina";
  }

  function aggregate() {
    const range = getRange();
    const days = eachDay(range.start, range.end);
    const workdays = days.filter(isWorkday);
    const records = getRecords().filter(
      (r) => r && matchSede(r) && inRange(r.fecha, range.start, range.end)
    );
    const workers = getWorkers().filter(matchSede);
    const expectedSlots = Math.max(1, workers.length * workdays.length);

    const presentKeys = new Set();
    let late = 0;
    let fuera = 0;
    let pendientes = 0;
    let horasSum = 0;
    let horasN = 0;
    const byDay = {};
    const byModality = { oficina: 0, gps: 0, comision: 0, externa: 0 };
    const heat = {}; // workerId -> { fecha: status }

    days.forEach((d) => {
      byDay[d] = { present: 0, late: 0, fuera: 0 };
    });

    records.forEach((r) => {
      const wid = r.workerId || r.dni || r.id;
      const key = wid + "|" + r.fecha;
      if (r.ingreso) {
        presentKeys.add(key);
        if (byDay[r.fecha]) byDay[r.fecha].present += 1;
      }
      if (isLate(r.ingreso)) {
        late += 1;
        if (byDay[r.fecha]) byDay[r.fecha].late += 1;
      }
      if (r.enGeocerca === false) {
        fuera += 1;
        if (byDay[r.fecha]) byDay[r.fecha].fuera += 1;
      }
      if (r.estadoAprobacion === "pendiente") pendientes += 1;
      const h = hoursWorked(r);
      if (h > 0) {
        horasSum += h;
        horasN += 1;
      }
      byModality[modalityOf(r)] = (byModality[modalityOf(r)] || 0) + 1;

      if (!heat[wid]) {
        heat[wid] = {
          nombre: r.nombre || wid,
          cargo: r.cargo || "",
          days: {}
        };
      }
      let status = "present";
      if (!r.ingreso) status = "absent";
      else if (isLate(r.ingreso)) status = "late";
      if (r.enGeocerca === false) status = "external";
      if (r.estadoAprobacion === "pendiente") status = "pending";
      if (r.estadoAprobacion === "rechazado") status = "rejected";
      heat[wid].days[r.fecha] = status;
    });

    // Completar heatmap con trabajadores activos sin marcaje
    workers.forEach((w) => {
      const wid = w.id || w.dni;
      if (!heat[wid]) {
        heat[wid] = { nombre: w.nombre || wid, cargo: w.cargo || "", days: {} };
      }
    });

    const present = presentKeys.size;
    const asistenciaPct = Math.round((present / expectedSlots) * 1000) / 10;
    const avgHours = horasN ? Math.round((horasSum / horasN) * 10) / 10 : 0;

    return {
      range,
      days,
      workdays,
      records,
      workers,
      metrics: {
        present,
        expectedSlots,
        asistenciaPct,
        late,
        fuera,
        pendientes,
        avgHours,
        totalMarcajes: records.length
      },
      byDay,
      byModality,
      heat
    };
  }

  function destroyCharts() {
    Object.keys(state.charts).forEach((k) => {
      try {
        if (state.charts[k] && typeof state.charts[k].destroy === "function") state.charts[k].destroy();
      } catch (_) {}
    });
    state.charts = {};
  }

  function setMetric(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function updateSlicerUi() {
    document.querySelectorAll(".att-kpi-mode-btn").forEach((btn) => {
      const active = btn.dataset.mode === state.mode;
      btn.className = active
        ? "att-kpi-mode-btn px-3 py-1.5 rounded-lg text-[11px] font-bold bg-amber-500 text-slate-950 shadow transition"
        : "att-kpi-mode-btn px-3 py-1.5 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-slate-100 transition";
    });
    const label = document.getElementById("att-kpi-period-label");
    if (label) label.textContent = getRange().label;
    const sedeSel = document.getElementById("att-kpi-sede-filter");
    if (sedeSel && sedeSel.value !== state.sede) sedeSel.value = state.sede;
  }

  async function ensureChart() {
    if (typeof global.Chart !== "undefined") return true;
    if (global.PaoloLibLoader && typeof global.PaoloLibLoader.loadChart === "function") {
      try {
        await global.PaoloLibLoader.loadChart();
      } catch (e) {
        console.warn("[AttendanceKpis] Chart.js:", e);
      }
    }
    return typeof global.Chart !== "undefined";
  }

  async function renderCharts(agg) {
    const ok = await ensureChart();
    if (!ok) return;
    destroyCharts();

    const dayLabels = agg.days.map((iso) => {
      const d = parseIso(iso);
      return d
        ? d.toLocaleDateString("es-PE", { weekday: "short", day: "2-digit" })
        : iso;
    });
    const presentData = agg.days.map((d) => (agg.byDay[d] ? agg.byDay[d].present : 0));
    const lateData = agg.days.map((d) => (agg.byDay[d] ? agg.byDay[d].late : 0));
    const fueraData = agg.days.map((d) => (agg.byDay[d] ? agg.byDay[d].fuera : 0));

    const barCtx = document.getElementById("chartAttKpiDaily");
    if (barCtx && typeof barCtx.getContext === "function") {
      state.charts.daily = new global.Chart(barCtx, {
        type: "bar",
        data: {
          labels: dayLabels,
          datasets: [
            {
              label: "Presentes",
              data: presentData,
              backgroundColor: "#059669",
              borderRadius: 4,
              barPercentage: 0.7
            },
            {
              label: "Tardeos",
              data: lateData,
              backgroundColor: "#D97706",
              borderRadius: 4,
              barPercentage: 0.7
            },
            {
              label: "Fuera geocerca",
              data: fueraData,
              backgroundColor: "#DC2626",
              borderRadius: 4,
              barPercentage: 0.7
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "top",
              labels: { boxWidth: 10, color: "#CBD5E1", font: { size: 10, weight: "600" } }
            }
          },
          scales: {
            x: {
              ticks: { color: "#94A3B8", font: { size: 9 }, maxRotation: 45 },
              grid: { display: false }
            },
            y: {
              beginAtZero: true,
              ticks: { color: "#94A3B8", font: { size: 10 }, stepSize: 1 },
              grid: { color: "rgba(148,163,184,0.15)" }
            }
          }
        }
      });
    }

    const donutCtx = document.getElementById("chartAttKpiModality");
    if (donutCtx && typeof donutCtx.getContext === "function") {
      const labels = ["En oficina", "GPS móvil", "Comisión oficial", "Diligencia externa"];
      const data = [
        agg.byModality.oficina || 0,
        agg.byModality.gps || 0,
        agg.byModality.comision || 0,
        agg.byModality.externa || 0
      ];
      const sum = data.reduce((a, b) => a + b, 0);
      state.charts.modality = new global.Chart(donutCtx, {
        type: "doughnut",
        data: {
          labels,
          datasets: [
            {
              data: sum ? data : [1],
              backgroundColor: sum ? ["#059669", "#0284C7", "#7C3AED", "#D97706"] : ["#334155"],
              borderWidth: 2,
              borderColor: "#0F172A",
              hoverOffset: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "bottom",
              labels: { boxWidth: 10, color: "#CBD5E1", font: { size: 10 } }
            },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  if (!sum) return " Sin marcajes en el período";
                  return " " + ctx.label + ": " + ctx.raw;
                }
              }
            }
          }
        }
      });
    }
  }

  function renderHeatmap(agg) {
    const wrap = document.getElementById("att-kpi-heatmap");
    if (!wrap) return;

    const days = agg.days;
    const workers = Object.keys(agg.heat)
      .map((id) => ({ id, ...agg.heat[id] }))
      .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), "es"));

    if (!workers.length) {
      wrap.innerHTML =
        '<p class="text-xs text-slate-500 italic p-4 text-center">Sin colaboradores ni marcajes en el período seleccionado.</p>';
      return;
    }

    const statusClass = {
      present: "bg-emerald-500/80 text-emerald-950",
      late: "bg-amber-500/90 text-amber-950",
      external: "bg-sky-500/80 text-sky-950",
      pending: "bg-amber-600/80 text-white",
      rejected: "bg-rose-600/80 text-white",
      absent: "bg-slate-800 text-slate-500"
    };
    const statusTitle = {
      present: "Presente",
      late: "Tardeo",
      external: "Fuera de geocerca",
      pending: "Pendiente aprobación",
      rejected: "Rechazado",
      absent: "Sin marcaje"
    };

    const dayHeaders = days
      .map((iso) => {
        const d = parseIso(iso);
        const wd = d ? d.toLocaleDateString("es-PE", { weekday: "narrow" }) : "";
        const dd = d ? pad2(d.getDate()) : iso.slice(8);
        const weekend = !isWorkday(iso);
        return (
          '<th class="px-1 py-2 text-center font-bold ' +
          (weekend ? "text-slate-600" : "text-slate-400") +
          '" title="' +
          iso +
          '"><div class="text-[9px] uppercase">' +
          wd +
          '</div><div class="text-[10px] font-mono">' +
          dd +
          "</div></th>"
        );
      })
      .join("");

    const rows = workers
      .map((w) => {
        const cells = days
          .map((iso) => {
            const st = w.days[iso] || (isWorkday(iso) ? "absent" : "absent");
            const cls = statusClass[st] || statusClass.absent;
            const tip = statusTitle[st] || st;
            return (
              '<td class="px-0.5 py-0.5 text-center"><span class="inline-flex w-6 h-6 items-center justify-center rounded-md text-[9px] font-bold ' +
              cls +
              '" title="' +
              tip +
              " · " +
              iso +
              '">' +
              (st === "present" ? "✓" : st === "late" ? "!" : st === "external" ? "↗" : st === "pending" ? "?" : st === "rejected" ? "×" : "·") +
              "</span></td>"
            );
          })
          .join("");
        return (
          '<tr class="border-b border-slate-800/60">' +
          '<td class="sticky left-0 bg-slate-950/95 py-1.5 px-2 text-[11px] text-slate-200 font-semibold whitespace-nowrap max-w-[140px] truncate" title="' +
          String(w.nombre || "") +
          '">' +
          String(w.nombre || w.id) +
          "</td>" +
          cells +
          "</tr>"
        );
      })
      .join("");

    wrap.innerHTML =
      '<div class="overflow-x-auto">' +
      '<table class="w-full border-collapse text-left">' +
      "<thead><tr>" +
      '<th class="sticky left-0 bg-slate-950 py-2 px-2 text-[10px] uppercase tracking-wide text-slate-500">Colaborador</th>' +
      dayHeaders +
      "</tr></thead><tbody>" +
      rows +
      "</tbody></table></div>";
  }

  async function refresh() {
    const panel = document.getElementById("asistencia-kpi-powerbi");
    if (!panel || panel.classList.contains("hidden")) {
      // sigue renderizando si el contenedor admin está visible
    }
    const admin = document.getElementById("asistencia-admin-container");
    if (admin && admin.classList.contains("hidden")) {
      destroyCharts();
      return;
    }

    updateSlicerUi();
    const agg = aggregate();
    const m = agg.metrics;

    setMetric("att-kpi-asistencia-pct", m.asistenciaPct + "%");
    setMetric("att-kpi-tardeos", String(m.late));
    setMetric("att-kpi-fuera", String(m.fuera));
    setMetric("att-kpi-horas", m.avgHours + " h");
    setMetric("att-kpi-marcajes", String(m.totalMarcajes));
    setMetric("att-kpi-pendientes-periodo", String(m.pendientes));

    const subAsist = document.getElementById("att-kpi-asistencia-sub");
    if (subAsist) {
      subAsist.textContent =
        m.present + " marcajes / " + m.expectedSlots + " slots laborables esperados";
    }

    await renderCharts(agg);
    renderHeatmap(agg);
  }

  function setMode(mode) {
    if (mode !== "week" && mode !== "month") return;
    state.mode = mode;
    state.offset = 0;
    refresh();
  }

  function shiftPeriod(delta) {
    state.offset += delta;
    refresh();
  }

  function setSede(sede) {
    state.sede = sede || "ALL";
    refresh();
  }

  function fillSedeOptions() {
    const sel = document.getElementById("att-kpi-sede-filter");
    if (!sel || sel.dataset.filled === "1") return;
    const cfg = global.SEDES_CONFIG || {};
    let html = '<option value="ALL">Todas las sedes (filtro activo)</option>';
    Object.keys(cfg).forEach((id) => {
      if (id === "todas") return;
      const name = cfg[id].nombreCorto || cfg[id].nombre || id;
      html += '<option value="' + id + '">' + name + "</option>";
    });
    sel.innerHTML = html;
    sel.dataset.filled = "1";
  }

  global.AttendanceKpis = {
    refresh,
    setMode,
    shiftPeriod,
    setSede,
    fillSedeOptions,
    destroyCharts,
    getState: () => ({ ...state })
  };
})(typeof window !== "undefined" ? window : globalThis);
