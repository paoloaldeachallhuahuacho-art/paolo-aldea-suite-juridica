/**
 * PAOLO ALDEA & ABOGADOS - Calendar & Judicial Hearings Controller
 * Controlador Especializado para la Agenda de Audiencias, Directorio Semanal
 * de Socios de los Viernes vía Google Meet y Notificaciones WhatsApp a Clientes.
 */

class CalendarController {
  constructor(appContext = null) {
    this.app = appContext || window.app;
  }

  setContext(app) {
    this.app = app;
  }

  /**
   * Cálculo de fecha del próximo Directorio Nacional de Socios (Viernes 15:00 hrs)
   */
  getNextFridayDirectorio() {
    const d = new Date();
    const dayOfWeek = d.getDay(); // 0: Dom, 1: Lun, ..., 5: Vie, 6: Sab
    let diff = (5 - dayOfWeek + 7) % 7;
    // Si hoy es viernes pero ya pasaron las 15:00, saltar al siguiente viernes
    if (diff === 0 && (d.getHours() > 15 || (d.getHours() === 15 && d.getMinutes() > 0))) {
      diff = 7;
    }
    d.setDate(d.getDate() + diff);
    d.setHours(15, 0, 0, 0);

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return {
      dateObj: d,
      isoDate: `${year}-${month}-${day}T15:00`,
      formattedDate: d.toLocaleDateString("es-PE", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      formattedTime: "3:00 PM (15:00 hrs)"
    };
  }

  /**
   * Generación de Mensaje Institucional de WhatsApp para Confirmación de Audiencias o Citas
   */
  buildWhatsAppMessage(cita, settings = {}) {
    if (!cita) return "";

    const firmName = settings.firmName || "PAOLO ALDEA & ABOGADOS";
    const dateFormatted = cita.fechaHora ? new Date(cita.fechaHora).toLocaleString("es-PE", {
      dateStyle: "medium", timeStyle: "short"
    }) : "Por confirmar";

    const isMeet = cita.modalidad?.toLowerCase().includes("virtual") || cita.modalidad?.toLowerCase().includes("meet");
    const linkMeet = cita.linkMeet || settings.directorioMeetUrl || "https://meet.google.com/new";

    let msg = `*PAOLO ALDEA & ABOGADOS — Notificación de Audiencia/Cita*\n\n`;
    msg += `Estimado(a) *${cita.cliente}*:\n\n`;
    msg += `Le confirmamos la cita programada con nuestro equipo legal:\n`;
    msg += `📌 *Asunto:* ${cita.motivo || "Consulta Legal"}\n`;
    msg += `📅 *Fecha y Hora:* ${dateFormatted}\n`;
    msg += `⚖️ *Abogado Responsable:* ${cita.abogado || "Dirección Jurídica"}\n`;
    msg += `📍 *Modalidad:* ${cita.modalidad || "Presencial en Despacho"}\n`;

    if (isMeet) {
      msg += `💻 *Enlace Virtual Google Meet:* ${linkMeet}\n`;
    }

    if (Array.isArray(cita.documentosRequeridos) && cita.documentosRequeridos.length > 0) {
      msg += `\n📁 *Documentación a presentar:*\n`;
      cita.documentosRequeridos.forEach(doc => {
        msg += `  • ${doc}\n`;
      });
    }

    msg += `\nPara cualquier consulta o reprogramación, por favor comunicarse con antelación.\n`;
    msg += `_Atentamente,_\n*${firmName}*`;

    return msg;
  }

  /**
   * Genera enlace listo para WhatsApp Web / Móvil
   */
  getWhatsAppUrl(telefono, mensaje) {
    const cleanPhone = String(telefono || "").replace(/[^0-9]/g, "");
    const encodedMsg = encodeURIComponent(mensaje);
    if (cleanPhone.length >= 9) {
      const fullPhone = cleanPhone.startsWith("51") ? cleanPhone : "51" + cleanPhone;
      return `https://wa.me/${fullPhone}?text=${encodedMsg}`;
    }
    return `https://wa.me/?text=${encodedMsg}`;
  }

  /**
   * Filtrado multi-criterio de citas y audiencias
   */
  filterCitas(items, searchVal = "", sede = "ALL", modalidad = "ALL", estado = "ALL") {
    if (!Array.isArray(items)) return [];
    const q = (searchVal || "").toLowerCase().trim();

    return items.filter(c => {
      if (!c) return false;

      // Filtro Sede
      if (sede !== "ALL" && sede !== "todas") {
        const cSede = window.db ? window.db.normalizeSede(c.sede) : (c.sede || "");
        if (cSede !== sede) return false;
      }

      // Filtro Modalidad
      if (modalidad !== "ALL" && c.modalidad !== modalidad) return false;

      // Filtro Estado
      if (estado !== "ALL" && c.estado !== estado) return false;

      // Búsqueda
      if (q) {
        const text = [
          c.cliente, c.telefono, c.motivo, c.abogado,
          c.materia, c.notas, c.modalidad
        ].filter(Boolean).join(" ").toLowerCase();

        if (!text.includes(q)) return false;
      }

      return true;
    });
  }
}

// Instanciar y acoplar al ecosistema
window.CalendarController = CalendarController;
window.calendarController = new CalendarController();
