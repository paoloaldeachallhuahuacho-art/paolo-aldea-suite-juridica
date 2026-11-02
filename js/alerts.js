/**
 * PAOLO ALDEA & ABOGADOS - Alert & Notification Engine
 * Detección de Plazos Fatales, Audiencias y Citas Inminentes
 */

class AlertEngine {
  constructor() {
    this.audioCtx = null;
    this.alerts = {
      urgent: [],
      warning: [],
      info: []
    };
    this.pushThrottles = new Set();
    this._meetSchedulerInterval = null;
    setTimeout(() => {
      this.initDirectorioMeetScheduler();
    }, 1500);
  }

  // Sintetizador de sonido elegante de notificación con Web Audio API (sin requerir archivos externos)
  playChime(type = "alert") {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!this.audioCtx) {
        this.audioCtx = new AudioContext();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      if (type === "urgent") {
        // Tono doble de alerta jurídica perentoria
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880, now + 0.12); // A5
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.45);
      } else {
        // Tono armónico suave tipo campana
        osc.type = "sine";
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.15); // E5
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
      }
    } catch (e) {
      console.warn("Audio notification not permitted yet or not supported:", e);
    }
  }

  // Solicitar permiso de notificaciones nativas de escritorio y móviles (PWA)
  async requestPermission() {
    if ("Notification" in window) {
      try {
        const perm = await Notification.requestPermission();
        if (perm === "granted") {
          this.sendBrowserNotification(
            "PAOLO ALDEA & ABOGADOS — Notificaciones Activadas",
            "Las alertas de plazos procesales fatales y asistencias se notificarán oportunamente en este dispositivo."
          );
          return true;
        }
      } catch (err) {
        console.warn("Error al solicitar permisos de notificación:", err);
      }
    }
    return false;
  }

  // Notificación local / nativa de sistema compatible con Service Worker en móviles y desktop
  sendBrowserNotification(title, body, customUrl = null) {
    if (!("Notification" in window) || Notification.permission !== "granted") {
      return;
    }
    const finalUrl = customUrl || window.location.href;
    const notifOptions = {
      body: body,
      icon: "assets/logo_paolo_aldea.jpg",
      badge: "assets/logo_paolo_aldea.jpg",
      vibrate: [250, 100, 250, 100, 250],
      tag: "paolo-aldea-alert-" + Date.now(),
      renotify: true,
      data: { url: finalUrl }
    };

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready
        .then(registration => {
          if (registration && typeof registration.showNotification === "function") {
            return registration.showNotification(title, notifOptions);
          }
          const n = new Notification(title, notifOptions);
          n.onclick = () => { window.focus(); if (customUrl) window.open(customUrl, "_blank"); };
        })
        .catch(() => {
          try {
            const n = new Notification(title, notifOptions);
            n.onclick = () => { window.focus(); if (customUrl) window.open(customUrl, "_blank"); };
          } catch (e) {
            console.warn("Fallo notificación web:", e);
          }
        });
    } else {
      try {
        const n = new Notification(title, notifOptions);
        n.onclick = () => { window.focus(); if (customUrl) window.open(customUrl, "_blank"); };
      } catch (e) {
        console.warn("Notificación de escritorio no soportada:", e);
      }
    }
  }

  // =========================================================================
  // SISTEMA DE NOTIFICACIONES PUSH A CELULAR (ANDROID / IOS) Y PC / LAPTOP
  // Funciona incluso con la página web o la aplicación completamente cerrada
  // =========================================================================
  getPushTopic() {
    const s = window.db ? window.db.getSettings() : null;
    return (s && s.pushTopic) ? s.pushTopic.trim() : "aldea_aldea_challhuahuacho";
  }

  async sendPushNotification({ title, message, priority = "default", tags = [], isManual = false }) {
    const s = window.db ? window.db.getSettings() : null;
    const topic = this.getPushTopic();

    // 1. Notificación local inmediata en el navegador si la pestaña está activa
    this.sendBrowserNotification(title, message);

    // Si las notificaciones remotas están deshabilitadas y no es prueba manual, respetar privacidad
    if (!isManual && s && s.pushAutoSend === false) {
      return true;
    }

    let ntfyOk = false;

    // 2. Envío a ntfy.sh con protección de Secreto Profesional y Ley N° 29733
    if (topic && (isManual || (s && s.pushAutoSend !== false))) {
      try {
        const ntfyPriority = priority === "urgent" ? "urgent" : priority === "high" ? "high" : "default";
        
        // En modo anónimo, protegemos nombres de partes y cuantías en buses públicos no autenticados
        let pushMessage = message;
        if (s && s.pushAnonymize !== false && !isManual) {
          pushMessage = `⚖️ [NOTIFICACIÓN CONFIDENCIAL DESPACHO]\n${title}\nPlazo o diligencia perentoria detectada. Ingrese a la Suite Segura de Challhuahuacho para ver los actuados del caso.`;
        }

        const headers = {
          "Title": title,
          "Priority": ntfyPriority,
          "Tags": tags.join(",")
        };

        const res = await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
          method: "POST",
          body: pushMessage,
          headers: headers
        });
        ntfyOk = res.ok;
      } catch (err) {
        console.warn("No se pudo enviar push a ntfy:", err);
      }
    }

    // 3. Envío seguro por Proxy Serverless (Netlify Function) con fallback directo para entorno local
    if (s && s.telegramChatId) {
      try {
        const text = `⚖️ *${title}*\n\n${message}`;
        const proxyPayload = {
          chatId: s.telegramChatId,
          token: s.telegramToken || undefined,
          text: text
        };
        fetch("/.netlify/functions/telegram-proxy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(proxyPayload)
        }).then((res) => {
          if (!res.ok && s.telegramToken) {
            return fetch(`https://api.telegram.org/bot${s.telegramToken}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: s.telegramChatId,
                text: text,
                parse_mode: "Markdown"
              })
            });
          }
        }).catch(() => {
          if (s.telegramToken) {
            fetch(`https://api.telegram.org/bot${s.telegramToken}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: s.telegramChatId,
                text: text,
                parse_mode: "Markdown"
              })
            }).catch(e => console.warn("Telegram silent error:", e));
          }
        });
      } catch (te) {
        console.warn("Telegram fail:", te);
      }
    }

    return ntfyOk;
  }

  async testPushNotification() {
    const topic = this.getPushTopic();
    const ok = await this.sendPushNotification({
      title: "⚖️ PAOLO ALDEA & ABOGADOS - Notificaciones Activas",
      message: `¡Conexión exitosa! Su celular y PC están enlazados al canal «${topic}». Recibirá alertas de plazos fatales, audiencias y gastos fijos incluso con la app cerrada.`,
      priority: "high",
      tags: ["white_check_mark", "tada", "scales"],
      isManual: true
    });
    return { success: ok, topic };
  }

  async syncAllAlertsToPhone() {
    const totalUrgent = this.alerts.urgent.length;
    const totalWarn = this.alerts.warning.length;

    if (totalUrgent === 0 && totalWarn === 0) {
      await this.sendPushNotification({
        title: "✅ PAOLO ALDEA & ABOGADOS - Todos los Módulos al Día",
        message: "No se registran plazos fatales, audiencias inminentes, pagos fijos vencidos ni quiebres de inventario. Toda la oficina opera al 100%.",
        priority: "default",
        tags: ["white_check_mark", "clipboard"]
      });
      return { count: 0, success: true };
    }

    // Organizar alertas por cada apartado de la página web
    let summary = `🚨 ${totalUrgent} URGENTES | ⏳ ${totalWarn} PRÓXIMAS\n\n`;

    const casosAlerts = [...this.alerts.urgent, ...this.alerts.warning].filter(a => a.source === "caso");
    const cajaAlerts = [...this.alerts.urgent, ...this.alerts.warning].filter(a => a.source === "caja");
    const citasAlerts = [...this.alerts.urgent, ...this.alerts.warning].filter(a => a.source === "cita");
    const invAlerts = [...this.alerts.urgent, ...this.alerts.warning].filter(a => a.source === "inventario");

    if (casosAlerts.length > 0) {
      summary += `⚖️ CASOS & EXPEDIENTES (${casosAlerts.length}):\n`;
      casosAlerts.slice(0, 3).forEach(a => summary += `• ${a.title.replace(/^[^\w\s]+/, '').trim()}: ${a.meta}\n`);
      summary += `\n`;
    }

    if (cajaAlerts.length > 0) {
      summary += `💰 CAJA CHICA & GASTOS FIJOS (${cajaAlerts.length}):\n`;
      cajaAlerts.slice(0, 3).forEach(a => summary += `• ${a.title.replace(/^[^\w\s]+/, '').trim()}: ${a.meta}\n`);
      summary += `\n`;
    }

    if (citasAlerts.length > 0) {
      summary += `📅 AGENDA & CITAS (${citasAlerts.length}):\n`;
      citasAlerts.slice(0, 3).forEach(a => summary += `• ${a.title.replace(/^[^\w\s]+/, '').trim()}: ${a.meta}\n`);
      summary += `\n`;
    }

    if (invAlerts.length > 0) {
      summary += `📦 INVENTARIO & ARCHIVO (${invAlerts.length}):\n`;
      invAlerts.slice(0, 2).forEach(a => summary += `• ${a.title.replace(/^[^\w\s]+/, '').trim()}: ${a.meta}\n`);
      summary += `\n`;
    }

    const ok = await this.sendPushNotification({
      title: `⚖️ PAOLO ALDEA & ABOGADOS: Alertas Generales de Sede`,
      message: summary,
      priority: totalUrgent > 0 ? "urgent" : "high",
      tags: ["warning", "calendar", "scales", "bell"]
    });

    return { count: totalUrgent + totalWarn, success: ok };
  }

  async dispatchAutoPush() {
    const s = window.db ? window.db.getSettings() : null;
    if (!s || s.pushAutoSend === false) return;

    // Despachar alertas perentorias de cualquier módulo (Casos, Caja Chica, Citas, Inventario)
    const criticals = this.alerts.urgent.slice(0, 4);
    for (const alert of criticals) {
      const key = `${alert.type}_${alert.id}_${alert.date}`;
      if (!this.pushThrottles.has(key)) {
        this.pushThrottles.add(key);
        await this.sendPushNotification({
          title: alert.title,
          message: `${alert.subtitle || ""}\n${alert.meta || ""}`,
          priority: "urgent",
          tags: ["warning", "gavel", "scales", "bell"]
        });
      }
    }
  }

  // Analiza todos los registros de la base de datos y genera la lista de alertas activas
  notifyRole(targetRoles, alertData) {
    const roles = Array.isArray(targetRoles) ? targetRoles : [targetRoles];
    const currentUser = (window.db && window.db.getCurrentUser) ? window.db.getCurrentUser() : null;
    const userRole = currentUser ? currentUser.rol : "socio";
    if (roles.includes(userRole)) {
      this.playChime(alertData.severity === "urgent" ? "urgent" : "alert");
      this.sendBrowserNotification(alertData.title, alertData.message || alertData.subtitle || "");
    }
    if (alertData.severity === "urgent" || alertData.priority === "high") {
      this.sendPushNotification({
        title: alertData.title,
        message: alertData.message || alertData.subtitle || "",
        priority: alertData.severity === "urgent" ? "urgent" : "high",
        tags: ["bell", "moneybag", "scales"]
      });
    }
    this.evaluateAlerts();
  }

  notifyUser(workerId, alertData) {
    const currentUser = (window.db && window.db.getCurrentUser) ? window.db.getCurrentUser() : null;
    if (currentUser && currentUser.id === workerId) {
      this.playChime(alertData.severity === "urgent" ? "urgent" : "alert");
      this.sendBrowserNotification(alertData.title, alertData.message || alertData.subtitle || "");
    }
    this.evaluateAlerts();
  }

  evaluateAlerts() {
    const casos = window.db.get("casos");
    const citas = window.db.get("citas");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const urgent = [];
    const warning = [];
    const info = [];

    // 1. Evaluación de Plazos Fatales y Audiencias en Casos
    casos.forEach(c => {
      if (c.estado !== "Concluido / Ganado" && c.estado !== "Archivado") {
        if (c.vencimiento) {
          const vDate = new Date(c.vencimiento + "T00:00:00");
          const diffDays = Math.round((vDate - today) / (1000 * 60 * 60 * 24));

          if (diffDays < 0) {
            urgent.push({
              type: "plazo_vencido",
              title: `🚨 PLAZO VENCIDO: Exp. ${c.expediente}`,
              subtitle: c.detalleVencimiento || c.caratula,
              meta: `Venció hace ${Math.abs(diffDays)} día(s)`,
              date: c.vencimiento,
              source: "caso",
              id: c.id,
              severity: "urgent"
            });
          } else if (diffDays === 0) {
            urgent.push({
              type: "plazo_hoy",
              title: `⚠️ PLAZO FATAL HOY: Exp. ${c.expediente}`,
              subtitle: c.detalleVencimiento || c.caratula,
              meta: `¡Vence HOY! No olvidar presentar escrito`,
              date: c.vencimiento,
              source: "caso",
              id: c.id,
              severity: "urgent"
            });
          } else if (diffDays <= 2) {
            urgent.push({
              type: "plazo_inminente",
              title: `⏳ Plazo Perentorio (${diffDays} d): Exp. ${c.expediente}`,
              subtitle: c.detalleVencimiento || c.caratula,
              meta: `Vence en ${diffDays} día(s)`,
              date: c.vencimiento,
              source: "caso",
              id: c.id,
              severity: "urgent"
            });
          } else if (diffDays <= 5) {
            warning.push({
              type: "plazo_proximo",
              title: `Próximo Vencimiento: Exp. ${c.expediente}`,
              subtitle: c.detalleVencimiento || c.caratula,
              meta: `Vence en ${diffDays} días`,
              date: c.vencimiento,
              source: "caso",
              id: c.id,
              severity: "warning"
            });
          }
        }

        // Audiencia próxima
        if (c.proximaAudiencia && c.proximaAudiencia !== "-") {
          const audDate = new Date(c.proximaAudiencia);
          if (!isNaN(audDate.getTime())) {
            const audDay = new Date(audDate);
            audDay.setHours(0, 0, 0, 0);
            const diffAud = Math.round((audDay - today) / (1000 * 60 * 60 * 24));
            const timeStr = audDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            if (diffAud === 0) {
              urgent.push({
                type: "audiencia_hoy",
                title: `⚖️ AUDIENCIA JUDICIAL HOY - ${timeStr}`,
                subtitle: `Exp. ${c.expediente} | ${c.juzgado}`,
                meta: `Audiencia programada para el día de hoy a las ${timeStr}`,
                date: c.proximaAudiencia,
                source: "caso",
                id: c.id,
                severity: "urgent"
              });
            } else if (diffAud === 1) {
              warning.push({
                type: "audiencia_manana",
                title: `⚖️ Audiencia Mañana a las ${timeStr}`,
                subtitle: `Exp. ${c.expediente} | ${c.juzgado}`,
                meta: `Audiencia programada para mañana`,
                date: c.proximaAudiencia,
                source: "caso",
                id: c.id,
                severity: "warning"
              });
            }
          }
        }
      }
    });

    // 2. Evaluación de Citas y Consultas
    citas.forEach(cita => {
      if (cita.estado !== "Atendida" && cita.estado !== "Cancelada" && cita.fechaHora) {
        const cDate = new Date(cita.fechaHora);
        if (!isNaN(cDate.getTime())) {
          const cDay = new Date(cDate);
          cDay.setHours(0, 0, 0, 0);
          const diffCita = Math.round((cDay - today) / (1000 * 60 * 60 * 24));
          const timeStr = cDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          if (cita.estado === "Pendiente") {
            warning.push({
              type: "cita_pendiente",
              title: `⏳ Cita Pendiente de Confirmar: ${cita.cliente}`,
              subtitle: `${cita.motivo} — Diligencia en ${diffCita === 0 ? 'HOY' : (diffCita === 1 ? 'MAÑANA' : diffCita + ' días')}`,
              meta: `Hora: ${timeStr} | Enviar solicitud de confirmación WhatsApp`,
              date: cita.fechaHora,
              source: "cita",
              id: cita.id,
              severity: "warning"
            });
          } else if (diffCita === 0) {
            urgent.push({
              type: "cita_hoy",
              title: `📅 Cita Legal Hoy: ${cita.cliente}`,
              subtitle: `${cita.motivo} (${cita.modalidad})`,
              meta: `Hora: ${timeStr} | Abogado: ${cita.abogado}`,
              date: cita.fechaHora,
              source: "cita",
              id: cita.id,
              severity: "urgent"
            });
          } else if (diffCita === 1) {
            warning.push({
              type: "cita_manana",
              title: `📅 Cita Mañana: ${cita.cliente}`,
              subtitle: `${cita.motivo} (${cita.modalidad})`,
              meta: `Hora: ${timeStr}`,
              date: cita.fechaHora,
              source: "cita",
              id: cita.id,
              severity: "warning"
            });
          } else if (diffCita <= 5) {
            info.push({
              type: "cita_semana",
              title: `Cita Programada: ${cita.cliente}`,
              subtitle: cita.motivo,
              meta: `En ${diffCita} días (${timeStr})`,
              date: cita.fechaHora,
              source: "cita",
              id: cita.id,
              severity: "info"
            });
          }
        }
      }
    });

    // 3. Evaluación de Gastos Administrativos Fijos y Pagos Recurrentes (Alquiler, Luz, Agua, Internet Claro)
    const caja = window.db.get("caja_chica");
    const curr = window.db.getSettings().currency || "S/";

    caja.forEach(gasto => {
      if (gasto.tipo === "Egreso") {
        const cat = (gasto.categoria || "").toLowerCase();
        const conc = (gasto.concepto || "").toLowerCase();
        const cc = (gasto.centroCosto || "").toLowerCase();

        const esFijo = gasto.esRecurrente ||
                       cc.includes("fijo") ||
                       cat.includes("alquiler") || cat.includes("luz") || cat.includes("agua") || cat.includes("claro") || cat.includes("internet") || cat.includes("starlink") || cat.includes("telecom") ||
                       conc.includes("alquiler") || conc.includes("claro") || conc.includes("internet") || conc.includes("starlink") || conc.includes("luz") || conc.includes("agua") || conc.includes("arrendamiento");

        if (esFijo) {
          let targetDate = null;

          if (gasto.proximoPago) {
            const pDate = new Date(gasto.proximoPago + "T00:00:00");
            if (!isNaN(pDate.getTime())) {
              targetDate = pDate;
            }
          }

          if (!targetDate) {
            let day = gasto.diaPago || 15;
            if (!gasto.diaPago && gasto.fecha) {
              const f = new Date(gasto.fecha + "T00:00:00");
              if (!isNaN(f.getTime())) day = f.getDate();
            }
            if (day < 1) day = 1;
            if (day > 31) day = 31;

            const thisMonthTarget = new Date(today.getFullYear(), today.getMonth(), Math.min(day, new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()));
            const nextMonthTarget = new Date(today.getFullYear(), today.getMonth() + 1, Math.min(day, new Date(today.getFullYear(), today.getMonth() + 2, 0).getDate()));

            const diffThis = Math.round((thisMonthTarget - today) / (1000 * 60 * 60 * 24));
            targetDate = (diffThis >= -2) ? thisMonthTarget : nextMonthTarget;
          }

          if (targetDate) {
            const diffDays = Math.round((targetDate - today) / (1000 * 60 * 60 * 24));
            const dateStr = targetDate.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
            const montoStr = `${curr} ${Number(gasto.monto || 0).toFixed(2)}`;

            if (diffDays < 0 && diffDays >= -5) {
              urgent.push({
                type: "pago_vencido",
                title: `🚨 PAGO FIJO VENCIDO: ${gasto.concepto || gasto.categoria}`,
                subtitle: `Alquiler / Servicios Sede Challhuahuacho (${montoStr})`,
                meta: `Debió pagarse hace ${Math.abs(diffDays)} día(s)`,
                date: targetDate.toISOString().split("T")[0],
                source: "caja",
                id: gasto.id,
                severity: "urgent"
              });
            } else if (diffDays === 0) {
              urgent.push({
                type: "pago_hoy",
                title: `⚠️ ¡PAGO FIJO VENCE HOY!: ${gasto.concepto || gasto.categoria}`,
                subtitle: `Alquiler / Servicios Sede Challhuahuacho (${montoStr})`,
                meta: `¡Vence HOY! Realizar pago y registrar comprobante`,
                date: targetDate.toISOString().split("T")[0],
                source: "caja",
                id: gasto.id,
                severity: "urgent"
              });
            } else if (diffDays <= 3 && diffDays > 0) {
              urgent.push({
                type: "pago_inminente",
                title: `⏳ Pago Fijo Próximo (${diffDays} d): ${gasto.concepto || gasto.categoria}`,
                subtitle: `Alquiler / Servicios Sede Challhuahuacho (${montoStr})`,
                meta: `Vence en ${diffDays} día(s) (${dateStr})`,
                date: targetDate.toISOString().split("T")[0],
                source: "caja",
                id: gasto.id,
                severity: "urgent"
              });
            } else if (diffDays <= 7 && diffDays > 3) {
              warning.push({
                type: "pago_proximo",
                title: `📅 Vencimiento Próximo Mes: ${gasto.concepto || gasto.categoria}`,
                subtitle: `Gasto Fijo Administrativo (${montoStr})`,
                meta: `Vence en ${diffDays} días (${dateStr})`,
                date: targetDate.toISOString().split("T")[0],
                source: "caja",
                id: gasto.id,
                severity: "warning"
              });
            }
          }
        }
      }
    });

    // 4. Evaluación de Saldo Operativo de Caja Chica
    const saldoTotal = caja.reduce((acc, it) => acc + (it.tipo === "Ingreso" ? Number(it.monto || 0) : -Number(it.monto || 0)), 0);
    if (saldoTotal < 300 && saldoTotal > 0) {
      warning.push({
        type: "caja_baja",
        title: `💰 Saldo Bajo en Caja Chica: ${curr} ${saldoTotal.toFixed(2)}`,
        subtitle: `Fondo operativo de Sede Challhuahuacho por agotarse`,
        meta: `Saldo disponible menor a ${curr} 300.00`,
        date: today.toISOString().split("T")[0],
        source: "caja",
        id: "caja_saldo_bajo",
        severity: "warning"
      });
    } else if (saldoTotal <= 0 && caja.length > 0) {
      urgent.push({
        type: "caja_critica",
        title: `🚨 CAJA CHICA SIN SALDO: ${curr} ${saldoTotal.toFixed(2)}`,
        subtitle: `Fondo operativo agotado en Sede Challhuahuacho`,
        meta: `Requiere reposición urgente para gastos procesales`,
        date: today.toISOString().split("T")[0],
        source: "caja",
        id: "caja_saldo_cero",
        severity: "urgent"
      });
    }

    // 5. Evaluación de Inventario & Archivo Central (Insumos Críticos & Expedientes)
    const inventario = window.db.get("inventario");
    inventario.forEach(inv => {
      const stock = Number(inv.stock || 0);
      const stockMin = Number(inv.stockMinimo || 2);
      if (stock === 0) {
        urgent.push({
          type: "stock_agotado",
          title: `📦 STOCK AGOTADO: ${inv.nombre || inv.descripcion}`,
          subtitle: `Insumo de oficina / archivo (${inv.ubicacion || 'Sede Challhuahuacho'})`,
          meta: `Stock: 0 unidades (Agotado - Requiere compra urgente)`,
          date: today.toISOString().split("T")[0],
          source: "inventario",
          id: inv.id,
          severity: "urgent"
        });
      } else if (stock <= stockMin) {
        warning.push({
          type: "stock_bajo",
          title: `📦 Stock Bajo: ${inv.nombre || inv.descripcion}`,
          subtitle: `Insumo de oficina (${inv.categoria})`,
          meta: `Quedan solo ${stock} unidad(es) (Mínimo: ${stockMin})`,
          date: today.toISOString().split("T")[0],
          source: "inventario",
          id: inv.id,
          severity: "warning"
        });
      }
    });

    // 6. Evaluación de Expedientes & Resoluciones PDF Pendientes en Casos Activos
    const hasAnyPdf = (c) => {
      if (!c || !c.pdfMeta) return false;
      if (c.pdfMeta.hasPdf) return true;
      if (c.pdfMeta.expediente && c.pdfMeta.expediente.hasPdf) return true;
      if (c.pdfMeta.resolucion && c.pdfMeta.resolucion.hasPdf) return true;
      return false;
    };
    const casosSinPdf = casos.filter(c => c.estado !== "Concluido / Ganado" && c.estado !== "Archivado" && !hasAnyPdf(c));
    if (casosSinPdf.length > 0) {
      info.push({
        type: "resoluciones_pendientes",
        title: `📁 ${casosSinPdf.length} Expediente(s) sin Digitalización PDF`,
        subtitle: `Causas activas pendientes de adjuntar Expediente o Resolución PDF`,
        meta: `Suba el expediente o la resolución judicial para mantener el archivo digital al día`,
        date: today.toISOString().split("T")[0],
        source: "caso",
        id: casosSinPdf[0]?.id || "",
        severity: "info"
      });
    }

    // 7. Flujo de Aprobación de Caja Chica (3 Niveles: Colaborador -> Asistente -> Socio/Admin)
    const currentUserAlert = (window.db && window.db.getCurrentUser) ? window.db.getCurrentUser() : null;
    const userRoleAlert = currentUserAlert ? currentUserAlert.rol : "socio";
    const currentUserIdAlert = currentUserAlert ? currentUserAlert.id : "";

    caja.forEach(gasto => {
      const estado = gasto.estadoFlujo || "pendiente_asistente";
      const solicitanteNom = (gasto.solicitante && gasto.solicitante.nombre) ? gasto.solicitante.nombre : (gasto.responsable || "Colaborador");
      const solicitanteId = (gasto.solicitante && gasto.solicitante.id) ? gasto.solicitante.id : "";
      const montoStr = curr + " " + Number(gasto.monto || 0).toFixed(2);

      if (estado === "pendiente_asistente") {
        if (["asistente_admin", "admin", "socio"].includes(userRoleAlert)) {
          warning.push({
            type: "caja_pendiente_asistente",
            title: "Caja Chica por Revisar: " + solicitanteNom,
            subtitle: (gasto.concepto || "Gasto") + " (" + montoStr + ")",
            meta: "Rendición pendiente de revisión por Asistente Administrativo. Clic para ver.",
            date: gasto.fecha,
            source: "caja",
            id: gasto.id,
            severity: "warning"
          });
        }
      } else if (estado === "elevado_admin") {
        if (["admin", "socio"].includes(userRoleAlert)) {
          urgent.push({
            type: "caja_elevado_admin",
            title: "Gasto Elevado para Desembolso: " + solicitanteNom,
            subtitle: (gasto.concepto || "Gasto") + " (" + montoStr + ")",
            meta: "Revisado por Asistente Admin. Requiere V°B° de Dirección / Socio.",
            date: gasto.fecha,
            source: "caja",
            id: gasto.id,
            severity: "urgent"
          });
        }
      } else if (estado === "observado") {
        if (currentUserIdAlert === solicitanteId || ["asistente_admin", "admin", "socio"].includes(userRoleAlert)) {
          warning.push({
            type: "caja_observada",
            title: "Gasto Observado: " + (gasto.concepto || "Gasto"),
            subtitle: solicitanteNom + " (" + montoStr + ")",
            meta: "Tiene observaciones por subsanar en comprobante o detalle.",
            date: gasto.fecha,
            source: "caja",
            id: gasto.id,
            severity: "warning"
          });
        }
      }
    });

    // 7. Evaluación de la Sesión Fija de Directorio de Socios & Equipo Legal (Viernes 3:00 PM)
    const currentDay = today.getDay(); // 0=Dom, 1=Lun, ..., 5=Vie
    const meetUrl = (window.app && typeof window.app.getDirectorioMeetUrl === "function") 
      ? window.app.getDirectorioMeetUrl() 
      : (localStorage.getItem("aldea_directorio_meet_url") || "https://meet.google.com/paolo-aldea-jur");

    if (currentDay === 5) {
      const nowClock = new Date();
      const targetMeeting = new Date(nowClock);
      targetMeeting.setHours(15, 0, 0, 0);
      const diffMs = targetMeeting.getTime() - nowClock.getTime();
      const diffMin = Math.round(diffMs / 60000);

      if (diffMin <= 15 && diffMin > 0) {
        urgent.push({
          type: "directorio_hoy",
          title: `🏛️ ¡DIRECTORIO INICIA EN ${diffMin} MINUTOS! (3:00 PM)`,
          subtitle: "Directorio de Socios & Equipo Legal — Sala Google Meet",
          meta: `Enlace Oficial: ${meetUrl}`,
          date: targetMeeting.toISOString(),
          source: "directorio",
          id: "DIRECTORIO-VIERNES-15MIN",
          severity: "urgent",
          meetUrl: meetUrl
        });
      } else if (diffMin <= 0 && diffMin >= -60) {
        urgent.push({
          type: "directorio_hoy",
          title: `🏛️ ¡DIRECTORIO EN CURSO AHORA! (Google Meet)`,
          subtitle: "Sesión obligatoria de Socios y Abogados en vivo",
          meta: `Clic para ingresar de inmediato: ${meetUrl}`,
          date: targetMeeting.toISOString(),
          source: "directorio",
          id: "DIRECTORIO-VIERNES-EN-VIVO",
          severity: "urgent",
          meetUrl: meetUrl
        });
      } else {
        warning.push({
          type: "directorio_hoy",
          title: `🏛️ Directorio de Socios Hoy a las 3:00 PM`,
          subtitle: "Reunión semanal de estrategia procesal y balance de sede",
          meta: `Modalidad Virtual: Google Meet (${meetUrl})`,
          date: targetMeeting.toISOString(),
          source: "directorio",
          id: "DIRECTORIO-VIERNES-HOY",
          severity: "warning",
          meetUrl: meetUrl
        });
      }
    } else if (currentDay === 4) { // Jueves (Aviso preventivo oficial)
      info.push({
        type: "directorio_manana",
        title: `🏛️ Mañana Viernes: Directorio de Socios (3:00 PM)`,
        subtitle: "Directorio de Socios & Equipo Legal vía Google Meet",
        meta: `Tener listos informes procesales para las 15:00 hrs`,
        date: new Date(today.getTime() + 86400000).toISOString(),
        source: "directorio",
        id: "DIRECTORIO-VIERNES-PREVIO",
        severity: "info",
        meetUrl: meetUrl
      });
    }

    this.alerts = { urgent, warning, info };
    this.renderHeaderBadges();
    this.renderAlertBanner();
    this.dispatchAutoPush();
    this.syncLocalAlertsFile();
    return this.alerts;
  }

  // Sincronización autónoma local para notificaciones Toast de Windows 100% Offline
  syncLocalAlertsFile() {
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      try {
        const payload = {
          timestamp: Date.now(),
          urgentAlerts: this.alerts.urgent.map(a => ({
            id: a.id,
            expediente: a.expediente || (a.title ? a.title.replace(/^[^:]+:\s*(Exp\.\s*)?/, 'Exp. ') : (a.id || 'Causa')),
            detalle: a.subtitle || a.title || "Plazo perentorio",
            vencimiento: a.date || "Inmediato"
          })),
          audienciasHoy: (window.db ? window.db.get("citas") : []).filter(c => {
            if (!c.fechaHora) return false;
            const d = new Date(c.fechaHora);
            const now = new Date();
            return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
          }).map(c => ({
            id: c.id,
            expediente: c.cliente || c.expediente || "Audiencia",
            juzgado: c.lugar || c.modalidad || "Sede Judicial Cotabambas",
            hora: c.fechaHora.split("T")[1] ? c.fechaHora.split("T")[1].substring(0, 5) : "Programada"
          }))
        };
        const tok = window.__LOCAL_SERVER_API_KEY__ || (typeof sessionStorage !== "undefined" ? sessionStorage.getItem("PA_LOCAL_API_TOKEN") : "") || "";
        fetch("/api/alertas_sync", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            ...(tok ? { Authorization: "Bearer " + tok } : {})
          },
          body: JSON.stringify(payload)
        }).catch(() => {});
      } catch (e) {}
    }
  }

  renderHeaderBadges() {
    const badge = document.getElementById("alertBadgeCount");
    const pulseDot = document.getElementById("alertPulseDot");
    const totalUrgent = this.alerts.urgent.length;
    const totalAll = totalUrgent + this.alerts.warning.length;

    if (badge) {
      if (totalAll > 0) {
        badge.textContent = totalAll;
        badge.classList.remove("hidden");
        if (totalUrgent > 0) {
          badge.className = "absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-bounce";
          if (pulseDot) pulseDot.classList.remove("hidden");
        } else {
          badge.className = "absolute -top-1 -right-1 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full";
          if (pulseDot) pulseDot.classList.add("hidden");
        }
      } else {
        badge.classList.add("hidden");
        if (pulseDot) pulseDot.classList.add("hidden");
      }
    }
  }

  renderAlertBanner() {
    const banner = document.getElementById("topAlertBanner");
    const container = document.getElementById("topAlertBannerContent");
    if (!banner || !container) return;

    if (this.alerts.urgent.length > 0) {
      const topAlert = this.alerts.urgent[0];
      container.innerHTML = `
        <div class="flex items-center justify-between gap-3 text-xs md:text-sm">
          <div class="flex items-center gap-2">
            <span class="flex h-3 w-3 relative">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
            </span>
            <span class="font-bold text-red-900">${topAlert.title}:</span>
            <span class="text-red-800 truncate max-w-[280px] sm:max-w-md md:max-w-xl">${topAlert.subtitle} - <span class="font-medium underline">${topAlert.meta}</span></span>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="bg-red-200 text-red-900 px-2 py-0.5 rounded text-xs font-bold">${this.alerts.urgent.length} alerta(s) crítica(s)</span>
            <button onclick="window.alerts.openDrawer()" class="bg-red-700 hover:bg-red-800 text-white px-2.5 py-1 rounded text-xs font-semibold transition">Ver Todas</button>
          </div>
        </div>
      `;
      banner.classList.remove("hidden");
    } else {
      banner.classList.add("hidden");
    }
  }

  openDrawer() {
    const drawer = document.getElementById("alertsDrawer");
    const backdrop = document.getElementById("alertsDrawerBackdrop");
    if (!drawer) return;

    this.renderDrawerList();
    drawer.classList.remove("translate-x-full");
    if (backdrop) backdrop.classList.remove("hidden");
  }

  closeDrawer() {
    const drawer = document.getElementById("alertsDrawer");
    const backdrop = document.getElementById("alertsDrawerBackdrop");
    if (!drawer) return;
    drawer.classList.add("translate-x-full");
    if (backdrop) backdrop.classList.add("hidden");
  }

  renderDrawerList(filter = "all") {
    const listEl = document.getElementById("alertsListContainer");
    if (!listEl) return;

    let items = [];
    if (filter === "urgent") items = this.alerts.urgent;
    else if (filter === "warning") items = this.alerts.warning;
    else items = [...this.alerts.urgent, ...this.alerts.warning, ...this.alerts.info];

    if (items.length === 0) {
      listEl.innerHTML = `
        <div class="py-12 text-center text-slate-400">
          <i class="fa-solid fa-circle-check text-4xl text-emerald-500 mb-3"></i>
          <p class="font-semibold text-slate-700">¡Al día! No hay alertas pendientes</p>
          <p class="text-xs text-slate-500 mt-1">Todos los plazos judiciales y citas están debidamente atendidos.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = items.map(item => {
      let icon = "fa-triangle-exclamation text-amber-500";
      let border = "border-amber-200 bg-amber-50/50";
      if (item.severity === "urgent") {
        icon = "fa-circle-exclamation text-red-600";
        border = "border-red-200 bg-red-50/60";
      } else if (item.severity === "info") {
        icon = "fa-circle-info text-blue-500";
        border = "border-blue-100 bg-blue-50/40";
      }

      let targetModuleName = 'Casos & Expedientes';
      if (item.source === 'cita') targetModuleName = 'Agenda Citas';
      if (item.source === 'caja') targetModuleName = 'Caja Chica';
      if (item.source === 'inventario') targetModuleName = 'Inventario & Archivo';

      return `
        <div class="p-3.5 rounded-xl border ${border} flex items-start gap-3 transition hover:shadow-sm">
          <i class="fa-solid ${icon} text-lg mt-0.5 shrink-0"></i>
          <div class="flex-1 min-w-0">
            <h4 class="text-xs font-bold text-slate-900 leading-tight">${item.title}</h4>
            <p class="text-xs text-slate-700 mt-0.5 line-clamp-2">${item.subtitle}</p>
            <div class="flex items-center gap-2 mt-2">
              <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                <i class="fa-regular fa-clock text-[10px]"></i> ${item.meta}
              </span>
              ${item.source === 'cita' ? `
                <button onclick="window.app.openWhatsAppModal('${item.id}'); event.stopPropagation();" class="ml-auto text-[11px] font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 px-2 py-0.5 rounded flex items-center gap-1 shadow-sm transition" title="Enviar mensaje o recordatorio por WhatsApp">
                  <i class="fa-brands fa-whatsapp text-emerald-600"></i> WhatsApp
                </button>
              ` : ''}
              <button onclick="window.alerts.goToItem('${item.source}', '${item.id}')" class="${item.source === 'cita' ? '' : 'ml-auto'} text-[11px] font-bold text-slate-900 hover:text-amber-700 underline flex items-center gap-1">
                Ver en ${targetModuleName} <i class="fa-solid fa-arrow-right text-[9px]"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  goToItem(source, id) {
    this.closeDrawer();
    if (source === "caso") {
      window.app.switchTab("casos");
      setTimeout(() => {
        const row = document.getElementById(`caso-row-${id}`);
        if (row) {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          row.classList.add("bg-amber-100", "transition", "duration-1000");
          setTimeout(() => row.classList.remove("bg-amber-100"), 2500);
        }
      }, 250);
    } else if (source === "cita") {
      window.app.switchTab("citas");
      setTimeout(() => {
        const card = document.getElementById(`cita-card-${id}`);
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          card.classList.add("ring-2", "ring-amber-500", "transition", "duration-1000");
          setTimeout(() => card.classList.remove("ring-2", "ring-amber-500"), 2500);
        }
      }, 250);
    } else if (source === "caja") {
      window.app.switchTab("caja_chica");
      setTimeout(() => {
        const row = document.getElementById(`caja-row-${id}`);
        if (row) {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          row.classList.add("bg-amber-100", "transition", "duration-1000");
          setTimeout(() => row.classList.remove("bg-amber-100"), 2500);
        }
      }, 250);
    } else if (source === "inventario") {
      window.app.switchTab("inventario");
      setTimeout(() => {
        const row = document.getElementById(`inv-row-${id}`);
        if (row) {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          row.classList.add("bg-amber-100", "transition", "duration-1000");
          setTimeout(() => row.classList.remove("bg-amber-100"), 2500);
        }
      }, 250);
    } else if (source === "directorio") {
      const url = (window.app && typeof window.app.getDirectorioMeetUrl === "function")
        ? window.app.getDirectorioMeetUrl()
        : (localStorage.getItem("aldea_directorio_meet_url") || "https://meet.google.com/pao-aldea-jur");
      window.open(url, "_blank");
    }
  }

  // =========================================================================
  // SISTEMA DE ALERTAS INTELIGENTES: REUNIÓN DE DIRECTORIO (VIERNES 3:00 PM)
  // =========================================================================
  initDirectorioMeetScheduler() {
    if (this._meetSchedulerInterval) {
      clearInterval(this._meetSchedulerInterval);
    }
    this.checkDirectorioMeetAlerts();
    this._meetSchedulerInterval = setInterval(() => {
      this.checkDirectorioMeetAlerts();
    }, 30000); // Evaluación continua cada 30 segundos
  }

  checkDirectorioMeetAlerts() {
    const now = new Date();
    // 5 = Viernes (0=Dom, 1=Lun, 2=Mar, 3=Mie, 4=Jue, 5=Vie, 6=Sab)
    if (now.getDay() !== 5) {
      return;
    }

    // Objetivo: 15:00:00 (3:00 PM) del día actual
    const targetMeeting = new Date(now);
    targetMeeting.setHours(15, 0, 0, 0);

    const diffMs = targetMeeting.getTime() - now.getTime();
    const diffMinutes = Math.round(diffMs / 60000);
    const todayYMD = now.toISOString().split("T")[0];

    // Alerta a los 15 minutos (entre 14 y 16 minutos antes)
    if (diffMinutes >= 14 && diffMinutes <= 16) {
      const key = `ALDEA_ALERT_MEET_15MIN_${todayYMD}`;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "true");
        this.dispararAlertaDirectorioMeet({
          minutosRestantes: 15,
          etiqueta: "Faltan 15 Minutos",
          mensaje: "La sesión semanal de Directorio de Socios & Equipo Legal inicia a las 3:00 PM vía Google Meet."
        });
      }
    }

    // Alerta a los 5 minutos (entre 4 y 6 minutos antes)
    if (diffMinutes >= 4 && diffMinutes <= 6) {
      const key = `ALDEA_ALERT_MEET_5MIN_${todayYMD}`;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "true");
        this.dispararAlertaDirectorioMeet({
          minutosRestantes: 5,
          etiqueta: "¡Faltan 5 Minutos!",
          mensaje: "La sesión de Directorio está a punto de comenzar. Conéctese a la sala virtual oficial."
        });
      }
    }

    // Alerta en la hora exacta / en curso (entre 1 y -15 minutos)
    if (diffMinutes <= 1 && diffMinutes >= -15) {
      const key = `ALDEA_ALERT_MEET_NOW_${todayYMD}`;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "true");
        this.dispararAlertaDirectorioMeet({
          minutosRestantes: 0,
          etiqueta: "¡Reunión en Curso Ahora!",
          mensaje: "La sesión de Directorio de Socios ha iniciado. Ingrese a la sala de Google Meet."
        });
      }
    }
  }

  dispararAlertaDirectorioMeet(detalles) {
    const meetUrl = (window.app && typeof window.app.getDirectorioMeetUrl === "function")
      ? window.app.getDirectorioMeetUrl()
      : (localStorage.getItem("aldea_directorio_meet_url") || "https://meet.google.com/paolo-aldea-jur");

    // 1. Alarma sonora perentoria
    this.playChime("urgent");

    // 2. Notificación push de sistema (móvil y desktop con enlace directo a Google Meet)
    this.sendBrowserNotification(
      `🏛️ PAOLO ALDEA — Directorio de Socios (${detalles.etiqueta})`,
      `${detalles.mensaje}\nToque aquí para unirse a Google Meet.`,
      meetUrl
    );

    // 3. Modal interactivo en pantalla para todos los trabajadores
    if (window.app && typeof window.app.mostrarModalAlertaDirectorioMeet === "function") {
      window.app.mostrarModalAlertaDirectorioMeet(detalles);
    }

    // 4. Banner superior persistente
    if (window.app && typeof window.app.mostrarBannerReunionViernes === "function") {
      window.app.mostrarBannerReunionViernes(detalles);
    }
  }

  testDirectorioMeetAlert(minutos = 15) {
    this.dispararAlertaDirectorioMeet({
      minutosRestantes: minutos,
      etiqueta: `Simulación: Faltan ${minutos} Minutos`,
      mensaje: "Prueba técnica de alerta inteligente para la reunión de los Viernes a las 3:00 PM vía Google Meet."
    });
  }
}

// Global instance
window.alerts = new AlertEngine();
