/**
 * PAOLO ALDEA & ABOGADOS - Motor de Exportación Excel de Alta Definición
 * Especializado para: PAOLO ALDEA & ABOGADOS (Sede Challhuahuacho)
 * Ajuste perfecto de anchos de columna, alineación centrada y formateo contable
 */

class LegalExcelExporter {
  constructor() {
    this.fontFamily = "Segoe UI";
    this.colors = {
      headerNavy: "0B132B",      // Azul marino institucional oscuro de prestigio
      headerNavyMid: "1C2541",   // Azul marino medio
      goldAccent: "C5A059",      // Oro champagne legal
      goldLight: "FEF3C7",       // Fondo ámbar / oro tenue contable
      goldDarkText: "78350F",    // Texto dorado oscuro para totales
      zebraLight: "F8FAFC",      // Blanco grisáceo alterno para filas de datos
      borderGray: "CBD5E1",      // Bordes delgados nítidos
      textWhite: "FFFFFF",
      textDark: "0F172A",
      incomeGreen: "D1FAE5",     // Fondo verde ingresos
      incomeText: "065F46",      // Texto verde ingresos
      expenseRed: "FEE2E2",      // Fondo rojo egresos
      expenseText: "991B1B",     // Texto rojo egresos
      urgentBg: "FEE2E2",
      urgentText: "991B1B",
      successBg: "D1FAE5",
      successText: "065F46"
    };
  }

  // Sanitización de celdas contra Formula Injection / CSV Injection (CWE-1236)
  sanitizeExcelCell(val) {
    if (val === null || val === undefined) return val;
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (/^(?:[=+@\t\r]|-(?![\d.,\s]*$))/.test(trimmed)) {
        return "'" + val;
      }
    }
    return val;
  }

  // Sanitizador integral del libro de trabajo previo a la serialización binaria XLSX
  sanitizeWorkbookBeforeExport(workbook) {
    if (!workbook) return;
    try {
      workbook.eachSheet((sheet) => {
        sheet.eachRow((row) => {
          row.eachCell({ includeEmpty: false }, (cell) => {
            if (typeof cell.value === "string") {
              const val = cell.value;
              const trimmed = val.trim();
              if (/^(?:[=+@\t\r]|-(?![\d.,\s]*$))/.test(trimmed) && !trimmed.startsWith("'")) {
                cell.value = "'" + val;
              }
            }
          });
        });
      });
    } catch (e) {
      console.warn("Aviso de sanitización de celdas Excel:", e);
    }
  }

  get thinBorder() {
    return {
      top: { style: 'thin', color: { argb: this.colors.borderGray } },
      left: { style: 'thin', color: { argb: this.colors.borderGray } },
      bottom: { style: 'thin', color: { argb: this.colors.borderGray } },
      right: { style: 'thin', color: { argb: this.colors.borderGray } }
    };
  }

  get accountingTotalBorder() {
    return {
      top: { style: 'thin', color: { argb: "0B132B" } },
      left: { style: 'thin', color: { argb: this.colors.borderGray } },
      bottom: { style: 'double', color: { argb: "0B132B" } },
      right: { style: 'thin', color: { argb: this.colors.borderGray } }
    };
  }

  // Obtiene los datos institucionales correspondientes a la sede activa
  getBranchInfo() {
    const active = (window.db && typeof window.db.getActiveSede === "function") ? window.db.getActiveSede() : "-";
    const settings = (window.db && typeof window.db.getSettings === "function") ? window.db.getSettings() : {};
    const branchCfg = (window.SEDES_CONFIG && window.SEDES_CONFIG[active]) ? window.SEDES_CONFIG[active] : null;

    let branchName = "SEDE CHALLHUAHUACHO";
    let branchSlug = "Challhuahuacho";
    let branchAddress = branchCfg?.direccion || settings.firmAddress || "Av. Los Mineros Mz. D Lt. 4, Challhuahuacho, Cotabambas - Apurímac";
    let branchPhone = branchCfg?.telefono || settings.firmPhone || "+51 943 410 215 / Central Despacho";

    if (active === "todas") {
      branchName = "CONSOLIDADO NACIONAL \u2014 TODAS LAS SEDES";
      branchSlug = "Nacional_Todas";
      branchAddress = branchCfg?.direccion || settings.firmAddress || "Sede Central & Red Descentralizada Nacional";
      branchPhone = branchCfg?.telefono || settings.firmPhone || "+51 943 410 215 / Central Despacho";
    } else if (branchCfg) {
      branchName = branchCfg.nombre.toUpperCase();
      branchSlug = branchCfg.ciudad || branchCfg.nombreCorto || branchCfg.id;
      branchAddress = branchCfg.direccion || settings.firmAddress || "";
      branchPhone = branchCfg.telefono || settings.firmPhone || "+51 943 410 215";
    }
    return {
      activeSede: active,
      branchName,
      branchSlug,
      branchAddress,
      branchPhone
    };
  }

  // Agrega el membrete institucional oficial adaptado a la sede activa
  addReportHeader(sheet, reportTitle, subtitle = "", totalCols = 12, latinMotto = "") {
    const settings = window.db ? window.db.getSettings() : {};
    const branchInfo = this.getBranchInfo();
    const currentUser = window.db ? window.db.getCurrentUser() : null;
    const currentUserName = currentUser ? (currentUser.nombre || currentUser.nombres || settings.adminOfficer || "Ing. Yimer Dami\u00E1n Soto") : (settings.adminOfficer || "Ing. Yimer Dami\u00E1n Soto");
    const currentUserCargo = currentUser ? (currentUser.cargo || "Ingenier\u00EDa Industrial & Control Operativo") : (settings.adminTitle || "Ingenier\u00EDa Industrial & Control Operativo");
    
    const now = new Date();
    const dayName = now.toLocaleDateString('es-PE', { weekday: 'long' });
    const dayNum = now.getDate();
    const monthName = now.toLocaleDateString('es-PE', { month: 'long' });
    const yearNum = now.getFullYear();
    const timeFormatted = now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true });
    const formattedLegalDateTime = `${dayName}, ${dayNum} de ${monthName} de ${yearNum}, ${timeFormatted}`;
    const sedeNameDisplay = (branchInfo.activeSede === "todas")
      ? "Consolidado Nacional \u2014 Todas las Sedes"
      : ("Sede " + (branchInfo.branchSlug || branchInfo.branchName).replace(/^SEDE\s+/i, ""));

    const lastColLetter = this.colNumberToLetter(totalCols);

    // Activación obligatoria de cuadrícula nítida en Excel
    sheet.views = [{ showGridLines: true }];

    // Fila 1: Gran Membrete Corporativo Institucional
    sheet.mergeCells("A1:" + lastColLetter + "1");
    const titleCell = sheet.getCell('A1');
    titleCell.value = "\u{1F3DB}\uFE0F  " + ((settings.firmName || "PAOLO ALDEA & ABOGADOS").toUpperCase());
    titleCell.font = { name: this.fontFamily, size: 13.5, bold: true, color: { argb: this.colors.textWhite } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.colors.headerNavy } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(1).height = 30;

    // Fila 2: NOMBRE DEL APARTADO (Diseño Oficial Imagen 2)
    sheet.mergeCells("A2:" + lastColLetter + "2");
    const repCell = sheet.getCell('A2');
    repCell.value = (reportTitle || "CONTROL ADMINISTRATIVO").toUpperCase() + (subtitle ? " \u2014 " + subtitle.toUpperCase() : "");
    repCell.font = { name: this.fontFamily, size: 11.5, bold: true, color: { argb: "0F172A" } };
    repCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: "F1F5F9" } };
    repCell.alignment = { vertical: 'middle', horizontal: 'center' };
    repCell.border = { top: { style: 'thin', color: { argb: 'CBD5E1' } }, left: { style: 'thin', color: { argb: 'CBD5E1' } }, right: { style: 'thin', color: { argb: 'CBD5E1' } } };
    sheet.getRow(2).height = 23;

    // Fila 3: DÍA, FECHA, MES, AÃ‘O Y HORA (Diseño Oficial Imagen 2)
    sheet.mergeCells("A3:" + lastColLetter + "3");
    const dateCell = sheet.getCell('A3');
    dateCell.value = formattedLegalDateTime;
    dateCell.font = { name: this.fontFamily, size: 9.5, bold: false, color: { argb: "334155" } };
    dateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: "FFFFFF" } };
    dateCell.alignment = { vertical: 'middle', horizontal: 'center' };
    dateCell.border = { left: { style: 'thin', color: { argb: 'CBD5E1' } }, right: { style: 'thin', color: { argb: 'CBD5E1' } } };
    sheet.getRow(3).height = 20;

    // Fila 4: SEDE RESALTADA EN AZUL (Diseño Oficial Imagen 2)
    sheet.mergeCells("A4:" + lastColLetter + "4");
    const sedeCell = sheet.getCell('A4');
    sedeCell.value = sedeNameDisplay;
    sedeCell.font = { name: this.fontFamily, size: 11, bold: true, color: { argb: "0284C7" } };
    sedeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: "F0F9FF" } };
    sedeCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sedeCell.border = { bottom: { style: 'thin', color: { argb: 'CBD5E1' } }, left: { style: 'thin', color: { argb: 'CBD5E1' } }, right: { style: 'thin', color: { argb: 'CBD5E1' } } };
    sheet.getRow(4).height = 23;

    // Fila 5: Director, Dirección y Lema Jurídico
    const motto = latinMotto || "\u00ABRatio, Iustitia et Veritas \u2014 Control Jur\u00EDdico & Gesti\u00F3n Operativa de Excelencia\u00BB";
    sheet.mergeCells("A5:" + lastColLetter + "5");
    const mottoCell = sheet.getCell('A5');
    mottoCell.value = "Director: " + (settings.managingAttorney || "Dr. Paolo Aldea Quincho") + " | " + branchInfo.branchAddress + " | \u2696\uFE0F " + motto;
    mottoCell.font = { name: this.fontFamily, size: 8.5, italic: true, bold: true, color: { argb: "78350F" } };
    mottoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: "FEF3C7" } };
    mottoCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(5).height = 20;
  }

  colNumberToLetter(colNum) {
    let temp, letter = '';
    while (colNum > 0) {
      temp = (colNum - 1) % 26;
      letter = String.fromCharCode(temp + 65) + letter;
      colNum = (colNum - temp - 1) / 26;
    }
    return letter;
  }

  // Ajuste perfecto y estético de anchos de columna sin truncar texto ni generar "###"
  autoFitColumns(sheet, customWidths = {}) {
    sheet.columns.forEach((column, colIdx) => {
      const colNumber = colIdx + 1;
      let maxLen = 15;

      if (customWidths[colNumber]) {
        column.width = customWidths[colNumber];
        return;
      }

      if (column.values) {
        column.values.forEach((val, rowIdx) => {
          // Ignorar filas de membrete fusionado (1 a 6) y firmas para no inflar la columna
          if (rowIdx > 6 && val != null) {
            const strVal = String(val);
            if (!strVal.includes("___") && !strVal.includes("LEY 27269")) {
              if (strVal.length > maxLen) {
                maxLen = Math.min(strVal.length, 55);
              }
            }
          }
        });
      }
      column.width = Math.max(16, maxLen + 5); // Margen generoso de seguridad para legibilidad total
    });
  }

  // Bloque Oficial de Firmas Institucionales (Izquierda: Dr. Paolo Aldea, Centro: Sello Digital, Derecha: Usuario exportador)
  addInstitutionalSignatures(sheet, startRow, totalCols = 12) {
    const settings = window.db ? window.db.getSettings() : {};
    const branchInfo = this.getBranchInfo();
    const currentUser = window.db ? window.db.getCurrentUser() : null;
    const currentUserName = currentUser ? (currentUser.nombre || currentUser.nombres || settings.adminOfficer || "Ing. Yimer Dami\u00E1n Soto") : (settings.adminOfficer || "Ing. Yimer Dami\u00E1n Soto");
    const currentUserCargo = currentUser ? (currentUser.cargo || "Ingenier\u00EDa Industrial & Control Operativo") : (settings.adminTitle || "Ingenier\u00EDa Industrial & Control Operativo");
    const certCode = "CERT-PAOLO-" + Math.floor(100000 + Math.random() * 900000);
    const branchOrg = (branchInfo.activeSede === "todas") 
      ? "Consolidado Nacional \u2014 Todas las Sedes"
      : ("PAOLO ALDEA & ABOGADOS \u2014 " + branchInfo.branchName);

    let r = startRow + 2;
    sheet.getRow(r).height = 25;
    r++;

    const midCol = Math.floor(totalCols / 2);
    const leftStart = 1;
    const leftEnd = Math.max(leftStart + 2, midCol - 2);
    const centerStart = leftEnd + 1;
    const centerEnd = Math.min(totalCols - 3, centerStart + 2);
    const rightStart = centerEnd + 1;
    const rightEnd = totalCols;

    const cLeftS = this.colNumberToLetter(leftStart);
    const cLeftE = this.colNumberToLetter(leftEnd);
    const cCentS = this.colNumberToLetter(centerStart);
    const cCentE = this.colNumberToLetter(centerEnd);
    const cRightS = this.colNumberToLetter(rightStart);
    const cRightE = this.colNumberToLetter(rightEnd);

    // Fila de líneas
    sheet.mergeCells(cLeftS + r + ":" + cLeftE + r);
    sheet.getCell(cLeftS + r).value = "_____________________________________________";
    sheet.getCell(cLeftS + r).alignment = { horizontal: "center" };
    sheet.getCell(cLeftS + r).font = { name: this.fontFamily, size: 9, color: { argb: "64748B" } };

    sheet.mergeCells(cCentS + r + ":" + cCentE + r);
    sheet.getCell(cCentS + r).value = "[\u25A0 FIRMA DIGITAL LEY 27269 \u25A0]";
    sheet.getCell(cCentS + r).alignment = { horizontal: "center" };
    sheet.getCell(cCentS + r).font = { name: this.fontFamily, size: 8, bold: true, color: { argb: "059669" } };

    sheet.mergeCells(cRightS + r + ":" + cRightE + r);
    sheet.getCell(cRightS + r).value = "_____________________________________________";
    sheet.getCell(cRightS + r).alignment = { horizontal: "center" };
    sheet.getCell(cRightS + r).font = { name: this.fontFamily, size: 9, color: { argb: "64748B" } };
    r++;

    // Fila de nombres
    sheet.mergeCells(cLeftS + r + ":" + cLeftE + r);
    sheet.getCell(cLeftS + r).value = "Dr. Paolo Aldea Quincho";
    sheet.getCell(cLeftS + r).alignment = { horizontal: "center" };
    sheet.getCell(cLeftS + r).font = { name: this.fontFamily, size: 10, bold: true, color: { argb: this.colors.headerNavy } };

    sheet.mergeCells(cCentS + r + ":" + cCentE + r);
    sheet.getCell(cCentS + r).value = "VERIFICACI\u00D3N: " + certCode;
    sheet.getCell(cCentS + r).alignment = { horizontal: "center" };
    sheet.getCell(cCentS + r).font = { name: this.fontFamily, size: 7.5, italic: true, color: { argb: "475569" } };

    sheet.mergeCells(cRightS + r + ":" + cRightE + r);
    sheet.getCell(cRightS + r).value = currentUserName;
    sheet.getCell(cRightS + r).alignment = { horizontal: "center" };
    sheet.getCell(cRightS + r).font = { name: this.fontFamily, size: 10, bold: true, color: { argb: this.colors.headerNavy } };
    r++;

    // Fila de cargos
    sheet.mergeCells(cLeftS + r + ":" + cLeftE + r);
    sheet.getCell(cLeftS + r).value = "Abogado Titular & Director";
    sheet.getCell(cLeftS + r).alignment = { horizontal: "center" };
    sheet.getCell(cLeftS + r).font = { name: this.fontFamily, size: 8.5, color: { argb: "475569" } };

    sheet.mergeCells(cCentS + r + ":" + cCentE + r);
    sheet.getCell(cCentS + r).value = "Sello Criptogr\u00E1fico V\u00E1lido";
    sheet.getCell(cCentS + r).alignment = { horizontal: "center" };
    sheet.getCell(cCentS + r).font = { name: this.fontFamily, size: 7.5, color: { argb: "059669" } };

    sheet.mergeCells(cRightS + r + ":" + cRightE + r);
    sheet.getCell(cRightS + r).value = currentUserCargo;
    sheet.getCell(cRightS + r).alignment = { horizontal: "center" };
    sheet.getCell(cRightS + r).font = { name: this.fontFamily, size: 8.5, color: { argb: "475569" } };
    r++;

    // Fila de Colegiatura / Organización
    sheet.mergeCells(cLeftS + r + ":" + cLeftE + r);
    sheet.getCell(cLeftS + r).value = "CAL / CAA - Registro Profesional";
    sheet.getCell(cLeftS + r).alignment = { horizontal: "center" };
    sheet.getCell(cLeftS + r).font = { name: this.fontFamily, size: 8, color: { argb: "64748B" } };

    sheet.mergeCells(cCentS + r + ":" + cCentE + r);
    sheet.getCell(cCentS + r).value = "Registro Oficial Vigente";
    sheet.getCell(cCentS + r).alignment = { horizontal: "center" };
    sheet.getCell(cCentS + r).font = { name: this.fontFamily, size: 7.5, color: { argb: "64748B" } };

    sheet.mergeCells(cRightS + r + ":" + cRightE + r);
    sheet.getCell(cRightS + r).value = branchOrg;
    sheet.getCell(cRightS + r).alignment = { horizontal: "center" };
    sheet.getCell(cRightS + r).font = { name: this.fontFamily, size: 8, color: { argb: "64748B" } };
    r++;
  }


  // =========================================================================
  // EXPORTACIÓN MAESTRA COMPLETA (6 PESTAÑAS)
  // =========================================================================
  async _ensureExcelReady() {
    if (typeof ExcelJS !== "undefined" && typeof saveAs === "function") return true;
    if (window.PaoloLibLoader) {
      await window.PaoloLibLoader.loadExcel();
    }
    if (typeof ExcelJS === "undefined") {
      throw new Error("ExcelJS no disponible. Verifique lib/exceljs.min.js o conexión.");
    }
    return true;
  }

  async exportMasterWorkbook() {
    try {
      await this._ensureExcelReady();

      const branchInfo = this.getBranchInfo();
      const workbook = new ExcelJS.Workbook();
      workbook.creator = `PAOLO ALDEA & ABOGADOS - ${branchInfo.branchName}`;
      workbook.lastModifiedBy = "Asistente Administrativo / Control Operativo";
      workbook.created = new Date();

      this.buildSummarySheet(workbook);
      this.buildCajaChicaSheet(workbook);
      this.buildCasosSheet(workbook);
      this.buildCitasSheet(workbook);
      this.buildPresupuestosSheet(workbook);
      this.buildInventarioSheet(workbook);
      this.buildDocumentosSheet(workbook);
      this.buildAsistenciaSheet(workbook);
      this.buildPersonalSheet(workbook);

      this.sanitizeWorkbookBeforeExport(workbook);
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const fileName = `PAOLO_ALDEA_ABOGADOS_${branchInfo.branchSlug}_Reporte_Maestro_${getRelativeDateOnlyStr(0)}.xlsx`;
      saveAs(blob, fileName);
      if (window.app?.showToast) {
        window.app.showToast("Reporte Maestro en Excel generado y descargado con éxito.", "success");
      }
    } catch (err) {
      console.error("Error al exportar Reporte Maestro Excel:", err);
      if (window.app?.showToast) {
        window.app.showToast(`Error al exportar Reporte Maestro a Excel: ${err.message}`, "error");
      } else {
        alert(`Error al exportar a Excel: ${err.message}`);
      }
    }
  }

  // =========================================================================
  // HOJA 1: RESUMEN EJECUTIVO (KPIs & Métricas de Ingeniería Industrial)
  // =========================================================================
  buildSummarySheet(workbook) {
    const sheet = workbook.addWorksheet("RESUMEN EJECUTIVO", {
      views: [{ showGridLines: true, state: 'normal' }],
      properties: { tabColor: { argb: this.colors.goldAccent } }
    });

    const bInfoSum = this.getBranchInfo(); const sedeNameSum = (bInfoSum.activeSede === "todas") ? "Consolidado Nacional" : bInfoSum.branchName; this.addReportHeader(sheet, "TABLERO DE CONTROL EJECUTIVO Y EFICIENCIA OPERATIVA", "Consolidado Ejecutivo y Reporte Integral en " + sedeNameSum, 4, "Facta non verba \u2014 Decisiones sustentadas en datos de precisi\u00F3n y control exhaustivo.");

    const settings = window.db.getSettings();
    const caja = window.db.get("caja_chica");
    const casos = window.db.get("casos");
    const citas = window.db.get("citas");
    const inv = window.db.get("inventario");
    const docs = window.db.get("documentos");

    const totIng = caja.filter(t => t.tipo === "Ingreso").reduce((s, t) => s + Number(t.monto || 0), 0);
    const totEg = caja.filter(t => t.tipo === "Egreso").reduce((s, t) => s + Number(t.monto || 0), 0);
    const saldo = totIng - totEg;

    const casosTramite = casos.filter(c => c.estado === "En trámite").length;
    const casosGanados = casos.filter(c => c.estado === "Concluido / Ganado").length;
    const totalHonorarios = casos.reduce((s, c) => s + Number(c.honorarios || 0), 0);
    const totalValorInv = inv.reduce((s, i) => s + (Number(i.stock || 0) * Number(i.costoUnitario || 0)), 0);

    const metricsData = [
      ["MÉTRICAS DE GESTIÓN OPERATIVA & COSTOS", "VALOR / KPI", "CONTROL DE LITIGIOS & EFICIENCIA", "VALOR / KPI"],
      ["Saldo Disponible en Caja Sede Challhuahuacho", `${settings.currency} ${saldo.toFixed(2)}`, "Expedientes Activos en Trámite", `${casosTramite} expedientes`],
      ["Ingresos Totales (Aportes y Provisiones)", `${settings.currency} ${totIng.toFixed(2)}`, "Tasa de Efectividad Procesal", `${Math.round((casosGanados / Math.max(1, casos.length)) * 100)}% de Éxito`],
      ["Egresos Operativos y Procesales", `${settings.currency} ${totEg.toFixed(2)}`, "Cartera Total de Honorarios Pactados", `${settings.currency} ${totalHonorarios.toFixed(2)}`],
      ["Valorización de Activos en Sede (Inventario)", `${settings.currency} ${totalValorInv.toFixed(2)}`, "Plazos Fatales en Riesgo Inminente", `${window.alerts.alerts.urgent.length} causas perentorias`],
      ["Agenda de Citas & Audiencias", `${citas.length} citas programadas`, "Acervo Documental y Modelos Legales", `${docs.length} escritos y contratos`]
    ];

    const headerRow = sheet.getRow(6);
    headerRow.values = metricsData[0];
    headerRow.eachCell(cell => {
      cell.font = { name: this.fontFamily, size: 10, bold: true, color: { argb: this.colors.textWhite } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.colors.headerNavyMid } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = this.thinBorder;
    });
    headerRow.height = 25;

    for (let i = 1; i < metricsData.length; i++) {
      const row = sheet.getRow(6 + i);
      row.values = metricsData[i];
      row.height = 22;

      const cellA = row.getCell(1);
      cellA.font = { name: this.fontFamily, size: 9.5, bold: true, color: { argb: "1E293B" } };
      cellA.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: "F8FAFC" } };
      cellA.alignment = { horizontal: 'left', vertical: 'middle' };
      cellA.border = this.thinBorder;

      const cellB = row.getCell(2);
      cellB.font = { name: this.fontFamily, size: 10, bold: true, color: { argb: "0B5CAD" } };
      cellB.alignment = { horizontal: 'center', vertical: 'middle' };
      cellB.border = this.thinBorder;

      const cellC = row.getCell(3);
      cellC.font = { name: this.fontFamily, size: 9.5, bold: true, color: { argb: "1E293B" } };
      cellC.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: "F8FAFC" } };
      cellC.alignment = { horizontal: 'left', vertical: 'middle' };
      cellC.border = this.thinBorder;

      const cellD = row.getCell(4);
      cellD.font = { name: this.fontFamily, size: 10, bold: true, color: { argb: "047857" } };
      cellD.alignment = { horizontal: 'center', vertical: 'middle' };
      cellD.border = this.thinBorder;
    }

    // Guía del Libro
    sheet.getCell('A13').value = "ESTRUCTURA Y CENTROS DE CONTROL DEL LIBRO EXCEL:";
    sheet.getCell('A13').font = { name: this.fontFamily, size: 10.5, bold: true, color: { argb: this.colors.headerNavy } };

    const navGuides = [
      ["Pesta\u00F1a 'CAJA CHICA'", "Libro contable auxiliar con imputaci\u00F3n por Centro de Costo, flujo de aprobaci\u00F3n y comprobantes."],
      ["Pesta\u00F1a 'CASOS Y EXPEDIENTES'", "Control de expedientes, plazos fatales, PDFs adjuntos y tiempos de ciclo."],
      ["Pesta\u00F1a 'CITAS Y AUDIENCIAS'", "Agenda presencial/virtual, Meet y notas log\u00EDsticas."],
      ["Pesta\u00F1a 'Presupuesto & Proyecciones'", "CAPEX/OPEX, ejecuci\u00F3n presupuestal y saldo por partida."],
      ["Pesta\u00F1a 'INVENTARIO Y ARCHIVO'", "M\u00E9todo ABC, tokens SINOE, Internet Claro y reorden."],
      ["Pesta\u00F1a 'GESTI\u00D3N DOCUMENTAL'", "Escritos judiciales, contratos y estado de firma."],
      ["Pesta\u00F1a 'ASISTENCIA Y TAREO'", "Marcajes de jornada completa, geocerca y diligencias."],
      ["Pesta\u00F1a 'PERSONAL Y SEDES'", "Padr\u00F3n multi-sede, roles RBAC y contacto institucional."]
    ];

    navGuides.forEach((g, idx) => {
      const r = sheet.getRow(14 + idx);
      r.getCell(1).value = g[0];
      r.getCell(1).font = { name: this.fontFamily, size: 9, bold: true, color: { argb: "1E3A8A" } };
      r.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(1).border = this.thinBorder;

      sheet.mergeCells(`B${14 + idx}:D${14 + idx}`);
      const rDesc = r.getCell(2);
      rDesc.value = g[1];
      rDesc.font = { name: this.fontFamily, size: 9, color: { argb: "334155" } };
      rDesc.alignment = { horizontal: 'left', vertical: 'middle' };
      rDesc.border = this.thinBorder;
      r.height = 20;
    });

    sheet.columns = [
      { width: 38 },
      { width: 22 },
      { width: 38 },
      { width: 24 }
    ];
  }

  // =========================================================================
  // HOJA 2: CAJA CHICA CON CENTROS DE COSTO (Alineación y Orden Perfecto)
  // =========================================================================
  buildCajaChicaSheet(workbook) {
    const sheet = workbook.addWorksheet("CAJA CHICA", {
      views: [{ state: 'frozen', ySplit: 6, activeCell: 'A7', showGridLines: true }],
      properties: { tabColor: { argb: "059669" } }
    });

    const headers = [
      "ID",
      "SEDE",
      "FECHA",
      "TIPO",
      "ESTADO FLUJO",
      "CENTRO DE COSTO",
      "CATEGORÍA JUDICIAL",
      "EXPEDIENTE ASOCIADO",
      "N° COMPROBANTE",
      "DETALLE / CONCEPTO DEL GASTO",
      "RESPONSABLE",
      "SOLICITANTE",
      "MÉTODO DE PAGO",
      "MONTO INGRESO (S/)",
      "MONTO EGRESO (S/)",
      "SALDO RESULTANTE (S/)"
    ];

    const bInfoCC = this.getBranchInfo(); const sedeNameCC = (bInfoCC.activeSede === "todas") ? "Consolidado Nacional" : bInfoCC.branchName; this.addReportHeader(sheet, "LIBRO AUXILIAR DE CAJA CHICA & GASTOS JUDICIALES", "Control Financiero y Rendici\u00F3n de Caja Chica en " + sedeNameCC, headers.length, "Fides et integritas in omnibus rebus \u2014 Transparencia absoluta en la administraci\u00F3n de fondos procesales.");

    const hRow = sheet.getRow(6);
    hRow.values = headers;
    hRow.height = 28;
    hRow.eachCell(cell => {
      cell.font = { name: this.fontFamily, size: 9, bold: true, color: { argb: this.colors.textWhite } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.colors.headerNavyMid } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = this.thinBorder;
    });

    const items = (window.db.get("caja_chica") || []).slice().sort((a, b) => String(a.fecha || "").localeCompare(String(b.fecha || "")));
    let currentRowIdx = 7;
    let runningBalance = 0;
    let totalIng = 0;
    let totalEg = 0;

    items.forEach((item, index) => {
      const tipoNorm = String(item.tipo || "Egreso").trim();
      const isIngreso = /^ingreso$/i.test(tipoNorm);
      const monto = Number(item.monto || 0);

      if (isIngreso) {
        runningBalance += monto;
        totalIng += monto;
      } else {
        runningBalance -= monto;
        totalEg += monto;
      }

      const row = sheet.getRow(currentRowIdx);
      const isZebra = index % 2 === 1;
      const bgArgb = isZebra ? this.colors.zebraLight : "FFFFFF";
      const solicitante = item.solicitante?.nombre || item.solicitante || "-";

      row.values = [
        item.id || "-",
        item.sede || item.sedeId || "-",
        item.fecha || "-",
        tipoNorm.toUpperCase(),
        item.estadoFlujo || item.estado || "-",
        item.centroCosto || "-",
        item.categoria || "-",
        item.expediente || "-",
        item.comprobante || "-",
        item.concepto || "-",
        item.responsable || "-",
        solicitante,
        item.metodo || "-",
        isIngreso ? monto : null,
        !isIngreso ? monto : null,
        runningBalance
      ];
      row.height = 22;

      row.eachCell((cell, colNumber) => {
        cell.font = { name: this.fontFamily, size: 8.5, color: { argb: this.colors.textDark } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
        cell.border = this.thinBorder;
        cell.alignment = { vertical: 'middle' };

        if ([1, 2, 3, 4, 5, 8, 9, 13].includes(colNumber)) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }

        if (colNumber === 4) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          if (isIngreso) {
            cell.font = { name: this.fontFamily, size: 8.5, bold: true, color: { argb: this.colors.incomeText } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.colors.incomeGreen } };
          } else {
            cell.font = { name: this.fontFamily, size: 8.5, bold: true, color: { argb: this.colors.expenseText } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.colors.expenseRed } };
          }
        }

        if (colNumber === 8) {
          cell.font = { name: "Consolas", size: 8.5, bold: true, color: { argb: "0F172A" } };
        }

        if ([6, 7, 10, 11, 12].includes(colNumber)) {
          cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        }

        if (colNumber >= 14 && colNumber <= 16) {
          cell.numFmt = `_("S/"* #,##0.00_);_("S/"* (#,##0.00);_("S/"* "-"??_);_(@_)`;
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          if (colNumber === 16) {
            cell.font = { name: this.fontFamily, size: 9, bold: true, color: { argb: "1E3A8A" } };
          }
        }
      });

      currentRowIdx++;
    });

    // Fila Totales Contables
    const totalRow = sheet.getRow(currentRowIdx);
    totalRow.height = 25;
    totalRow.values = [
      "TOTALES LIQUIDADOS",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "FONDO DE CAJA CHICA — " + String(sedeNameCC || "").toUpperCase(),
      "",
      "",
      "",
      totalIng,
      totalEg,
      totalIng - totalEg
    ];

    sheet.mergeCells(`A${currentRowIdx}:I${currentRowIdx}`);
    const totLabel = totalRow.getCell(1);
    totLabel.alignment = { horizontal: 'center', vertical: 'middle' };

    totalRow.eachCell((cell, colNumber) => {
      cell.font = { name: this.fontFamily, size: 9.5, bold: true, color: { argb: "0F172A" } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.colors.goldLight } };
      cell.border = this.accountingTotalBorder;

      if (colNumber >= 14 && colNumber <= 16) {
        cell.numFmt = `_("S/"* #,##0.00_);_("S/"* (#,##0.00);_("S/"* "-"??_);_(@_)`;
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      }
    });

    sheet.autoFilter = { from: { row: 6, column: 1 }, to: { row: Math.max(6, currentRowIdx - 1), column: headers.length } };

    this.addInstitutionalSignatures(sheet, currentRowIdx, headers.length);

    this.autoFitColumns(sheet, {
      1: 12,
      2: 16,
      3: 12,
      4: 12,
      5: 18,
      6: 24,
      7: 22,
      8: 26,
      9: 16,
      10: 40,
      11: 20,
      12: 20,
      13: 14,
      14: 16,
      15: 16,
      16: 18
    });
  }

  // =========================================================================
  // HOJA 3: CASOS Y EXPEDIENTES (Alineación y Orden Perfecto)
  // =========================================================================
  buildCasosSheet(workbook) {
    const sheet = workbook.addWorksheet("CASOS Y EXPEDIENTES", {
      views: [{ state: 'frozen', ySplit: 6, activeCell: 'A7', showGridLines: true }],
      properties: { tabColor: { argb: "1E3A8A" } }
    });

    const headers = [
      "ID",
      "SEDE",
      "N° DE EXPEDIENTE",
      "CARÁTULA / CAUSA JUDICIAL",
      "MATERIA",
      "JUZGADO / SALA",
      "CLIENTE PATROCINADO",
      "PARTE CONTRARIA",
      "ABOGADO ASIGNADO",
      "PLAZO FATAL (VENCIMIENTO)",
      "TRÁMITE QUE VENCE",
      "PRÓXIMA AUDIENCIA",
      "ESTADO PROCESAL",
      "ETAPA",
      "PRIORIDAD",
      "LEAD TIME (DÍAS)",
      "NIVEL DE RIESGO",
      "CUANTÍA (S/)",
      "HONORARIOS (S/)",
      "PDF EXP.",
      "PDF RES.",
      "NOTAS"
    ];

    const bInfoCas = this.getBranchInfo(); const sedeNameCas = (bInfoCas.activeSede === "todas") ? "Consolidado Nacional" : bInfoCas.branchName; this.addReportHeader(sheet, "REPORTE MAESTRO DE LITIGIOS & EXPEDIENTES JUDICIALES", "Gesti\u00F3n Operativa de Expedientes Judiciales en " + sedeNameCas, headers.length, "Iustitia nemini neganda est \u2014 Rigor procesal inquebrantable en defensa de la causa.");

    const hRow = sheet.getRow(6);
    hRow.values = headers;
    hRow.height = 28;
    hRow.eachCell(cell => {
      cell.font = { name: this.fontFamily, size: 9, bold: true, color: { argb: this.colors.textWhite } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.colors.headerNavyMid } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = this.thinBorder;
    });

    const items = window.db.get("casos");
    let currentRowIdx = 7;
    let totalCuantia = 0;
    let totalHonorarios = 0;

    items.forEach((c, index) => {
      const cuantia = Number(c.cuantia || 0);
      const honorarios = Number(c.honorarios || 0);
      totalCuantia += cuantia;
      totalHonorarios += honorarios;

      const isZebra = index % 2 === 1;
      const bgArgb = isZebra ? this.colors.zebraLight : "-";
      const row = sheet.getRow(currentRowIdx);

      const pdfMeta = c.pdfMeta || {};
      const hasExp = !!(pdfMeta.expediente?.hasPdf || pdfMeta.hasExpediente);
      const hasRes = !!(pdfMeta.resolucion?.hasPdf || (pdfMeta.hasPdf && !pdfMeta.expediente));
      const bgArgbSafe = bgArgb === "-" ? "FFFFFF" : bgArgb;

      row.values = [
        c.id || "-",
        c.sede || c.sedeId || "-",
        c.expediente || "-",
        c.caratula || "-",
        c.materia || "-",
        c.juzgado || "-",
        c.cliente || "-",
        c.parteContraria || "-",
        c.abogadoAsignado || c.abogado || "-",
        c.vencimiento || "-",
        c.detalleVencimiento || "-",
        c.proximaAudiencia || "-",
        c.estado || "-",
        c.etapa || "-",
        c.prioridad || "-",
        c.tiempoCicloDias || 30,
        c.nivelRiesgo || "-",
        cuantia,
        honorarios,
        hasExp ? "SÍ" : "NO",
        hasRes ? "SÍ" : "NO",
        c.notas || "-"
      ];
      row.height = 22;

      row.eachCell((cell, colNumber) => {
        cell.font = { name: this.fontFamily, size: 8.5, color: { argb: this.colors.textDark } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgbSafe } };
        cell.border = this.thinBorder;
        cell.alignment = { vertical: 'middle' };

        if ([1, 2, 3, 5, 10, 12, 13, 14, 15, 16, 17, 20, 21].includes(colNumber)) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }

        if (colNumber === 3) {
          cell.font = { name: "Consolas", size: 8.5, bold: true, color: { argb: "0F172A" } };
        }

        if (colNumber === 10 && c.prioridad === "Urgente") {
          cell.font = { name: this.fontFamily, size: 8.5, bold: true, color: { argb: this.colors.urgentText } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.colors.urgentBg } };
        }

        if ([4, 6, 7, 8, 9, 11, 22].includes(colNumber)) {
          cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        }

        if (colNumber === 18 || colNumber === 19) {
          cell.numFmt = `_("S/"* #,##0.00_);_("S/"* (#,##0.00);_("S/"* "-"??_);_(@_)`;
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.font = { name: this.fontFamily, size: 8.5, bold: true, color: { argb: "1E3A8A" } };
        }
      });

      currentRowIdx++;
    });

    const totalRow = sheet.getRow(currentRowIdx);
    totalRow.height = 25;
    totalRow.values = Array(headers.length).fill("");
    totalRow.values[0] = "TOTAL CARTERA DE LITIGIOS";
    totalRow.values[17] = totalCuantia;
    totalRow.values[18] = totalHonorarios;

    sheet.mergeCells(`A${currentRowIdx}:Q${currentRowIdx}`);
    const totLabel = totalRow.getCell(1);
    totLabel.alignment = { horizontal: 'center', vertical: 'middle' };

    totalRow.eachCell((cell, colNumber) => {
      cell.font = { name: this.fontFamily, size: 9.5, bold: true, color: { argb: "0F172A" } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.colors.goldLight } };
      cell.border = this.accountingTotalBorder;

      if (colNumber === 18 || colNumber === 19) {
        cell.numFmt = `_("S/"* #,##0.00_);_("S/"* (#,##0.00);_("S/"* "-"??_);_(@_)`;
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      }
    });

    sheet.autoFilter = { from: { row: 6, column: 1 }, to: { row: Math.max(6, currentRowIdx - 1), column: headers.length } };

    this.autoFitColumns(sheet, {
      1: 12, 2: 14, 3: 26, 4: 36, 5: 16, 6: 24, 7: 26, 8: 22, 9: 20,
      10: 14, 11: 28, 12: 16, 13: 14, 14: 14, 15: 12, 16: 12, 17: 14,
      18: 14, 19: 14, 20: 10, 21: 10, 22: 30
    });
  }

  // =========================================================================
  // HOJA 4: CITAS Y AUDIENCIAS (Alineación y Orden Perfecto)
  // =========================================================================
  buildCitasSheet(workbook) {
    const sheet = workbook.addWorksheet("CITAS Y AUDIENCIAS", {
      views: [{ state: 'frozen', ySplit: 6, activeCell: 'A7', showGridLines: true }],
      properties: { tabColor: { argb: "7C3AED" } }
    });

    const headers = [
      "ID",
      "SEDE",
      "CLIENTE / ENTIDAD",
      "TELÉFONO / WHATSAPP",
      "MOTIVO DE LA CONSULTA / AUDIENCIA",
      "FECHA Y HORA PROGRAMADA",
      "MODALIDAD",
      "LINK MEET / URL",
      "ABOGADO ASIGNADO",
      "ESTADO",
      "DOCUMENTOS REQUERIDOS",
      "NOTAS LOGÍSTICAS DE PREPARACIÓN"
    ];

    const bInfoCit = this.getBranchInfo(); const sedeNameCit = (bInfoCit.activeSede === "todas") ? "Consolidado Nacional" : bInfoCit.branchName; this.addReportHeader(sheet, "AGENDA OFICIAL DE CITAS & AUDIENCIAS JUDICIALES", "Programaci\u00F3n Legal en " + sedeNameCit + " y Videoconferencias", headers.length, "Ratio, Iustitia et Veritas \u2014 La puntualidad y pulcritud procesal garantizan el debido proceso.");

    const hRow = sheet.getRow(6);
    hRow.values = headers;
    hRow.height = 28;
    hRow.eachCell(cell => {
      cell.font = { name: this.fontFamily, size: 9, bold: true, color: { argb: this.colors.textWhite } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.colors.headerNavyMid } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = this.thinBorder;
    });

    const items = window.db.get("citas") || [];
    let currentRowIdx = 7;

    items.forEach((item, index) => {
      const isZebra = index % 2 === 1;
      const bgArgb = isZebra ? this.colors.zebraLight : "FFFFFF";
      const row = sheet.getRow(currentRowIdx);
      const docsReq = Array.isArray(item.documentosRequeridos)
        ? item.documentosRequeridos.join(", ")
        : (item.documentosRequeridos || "-");

      row.values = [
        item.id || "-",
        item.sede || item.sedeId || "-",
        item.cliente || "-",
        item.telefono || "-",
        item.motivo || "-",
        item.fechaHora ? String(item.fechaHora).replace("T", " ") : "-",
        item.modalidad || "-",
        item.linkMeet || item.link || item.urlMeet || "-",
        item.abogado || "-",
        item.estado || "-",
        docsReq,
        item.notas || "-"
      ];
      row.height = 21;

      row.eachCell((cell, colNumber) => {
        cell.font = { name: this.fontFamily, size: 8.5, color: { argb: this.colors.textDark } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
        cell.border = this.thinBorder;
        cell.alignment = { vertical: 'middle' };

        if ([1, 2, 4, 6, 7, 9, 10].includes(colNumber)) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        }
      });

      currentRowIdx++;
    });

    sheet.autoFilter = { from: { row: 6, column: 1 }, to: { row: Math.max(6, currentRowIdx - 1), column: headers.length } };

    this.autoFitColumns(sheet, {
      1: 12, 2: 14, 3: 28, 4: 16, 5: 36, 6: 20,
      7: 14, 8: 28, 9: 18, 10: 14, 11: 24, 12: 30
    });
  }

  // =========================================================================
  // HOJA 5: INVENTARIO ABC (Alineación y Orden Perfecto)
  // =========================================================================
  buildInventarioSheet(workbook) {
    const sheet = workbook.addWorksheet("INVENTARIO Y ARCHIVO", {
      views: [{ state: 'frozen', ySplit: 6, activeCell: 'A7', showGridLines: true }],
      properties: { tabColor: { argb: "D97706" } }
    });

    const headers = [
      "ID",
      "CÓDIGO / SKU",
      "DESCRIPCIÓN DEL ACTIVO / EXPEDIENTE FÍSICO",
      "CLASIFICACIÓN ABC",
      "CATEGORÍA",
      "UBICACIÓN FÍSICA EN SEDE",
      "STOCK ACTUAL",
      "UNIDAD",
      "PUNTO REORDEN",
      "ESTADO",
      "COSTO UNITARIO (S/)",
      "VALOR TOTAL (S/)",
      "OBSERVACIONES TÉCNICAS & LOGÍSTICA"
    ];

    this.addReportHeader(sheet, "CONTROL PATRIMONIAL, EXPEDIENTES & ALMACÉN (MÉTODO ABC)", "Sede Challhuahuacho - Control de Criticidad, Tokens y Suministros", headers.length);

    const hRow = sheet.getRow(6);
    hRow.values = headers;
    hRow.height = 28;
    hRow.eachCell(cell => {
      cell.font = { name: this.fontFamily, size: 9, bold: true, color: { argb: this.colors.textWhite } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.colors.headerNavyMid } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = this.thinBorder;
    });

    const items = window.db.get("inventario");
    let currentRowIdx = 7;
    let totalValorInventario = 0;

    items.forEach((item, index) => {
      const stock = Number(item.stock || 0);
      const costo = Number(item.costoUnitario || 0);
      const valorTotal = stock * costo;
      totalValorInventario += valorTotal;

      const isZebra = index % 2 === 1;
      const bgArgb = isZebra ? this.colors.zebraLight : "-";
      const row = sheet.getRow(currentRowIdx);

      row.values = [
        item.id,
        item.codigo,
        item.nombre,
        item.clasificacionABC || "-",
        item.categoria,
        item.ubicacion,
        stock,
        item.unidad || "-",
        item.puntoReorden !== undefined ? item.puntoReorden : 1,
        item.estado,
        costo,
        valorTotal,
        item.observacion || "-"
      ];
      row.height = 22;

      row.eachCell((cell, colNumber) => {
        cell.font = { name: this.fontFamily, size: 8.5, color: { argb: this.colors.textDark } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
        cell.border = this.thinBorder;
        cell.alignment = { vertical: 'middle' };

        // Columnas centradas: ID (1), Código (2), ABC (4), Stock (7), Unidad (8), Reorden (9), Estado (10)
        if (colNumber === 1 || colNumber === 2 || colNumber === 4 || colNumber === 7 || colNumber === 8 || colNumber === 9 || colNumber === 10) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }

        // Resaltar Clase A
        if (colNumber === 4 && (item.clasificacionABC || "").includes("Clase A")) {
          cell.font = { name: this.fontFamily, size: 8.5, bold: true, color: { argb: "6B21A8" } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: "F3E8FF" } };
        }

        // Columnas descriptivas: Nombre (3), Categoría (5), Ubicación (6), Obs (13)
        if (colNumber === 3 || colNumber === 5 || colNumber === 6 || colNumber === 13) {
          cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        }

        // Columnas monetarias: Costo Unitario (11), Valor Total (12)
        if (colNumber === 11 || colNumber === 12) {
          cell.numFmt = `_("S/"* #,##0.00_);_("S/"* (#,##0.00);_("S/"* "-"??_);_(@_)`;
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.font = { name: this.fontFamily, size: 8.5, bold: true, color: { argb: "1E3A8A" } };
        }
      });

      currentRowIdx++;
    });

    const totalRow = sheet.getRow(currentRowIdx);
    totalRow.height = 25;
    totalRow.values = [
      "VALORIZACIÓN TOTAL PATRIMONIAL",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      totalValorInventario,
      "Sede Challhuahuacho"
    ];

    sheet.mergeCells(`A${currentRowIdx}:K${currentRowIdx}`);
    const totLabel = totalRow.getCell(1);
    totLabel.alignment = { horizontal: 'center', vertical: 'middle' };

    totalRow.eachCell((cell, colNumber) => {
      cell.font = { name: this.fontFamily, size: 9.5, bold: true, color: { argb: "0F172A" } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.colors.goldLight } };
      cell.border = this.accountingTotalBorder;

      if (colNumber === 12) {
        cell.numFmt = `_("S/"* #,##0.00_);_("S/"* (#,##0.00);_("S/"* "-"??_);_(@_)`;
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      }
    });

    sheet.autoFilter = { from: { row: 6, column: 1 }, to: { row: currentRowIdx - 1, column: headers.length } };

    this.autoFitColumns(sheet, {
      1: 12,
      2: 18,
      3: 38,
      4: 24,
      5: 24,
      6: 28,
      7: 12,
      8: 12,
      9: 14,
      10: 16,
      11: 18,
      12: 18,
      13: 35
    });
  }

  // =========================================================================
  // HOJA 6: GESTIÓN DOCUMENTAL
  // =========================================================================
  buildDocumentosSheet(workbook) {
    const sheet = workbook.addWorksheet("GESTIÓN DOCUMENTAL", {
      views: [{ state: 'frozen', ySplit: 6, activeCell: 'A7', showGridLines: true }],
      properties: { tabColor: { argb: "0284C7" } }
    });

    const headers = [
      "ID",
      "TÍTULO DEL DOCUMENTO",
      "TIPO DE DOCUMENTO",
      "EXPEDIENTE ASOCIADO",
      "CLIENTE / PATROCINADO",
      "MATERIA",
      "FECHA DE REGISTRO",
      "VERSIÓN",
      "ESTADO DE FIRMA SINOE / NOTARIAL"
    ];

    const bInfoDoc = this.getBranchInfo(); const sedeNameDoc = (bInfoDoc.activeSede === "todas") ? "Consolidado Nacional" : bInfoDoc.branchName; this.addReportHeader(sheet, "CAT\u00C1LOGO DE ESCRITOS JUDICIALES & CONTRATOS", "Acervo Documental y Archivo Central en " + sedeNameDoc, headers.length, "Verba volant, scripta manent \u2014 Doctrina y precedente escrito al servicio de la verdad jur\u00EDdica.");

    const hRow = sheet.getRow(6);
    hRow.values = headers;
    hRow.height = 28;
    hRow.eachCell(cell => {
      cell.font = { name: this.fontFamily, size: 9, bold: true, color: { argb: this.colors.textWhite } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.colors.headerNavyMid } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = this.thinBorder;
    });

    const items = window.db.get("documentos");
    let currentRowIdx = 7;

    items.forEach((item, index) => {
      const isZebra = index % 2 === 1;
      const bgArgb = isZebra ? this.colors.zebraLight : "-";
      const row = sheet.getRow(currentRowIdx);

      row.values = [
        item.id,
        item.titulo,
        item.tipo,
        item.expediente || "-",
        item.cliente || "-",
        item.materia || "-",
        item.fecha,
        item.version || "-",
        item.estado
      ];
      row.height = 21;

      row.eachCell((cell, colNumber) => {
        cell.font = { name: this.fontFamily, size: 8.5, color: { argb: this.colors.textDark } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
        cell.border = this.thinBorder;
        cell.alignment = { vertical: 'middle' };

        if (colNumber === 1 || colNumber === 4 || colNumber === 7 || colNumber === 8 || colNumber === 9) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        }
      });

      currentRowIdx++;
    });

    sheet.autoFilter = { from: { row: 6, column: 1 }, to: { row: currentRowIdx - 1, column: headers.length } };

    this.autoFitColumns(sheet, {
      1: 12,
      2: 38,
      3: 20,
      4: 26,
      5: 30,
      6: 18,
      7: 15,
      8: 12,
      9: 22
    });
  }

  buildPresupuestosSheet(workbook) {
    const sheet = workbook.addWorksheet("Presupuesto & Proyecciones", {
      views: [{ state: 'frozen', ySplit: 7, activeCell: 'A8', showGridLines: true }],
      properties: { tabColor: { argb: "059669" } }
    });

    const items = window.db.get("presupuestos");
    const capex = items.filter(i => i.tipo === "CAPEX").reduce((s, i) => s + Number(i.subtotal || 0), 0);
    const opex = items.filter(i => i.tipo === "OPEX").reduce((s, i) => s + Number(i.subtotal || 0), 0);
    const contingencia = items.filter(i => i.tipo === "Contingencia" || i.categoria === "Fondo de Contingencia").reduce((s, i) => s + Number(i.subtotal || 0), 0);
    const cajaChica = items.filter(i => i.tipo === "Caja Chica" || i.categoria === "Asignación de Caja Chica").reduce((s, i) => s + Number(i.subtotal || 0), 0);
    const granTotal = capex + opex + contingencia + cajaChica;

    // Encabezado institucional Oficial (10 columnas)
    const bInfoPre = this.getBranchInfo(); 
    const sedeNamePre = (bInfoPre.activeSede === "todas") ? "Consolidado Nacional" : bInfoPre.branchName; 
    this.addReportHeader(sheet, "PLAN PRESUPUESTARIO Y CONTROL DE FLUJO", "Control Presupuestal y Flujo de Fondos en " + sedeNamePre, 10, "Ratio pecuniae in iustitia \u2014 Planificaci\u00F3n financiera, provisión y sostenibilidad institucional.");

    // Fila 6: Tarjetas dinámicas de resumen financiero
    sheet.getRow(6).height = 25;
    sheet.getCell('A6').value = "RESUMEN:";
    sheet.getCell('A6').font = { name: this.fontFamily, size: 9, bold: true, color: { argb: this.colors.headerNavy } };
    sheet.getCell('A6').alignment = { vertical: 'middle', horizontal: 'center' };

    sheet.getCell('B6').value = `CAPEX: S/ ${capex.toFixed(2)}`;
    sheet.getCell('B6').font = { name: this.fontFamily, size: 9, bold: true, color: { argb: "1E40AF" } };
    sheet.getCell('B6').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: "DBEAFE" } };
    sheet.getCell('B6').alignment = { vertical: 'middle', horizontal: 'center' };

    sheet.mergeCells('C6:D6');
    sheet.getCell('C6').value = `OPEX: S/ ${opex.toFixed(2)}`;
    sheet.getCell('C6').font = { name: this.fontFamily, size: 9, bold: true, color: { argb: "065F46" } };
    sheet.getCell('C6').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: "D1FAE5" } };
    sheet.getCell('C6').alignment = { vertical: 'middle', horizontal: 'center' };

    sheet.mergeCells('E6:F6');
    sheet.getCell('E6').value = `Contingencia: S/ ${contingencia.toFixed(2)}`;
    sheet.getCell('E6').font = { name: this.fontFamily, size: 9, bold: true, color: { argb: "92400E" } };
    sheet.getCell('E6').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: "FEF3C7" } };
    sheet.getCell('E6').alignment = { vertical: 'middle', horizontal: 'center' };

    sheet.mergeCells('G6:H6');
    sheet.getCell('G6').value = `Caja Chica: S/ ${cajaChica.toFixed(2)}`;
    sheet.getCell('G6').font = { name: this.fontFamily, size: 9, bold: true, color: { argb: "5B21B6" } };
    sheet.getCell('G6').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: "EDE9FE" } };
    sheet.getCell('G6').alignment = { vertical: 'middle', horizontal: 'center' };

    sheet.mergeCells('I6:J6');
    sheet.getCell('I6').value = `TOTAL: S/ ${granTotal.toFixed(2)}`;
    sheet.getCell('I6').font = { name: this.fontFamily, size: 9.5, bold: true, color: { argb: this.colors.textWhite } };
    sheet.getCell('I6').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.colors.headerNavy } };
    sheet.getCell('I6').alignment = { vertical: 'middle', horizontal: 'center' };

    // Fila 7: Encabezados de tabla
    const headers = [
      "Código",
      "Sede",
      "Centro de Costo",
      "PCGE",
      "Categoría",
      "Concepto / Partida",
      "Tipo",
      "Frecuencia / Días",
      "Cant.",
      "Unidad",
      "Costo Unitario",
      "Presupuestado",
      "Ejecutado",
      "Saldo",
      "Estado",
      "Responsable"
    ];

    const headerRow = sheet.getRow(7);
    headerRow.values = headers;
    headerRow.height = 28;

    headerRow.eachCell((cell) => {
      cell.font = { name: this.fontFamily, size: 9, bold: true, color: { argb: this.colors.textWhite } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.colors.headerNavyMid } };
      cell.border = this.thinBorder;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    let currentRowIdx = 8;
    let totalEjecutado = 0;
    items.forEach((item, idx) => {
      const row = sheet.getRow(currentRowIdx);
      const bgArgb = idx % 2 === 1 ? this.colors.zebraLight : this.colors.textWhite;
      const presupuestado = Number(item.subtotal || item.montoPresupuestado || 0);
      const ejecutado = (item.montoEjecutado !== undefined && item.montoEjecutado !== null)
        ? Number(item.montoEjecutado)
        : (item.estado === "Ejecutado" ? presupuestado : 0);
      totalEjecutado += ejecutado;
      const saldo = presupuestado - ejecutado;

      row.values = [
        item.id || "-",
        item.sede || item.sedeId || "-",
        item.centroCosto || "-",
        item.clasePcge || "-",
        item.categoria || "-",
        (item.concepto || "-") + (item.notas ? ` (${item.notas})` : ""),
        item.tipo || "-",
        String(item.frecuencia || "-") + (item.diasEventual ? ` (${item.diasEventual} días)` : ""),
        item.cantidad != null ? item.cantidad : 1,
        item.unidad || "Unidad",
        Number(item.costoUnitario || 0),
        presupuestado,
        ejecutado,
        saldo,
        item.estado || "-",
        item.responsable || "-"
      ];
      row.height = 21;

      row.eachCell((cell, colNumber) => {
        cell.font = { name: this.fontFamily, size: 8.5, color: { argb: this.colors.textDark } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
        cell.border = this.thinBorder;
        cell.alignment = { vertical: 'middle' };

        if ([1, 2, 3, 4, 7, 8, 9, 10, 15].includes(colNumber)) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if ([11, 12, 13, 14].includes(colNumber)) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = '"S/" #,##0.00';
          if (colNumber === 12 || colNumber === 13) {
            cell.font = { name: this.fontFamily, size: 8.5, bold: true, color: { argb: "0B132B" } };
          }
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        }
      });

      currentRowIdx++;
    });

    // Fila de Total Contable
    const totalRow = sheet.getRow(currentRowIdx);
    sheet.mergeCells(`A${currentRowIdx}:K${currentRowIdx}`);
    const lblCell = sheet.getCell(`A${currentRowIdx}`);
    lblCell.value = "TOTAL GENERAL PROYECTADO \u2014 " + (sedeNamePre || "CONSOLIDADO NACIONAL").toUpperCase() + ":";
    lblCell.font = { name: this.fontFamily, size: 9.5, bold: true, color: { argb: this.colors.goldDarkText } };
    lblCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.colors.goldLight } };
    lblCell.alignment = { horizontal: 'right', vertical: 'middle' };

    const sumCell = sheet.getCell(`L${currentRowIdx}`);
    sumCell.value = granTotal;
    sumCell.font = { name: this.fontFamily, size: 10, bold: true, color: { argb: this.colors.goldDarkText } };
    sumCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.colors.goldLight } };
    sumCell.alignment = { horizontal: 'right', vertical: 'middle' };
    sumCell.numFmt = '"S/" #,##0.00';

    const ejecCell = sheet.getCell(`M${currentRowIdx}`);
    ejecCell.value = totalEjecutado;
    ejecCell.font = { name: this.fontFamily, size: 10, bold: true, color: { argb: this.colors.goldDarkText } };
    ejecCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.colors.goldLight } };
    ejecCell.alignment = { horizontal: 'right', vertical: 'middle' };
    ejecCell.numFmt = '"S/" #,##0.00';

    const saldoCell = sheet.getCell(`N${currentRowIdx}`);
    saldoCell.value = granTotal - totalEjecutado;
    saldoCell.font = { name: this.fontFamily, size: 10, bold: true, color: { argb: this.colors.goldDarkText } };
    saldoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.colors.goldLight } };
    saldoCell.alignment = { horizontal: 'right', vertical: 'middle' };
    saldoCell.numFmt = '"S/" #,##0.00';

    const endCell = sheet.getCell(`O${currentRowIdx}`);
    endCell.value = `${items.length} partidas`;
    endCell.font = { name: this.fontFamily, size: 8.5, bold: true, color: { argb: this.colors.goldDarkText } };
    endCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.colors.goldLight } };
    endCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getCell(`P${currentRowIdx}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.colors.goldLight } };

    totalRow.height = 24;
    for (let c = 1; c <= 16; c++) {
      sheet.getRow(currentRowIdx).getCell(c).border = this.accountingTotalBorder;
    }

    sheet.autoFilter = { from: { row: 7, column: 1 }, to: { row: Math.max(8, currentRowIdx - 1), column: 16 } };

    this.addInstitutionalSignatures(sheet, currentRowIdx, 16);

    this.autoFitColumns(sheet, {
      1: 12, 2: 14, 3: 18, 4: 10, 5: 22, 6: 36, 7: 12, 8: 18,
      9: 8, 10: 10, 11: 14, 12: 14, 13: 14, 14: 12, 15: 12, 16: 18
    });
  }

  // =========================================================================
  // HOJA: CONTROL DE ASISTENCIA & GEOCERCA (Haversine 100m & Diligencias)
  // =========================================================================
  buildAsistenciaSheet(workbook) {
    const sheet = workbook.addWorksheet("ASISTENCIA Y TAREO", {
      views: [{ state: 'frozen', ySplit: 6, activeCell: 'A7', showGridLines: true }],
      properties: { tabColor: { argb: "0D9488" } }
    });

    const bInfoAtt = this.getBranchInfo(); const sedeNameAtt = (bInfoAtt.activeSede === "todas") ? "Consolidado Nacional" : bInfoAtt.branchName; this.addReportHeader(sheet, "REPORTE DE ASISTENCIA Y GEOLOCALIZACI\u00D3N", "Registro Oficial de Asistencia y Geolocalizaci\u00F3n en " + sedeNameAtt, 12, "Constantia et disciplina \u2014 Compromiso y rigurosidad diaria del equipo legal.");

    const headers = [
      "ID REGISTRO",
      "SEDE",
      "COLABORADOR",
      "DNI",
      "CARGO PROFESIONAL",
      "FECHA",
      "INGRESO",
      "SALIDA ALMUERZO",
      "RETORNO ALMUERZO",
      "SALIDA FINAL",
      "TIPO MARCACIÓN",
      "GEOCERCA",
      "DISTANCIA (m)",
      "MOTIVO DILIGENCIA",
      "DETALLE / SUSTENTO",
      "ESTADO APROBACIÓN"
    ];

    const headerRow = sheet.getRow(6);
    headerRow.values = headers;
    headerRow.eachCell(cell => {
      cell.font = { name: this.fontFamily, size: 9, bold: true, color: { argb: this.colors.textWhite } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.colors.headerNavy } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = this.thinBorder;
    });
    headerRow.height = 24;

    const fmtHora = (iso) => {
      if (!iso) return "-";
      try { return new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
      catch (_) { return String(iso); }
    };

    const records = window.db ? (window.db.get("attendance") || []) : [];
    let currentRowIdx = 7;

    records.forEach(r => {
      const row = sheet.getRow(currentRowIdx);
      row.values = [
        r.id || "-",
        r.sede || r.sedeId || "-",
        r.nombre || "-",
        r.dni || "-",
        r.cargo || "-",
        r.fecha || "-",
        fmtHora(r.ingreso),
        fmtHora(r.salidaAlmuerzo),
        fmtHora(r.retornoAlmuerzo),
        fmtHora(r.salida),
        r.tipoMarcacion || r.modalidad || "-",
        r.enGeocerca ? "EN GEOCERCA" : "FUERA DE GEOCERCA",
        r.distanciaMetros != null ? r.distanciaMetros : "-",
        r.motivoExterno || "-",
        r.justificacion || "-",
        String(r.estadoAprobacion || "aprobado").toUpperCase()
      ];
      row.height = 20;

      for (let c = 1; c <= 16; c++) {
        const cell = row.getCell(c);
        cell.font = { name: this.fontFamily, size: 8.5, color: { argb: this.colors.textDark } };
        cell.border = this.thinBorder;
        cell.alignment = { vertical: 'middle' };
        if ([1, 2, 4, 6, 7, 8, 9, 10, 11, 12, 13, 16].includes(c)) {
          cell.alignment.horizontal = 'center';
        }
      }

      const geoCell = row.getCell(12);
      if (r.enGeocerca) {
        geoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: "D1FAE5" } };
        geoCell.font = { name: this.fontFamily, size: 8.5, bold: true, color: { argb: "065F46" } };
      } else {
        geoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: "FEF3C7" } };
        geoCell.font = { name: this.fontFamily, size: 8.5, bold: true, color: { argb: "92400E" } };
      }

      const statusCell = row.getCell(16);
      if (r.estadoAprobacion === "aprobado" || !r.estadoAprobacion) {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: "D1FAE5" } };
        statusCell.font = { name: this.fontFamily, size: 8.5, bold: true, color: { argb: "065F46" } };
      } else if (r.estadoAprobacion === "pendiente") {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: "FEF3C7" } };
        statusCell.font = { name: this.fontFamily, size: 8.5, bold: true, color: { argb: "B45309" } };
      } else {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: "FEE2E2" } };
        statusCell.font = { name: this.fontFamily, size: 8.5, bold: true, color: { argb: "991B1B" } };
      }

      currentRowIdx++;
    });

    sheet.autoFilter = { from: { row: 6, column: 1 }, to: { row: Math.max(7, currentRowIdx - 1), column: 16 } };

    this.addInstitutionalSignatures(sheet, currentRowIdx, 16);

    this.autoFitColumns(sheet, {
      1: 14, 2: 14, 3: 26, 4: 12, 5: 22, 6: 12,
      7: 12, 8: 14, 9: 14, 10: 12, 11: 16, 12: 16,
      13: 12, 14: 24, 15: 28, 16: 16
    });
  }

  // =========================================================================
  // HOJA: PADRÓN Y DIRECTORIO DE PERSONAL PROFESIONAL MULTI-SEDE
  // =========================================================================
  buildPersonalSheet(workbook) {
    const branchInfo = this.getBranchInfo();
    const sheet = workbook.addWorksheet("PERSONAL Y SEDES", {
      views: [{ state: 'frozen', ySplit: 6, activeCell: 'A7', showGridLines: true }],
      properties: { tabColor: { argb: "4F46E5" } }
    });

    const sedeNameDisplay = (branchInfo.activeSede === "todas") ? "Consolidado Nacional" : branchInfo.branchName;
    this.addReportHeader(
      sheet,
      "PADRÓN Y DIRECTORIO GENERAL DE PERSONAL PROFESIONAL",
      `Sede: ${sedeNameDisplay} — Gestión de Personal y Control de Acceso (RBAC)`,
      13,
      "Diligens et fidelis — Rigor profesional, probidad e integridad en la labor jurídica."
    );

    const headers = [
      "N°",
      "ID REGISTRO",
      "DNI",
      "COLEGIATURA",
      "COLABORADOR",
      "CARGO / ESPECIALIDAD",
      "ROL SISTEMA",
      "SEDE ASIGNADA",
      "DESPACHO",
      "CORREO INSTITUCIONAL",
      "TELÉFONO / WHATSAPP",
      "ESTADO",
      "FECHA INGRESO"
    ];

    const headerRow = sheet.getRow(6);
    headers.forEach((h, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.value = h;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.colors.headerNavyMid } };
      cell.font = { name: this.fontFamily, size: 9, bold: true, color: { argb: this.colors.textWhite } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = this.thinBorder;
    });
    headerRow.height = 28;

    const workers = window.db.get("workers");
    let currentRowIdx = 7;

    workers.forEach((w, index) => {
      const row = sheet.getRow(currentRowIdx);
      const isZebra = (index % 2 === 1);
      const bgArgb = isZebra ? this.colors.zebraLight : "-";

      const sedeCfg = window.SEDES_CONFIG ? window.SEDES_CONFIG[w.sede] : null;
      const sedeLabel = sedeCfg ? sedeCfg.nombreCorto : (w.sede === "todas" ? "Consolidado Nacional" : w.sede);
      const rolLabel = window.db ? window.db.getRoleLabel(w.rol) : w.rol;
      const despachoLegacy = {
        "Despacho General 1": "Despacho 1",
        "Despacho General 2": "Despacho 2",
        "Despacho General 3": "Despacho 3",
        "Admin General": "Administrador General"
      };
      const despachoLabel = w.despacho ? (despachoLegacy[w.despacho] || w.despacho) : "-";

      row.values = [
        index + 1,
        w.id,
        w.dni,
        w.colegiatura || "-",
        w.nombre,
        w.cargo,
        rolLabel,
        sedeLabel,
        despachoLabel,
        w.email || "-",
        w.telefono || "-",
        (w.activo !== false) ? "ACTIVO" : "INACTIVO",
        w.fechaIngreso || "-"
      ];
      row.height = 22;

      for (let c = 1; c <= 13; c++) {
        const cell = row.getCell(c);
        cell.font = { name: this.fontFamily, size: 8.5, color: { argb: this.colors.textDark } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
        cell.border = this.thinBorder;
        cell.alignment = { vertical: 'middle' };
      }

      // Columnas centradas
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(9).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(12).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(13).alignment = { horizontal: 'center', vertical: 'middle' };

      const statusCell = row.getCell(12);
      if (w.activo !== false) {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: "D1FAE5" } };
        statusCell.font = { name: this.fontFamily, size: 8.5, bold: true, color: { argb: "065F46" } };
      } else {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: "FEE2E2" } };
        statusCell.font = { name: this.fontFamily, size: 8.5, bold: true, color: { argb: "991B1B" } };
      }

      currentRowIdx++;
    });

    sheet.autoFilter = { from: { row: 6, column: 1 }, to: { row: Math.max(7, currentRowIdx - 1), column: 13 } };

    this.addInstitutionalSignatures(sheet, currentRowIdx, 13);

    this.autoFitColumns(sheet, {
      1: 6,
      2: 14,
      3: 13,
      4: 16,
      5: 32,
      6: 28,
      7: 18,
      8: 20,
      9: 16,
      10: 28,
      11: 18,
      12: 14,
      13: 15
    });
  }

  // =========================================================================
  // EXPORTACIONES ESPECÍFICAS DE CADA MÓDULO INDIVIDUAL
  // =========================================================================
  async exportModule(moduleName) {
    try {
      await this._ensureExcelReady();

      const branchInfo = this.getBranchInfo();
      const slug = branchInfo.branchSlug;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = `PAOLO ALDEA & ABOGADOS - ${branchInfo.branchName}`;
      workbook.created = new Date();

      let fileName = "";

      if (moduleName === "asistencia") {
        this.buildAsistenciaSheet(workbook);
        fileName = `PAOLO_ALDEA_Control_Asistencia_y_Geocerca_${slug}_${getRelativeDateOnlyStr(0)}.xlsx`;
      } else if (moduleName === "caja_chica") {
        this.buildCajaChicaSheet(workbook);
        fileName = `PAOLO_ALDEA_Caja_Chica_${slug}_${getRelativeDateOnlyStr(0)}.xlsx`;
      } else if (moduleName === "presupuestos") {
        this.buildPresupuestosSheet(workbook);
        fileName = `PAOLO_ALDEA_Presupuesto_y_Proyecciones_${slug}_${getRelativeDateOnlyStr(0)}.xlsx`;
      } else if (moduleName === "casos") {
        this.buildCasosSheet(workbook);
        fileName = `PAOLO_ALDEA_Litigios_y_Plazos_${slug}_${getRelativeDateOnlyStr(0)}.xlsx`;
      } else if (moduleName === "resoluciones") {
        this.buildCasosSheet(workbook);
        fileName = `PAOLO_ALDEA_Resoluciones_y_Expedientes_${slug}_${getRelativeDateOnlyStr(0)}.xlsx`;
      } else if (moduleName === "citas") {
        this.buildCitasSheet(workbook);
        fileName = `PAOLO_ALDEA_Agenda_Citas_${slug}_${getRelativeDateOnlyStr(0)}.xlsx`;
      } else if (moduleName === "inventario") {
        this.buildInventarioSheet(workbook);
        fileName = `PAOLO_ALDEA_Inventario_ABC_${slug}_${getRelativeDateOnlyStr(0)}.xlsx`;
      } else if (moduleName === "documentos") {
        this.buildDocumentosSheet(workbook);
        fileName = `PAOLO_ALDEA_Gestion_Documental_${slug}_${getRelativeDateOnlyStr(0)}.xlsx`;
      } else if (moduleName === "personal") {
        this.buildPersonalSheet(workbook);
        fileName = `PAOLO_ALDEA_Directorio_Personal_${slug}_${getRelativeDateOnlyStr(0)}.xlsx`;
      }

      this.sanitizeWorkbookBeforeExport(workbook);
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      saveAs(blob, fileName);
      if (window.app?.showToast) {
        window.app.showToast("Módulo exportado a Excel exitosamente.", "success");
      }
    } catch (err) {
      console.error(`Error al exportar módulo ${moduleName} a Excel:`, err);
      if (window.app?.showToast) {
        window.app.showToast(`Error al exportar a Excel: ${err.message}`, "error");
      } else {
        alert(`Error al exportar: ${err.message}`);
      }
    }
  }

  // EXPORTACION INDIVIDUAL DE PARTIDA PRESUPUESTARIA EN EXCEL
  async exportSinglePresupuesto(presupuestoId) {
    try {
      await this._ensureExcelReady();

      const item = window.db.get("presupuestos").find(i => i.id === presupuestoId);
      if (!item) {
        alert("Partida presupuestaria no encontrada.");
        return;
      }

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "PAOLO ALDEA & ABOGADOS";
      workbook.lastModifiedBy = "Ing. Industrial / Control Operativo";
      workbook.created = new Date();

      const sheet = workbook.addWorksheet(`Partida ${item.id}`, {
        views: [{ showGridLines: true }]
      });

    // Encabezado institucional
    this.addReportHeader(
      sheet,
      "COMPROBANTE DE PARTIDA PRESUPUESTARIA — CONTROL SEDE CHALLHUAHUACHO",
      `Ficha Técnica & Justificación Financiera • Código de Partida: ${item.id}`,
      7
    );

    // Fila 4: Tarjeta de datos principales
    sheet.getRow(4).height = 20;
    sheet.getCell('A4').value = "CÓDIGO:";
    sheet.getCell('A4').font = { name: this.fontFamily, size: 9, bold: true, color: { argb: this.colors.headerNavy } };
    sheet.getCell('B4').value = item.id;
    sheet.getCell('B4').font = { name: this.fontFamily, size: 9, bold: true };
    sheet.getCell('C4').value = "C. COSTO:";
    sheet.getCell('C4').font = { name: this.fontFamily, size: 9, bold: true, color: { argb: this.colors.headerNavy } };
    sheet.getCell('D4').value = `${item.centroCosto || (item.id ? item.id.split('-')[1] : 'ADM')} • PCGE ${item.clasePcge || (item.id ? item.id.split('-')[2] : '63')}`;
    sheet.getCell('D4').font = { name: this.fontFamily, size: 9, bold: true, color: { argb: "1E40AF" } };
    sheet.getCell('E4').value = "ESTADO:";
    sheet.getCell('E4').font = { name: this.fontFamily, size: 9, bold: true, color: { argb: this.colors.headerNavy } };
    sheet.getCell('F4').value = item.estado;
    sheet.getCell('F4').font = { name: this.fontFamily, size: 9, bold: true, color: { argb: "047857" } };
    sheet.getCell('G4').value = `PRIORIDAD: ${item.prioridad || 'Alta'}`;
    sheet.getCell('G4').font = { name: this.fontFamily, size: 9, bold: true, color: { argb: "B45309" } };

    // Fila 5: Concepto y Categoría
    sheet.getRow(5).height = 22;
    sheet.getCell('A5').value = "CONCEPTO:";
    sheet.getCell('A5').font = { name: this.fontFamily, size: 9, bold: true, color: { argb: this.colors.headerNavy } };
    sheet.mergeCells('B5:D5');
    sheet.getCell('B5').value = item.concepto;
    sheet.getCell('B5').font = { name: this.fontFamily, size: 9.5, bold: true };

    sheet.getCell('E5').value = "CATEGORÍA:";
    sheet.getCell('E5').font = { name: this.fontFamily, size: 9, bold: true, color: { argb: this.colors.headerNavy } };
    sheet.mergeCells('F5:G5');
    sheet.getCell('F5').value = `${item.categoria} (${item.subcategoria || 'General'})`;
    sheet.getCell('F5').font = { name: this.fontFamily, size: 9, bold: true, color: { argb: "1E293B" } };

    // Fila 6: Responsable y Sede
    sheet.getRow(6).height = 20;
    sheet.getCell('A6').value = "RESPONSABLE:";
    sheet.getCell('A6').font = { name: this.fontFamily, size: 9, bold: true, color: { argb: this.colors.headerNavy } };
    sheet.mergeCells('B6:D6');
    sheet.getCell('B6').value = item.responsable || "Ing. Yimer Damián Soto";
    sheet.getCell('B6').font = { name: this.fontFamily, size: 9 };

    sheet.getCell('E6').value = "SEDE:";
    sheet.getCell('E6').font = { name: this.fontFamily, size: 9, bold: true, color: { argb: this.colors.headerNavy } };
    sheet.mergeCells('F6:G6');
    sheet.getCell('F6').value = "Sede Challhuahuacho - Cotabambas";
    sheet.getCell('F6').font = { name: this.fontFamily, size: 9, color: { argb: "047857" } };

    sheet.getRow(7).height = 10; // Espaciador

    // Fila 8: Encabezados de tabla de liquidación
    const headers = [
      "Concepto / Partida Presupuestaria",
      "",
      "Régimen / Frecuencia",
      "Cant.",
      "Unidad",
      "Costo Unitario",
      "Subtotal Proyectado"
    ];

    const hRow = sheet.getRow(8);
    hRow.values = headers;
    hRow.height = 26;
    sheet.mergeCells('A8:B8');
    hRow.eachCell((cell) => {
      cell.font = { name: this.fontFamily, size: 9, bold: true, color: { argb: this.colors.textWhite } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.colors.headerNavy } };
      cell.border = this.thinBorder;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // Fila 9: Datos de liquidación
    const dRow = sheet.getRow(9);
    dRow.values = [
      item.concepto,
      "",
      item.frecuencia || "-",
      item.cantidad,
      item.unidad || 'Unidad',
      Number(item.costoUnitario || 0),
      Number(item.subtotal || 0)
    ];
    dRow.height = 24;
    sheet.mergeCells('A9:B9');
    dRow.eachCell((cell, colNumber) => {
      cell.font = { name: this.fontFamily, size: 9.5, color: { argb: this.colors.textDark } };
      cell.border = this.thinBorder;
      cell.alignment = { vertical: 'middle' };

      if (colNumber === 1) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
        cell.font = { name: this.fontFamily, size: 9.5, bold: true };
      } else if (colNumber === 3 || colNumber === 4 || colNumber === 5) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (colNumber === 6) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '"S/" #,##0.00';
      } else if (colNumber === 7) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.font = { name: this.fontFamily, size: 10, bold: true, color: { argb: "065F46" } };
        cell.numFmt = '"S/" #,##0.00';
      }
    });

    // Fila 10: Total destacado
    sheet.getRow(10).height = 24;
    sheet.mergeCells('A10:F10');
    sheet.getCell('A10').value = "TOTAL PARTIDA PRESUPUESTARIA PROYECTADA:";
    sheet.getCell('A10').font = { name: this.fontFamily, size: 9.5, bold: true, color: { argb: this.colors.headerNavy } };
    sheet.getCell('A10').alignment = { vertical: 'middle', horizontal: 'right' };
    sheet.getCell('A10').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: "F1F5F9" } };
    sheet.getCell('A10').border = this.thinBorder;

    sheet.getCell('G10').value = Number(item.subtotal || 0);
    sheet.getCell('G10').font = { name: this.fontFamily, size: 11, bold: true, color: { argb: "065F46" } };
    sheet.getCell('G10').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: "D1FAE5" } };
    sheet.getCell('G10').alignment = { vertical: 'middle', horizontal: 'right' };
    sheet.getCell('G10').numFmt = '"S/" #,##0.00';
    sheet.getCell('G10').border = this.thinBorder;

    let nextRow = 12;

    if (item.montoEjecutado !== undefined && item.montoEjecutado !== null) {
      // Fila 11: Monto Ejecutado
      sheet.getRow(11).height = 22;
      sheet.mergeCells('A11:F11');
      sheet.getCell('A11').value = "MONTO REALMENTE EJECUTADO / LIQUIDADO:";
      sheet.getCell('A11').font = { name: this.fontFamily, size: 9.5, bold: true, color: { argb: "0F172A" } };
      sheet.getCell('A11').alignment = { vertical: 'middle', horizontal: 'right' };
      sheet.getCell('A11').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: "F8FAFC" } };
      sheet.getCell('A11').border = this.thinBorder;

      sheet.getCell('G11').value = Number(item.montoEjecutado);
      sheet.getCell('G11').font = { name: this.fontFamily, size: 10.5, bold: true, color: { argb: "1E3A8A" } };
      sheet.getCell('G11').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: "DBEAFE" } };
      sheet.getCell('G11').alignment = { vertical: 'middle', horizontal: 'right' };
      sheet.getCell('G11').numFmt = '"S/" #,##0.00';
      sheet.getCell('G11').border = this.thinBorder;

      // Fila 12: % Usado vs % No Usado
      sheet.getRow(12).height = 22;
      sheet.mergeCells('A12:F12');
      const pctUs = item.porcentajeUsado !== undefined ? item.porcentajeUsado : 100;
      const pctNo = item.porcentajeNoUsado !== undefined ? item.porcentajeNoUsado : 0;
      sheet.getCell('A12').value = `EFICIENCIA PRESUPUESTAL: ${pctUs}% USADO | ${pctNo}% NO USADO (SALDO DISPONIBLE):`;
      sheet.getCell('A12').font = { name: this.fontFamily, size: 9, bold: true, color: { argb: "78350F" } };
      sheet.getCell('A12').alignment = { vertical: 'middle', horizontal: 'right' };
      sheet.getCell('A12').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: "FEF3C7" } };
      sheet.getCell('A12').border = this.thinBorder;

      const saldoVal = Number(item.saldoRestante !== undefined ? item.saldoRestante : (Number(item.subtotal || 0) - Number(item.montoEjecutado)));
      sheet.getCell('G12').value = saldoVal;
      sheet.getCell('G12').font = { name: this.fontFamily, size: 10.5, bold: true, color: { argb: "78350F" } };
      sheet.getCell('G12').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: "FEF3C7" } };
      sheet.getCell('G12').alignment = { vertical: 'middle', horizontal: 'right' };
      sheet.getCell('G12').numFmt = '"S/" #,##0.00';
      sheet.getCell('G12').border = this.thinBorder;

      nextRow = 14;
    }

    // Desglose consolidado de múltiples subcategorías si existen
    if (item.subcategoriasActivas && item.subcategoriasActivas.length > 0) {
      sheet.getRow(nextRow).height = 20;
      sheet.mergeCells(`A${nextRow}:G${nextRow}`);
      sheet.getCell(`A${nextRow}`).value = `SUBCATEGORÍAS REGISTRADAS (${item.subcategoriasActivas.length} RUBROS CONSOLIDADOS)`;
      sheet.getCell(`A${nextRow}`).font = { name: this.fontFamily, size: 9, bold: true, color: { argb: "92400E" } };
      sheet.getCell(`A${nextRow}`).alignment = { vertical: 'middle' };
      nextRow++;

      const subHRow = sheet.getRow(nextRow);
      subHRow.values = ["Subcategoría", "", "Especificación / Detalle", "", "", "", "Subtotal"];
      subHRow.height = 22;
      sheet.mergeCells(`A${nextRow}:B${nextRow}`);
      sheet.mergeCells(`C${nextRow}:F${nextRow}`);
      subHRow.eachCell(cell => {
        cell.font = { name: this.fontFamily, size: 8.5, bold: true, color: { argb: "92400E" } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: "FEF3C7" } };
        cell.border = this.thinBorder;
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });
      nextRow++;

      item.subcategoriasActivas.forEach(s => {
        const sr = sheet.getRow(nextRow);
        sr.values = [s.name, "", s.detail, "", "", "", Number(s.amount || 0)];
        sr.height = 20;
        sheet.mergeCells(`A${nextRow}:B${nextRow}`);
        sheet.mergeCells(`C${nextRow}:F${nextRow}`);
        sr.eachCell((cell, col) => {
          cell.font = { name: this.fontFamily, size: 8.5 };
          cell.border = this.thinBorder;
          cell.alignment = { vertical: 'middle' };
          if (col === 7) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.font = { name: this.fontFamily, size: 9, bold: true, color: { argb: "065F46" } };
            cell.numFmt = '"S/" #,##0.00';
          }
        });
        nextRow++;
      });

      // Fila total subcategorías
      const subTotRow = sheet.getRow(nextRow);
      const subSum = item.subcategoriasActivas.reduce((acc, s) => acc + Number(s.amount || 0), 0);
      subTotRow.values = ["TOTAL SUBCATEGORÍAS:", "", "", "", "", "", subSum];
      subTotRow.height = 22;
      sheet.mergeCells(`A${nextRow}:F${nextRow}`);
      subTotRow.getCell(1).font = { name: this.fontFamily, size: 9, bold: true, color: { argb: "92400E" } };
      subTotRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };
      subTotRow.getCell(1).border = this.thinBorder;
      subTotRow.getCell(7).font = { name: this.fontFamily, size: 9.5, bold: true, color: { argb: "065F46" } };
      subTotRow.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: "D1FAE5" } };
      subTotRow.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
      subTotRow.getCell(7).numFmt = '"S/" #,##0.00';
      subTotRow.getCell(7).border = this.thinBorder;
      nextRow += 2;
    }

    // Subdesglose de Subcategoría Específica si existe
    if (item.detalleSubcategoria && item.detalleSubcategoria.data) {
      const d = item.detalleSubcategoria.data;
      const subcatTitulo = item.detalleSubcategoria.tipoSubcat || item.subcategoria;

      sheet.getRow(nextRow).height = 20;
      sheet.mergeCells(`A${nextRow}:G${nextRow}`);
      sheet.getCell(`A${nextRow}`).value = `FICHA DE SUBCATEGORÍA: ${subcatTitulo.toUpperCase()}`;
      sheet.getCell(`A${nextRow}`).font = { name: this.fontFamily, size: 9, bold: true, color: { argb: "1E40AF" } };
      sheet.getCell(`A${nextRow}`).alignment = { vertical: 'middle' };
      nextRow++;

      const subcatDetails = [];
      if (d.modalidad) subcatDetails.push(["Modalidad / Servicio:", d.modalidad]);
      if (d.ruta) subcatDetails.push(["Tramo / Ruta / Destino:", d.ruta]);
      if (d.empresa) subcatDetails.push(["Empresa / Operador:", d.empresa]);
      if (d.restaurante) subcatDetails.push(["Establecimiento / Restaurante:", d.restaurante]);
      if (d.hotel) subcatDetails.push(["Hotel / Hospedaje:", `${d.hotel} (${d.ciudad || 'Challhuahuacho'})`]);
      if (d.tipoHabitacion) subcatDetails.push(["Tipo de Habitación:", d.tipoHabitacion]);
      if (d.cargo) subcatDetails.push(["Función / Cargo Eventual:", d.cargo]);
      if (d.zona) subcatDetails.push(["Zona o Sector de Cobertura:", d.zona]);
      if (d.canal) subcatDetails.push(["Canal / Medio:", `${d.canal} — ${d.medio || ''}`]);
      if (d.tipoLetrero) subcatDetails.push(["Tipo de Letrero:", d.tipoLetrero]);
      if (d.medidas) subcatDetails.push(["Medidas / Especificaciones:", d.medidas]);
      if (d.tipoServicio) subcatDetails.push(["Tipo de Servicio Básico:", d.tipoServicio]);
      if (d.suministro) subcatDetails.push(["N° Suministro / Código Cliente:", d.suministro]);
      if (d.local) subcatDetails.push(["Inmueble / Sede:", d.local]);
      if (d.arrendador) subcatDetails.push(["Arrendador / Propietario:", d.arrendador]);
      if (d.sedeNotarial) subcatDetails.push(["Sede Notarial / Registral:", d.sedeNotarial]);
      if (d.actoNotarial) subcatDetails.push(["Acto Notarial SUNARP:", d.actoNotarial]);
      if (d.tipoActivo) subcatDetails.push(["Activo / Equipamiento TIC:", d.tipoActivo]);
      if (d.especificacion) subcatDetails.push(["Especificación / Modelo:", d.especificacion]);
      if (d.descripcion) subcatDetails.push(["Descripción / Ferretería:", d.descripcion]);

      subcatDetails.forEach(([campo, valor]) => {
        const sr = sheet.getRow(nextRow);
        sr.height = 19;
        sheet.mergeCells(`A${nextRow}:B${nextRow}`);
        sheet.mergeCells(`C${nextRow}:G${nextRow}`);
        sheet.getCell(`A${nextRow}`).value = campo;
        sheet.getCell(`A${nextRow}`).font = { name: this.fontFamily, size: 8.5, bold: true, color: { argb: this.colors.headerNavy } };
        sheet.getCell(`A${nextRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: "F8FAFC" } };
        sheet.getCell(`A${nextRow}`).border = this.thinBorder;
        sheet.getCell(`A${nextRow}`).alignment = { vertical: 'middle' };

        sheet.getCell(`C${nextRow}`).value = valor;
        sheet.getCell(`C${nextRow}`).font = { name: this.fontFamily, size: 8.5, color: { argb: this.colors.textDark } };
        sheet.getCell(`C${nextRow}`).border = this.thinBorder;
        sheet.getCell(`C${nextRow}`).alignment = { vertical: 'middle' };
        nextRow++;
      });
      nextRow++;
    }

    // Justificación / Notas si existen
    if (item.notas) {
      sheet.getRow(nextRow).height = 18;
      sheet.getCell(`A${nextRow}`).value = "SUSTENTO Y JUSTIFICACIÓN LOGÍSTICA / LEGAL:";
      sheet.getCell(`A${nextRow}`).font = { name: this.fontFamily, size: 9, bold: true, color: { argb: "92400E" } };
      nextRow++;

      sheet.getRow(nextRow).height = 24;
      sheet.mergeCells(`A${nextRow}:G${nextRow}`);
      sheet.getCell(`A${nextRow}`).value = item.notas;
      sheet.getCell(`A${nextRow}`).font = { name: this.fontFamily, size: 8.5, italic: true };
      sheet.getCell(`A${nextRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: "FEF3C7" } };
      sheet.getCell(`A${nextRow}`).alignment = { vertical: 'middle', wrapText: true };
      sheet.getCell(`A${nextRow}`).border = this.thinBorder;
      nextRow += 2;
    }

    // Firmas institucionales
    sheet.getRow(nextRow).height = 30;
    nextRow++;
    sheet.mergeCells(`B${nextRow}:C${nextRow}`);
    sheet.getCell(`B${nextRow}`).value = "____________________________________";
    sheet.getCell(`B${nextRow}`).alignment = { horizontal: 'center' };

    sheet.mergeCells(`E${nextRow}:F${nextRow}`);
    sheet.getCell(`E${nextRow}`).value = "____________________________________";
    sheet.getCell(`E${nextRow}`).alignment = { horizontal: 'center' };
    nextRow++;

    sheet.mergeCells(`B${nextRow}:C${nextRow}`);
    sheet.getCell(`B${nextRow}`).value = "Dr. Paolo Aldea - Abogado Director";
    sheet.getCell(`B${nextRow}`).font = { name: this.fontFamily, size: 9, bold: true };
    sheet.getCell(`B${nextRow}`).alignment = { horizontal: 'center' };

    sheet.mergeCells(`E${nextRow}:F${nextRow}`);
    sheet.getCell(`E${nextRow}`).value = "Ing. Industrial / Control Operativo";
    sheet.getCell(`E${nextRow}`).font = { name: this.fontFamily, size: 9, bold: true };
    sheet.getCell(`E${nextRow}`).alignment = { horizontal: 'center' };

    // Ancho de columnas
    sheet.getColumn(1).width = 34;
    sheet.getColumn(2).width = 20;
    sheet.getColumn(3).width = 18;
    sheet.getColumn(4).width = 12;
    sheet.getColumn(5).width = 15;
    sheet.getColumn(6).width = 18;
    sheet.getColumn(7).width = 20;

    const fileName = `PAOLO_ALDEA_Partida_${item.id}_Challhuahuacho_${getRelativeDateOnlyStr(0)}.xlsx`;
    this.sanitizeWorkbookBeforeExport(workbook);
      const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(blob, fileName);
    if (window.app?.showToast) {
      window.app.showToast(`Partida ${item.id} exportada a Excel correctamente.`, "success");
    }
  } catch (err) {
    console.error("Error al exportar partida presupuestaria:", err);
    if (window.app?.showToast) {
      window.app.showToast(`Error al exportar partida a Excel: ${err.message}`, "error");
    } else {
      alert(`Error al exportar: ${err.message}`);
    }
  }
}
}

// Instancia global
window.excelExporter = new LegalExcelExporter();
window.exportarAsistenciaExcel = () => window.excelExporter.exportModule("asistencia");
window.LegalExcelExporter = LegalExcelExporter;
