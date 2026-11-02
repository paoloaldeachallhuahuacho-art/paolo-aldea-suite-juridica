/**
 * PAOLO ALDEA & ABOGADOS - Legal Documents & Judicial Drafting Controller
 * Controlador Especializado para la Gestión Documental, Generador Inteligente
 * de Escritos Judiciales Oficiales (SINOE / CEJ) y Cartas Notariales.
 */

class DocumentsController {
  constructor(appContext = null) {
    this.app = appContext || window.app;
    this.plantillas = this.initPlantillas();
  }

  setContext(app) {
    this.app = app;
  }

  initPlantillas() {
    return {
      apersonamiento: {
        titulo: "Apersonamiento y Señalamiento de Casilla SINOE",
        tipo: "Escrito Judicial",
        materia: "Procesal General",
        template: `SECRETARIO : \${secretario}
EXPEDIENTE : \${expediente}
CUADERNO   : PRINCIPAL
ESCRITO    : 01-2026
SUMILLA    : APERSONAMIENTO Y SEÑALAMIENTO DE CASILLA ELECTRÓNICA SINOE

SEÑOR JUEZ DEL \${juzgado}:

\${cliente}, identificado con DNI/RUC N° \${documentoIdentidad}, con domicilio procesal en \${domicilioSede}, y con CASILLA ELECTRÓNICA SINOE N° \${casillaSinoe}, bajo la dirección técnica del Dr. Paolo Aldea Quincho, en los seguidos sobre \${materia} contra \${parteContraria}; a Ud. con el debido respeto digo:

I. PETITORIO:
Que, al amparo del Artículo 139° inciso 14 de la Constitución Política del Perú y los Artículos 155-A y siguientes del Texto Único Ordenado de la Ley Orgánica del Poder Judicial, me APERSONO a la presente instancia solicitando se me tenga por apersonado al proceso y se sirva notificar las resoluciones que recaigan en autos a la casilla electrónica señalada en la sumilla.

II. DOMICILIO PROCESAL Y CASILLA JUDICIAL:
Para los efectos de ley, cumplo con señalar como domicilio procesal el ubicado en \${domicilioSede}, y de manera preferente y obligatoria la CASILLA ELECTRÓNICA SINOE N° \${casillaSinoe}.

POR TANTO:
A Ud. Señor Juez, pido admitir el presente escrito y proveer conforme a ley.

\${ciudadSede}, \${fechaHoy}

______________________________
Dr. Paolo Aldea Quincho
Abogado Litigante - Reg. CAL`
      },

      impulso: {
        titulo: "Solicitud de Impulso Procesal y Celeridad",
        tipo: "Escrito Judicial",
        materia: "Procesal General",
        template: `SECRETARIO : \${secretario}
EXPEDIENTE : \${expediente}
ESCRITO    : Correlativo
SUMILLA    : SOLICITA IMPULSO PROCESAL Y PROVEÍDO CONFORME A LEY

SEÑOR JUEZ DEL \${juzgado}:

\${cliente}, en los seguidos contra \${parteContraria} sobre \${materia}; ante Ud. con el debido respeto me presento y expongo:

Que, habiendo transcurrido en exceso los plazos procesales perentorios establecidos en el Código Procesal, y estando pendiente de resolver el último acto postulatorio/resolutivo; al amparo del Principio de Celeridad y Concentración Procesal consagrado en el Artículo V del Título Preliminar del Código Procesal Civil:

SOLICITO:
Se sirva disponer el inmediato despacho del presente expediente y EMITIR la resolución correspondiente, bajo apercibimiento de remitir los actuados al Órgano de Control de la Magistratura (ODANC) por retardo injustificado en la administración de justicia.

POR TANTO:
A Ud., Señor Juez, pido acceder a lo solicitado por ser de justicia.

\${ciudadSede}, \${fechaHoy}`
      },

      apelacion: {
        titulo: "Recurso de Apelación con Efecto Suspensivo",
        tipo: "Recurso Impugnatorio",
        materia: "Derecho Procesal",
        template: `SECRETARIO : \${secretario}
EXPEDIENTE : \${expediente}
SUMILLA    : INTERPONE RECURSO DE APELACIÓN CONTRA LA RESOLUCIÓN N° \${numeroResolucion}

SEÑOR JUEZ DEL \${juzgado}:

\${cliente}, con el patrocinio del estudio PAOLO ALDEA & ABOGADOS, en los seguidos sobre \${materia}; ante Ud. digo:

I. PRETENSIÓN IMPUGNATORIA:
Que, dentro del plazo perentorio de ley, INTERPONGO RECURSO DE APELACIÓN con EFECTO SUSPENSIVO contra la Resolución N° \${numeroResolucion} notificada en fecha \${fechaNotificacion}, a fin de que sea REVOCADA o ANULADA por el Superior Jerárquico, por los siguientes fundamentos de hecho y de derecho:

II. FUNDAMENTOS DEL AGRAVIO:
1. Error in procedendo y vicio de motivación aparente consagrado en el Art. 139° inc. 5 de la Carta Magna.
2. Infracción normativa de las normas que garantizan el debido proceso y la tutela jurisdiccional efectiva.

POR TANTO:
Solicito conceder el recurso interpuesto y elevar los actuados a la Sala Superior.

\${ciudadSede}, \${fechaHoy}`
      },

      cartaNotarial: {
        titulo: "Carta Notarial de Intimación de Pago y Requerimiento",
        tipo: "Carta Notarial",
        materia: "Obligaciones & Contratos",
        template: `CARTA NOTARIAL DE REQUERIMIENTO DE PAGO

\${ciudadSede}, \${fechaHoy}

Señores:
\${parteContraria}
Dirección: \${direccionDestino}

De nuestra consideración:

Por medio del presente conducto notarial, en representación de nuestro patrocinado \${cliente}, bajo la dirección legal de PAOLO ALDEA & ABOGADOS, los REQUERIMOS para que en el término perentorio de SETENTA Y DOS (72) HORAS de notificada la presente, cumplan con hacer efectivo el pago de la suma adeudada ascendente a \${montoDeuda}, derivada de \${conceptoDeuda}.

Hacemos de su expreso conocimiento que, vencido el término concedido sin verificar el pago íntegro de la acreencia, iniciaremos de forma inmediata las acciones judiciales pertinentes mediante DEMANDA DE OBLIGACIÓN DE DAR SUMA DE DINERO y MEDIDAS CAUTELARES DE EMBARGO en forma de retención sobre sus cuentas bancarias en el sistema financiero nacional (Art. 608° y ss. del Código Procesal Civil), con expresa condena de costas y costos procesales.

Atentamente,

PAOLO ALDEA & ABOGADOS
Sede \${nombreSede}
Teléfono: +51 943 410 215`
      }
    };
  }

  /**
   * Compilador de plantilla: interpola variables del caso dinámicamente
   */
  compileTemplate(plantillaKey, data = {}) {
    const p = this.plantillas[plantillaKey];
    if (!p) return "";

    const activeSedeKey = window.db ? window.db.getActiveSede() : "challhuahuacho";
    const branchConfig = (window.SEDES_CONFIG && window.SEDES_CONFIG[activeSedeKey]) ? window.SEDES_CONFIG[activeSedeKey] : null;

    const context = {
      secretario: data.secretario || "Anotado en autos",
      expediente: data.expediente || "00000-2026-0-0303-JM-CI-01",
      juzgado: data.juzgado || (branchConfig ? `Juzgado Mixto de ${branchConfig.ciudad}` : "Juzgado Mixto de Cotabambas"),
      cliente: data.cliente || "CLIENTE PATROCINADO",
      documentoIdentidad: data.documentoIdentidad || "DNI / RUC",
      parteContraria: data.parteContraria || "PARTE DEMANDADA",
      materia: data.materia || "Materia Procesal",
      domicilioSede: branchConfig ? branchConfig.direccion : "Av. Los Mineros Mz. D Lt. 4, Challhuahuacho, Apurímac",
      casillaSinoe: data.casillaSinoe || "45890",
      ciudadSede: branchConfig ? branchConfig.ciudad : "Challhuahuacho",
      nombreSede: branchConfig ? branchConfig.nombre : "Challhuahuacho",
      fechaHoy: new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" }),
      numeroResolucion: data.numeroResolucion || "01",
      fechaNotificacion: data.fechaNotificacion || "Fecha reciente",
      direccionDestino: data.direccionDestino || "Domicilio fiscal de la contraparte",
      montoDeuda: data.montoDeuda || "S/ 0.00",
      conceptoDeuda: data.conceptoDeuda || "Valorizaciones de obra y liquidación contractual impaga"
    };

    let result = p.template;
    Object.keys(context).forEach(k => {
      const reg = new RegExp(`\\$\\{${k}\\}`, "g");
      result = result.replace(reg, context[k]);
    });

    return result;
  }

  /**
   * Filtrado multi-criterio de documentos
   */
  filterDocuments(docs, searchVal = "", tipo = "ALL", materia = "ALL", sede = "ALL") {
    if (!Array.isArray(docs)) return [];
    const q = (searchVal || "").toLowerCase().trim();

    return docs.filter(d => {
      if (!d) return false;

      if (sede !== "ALL" && sede !== "todas") {
        const dSede = window.db ? window.db.normalizeSede(d.sede) : (d.sede || "");
        if (dSede !== sede) return false;
      }

      if (tipo !== "ALL" && d.tipo !== tipo) return false;
      if (materia !== "ALL" && d.materia !== materia) return false;

      if (q) {
        const text = [d.titulo, d.tipo, d.expediente, d.cliente, d.materia].filter(Boolean).join(" ").toLowerCase();
        if (!text.includes(q)) return false;
      }

      return true;
    });
  }
}

// Acoplar al ámbito global
window.DocumentsController = DocumentsController;
window.documentsController = new DocumentsController();
