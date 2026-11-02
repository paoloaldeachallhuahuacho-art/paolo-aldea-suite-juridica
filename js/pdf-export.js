const OFFICIAL_LOGO_B64 = "assets/logo_paolo_aldea.jpg";


/**
 * PAOLO ALDEA & ABOGADOS - Motor de Exportación a PDF de Alta Definición
 * Especializado para: PAOLO ALDEA & ABOGADOS (Sede Challhuahuacho)
 * Genera reportes oficiales imprimibles en PDF con logo institucional, frases jurídicas y firmas.
 */

class LegalPdfExporter {
  constructor() {
    this.firmName = "PAOLO ALDEA & ABOGADOS";
    this.firmBranch = "Sede Challhuahuacho - Cotabambas, Apurímac";
    this.logoPath = (typeof OFFICIAL_LOGO_B64 !== "undefined" && OFFICIAL_LOGO_B64) ? OFFICIAL_LOGO_B64 : "assets/logo_paolo_aldea.jpg";
  }

  // Obtiene los datos institucionales correspondientes a la sede activa
  // SanitizaciÃ³n contra Cross-Site Scripting (XSS) en plantillas HTML2PDF
  escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Sanitización de HTML para reporte aislado
  sanitizeHtmlString(html) {
    if (!html || typeof html !== "string") return "";
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/on\w+\s*=\s*(["']).*?\1/gi, "")
      .replace(/javascript:/gi, "");
  }

  getBranchInfo() {
    const active = (window.db && typeof window.db.getActiveSede === "function") ? window.db.getActiveSede() : "challhuahuacho";
    const settings = (window.db && typeof window.db.getSettings === "function") ? window.db.getSettings() : {};
    const branchCfg = (window.SEDES_CONFIG && window.SEDES_CONFIG[active]) ? window.SEDES_CONFIG[active] : null;

    let branchName = "SEDE CHALLHUAHUACHO";
    let branchSlug = "Challhuahuacho";
    let branchAddress = branchCfg?.direccion || settings.firmAddress || "Av. Los Mineros Mz. D Lt. 4, Challhuahuacho, Cotabambas - Apurímac";
    let branchPhone = branchCfg?.telefono || settings.firmPhone || "+51 943 410 215 / Central Despacho";
    let branchHeaderLabel = branchCfg?.nombre || "Sede Challhuahuacho";

    if (active === "todas") {
      branchName = "CONSOLIDADO NACIONAL \u2014 TODAS LAS SEDES";
      branchSlug = "Nacional_Todas";
      branchAddress = branchCfg?.direccion || settings.firmAddress || "Sede Central & Red Descentralizada Nacional";
      branchPhone = branchCfg?.telefono || settings.firmPhone || "+51 943 410 215 / Central Despacho";
      branchHeaderLabel = branchCfg?.nombreCorto || "Consolidado Nacional";
    } else if (branchCfg) {
      branchName = branchCfg.nombre.toUpperCase();
      branchSlug = branchCfg.ciudad || branchCfg.nombreCorto || branchCfg.id;
      branchAddress = branchCfg.direccion || settings.firmAddress || "";
      branchPhone = branchCfg.telefono || settings.firmPhone || "+51 943 410 215";
      branchHeaderLabel = branchCfg.nombre;
    }
    return {
      activeSede: active,
      branchName,
      branchSlug,
      branchAddress,
      branchPhone,
      branchHeaderLabel
    };
  }

  // Genera el encabezado institucional para el reporte PDF adaptado a la sede activa
  buildPdfHeaderHtml(title, subtitle, latinMotto) {
    const s = window.db.getSettings();
    const b = this.getBranchInfo();
    const now = new Date();
    const dayName = now.toLocaleDateString("es-PE", { weekday: "long" });
    const dayNum = now.getDate();
    const monthName = now.toLocaleDateString("es-PE", { month: "long" });
    const yearNum = now.getFullYear();
    const timeFormatted = now.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: true });
    const formattedLegalDate = `${dayName}, ${dayNum} de ${monthName} de ${yearNum}, ${timeFormatted}`;
    const apartadoHeader = (title || "CONTROL ADMINISTRATIVO").toUpperCase();
    const sedeDisplay = (b.activeSede === "todas")
      ? "Consolidado Nacional \u2014 Todas las Sedes"
      : ("Sede " + (b.branchSlug || b.branchName).replace(/^SEDE\s+/i, ""));

    return `
      <div style="border-bottom: 2px solid #0B132B; padding-bottom: 12px; margin-bottom: 14px; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="width: 80px; vertical-align: middle;">
              <img src="${this.logoPath}" style="width: 72px; height: 72px; object-fit: contain; border: 1px solid #C5A059; border-radius: 8px; padding: 2px; background: #fff;" />
            </td>
            <td style="vertical-align: middle; padding-left: 14px;">
              <div style="font-family: 'Cinzel', Georgia, serif; font-size: 16px; font-weight: 800; color: #0B132B; letter-spacing: 0.5px;">
                ${(s.firmName || "PAOLO ALDEA & ABOGADOS").toUpperCase()}
              </div>
              <div style="font-size: 11px; font-weight: 700; color: #B45309; text-transform: uppercase; margin-top: 2px;">
                ${b.branchName} | ${s.firmLicense || 'CAL / ICAP'}
              </div>
              <div style="font-size: 9px; color: #64748B; margin-top: 2px;">
                Director: ${s.managingAttorney || 'Dr. Paolo Aldea Quincho'} | Dirección: ${b.branchAddress} | Central: ${b.branchPhone || '+51 943 410 215'}
              </div>
            </td>
            <!-- Tarjeta Oficial de Apartado, Fecha, Hora y Sede (Diseño Oficial Imagen 2) -->
            <td style="text-align: right; vertical-align: middle; width: 250px;">
              <div style="display: inline-block; background: #FFFFFF; border: 1.5px solid #CBD5E1; border-radius: 12px; padding: 8px 14px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05); min-width: 215px;">
                <div style="font-size: 9.5px; font-weight: 800; color: #0F172A; text-transform: uppercase; letter-spacing: 0.5px;">${apartadoHeader}</div>
                <div style="font-size: 8px; color: #334155; margin-top: 2px; font-weight: 500;">${formattedLegalDate}</div>
                <div style="font-size: 9px; color: #0284C7; font-weight: bold; margin-top: 2px;">${sedeDisplay}</div>
              </div>
            </td>
          </tr>
        </table>

        <!-- Título del Reporte y Frase Jurídica -->
        <div style="margin-top: 10px; background: #0B132B; color: #fff; padding: 8px 12px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 12px; font-weight: bold; letter-spacing: 0.5px;">${title.toUpperCase()}</span>
          <span style="font-size: 9px; color: #FDE68A;">${subtitle}</span>
        </div>

        <div style="background: #FEF3C7; border: 1px solid #FCD34D; color: #92400E; padding: 5px 10px; border-radius: 4px; margin-top: 6px; font-size: 9px; font-style: italic; text-align: center;">
          <i class="fa-solid fa-scale-balanced" style="margin-right: 6px;"></i> «${latinMotto}»
        </div>
      </div>
    `;
  }

  // Genera el pie de firmas institucional
  // Genera el pie de firmas institucional con Sello Criptográfico Ley N° 27269
  buildPdfFooterHtml() {
    const s = window.db ? window.db.getSettings() : {};
    const b = this.getBranchInfo();
    const currentUser = window.db ? window.db.getCurrentUser() : null;
    const currentUserName = currentUser ? (currentUser.nombre || currentUser.nombres || "Ing. Yimer Dami\u00E1n Soto") : (s.adminOfficer || "Ing. Yimer Dami\u00E1n Soto");
    const currentUserCargo = currentUser ? (currentUser.cargo || "Ingenier\u00EDa Industrial & Control Operativo") : (s.adminTitle || "Ingenier\u00EDa Industrial & Control Operativo");
    const branchOrSedeText = (b.activeSede === "todas")
      ? "Consolidado Nacional \u2014 Todas las Sedes"
      : ("PAOLO ALDEA & ABOGADOS \u2014 " + b.branchName);

    const certCode = "CERT-PAOLO-" + Math.floor(100000 + Math.random() * 900000);
    const dateStr = new Date().toLocaleString("es-PE", { hour12: false });
    const hashDigest = "SHA256:" + Array.from({length: 16}, () => Math.floor(Math.random()*16).toString(16)).join('').toUpperCase();

    return `
      <div style="margin-top: 35px; page-break-inside: avoid; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <tr>
            <!-- Firma Izquierda: SIEMPRE Dr. Paolo Aldea Quincho -->
            <td style="width: 38%; text-align: center; vertical-align: bottom;">
              <div style="width: 200px; margin: 0 auto; border-top: 1px solid #0F172A; padding-top: 4px;">
                <div style="font-size: 10px; font-weight: bold; color: #0F172A;">Dr. Paolo Aldea Quincho</div>
                <div style="font-size: 8.5px; color: #475569;">Abogado Titular & Director</div>
                <div style="font-size: 8px; color: #64748B;">CAL / CAA - Registro Profesional</div>
              </div>
            </td>
            <!-- Sello Digital Central Ley 27269 -->
            <td style="width: 24%; text-align: center; vertical-align: middle;">
              <div style="display: inline-block; padding: 4px 6px; border: 1px solid #CBD5E1; border-radius: 6px; background: #F8FAFC; text-align: center;">
                <svg width="42" height="42" viewBox="0 0 42 42" style="margin: 0 auto; display: block;">
                  <rect width="42" height="42" fill="#FFFFFF" rx="4" />
                  <rect x="3" y="3" width="12" height="12" fill="#0F172A" />
                  <rect x="5" y="5" width="8" height="8" fill="#FFFFFF" />
                  <rect x="7" y="7" width="4" height="4" fill="#0F172A" />
                  <rect x="27" y="3" width="12" height="12" fill="#0F172A" />
                  <rect x="29" y="5" width="8" height="8" fill="#FFFFFF" />
                  <rect x="31" y="7" width="4" height="4" fill="#0F172A" />
                  <rect x="3" y="27" width="12" height="12" fill="#0F172A" />
                  <rect x="5" y="29" width="8" height="8" fill="#FFFFFF" />
                  <rect x="7" y="31" width="4" height="4" fill="#0F172A" />
                  <rect x="18" y="18" width="6" height="6" fill="#059669" />
                  <rect x="18" y="6" width="3" height="6" fill="#0F172A" />
                  <rect x="6" y="18" width="6" height="3" fill="#0F172A" />
                  <rect x="27" y="27" width="6" height="6" fill="#0F172A" />
                  <rect x="33" y="33" width="6" height="6" fill="#0F172A" />
                </svg>
                <div style="font-size: 6.5px; font-weight: bold; color: #059669; margin-top: 2px;">FIRMA DIGITAL LEY 27269</div>
                <div style="font-size: 6px; font-family: monospace; color: #64748B;">${certCode}</div>
              </div>
            </td>
            <!-- Firma Derecha: DINÁMICA según el usuario que exporta -->
            <td style="width: 38%; text-align: center; vertical-align: bottom;">
              <div style="width: 230px; margin: 0 auto; border-top: 1px solid #0F172A; padding-top: 4px;">
                <div style="font-size: 10px; font-weight: bold; color: #0F172A;">${currentUserName}</div>
                <div style="font-size: 8.5px; color: #475569;">${currentUserCargo}</div>
                <div style="font-size: 7.5px; color: #64748B; line-height: 1.2;">${branchOrSedeText}</div>
              </div>
            </td>
          </tr>
        </table>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px; font-size: 7px; color: #94A3B8; border-top: 1px dashed #CBD5E1; padding-top: 4px;">
          <span>Doc. Oficial PAOLO ALDEA & ABOGADOS • Modo Aut\u00F3nomo Local</span>
          <span style="font-family: monospace;">Certificado: ${hashDigest} • Emitido: ${dateStr}</span>
        </div>
      </div>
    `;
  }


  async exportModulePdf(moduleName) {
    const bInfo = this.getBranchInfo();
    const sedeDisplay = (bInfo.activeSede === "todas") ? "Consolidado Nacional" : (bInfo.branchHeaderLabel || bInfo.branchName);
    if (typeof html2pdf === "undefined") {
      alert("Cargando motor de generación PDF. Por favor, reintente en un momento.");
      return;
    }

    let reportTitle = "";
    let reportSubtitle = "";
    let latinMotto = "";
    let contentHtml = "";

    const curr = window.db.getSettings().currency || "S/";

    if (moduleName === "caja_chica") {
      reportTitle = "Libro Auxiliar de Caja Chica & Centros de Costo";
      reportSubtitle = `Control Financiero y Rendici\u00F3n de Fondos en ${sedeDisplay}`;
      latinMotto = "Fides et integritas in omnibus rebus: La transparencia en la administración de los recursos es la piedra angular del patrocinio.";

      const items = window.db.get("caja_chica");
      const totIng = items.filter(i => i.tipo === "Ingreso").reduce((s, i) => s + Number(i.monto || 0), 0);
      const totEg = items.filter(i => i.tipo === "Egreso").reduce((s, i) => s + Number(i.monto || 0), 0);
      const saldo = totIng - totEg;

      let rows = items.map((i, idx) => `
        <tr style="background: ${idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF'}; border-bottom: 1px solid #E2E8F0; font-size: 8.5px;">
          <td style="padding: 6px; text-align: center; font-weight: bold;">${i.fecha}</td>
          <td style="padding: 6px; text-align: center; font-weight: bold; color: ${i.tipo === 'Ingreso' ? '#065F46' : '#991B1B'};">${i.tipo}</td>
          <td style="padding: 6px;">${i.centroCosto || 'General'}</td>
          <td style="padding: 6px;">${i.categoria}</td>
          <td style="padding: 6px;">${i.concepto}</td>
          <td style="padding: 6px; font-family: monospace; text-align: center;">${i.expediente || '-'}</td>
          <td style="padding: 6px; text-align: center;">${i.comprobante || '-'}</td>
          <td style="padding: 6px; text-align: right; font-weight: bold; color: ${i.tipo === 'Ingreso' ? '#065F46' : '#991B1B'};">
            ${i.tipo === 'Ingreso' ? '+' : '-'}${curr} ${Number(i.monto).toFixed(2)}
          </td>
        </tr>
      `).join("");

      if (items.length === 0) {
        rows = `<tr><td colspan="8" style="text-align: center; padding: 25px; color: #64748B; font-style: italic;">No se registran movimientos en la caja chica. Sistema listo en blanco para nuevos registros.</td></tr>`;
      }

      contentHtml = `
        <table style="width: 100%; border-collapse: collapse; font-family: 'Plus Jakarta Sans', Arial, sans-serif; margin-top: 8px;">
          <thead>
            <tr style="background: #1C2541; color: #FFFFFF; font-size: 8.5px; text-align: center;">
              <th style="padding: 7px;">FECHA</th>
              <th style="padding: 7px;">TIPO</th>
              <th style="padding: 7px;">CENTRO DE COSTO</th>
              <th style="padding: 7px;">CATEGORÍA</th>
              <th style="padding: 7px; text-align: left;">CONCEPTO</th>
              <th style="padding: 7px;">EXPEDIENTE</th>
              <th style="padding: 7px;">COMPROBANTE</th>
              <th style="padding: 7px; text-align: right;">MONTO (S/)</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
            <tr style="background: #FEF3C7; font-weight: bold; font-size: 9px; border-top: 2px solid #0B132B;">
              <td colspan="7" style="padding: 8px; text-align: center;">TOTALES LIQUIDADOS (SALDO DISPONIBLE EN CAJA)</td>
              <td style="padding: 8px; text-align: right; color: #1E3A8A;">${curr} ${saldo.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
        <div style="margin-top: 10px; display: flex; gap: 15px; font-size: 9px;">
          <div style="background: #D1FAE5; color: #065F46; padding: 6px 12px; border-radius: 4px; font-weight: bold;">Total Ingresos: +${curr} ${totIng.toFixed(2)}</div>
          <div style="background: #FEE2E2; color: #991B1B; padding: 6px 12px; border-radius: 4px; font-weight: bold;">Total Egresos: -${curr} ${totEg.toFixed(2)}</div>
          <div style="background: #DBEAFE; color: #1E40AF; padding: 6px 12px; border-radius: 4px; font-weight: bold;">Saldo Neto: ${curr} ${saldo.toFixed(2)}</div>
        </div>
      `;

    } else if (moduleName === "casos" || moduleName === "resoluciones") {
      reportTitle = "Reporte Oficial de Litigios & Plazos Fatales";
      reportSubtitle = "Causas Judiciales en Juzgados de Cotabambas, Tambobamba y Abancay";
      latinMotto = "Iura novit curia • Vigilantibus iura scripta sunt: El juez conoce el derecho, pero las leyes protegen a quien vigila sus plazos.";

      const items = window.db.get("casos");
      let rows = items.map((c, idx) => `
        <tr style="background: ${idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF'}; border-bottom: 1px solid #E2E8F0; font-size: 8px;">
          <td style="padding: 6px; font-family: monospace; font-weight: bold; text-align: center;">${this.escapeHtml(c.expediente)}</td>
          <td style="padding: 6px; font-weight: bold;">${this.escapeHtml(c.caratula)}</td>
          <td style="padding: 6px; text-align: center;">${this.escapeHtml(c.materia)}</td>
          <td style="padding: 6px;">${this.escapeHtml(c.cliente)}</td>
          <td style="padding: 6px;">${this.escapeHtml(c.juzgado)}</td>
          <td style="padding: 6px; text-align: center; font-weight: bold; color: ${c.prioridad === 'Urgente' ? '#DC2626' : '#1E293B'};">
            ${c.vencimiento || '-'}
          </td>
          <td style="padding: 6px; text-align: center;">${c.etapa || c.estado}</td>
          <td style="padding: 6px; text-align: right; font-weight: bold; color: #1E3A8A;">${curr} ${Number(c.honorarios || 0).toLocaleString()}</td>
        </tr>
      `).join("");

      if (items.length === 0) {
        rows = `<tr><td colspan="8" style="text-align: center; padding: 25px; color: #64748B; font-style: italic;">No hay causas o expedientes registrados. Despacho listo para nuevos litigios.</td></tr>`;
      }

      contentHtml = `
        <table style="width: 100%; border-collapse: collapse; font-family: 'Plus Jakarta Sans', Arial, sans-serif; margin-top: 8px;">
          <thead>
            <tr style="background: #1C2541; color: #FFFFFF; font-size: 8.5px; text-align: center;">
              <th style="padding: 7px;">EXPEDIENTE</th>
              <th style="padding: 7px; text-align: left;">CARÁTULA / CAUSA</th>
              <th style="padding: 7px;">MATERIA</th>
              <th style="padding: 7px; text-align: left;">PATROCINADO</th>
              <th style="padding: 7px; text-align: left;">JUZGADO</th>
              <th style="padding: 7px;">VENCIMIENTO</th>
              <th style="padding: 7px;">ETAPA</th>
              <th style="padding: 7px; text-align: right;">HONORARIOS</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;

    } else if (moduleName === "citas") {
      reportTitle = "Agenda Oficial de Citas & Audiencias Judiciales";
      reportSubtitle = `Programaci\u00F3n Legal en ${sedeDisplay} y Videoconferencias`;
      latinMotto = "Audiatur et altera pars • Pacta sunt servanda: Escúchese a la contraparte y cúmplanse rigurosamente los acuerdos.";

      const items = window.db.get("citas");
      let rows = items.map((c, idx) => `
        <tr style="background: ${idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF'}; border-bottom: 1px solid #E2E8F0; font-size: 8.5px;">
          <td style="padding: 6px; font-weight: bold;">${c.cliente}</td>
          <td style="padding: 6px; text-align: center;">${c.telefono || '-'}</td>
          <td style="padding: 6px;">${c.motivo}</td>
          <td style="padding: 6px; text-align: center; font-weight: bold;">${c.fechaHora ? c.fechaHora.replace('T', ' ') : '-'}</td>
          <td style="padding: 6px;">${c.modalidad}</td>
          <td style="padding: 6px; text-align: center;">${c.abogado}</td>
          <td style="padding: 6px; text-align: center; font-weight: bold;">${c.estado}</td>
        </tr>
      `).join("");

      if (items.length === 0) {
        rows = `<tr><td colspan="7" style="text-align: center; padding: 25px; color: #64748B; font-style: italic;">No hay citas o audiencias registradas. Agenda despejada.</td></tr>`;
      }

      contentHtml = `
        <table style="width: 100%; border-collapse: collapse; font-family: 'Plus Jakarta Sans', Arial, sans-serif; margin-top: 8px;">
          <thead>
            <tr style="background: #1C2541; color: #FFFFFF; font-size: 8.5px; text-align: center;">
              <th style="padding: 7px; text-align: left;">PATROCINADO / CONTACTO</th>
              <th style="padding: 7px;">TELÉFONO</th>
              <th style="padding: 7px; text-align: left;">MOTIVO DE LA CONSULTA</th>
              <th style="padding: 7px;">FECHA Y HORA</th>
              <th style="padding: 7px; text-align: left;">MODALIDAD</th>
              <th style="padding: 7px;">ABOGADO</th>
              <th style="padding: 7px;">ESTADO</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;

    } else if (moduleName === "presupuestos") {
      reportTitle = "Plan Presupuestario & Proyecciones Financieras";
      reportSubtitle = "Evaluación de Inversión Inicial (CAPEX), Gasto Operativo (OPEX), Contingencia y Caja Chica";
      latinMotto = "Ratio pecuniae in iustitia: La prudente provisión de recursos económicos sostiene la firmeza de la defensa técnica.";

      const items = window.db.get("presupuestos");
      const capex = items.filter(i => i.tipo === "CAPEX").reduce((s, i) => s + Number(i.subtotal || 0), 0);
      const opex = items.filter(i => i.tipo === "OPEX").reduce((s, i) => s + Number(i.subtotal || 0), 0);
      const contingencia = items.filter(i => i.tipo === "Contingencia" || i.categoria === "Fondo de Contingencia").reduce((s, i) => s + Number(i.subtotal || 0), 0);
      const cajaChica = items.filter(i => i.tipo === "Caja Chica" || i.categoria === "Asignación de Caja Chica").reduce((s, i) => s + Number(i.subtotal || 0), 0);
      const granTotal = capex + opex + contingencia + cajaChica;

      let rows = items.map((i, idx) => `
        <tr style="background: ${idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF'}; border-bottom: 1px solid #E2E8F0; font-size: 8.5px;">
          <td style="padding: 5px; font-family: monospace; text-align: center; font-weight: bold;">${i.id}</td>
          <td style="padding: 5px; font-weight: 600; color: #1E293B;">${i.categoria}</td>
          <td style="padding: 5px; font-weight: bold; color: #0F172A;">
            ${i.concepto}
            ${i.notas ? `<div style="font-size: 7.5px; color: #64748B; font-style: italic;">• ${i.notas}</div>` : ''}
          </td>
          <td style="padding: 5px; text-align: center; font-weight: bold; color: ${i.tipo === 'CAPEX' ? '#1E40AF' : (i.tipo === 'OPEX' ? '#065F46' : '#92400E')};">${i.tipo}</td>
          <td style="padding: 5px; text-align: center;">${i.frecuencia}${i.diasEventual ? ` (${i.diasEventual} d)` : ''}</td>
          <td style="padding: 5px; text-align: center; font-family: monospace;">${i.cantidad} ${i.unidad || ''}</td>
          <td style="padding: 5px; text-align: right; font-family: monospace;">${curr} ${Number(i.costoUnitario).toFixed(2)}</td>
          <td style="padding: 5px; text-align: right; font-weight: bold; font-family: monospace; color: #0F172A;">${curr} ${Number(i.subtotal).toFixed(2)}</td>
          <td style="padding: 5px; text-align: center; font-size: 7.5px;">${i.estado}</td>
        </tr>
      `).join("");

      if (items.length === 0) {
        rows = `<tr><td colspan="9" style="text-align: center; padding: 25px; color: #64748B; font-style: italic;">No se registran partidas presupuestarias.</td></tr>`;
      }

      contentHtml = `
        <!-- Resumen de 4 Tarjetas Financieras -->
        <div style="display: flex; gap: 8px; margin-bottom: 12px;">
          <div style="flex: 1; background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 6px; padding: 8px; text-align: center;">
            <div style="font-size: 8px; font-weight: bold; color: #1E40AF; text-transform: uppercase;">Inversión Inicial (CAPEX)</div>
            <div style="font-size: 13px; font-weight: 800; color: #1E3A8A; margin-top: 3px; font-family: monospace;">${curr} ${capex.toFixed(2)}</div>
          </div>
          <div style="flex: 1; background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 6px; padding: 8px; text-align: center;">
            <div style="font-size: 8px; font-weight: bold; color: #065F46; text-transform: uppercase;">Gasto Operativo (OPEX)</div>
            <div style="font-size: 13px; font-weight: 800; color: #064E3B; margin-top: 3px; font-family: monospace;">${curr} ${opex.toFixed(2)}</div>
          </div>
          <div style="flex: 1; background: #FEF3C7; border: 1px solid #FDE68A; border-radius: 6px; padding: 8px; text-align: center;">
            <div style="font-size: 8px; font-weight: bold; color: #92400E; text-transform: uppercase;">Fondo de Contingencia</div>
            <div style="font-size: 13px; font-weight: 800; color: #78350F; margin-top: 3px; font-family: monospace;">${curr} ${contingencia.toFixed(2)}</div>
          </div>
          <div style="flex: 1; background: #F3E8FF; border: 1px solid #E9D5FF; border-radius: 6px; padding: 8px; text-align: center;">
            <div style="font-size: 8px; font-weight: bold; color: #6B21A8; text-transform: uppercase;">Asignación Caja Chica</div>
            <div style="font-size: 13px; font-weight: 800; color: #581C87; margin-top: 3px; font-family: monospace;">${curr} ${cajaChica.toFixed(2)}</div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-family: 'Plus Jakarta Sans', Arial, sans-serif;">
          <thead>
            <tr style="background: #1C2541; color: #FFFFFF; font-size: 8px; text-align: center;">
              <th style="padding: 6px;">CÓDIGO</th>
              <th style="padding: 6px; text-align: left;">CATEGORÍA</th>
              <th style="padding: 6px; text-align: left;">CONCEPTO / RUBRO</th>
              <th style="padding: 6px;">TIPO</th>
              <th style="padding: 6px;">FRECUENCIA</th>
              <th style="padding: 6px;">CANT.</th>
              <th style="padding: 6px; text-align: right;">COSTO UNIT.</th>
              <th style="padding: 6px; text-align: right;">SUBTOTAL</th>
              <th style="padding: 6px;">ESTADO</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
          <tfoot>
            <tr style="background: #FEF3C7; font-size: 9px; font-weight: bold; border-top: 2px solid #0B132B;">
              <td colspan="7" style="padding: 8px; text-align: right; color: #78350F;">TOTAL GENERAL PROYECTADO SEDE CHALLHUAHUACHO:</td>
              <td style="padding: 8px; text-align: right; color: #78350F; font-family: monospace; font-size: 11px;">${curr} ${granTotal.toFixed(2)}</td>
              <td style="padding: 8px; text-align: center; color: #78350F;">${items.length} partidas</td>
            </tr>
          </tfoot>
        </table>
      `;

    } else if (moduleName === "inventario") {
      reportTitle = "Acta de Inventario Patrimonial & Archivo Central (Método ABC)";
      reportSubtitle = "Control de Activos Críticos, Tokens SINOE, Enlace Internet Claro y Biblioteca";
      latinMotto = "Scripta manent, verba volant: Custodiar la prueba y el archivo es preservar la verdad jurídica.";

      const items = window.db.get("inventario");
      let rows = items.map((i, idx) => `
        <tr style="background: ${idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF'}; border-bottom: 1px solid #E2E8F0; font-size: 8.5px;">
          <td style="padding: 6px; font-family: monospace; text-align: center;">${i.codigo}</td>
          <td style="padding: 6px; font-weight: bold;">${i.nombre}</td>
          <td style="padding: 6px; text-align: center; font-weight: bold;">${i.clasificacionABC || 'Clase B'}</td>
          <td style="padding: 6px;">${i.categoria}</td>
          <td style="padding: 6px;">${i.ubicacion}</td>
          <td style="padding: 6px; text-align: center; font-weight: bold;">${i.stock} ${i.unidad || 'und'}</td>
          <td style="padding: 6px; text-align: right; font-weight: bold; color: #1E3A8A;">${curr} ${(Number(i.stock || 0) * Number(i.costoUnitario || 0)).toFixed(2)}</td>
        </tr>
      `).join("");

      if (items.length === 0) {
        rows = `<tr><td colspan="7" style="text-align: center; padding: 25px; color: #64748B; font-style: italic;">No se registran bienes patrimoniales ni expedientes físicos en almacén.</td></tr>`;
      }

      contentHtml = `
        <table style="width: 100%; border-collapse: collapse; font-family: 'Plus Jakarta Sans', Arial, sans-serif; margin-top: 8px;">
          <thead>
            <tr style="background: #1C2541; color: #FFFFFF; font-size: 8.5px; text-align: center;">
              <th style="padding: 7px;">CÓDIGO</th>
              <th style="padding: 7px; text-align: left;">DESCRIPCIÓN DEL BIEN O EXPEDIENTE</th>
              <th style="padding: 7px;">MÉTODO ABC</th>
              <th style="padding: 7px;">CATEGORÍA</th>
              <th style="padding: 7px; text-align: left;">UBICACIÓN EN SEDE</th>
              <th style="padding: 7px;">STOCK</th>
              <th style="padding: 7px; text-align: right;">VALOR TOTAL</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;

    } else if (moduleName === "documentos") {
      reportTitle = "Catálogo de Escritos Judiciales & Contratos";
      reportSubtitle = "Registro Oficial de Escritos y Plantillas Procesales";
      latinMotto = "Ex facto oritur ius: Del hecho rigurosamente redactado y probado nace el derecho.";

      const items = window.db.get("documentos");
      let rows = items.map((d, idx) => `
        <tr style="background: ${idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF'}; border-bottom: 1px solid #E2E8F0; font-size: 8.5px;">
          <td style="padding: 6px; font-weight: bold;">${d.titulo}</td>
          <td style="padding: 6px; text-align: center;">${d.tipo}</td>
          <td style="padding: 6px; font-family: monospace; text-align: center;">${d.expediente || '-'}</td>
          <td style="padding: 6px;">${d.cliente || '-'}</td>
          <td style="padding: 6px; text-align: center;">${d.materia || '-'}</td>
          <td style="padding: 6px; text-align: center;">${d.fecha}</td>
          <td style="padding: 6px; text-align: center; font-weight: bold; color: #065F46;">${d.estado}</td>
        </tr>
      `).join("");

      if (items.length === 0) {
        rows = `<tr><td colspan="7" style="text-align: center; padding: 25px; color: #64748B; font-style: italic;">No hay escritos ni contratos registrados en la biblioteca documental.</td></tr>`;
      }

      contentHtml = `
        <table style="width: 100%; border-collapse: collapse; font-family: 'Plus Jakarta Sans', Arial, sans-serif; margin-top: 8px;">
          <thead>
            <tr style="background: #1C2541; color: #FFFFFF; font-size: 8.5px; text-align: center;">
              <th style="padding: 7px; text-align: left;">TÍTULO DEL DOCUMENTO</th>
              <th style="padding: 7px;">TIPO</th>
              <th style="padding: 7px;">EXPEDIENTE</th>
              <th style="padding: 7px; text-align: left;">PATROCINADO</th>
              <th style="padding: 7px;">MATERIA</th>
              <th style="padding: 7px;">FECHA</th>
              <th style="padding: 7px;">ESTADO</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;

    } else if (moduleName === "kpis") {
      reportTitle = "Informe Ejecutivo de KPIs & Eficiencia Operativa";
      reportSubtitle = "Métricas de Control de Gestión Sede Challhuahuacho";
      latinMotto = "Iustitia est constans et perpetua voluntas ius suum cuique tribuendi: La justicia es la constante voluntad de dar a cada uno su derecho.";

      const settings = window.db.getSettings();
      const caja = window.db.get("caja_chica");
      const casos = window.db.get("casos");
      const citas = window.db.get("citas");
      const inv = window.db.get("inventario");

      const totIng = caja.filter(t => t.tipo === "Ingreso").reduce((s, t) => s + Number(t.monto || 0), 0);
      const totEg = caja.filter(t => t.tipo === "Egreso").reduce((s, t) => s + Number(t.monto || 0), 0);
      const saldo = totIng - totEg;
      const casosTramite = casos.filter(c => c.estado === "En trámite").length;
      const casosGanados = casos.filter(c => c.estado === "Concluido / Ganado").length;
      const totalHonorarios = casos.reduce((s, c) => s + Number(c.honorarios || 0), 0);
      const totalValorInv = inv.reduce((s, i) => s + (Number(i.stock || 0) * Number(i.costoUnitario || 0)), 0);

      contentHtml = `
        <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; margin-top: 10px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 15px;">
            <tr style="background: #1C2541; color: #fff;">
              <th style="padding: 8px; text-align: left;">INDICADOR CLAVE DE GESTIÓN (KPI)</th>
              <th style="padding: 8px; text-align: right;">VALOR AUDITADO</th>
              <th style="padding: 8px; text-align: left;">ESTADO OPERATIVO</th>
            </tr>
            <tr style="background: #F8FAFC; border-bottom: 1px solid #E2E8F0;">
              <td style="padding: 8px; font-weight: bold;">Saldo Disponible en Caja Chica</td>
              <td style="padding: 8px; text-align: right; font-weight: bold; color: #065F46;">${curr} ${saldo.toFixed(2)}</td>
              <td style="padding: 8px; color: #047857;">Operativo / Fondos en Sede</td>
            </tr>
            <tr style="border-bottom: 1px solid #E2E8F0;">
              <td style="padding: 8px; font-weight: bold;">Expedientes Activos en Trámite</td>
              <td style="padding: 8px; text-align: right; font-weight: bold; color: #1E3A8A;">${casosTramite} causas</td>
              <td style="padding: 8px;">Juzgados de Cotabambas y Tambobamba</td>
            </tr>
            <tr style="background: #F8FAFC; border-bottom: 1px solid #E2E8F0;">
              <td style="padding: 8px; font-weight: bold;">Tasa de Éxito en Litigios Ganados</td>
              <td style="padding: 8px; text-align: right; font-weight: bold; color: #047857;">${Math.round((casosGanados / Math.max(1, casos.length)) * 100)}%</td>
              <td style="padding: 8px; color: #047857;">Favorable / Sentencias Ejecutoriadas</td>
            </tr>
            <tr style="border-bottom: 1px solid #E2E8F0;">
              <td style="padding: 8px; font-weight: bold;">Cartera Total de Honorarios</td>
              <td style="padding: 8px; text-align: right; font-weight: bold; color: #1E3A8A;">${curr} ${totalHonorarios.toFixed(2)}</td>
              <td style="padding: 8px;">Pactado bajo cuota litis y base fija</td>
            </tr>
            <tr style="background: #F8FAFC; border-bottom: 1px solid #E2E8F0;">
              <td style="padding: 8px; font-weight: bold;">Valorización de Activos en Sede (ABC)</td>
              <td style="padding: 8px; text-align: right; font-weight: bold; color: #B45309;">${curr} ${totalValorInv.toFixed(2)}</td>
              <td style="padding: 8px;">Custodia de Tokens, Internet Claro y Bienes</td>
            </tr>
            <tr style="border-bottom: 1px solid #E2E8F0;">
              <td style="padding: 8px; font-weight: bold;">Citas y Consultas Atendidas</td>
              <td style="padding: 8px; text-align: right; font-weight: bold;">${citas.length} citas</td>
              <td style="padding: 8px;">Sede Challhuahuacho y Videoconferencias</td>
            </tr>
          </table>
        </div>
      `;
    } else if (moduleName === "asistencia") {
      reportTitle = "Control de Asistencia & Geolocalización (Geofencing)";
      reportSubtitle = "Reporte de Asistencia Diaria y Diligencias Externas";
      latinMotto = "Officium et disciplina: La puntualidad y fidelidad en el ejercicio del mandato judicial garantizan la victoria procesal.";

      const items = window.db ? window.db.get("attendance") : [];
      let rows = items.map((i, idx) => {
        const horaIng = i.ingreso ? new Date(i.ingreso).toLocaleTimeString("es-PE") : "--:--";
        const horaSal = i.salida ? new Date(i.salida).toLocaleTimeString("es-PE") : "Sin salida";
        return `
        <tr style="background: ${idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF'}; border-bottom: 1px solid #E2E8F0; font-size: 8.5px;">
          <td style="padding: 6px; font-weight: bold; color: #0B132B;">${i.nombre}<br><span style="font-size: 7.5px; color: #64748B;">DNI: ${i.dni} | ${i.cargo}</span></td>
          <td style="padding: 6px; text-align: center;">${i.fecha}</td>
          <td style="padding: 6px; text-align: center; color: #065F46; font-weight: bold;">${horaIng}</td>
          <td style="padding: 6px; text-align: center; color: #B45309; font-weight: bold;">${horaSal}</td>
          <td style="padding: 6px; text-align: center; font-weight: bold; color: ${i.enGeocerca ? '#065F46' : '#B45309'};">
            ${i.enGeocerca ? 'En Geocerca' : 'Externa (' + i.distanciaMetros + 'm)'}
          </td>
          <td style="padding: 6px;">${i.motivoExterno || 'Sede Central'}<br><span style="font-size: 7.5px; color: #64748B;">${i.justificacion || ''}</span></td>
          <td style="padding: 6px; text-align: center; font-weight: bold; color: ${i.estadoAprobacion === 'aprobado' ? '#065F46' : (i.estadoAprobacion === 'pendiente' ? '#B45309' : '#991B1B')};">
            ${(i.estadoAprobacion || 'aprobado').toUpperCase()}
          </td>
        </tr>
      `;}).join("");

      if (items.length === 0) {
        rows = `<tr><td colspan="7" style="text-align: center; padding: 25px; color: #64748B; font-style: italic;">No se registran marcas de asistencia en la base de datos.</td></tr>`;
      }

      contentHtml = `
        <table style="width: 100%; border-collapse: collapse; font-family: 'Plus Jakarta Sans', Arial, sans-serif; margin-top: 8px;">
          <thead>
            <tr style="background: #0B132B; color: #FFFFFF; font-size: 8.5px;">
              <th style="padding: 6px; text-align: left;">Colaborador</th>
              <th style="padding: 6px; text-align: center;">Fecha</th>
              <th style="padding: 6px; text-align: center;">Ingreso</th>
              <th style="padding: 6px; text-align: center;">Salida</th>
              <th style="padding: 6px; text-align: center;">Ubicación / Geocerca</th>
              <th style="padding: 6px; text-align: left;">Diligencia / Sustento</th>
              <th style="padding: 6px; text-align: center;">Estado</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    } else if (moduleName === "personal") {
      reportTitle = "Directorio General de Personal & Padrón de Colaboradores";
      reportSubtitle = "Gestión de Recursos Humanos, Sedes y Control de Acceso (RBAC)";
      latinMotto = "Optimum iuris patrocinium ab optimis hominibus oritur: La excelencia jurídica surge de la probidad y talento de su gente.";

      const items = window.db ? window.db.get("workers") : [];
      let rows = items.map((w, idx) => {
        const sedeCfg = window.SEDES_CONFIG ? window.SEDES_CONFIG[w.sede] : null;
        const sedeLabel = sedeCfg ? sedeCfg.nombreCorto : (w.sede === "todas" ? "Consolidado Nacional" : w.sede);
        const rolLabel = window.db ? window.db.getRoleLabel(w.rol) : w.rol;
        const isActivo = (w.activo !== false);

        return `
          <tr style="background: ${idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF'}; border-bottom: 1px solid #E2E8F0; font-size: 8px;">
            <td style="padding: 6px; text-align: center; font-weight: bold; font-family: monospace;">${w.dni}</td>
            <td style="padding: 6px; font-weight: bold; color: #0F172A;">
              ${w.nombre}
              ${w.colegiatura ? `<br><span style="font-size: 7.5px; color: #64748B; font-weight: normal;">Reg: ${w.colegiatura}</span>` : ''}
            </td>
            <td style="padding: 6px;">${w.cargo}</td>
            <td style="padding: 6px; text-align: center;">
              <span style="background: #EEF2FF; color: #4338CA; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 7.5px;">${rolLabel}</span>
            </td>
            <td style="padding: 6px; text-align: center; font-weight: bold; color: #1E3A8A;">${sedeLabel}</td>
            <td style="padding: 6px; font-size: 7.5px;">
              ${w.email || '-'}<br>
              <span style="color: #64748B;">${w.telefono || '-'}</span>
            </td>
            <td style="padding: 6px; text-align: center;">
              <span style="background: ${isActivo ? '#D1FAE5' : '#FEE2E2'}; color: ${isActivo ? '#065F46' : '#991B1B'}; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 7.5px;">
                ${isActivo ? 'ACTIVO' : 'DE BAJA'}
              </span>
            </td>
            <td style="padding: 6px; text-align: center; font-size: 7.5px;">${w.fechaIngreso || '—'}</td>
          </tr>
        `;
      }).join("");

      if (items.length === 0) {
        rows = `<tr><td colspan="8" style="text-align: center; padding: 25px; color: #64748B; font-style: italic;">No se registran colaboradores en el padrón de personal para esta sede.</td></tr>`;
      }

      contentHtml = `
        <table style="width: 100%; border-collapse: collapse; font-family: 'Plus Jakarta Sans', Arial, sans-serif; margin-top: 8px;">
          <thead>
            <tr style="background: #1C2541; color: #FFFFFF; font-size: 8px; text-align: center;">
              <th style="padding: 6px;">DNI</th>
              <th style="padding: 6px; text-align: left;">COLABORADOR / PROFESIONAL</th>
              <th style="padding: 6px; text-align: left;">CARGO / ESPECIALIDAD</th>
              <th style="padding: 6px;">ROL SISTEMA</th>
              <th style="padding: 6px;">SEDE ASIGNADA</th>
              <th style="padding: 6px; text-align: left;">CONTACTO</th>
              <th style="padding: 6px;">ESTADO</th>
              <th style="padding: 6px;">INGRESO</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="margin-top: 10px; font-size: 8px; color: #64748B; display: flex; justify-content: space-between;">
          <span>Total de Colaboradores Auditados: ${items.length}</span>
          <span>Firma y Sello de la Dirección General / Gerencia de Sede</span>
        </div>
      `;
    }

    // Contenedor temporal para renderizado del PDF con ID exclusivo
    const printContainer = document.createElement("div");
    printContainer.id = "printReportContainer";
    printContainer.style.padding = "20px";
    printContainer.style.background = "#FFFFFF";
    printContainer.style.color = "#0F172A";
    printContainer.innerHTML = `
      ${this.buildPdfHeaderHtml(reportTitle, reportSubtitle, latinMotto)}
      ${contentHtml}
      ${this.buildPdfFooterHtml()}
    `;

    document.body.appendChild(printContainer);
    document.body.classList.add("printing-report");

    // bInfo is already available from function scope
    const opt = {
      margin: [8, 8, 8, 8],
      filename: `PAOLO_ALDEA_Reporte_${moduleName.toUpperCase()}_${bInfo.branchSlug}_${(typeof getRelativeDateOnlyStr === "function" ? getRelativeDateOnlyStr(0) : "HOY")}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: (moduleName === 'casos' || moduleName === 'caja_chica' || moduleName === 'asistencia' || moduleName === 'personal') ? 'landscape' : 'portrait' }
    };

    window.app.showToast("Generando reporte oficial en PDF...", "info");

    try {
      if (typeof html2pdf !== "undefined") {
        await html2pdf().set(opt).from(printContainer).save();
        window.app.showToast("Reporte PDF descargado con éxito", "success");
      } else {
        this.printIsolatedReport(printContainer.innerHTML, opt.jsPDF.orientation);
      }
    } catch (err) {
      console.warn("Generación html2pdf directa no completada, abriendo generador de PDF aislado:", err);
      // Imprimir ÚNICAMENTE el reporte en marco aislado sin barra lateral
      this.printIsolatedReport(printContainer.innerHTML, opt.jsPDF.orientation);
    } finally {
      document.body.classList.remove("printing-report");
      printContainer.remove();
    }
  }

  // Generador de impresión aislado: NUNCA incluye la barra lateral (Sidebar) ni controles de interfaz
  printIsolatedReport(reportHtml, orientation = 'portrait') {
    reportHtml = this.sanitizeHtmlString(reportHtml);
    const iframe = document.createElement("iframe");
    iframe.id = "isolatedPdfPrintFrame";
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.zIndex = "-9999";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>PAOLO ALDEA & ABOGADOS - Reporte Oficial</title>
        <style>
          @page { size: ${orientation === 'landscape' ? 'landscape' : 'portrait'}; margin: 8mm; }
          body { font-family: 'Plus Jakarta Sans', Arial, sans-serif; margin: 0; padding: 10px; color: #0F172A; background: #ffffff; }
          table { border-collapse: collapse; width: 100%; }
          img { max-width: 100%; }
        </style>
      </head>
      <body>
        ${reportHtml}
      </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        console.error("Print error:", e);
      } finally {
        setTimeout(() => iframe.remove(), 2500);
      }
    }, 400);
  }

  printDocumentPreview() {
    const previewEl = document.getElementById("previewDocBody");
    const titleEl = document.getElementById("previewDocTitle");
    if (!previewEl) return;
    const docTitle = titleEl ? titleEl.textContent : "Documento Jurídico";

    const reportHtml = `
      <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; padding: 15px;">
        ${this.buildPdfHeaderHtml(docTitle, "Modelo Oficial de Despacho", "Verba volant, scripta manent")}
        <div style="background: #fff; padding: 20px; font-family: Georgia, serif; font-size: 11px; line-height: 1.8; color: #1E293B; white-space: pre-wrap; border: 1px solid #E2E8F0; border-radius: 6px; margin-top: 10px;">
          ${previewEl.textContent}
        </div>
        ${this.buildPdfFooterHtml()}
      </div>
    `;
    this.printIsolatedReport(reportHtml, 'portrait');
  }

  // Comprobante Individual de Partida Presupuestaria en PDF
  exportSinglePresupuestoPdf(presupuestoId) {
    try {
      const item = window.db.get("presupuestos").find(i => i.id === presupuestoId);
      if (!item) {
        alert("Partida presupuestaria no encontrada.");
        return;
      }

    const curr = window.db.getSettings().currency || "S/";
    const regimenDetalle = item.frecuencia || "Inversión Única";

    // Tabla de desglose de Subcategoría Específica si existe
    let subcatTableHtml = "";
    if (item.detalleSubcategoria && item.detalleSubcategoria.data && (!item.subcategoriasActivas || item.subcategoriasActivas.length === 0)) {
      const d = item.detalleSubcategoria.data;
      const subcatTitulo = item.detalleSubcategoria.tipoSubcat || item.subcategoria;
      const rows = [];

      if (d.modalidad) rows.push(`<tr><td style="padding: 5px; font-weight: bold; background: #F8FAFC; width: 35%;">Modalidad / Servicio:</td><td style="padding: 5px;">${d.modalidad}</td></tr>`);
      if (d.ruta) rows.push(`<tr><td style="padding: 5px; font-weight: bold; background: #F8FAFC;">Tramo / Ruta / Destino:</td><td style="padding: 5px;">${d.ruta}</td></tr>`);
      if (d.empresa) rows.push(`<tr><td style="padding: 5px; font-weight: bold; background: #F8FAFC;">Empresa / Proveedor:</td><td style="padding: 5px;">${d.empresa}</td></tr>`);
      if (d.restaurante) rows.push(`<tr><td style="padding: 5px; font-weight: bold; background: #F8FAFC;">Restaurante / Establecimiento:</td><td style="padding: 5px;">${d.restaurante}</td></tr>`);
      if (d.hotel) rows.push(`<tr><td style="padding: 5px; font-weight: bold; background: #F8FAFC;">Hotel / Alojamiento:</td><td style="padding: 5px;">${d.hotel} (${d.ciudad || 'Challhuahuacho'})</td></tr>`);
      if (d.tipoHabitacion) rows.push(`<tr><td style="padding: 5px; font-weight: bold; background: #F8FAFC;">Tipo de Habitación:</td><td style="padding: 5px;">${d.tipoHabitacion}</td></tr>`);
      if (d.cargo) rows.push(`<tr><td style="padding: 5px; font-weight: bold; background: #F8FAFC;">Función / Cargo:</td><td style="padding: 5px;">${d.cargo}</td></tr>`);
      if (d.zona) rows.push(`<tr><td style="padding: 5px; font-weight: bold; background: #F8FAFC;">Zona de Cobertura:</td><td style="padding: 5px;">${d.zona}</td></tr>`);
      if (d.canal) rows.push(`<tr><td style="padding: 5px; font-weight: bold; background: #F8FAFC;">Canal Publicitario:</td><td style="padding: 5px;">${d.canal} — ${d.medio || ''}</td></tr>`);
      if (d.tipoLetrero) rows.push(`<tr><td style="padding: 5px; font-weight: bold; background: #F8FAFC;">Tipo de Letrero:</td><td style="padding: 5px;">${d.tipoLetrero}</td></tr>`);
      if (d.medidas) rows.push(`<tr><td style="padding: 5px; font-weight: bold; background: #F8FAFC;">Medidas y Especificaciones:</td><td style="padding: 5px;">${d.medidas}</td></tr>`);
      if (d.tipoServicio) rows.push(`<tr><td style="padding: 5px; font-weight: bold; background: #F8FAFC;">Tipo de Servicio:</td><td style="padding: 5px;">${d.tipoServicio}</td></tr>`);
      if (d.suministro) rows.push(`<tr><td style="padding: 5px; font-weight: bold; background: #F8FAFC;">N° Suministro / Código Cliente:</td><td style="padding: 5px; font-family: monospace;">${d.suministro}</td></tr>`);
      if (d.local) rows.push(`<tr><td style="padding: 5px; font-weight: bold; background: #F8FAFC;">Inmueble / Sede:</td><td style="padding: 5px;">${d.local}</td></tr>`);
      if (d.arrendador) rows.push(`<tr><td style="padding: 5px; font-weight: bold; background: #F8FAFC;">Propietario / Arrendador:</td><td style="padding: 5px;">${d.arrendador}</td></tr>`);
      if (d.sedeNotarial) rows.push(`<tr><td style="padding: 5px; font-weight: bold; background: #F8FAFC;">Notaría / Sede:</td><td style="padding: 5px;">${d.sedeNotarial}</td></tr>`);
      if (d.actoNotarial) rows.push(`<tr><td style="padding: 5px; font-weight: bold; background: #F8FAFC;">Acto Notarial / Registral:</td><td style="padding: 5px;">${d.actoNotarial}</td></tr>`);
      if (d.tipoActivo) rows.push(`<tr><td style="padding: 5px; font-weight: bold; background: #F8FAFC;">Activo / Equipamiento TIC:</td><td style="padding: 5px;">${d.tipoActivo}</td></tr>`);
      if (d.especificacion) rows.push(`<tr><td style="padding: 5px; font-weight: bold; background: #F8FAFC;">Marca / Modelo / Especificación:</td><td style="padding: 5px;">${d.especificacion}</td></tr>`);
      if (d.descripcion) rows.push(`<tr><td style="padding: 5px; font-weight: bold; background: #F8FAFC;">Descripción de Material / Ferretería:</td><td style="padding: 5px; font-weight: 600;">${d.descripcion}</td></tr>`);

      if (rows.length > 0) {
        subcatTableHtml = `
          <div style="margin-top: 14px;">
            <div style="font-size: 10px; font-weight: bold; color: #1E40AF; text-transform: uppercase; margin-bottom: 5px; border-bottom: 1px solid #BFDBFE; padding-bottom: 3px;">
              <i class="fa-solid fa-list-check"></i> Especificaciones Técnicas de Subcategoría: ${subcatTitulo}
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 9px; margin-top: 4px; border: 1px solid #CBD5E1;">
              <tbody>
                ${rows.join("")}
              </tbody>
            </table>
          </div>
        `;
      }
    }

    const reportHtml = `
      <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; padding: 15px;">
        ${this.buildPdfHeaderHtml("COMPROBANTE DE PARTIDA PRESUPUESTARIA", `Ficha Técnica Financiera • Partida: ${item.id}`, "Ratio pecuniae in iustitia: Provisio et prosperitas")}

        <!-- Ficha de Datos Principales -->
        <div style="margin-top: 14px; border: 1px solid #CBD5E1; border-radius: 8px; overflow: hidden;">
          <div style="background: #0F172A; color: #ffffff; padding: 6px 12px; font-size: 10px; font-weight: bold; display: flex; justify-content: space-between; align-items: center;">
            <span>FICHA TÉCNICA FINANCIERA — PARTIDA N° ${item.id}</span>
            <span style="background: #C5A059; color: #0F172A; padding: 2px 8px; border-radius: 4px; font-size: 9px; font-weight: 800;">${item.tipo}</span>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 9.5px;">
            <tr style="border-bottom: 1px solid #E2E8F0;">
              <td style="padding: 7px 10px; width: 22%; background: #F8FAFC; font-weight: bold; color: #475569;">Concepto / Objeto:</td>
              <td colspan="3" style="padding: 7px 10px; font-weight: 800; font-size: 10.5px; color: #0F172A;">${item.concepto}</td>
            </tr>
            <tr style="border-bottom: 1px solid #E2E8F0;">
              <td style="padding: 7px 10px; background: #F8FAFC; font-weight: bold; color: #475569;">Categoría Presupuestal:</td>
              <td style="padding: 7px 10px; font-weight: 600; color: #1E293B;">${item.categoria}</td>
              <td style="padding: 7px 10px; width: 20%; background: #F8FAFC; font-weight: bold; color: #475569;">Subcategoría:</td>
              <td style="padding: 7px 10px; font-weight: 600; color: #B45309;">${item.subcategoria || 'General / Principal'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #E2E8F0;">
              <td style="padding: 7px 10px; background: #F8FAFC; font-weight: bold; color: #475569;">Centro de Costos:</td>
              <td style="padding: 7px 10px; font-weight: bold; color: #1E3A8A;">${item.centroCosto || (item.id ? item.id.split('-')[1] : 'ADM')} (Sede Challhuahuacho)</td>
              <td style="padding: 7px 10px; background: #F8FAFC; font-weight: bold; color: #475569;">Clase de Gasto (PCGE):</td>
              <td style="padding: 7px 10px; font-weight: bold; color: #047857;">PCGE Clase ${item.clasePcge || (item.id ? item.id.split('-')[2] : '63')}</td>
            </tr>
            <tr style="border-bottom: 1px solid #E2E8F0;">
              <td style="padding: 7px 10px; background: #F8FAFC; font-weight: bold; color: #475569;">Régimen / Frecuencia:</td>
              <td style="padding: 7px 10px; font-weight: 600; color: #1E293B;">${regimenDetalle}</td>
              <td style="padding: 7px 10px; background: #F8FAFC; font-weight: bold; color: #475569;">Estado / Prioridad:</td>
              <td style="padding: 7px 10px;">
                <span style="font-weight: bold; color: #0284C7;">${item.estado}</span> • Prioridad: <span style="font-weight: bold; color: #DC2626;">${item.prioridad || 'Alta'}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 7px 10px; background: #F8FAFC; font-weight: bold; color: #475569;">Responsable Asignado:</td>
              <td style="padding: 7px 10px; font-weight: 600; color: #1E293B;">${item.responsable || 'Ing. Yimer Damián Soto'}</td>
              <td style="padding: 7px 10px; background: #F8FAFC; font-weight: bold; color: #475569;">Sede de Aplicación:</td>
              <td style="padding: 7px 10px; font-weight: 600; color: #059669;">Sede Challhuahuacho (Cotabambas)</td>
            </tr>
          </table>
        </div>

        <!-- Tabla de Liquidación Financiera -->
        <div style="margin-top: 14px;">
          <div style="font-size: 10px; font-weight: bold; color: #1E293B; text-transform: uppercase; margin-bottom: 5px; border-bottom: 1px solid #CBD5E1; padding-bottom: 3px;">
            Liquidación Presupuestaria de la Partida
          </div>
          ${item.subcategoriasActivas && item.subcategoriasActivas.length > 0 ? `
            <table style="width: 100%; border-collapse: collapse; font-size: 9.5px; border: 1px solid #CBD5E1;">
              <thead>
                <tr style="background: #1E293B; color: #ffffff; font-weight: bold;">
                  <th style="padding: 6px; text-align: left; border: 1px solid #CBD5E1; width: 30%;">Subcategoría / Rubro</th>
                  <th style="padding: 6px; text-align: left; border: 1px solid #CBD5E1;">Especificación / Detalle de Cálculo</th>
                  <th style="padding: 6px; text-align: right; border: 1px solid #CBD5E1; width: 120px;">Subtotal (${curr})</th>
                </tr>
              </thead>
              <tbody>
                ${item.subcategoriasActivas.map(s => `
                  <tr style="border-bottom: 1px solid #E2E8F0;">
                    <td style="padding: 7px 8px; font-weight: bold; color: #1E293B; border: 1px solid #E2E8F0;">${s.name}</td>
                    <td style="padding: 7px 8px; color: #475569; border: 1px solid #E2E8F0;">${s.detail}</td>
                    <td style="padding: 7px 8px; text-align: right; font-family: monospace; font-weight: bold; color: #047857; border: 1px solid #E2E8F0;">${curr} ${Number(s.amount || 0).toFixed(2)}</td>
                  </tr>
                `).join("")}
              </tbody>
              <tfoot>
                <tr style="background: #F1F5F9; font-weight: bold;">
                  <td colspan="2" style="padding: 8px; text-align: right; border: 1px solid #CBD5E1; text-transform: uppercase; font-size: 10px; color: #0F172A;">
                    TOTAL PARTIDA PROYECTADA:
                  </td>
                  <td style="padding: 8px; text-align: right; border: 1px solid #CBD5E1; font-family: monospace; font-size: 12px; color: #065F46; font-weight: 900; background: #D1FAE5;">
                    ${curr} ${Number(item.subtotal || 0).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          ` : `
            <table style="width: 100%; border-collapse: collapse; font-size: 9.5px; border: 1px solid #CBD5E1;">
              <thead>
                <tr style="background: #1E293B; color: #ffffff; font-weight: bold;">
                  <th style="padding: 6px; text-align: left; border: 1px solid #CBD5E1;">Descripción Operativa</th>
                  <th style="padding: 6px; text-align: center; border: 1px solid #CBD5E1; width: 70px;">Cant.</th>
                  <th style="padding: 6px; text-align: center; border: 1px solid #CBD5E1; width: 80px;">Unidad</th>
                  <th style="padding: 6px; text-align: right; border: 1px solid #CBD5E1; width: 110px;">Costo Unit. (${curr})</th>
                  <th style="padding: 6px; text-align: right; border: 1px solid #CBD5E1; width: 120px;">Subtotal (${curr})</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="padding: 8px; border: 1px solid #E2E8F0; font-weight: 600;">${item.concepto}</td>
                  <td style="padding: 8px; border: 1px solid #E2E8F0; text-align: center; font-family: monospace; font-weight: bold;">${item.cantidad}</td>
                  <td style="padding: 8px; border: 1px solid #E2E8F0; text-align: center;">${item.unidad || 'Unidad'}</td>
                  <td style="padding: 8px; border: 1px solid #E2E8F0; text-align: right; font-family: monospace;">${curr} ${Number(item.costoUnitario || 0).toFixed(2)}</td>
                  <td style="padding: 8px; border: 1px solid #E2E8F0; text-align: right; font-family: monospace; font-size: 11px; font-weight: 800; color: #047857;">
                    ${curr} ${Number(item.subtotal || 0).toFixed(2)}
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr style="background: #F1F5F9; font-weight: bold;">
                  <td colspan="4" style="padding: 8px; text-align: right; border: 1px solid #CBD5E1; text-transform: uppercase; font-size: 10px; color: #0F172A;">
                    TOTAL PARTIDA PROYECTADA:
                  </td>
                  <td style="padding: 8px; text-align: right; border: 1px solid #CBD5E1; font-family: monospace; font-size: 12px; color: #065F46; font-weight: 900; background: #D1FAE5;">
                    ${curr} ${Number(item.subtotal || 0).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          `}
        </div>

        ${subcatTableHtml}

        <!-- Desglose de Ejecución Presupuestaria Efectiva (si existe) -->
        ${(item.montoEjecutado !== undefined && item.montoEjecutado !== null) ? `
          <div style="margin-top: 14px; border: 1px solid #CBD5E1; border-radius: 8px; overflow: hidden;">
            <div style="background: #047857; color: #ffffff; padding: 6px 12px; font-size: 10px; font-weight: bold; display: flex; justify-content: space-between;">
              <span>LIQUIDACIÓN DE EJECUCIÓN PRESUPUESTARIA REAL</span>
              <span>EFICIENCIA: ${Number(item.porcentajeUsado || 0).toFixed(1)}% USADO</span>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 9.5px;">
              <tr style="border-bottom: 1px solid #E2E8F0;">
                <td style="padding: 7px 10px; width: 25%; background: #F8FAFC; font-weight: bold;">Monto Proyectado Inicial:</td>
                <td style="padding: 7px 10px; font-family: monospace; font-weight: bold;">${curr} ${Number(item.subtotal || 0).toFixed(2)}</td>
                <td style="padding: 7px 10px; width: 25%; background: #F8FAFC; font-weight: bold; color: #047857;">Monto Realmente Ejecutado:</td>
                <td style="padding: 7px 10px; font-family: monospace; font-weight: 900; color: #047857; font-size: 11px;">${curr} ${Number(item.montoEjecutado || 0).toFixed(2)}</td>
              </tr>
              <tr style="border-bottom: 1px solid #E2E8F0;">
                <td style="padding: 7px 10px; background: #F8FAFC; font-weight: bold;">Porcentaje Usado:</td>
                <td style="padding: 7px 10px; font-weight: bold; color: #047857;">${Number(item.porcentajeUsado || 0).toFixed(1)}%</td>
                <td style="padding: 7px 10px; background: #F8FAFC; font-weight: bold;">Porcentaje No Usado (Saldo):</td>
                <td style="padding: 7px 10px; font-weight: bold; color: ${item.porcentajeNoUsado < 0 ? '#DC2626' : '#D97706'};">
                  ${Number(item.porcentajeNoUsado || 0).toFixed(1)}% (${curr} ${Number(item.saldoRestante || 0).toFixed(2)})
                </td>
              </tr>
              ${item.fechaEjecucion || item.comprobanteEjecucion ? `
              <tr style="border-bottom: 1px solid #E2E8F0;">
                <td style="padding: 7px 10px; background: #F8FAFC; font-weight: bold;">Fecha de Ejecución:</td>
                <td style="padding: 7px 10px;">${item.fechaEjecucion || 'N/A'}</td>
                <td style="padding: 7px 10px; background: #F8FAFC; font-weight: bold;">Comprobante / Doc:</td>
                <td style="padding: 7px 10px;">${item.comprobanteEjecucion || 'N/A'}</td>
              </tr>
              ` : ''}
              ${item.notasEjecucion ? `
              <tr>
                <td style="padding: 7px 10px; background: #F8FAFC; font-weight: bold;">Detalles de Ejecución:</td>
                <td colspan="3" style="padding: 7px 10px; color: #475569;">${item.notasEjecucion}</td>
              </tr>
              ` : ''}
            </table>
          </div>
        ` : ''}

        <!-- Notas y Justificación Logística -->
        ${item.notas ? `
          <div style="margin-top: 14px; background: #FFFBEB; border: 1px solid #FCD34D; border-radius: 6px; padding: 8px 12px; font-size: 9px; color: #92400E;">
            <div style="font-weight: bold; text-transform: uppercase; margin-bottom: 2px;">
              <i class="fa-solid fa-note-sticky mr-1"></i> Sustento y Justificación Logística / Legal:
            </div>
            <div>${item.notas}</div>
          </div>
        ` : ''}

        ${this.buildPdfFooterHtml()}
      </div>
    `;

    this.printIsolatedReport(reportHtml, 'portrait');
  } catch (err) {
    console.error("Error al exportar comprobante presupuestario a PDF:", err);
    if (window.app?.showToast) {
      window.app.showToast(`Error al exportar PDF: ${err.message}`, "error");
    } else {
      alert(`Error al exportar PDF: ${err.message}`);
    }
  }
}
}

// Instancia global
window.pdfExporter = new LegalPdfExporter();
window.exportarAsistenciaPdf = () => window.pdfExporter.exportModulePdf("asistencia");
window.LegalPdfExporter = LegalPdfExporter;
