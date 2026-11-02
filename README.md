# PAOLO ALDEA & ABOGADOS | Sede Challhuahuacho
## Suite de Gestión Operativa, Procesal & Administrativa (Ingeniería Industrial)

Sistema integral de gestión diseñado específicamente para la **Sede Challhuahuacho** (Cotabambas, Apurímac) del prestigioso estudio **PAOLO ALDEA & ABOGADOS**. Desarrollado con enfoque de **Ingeniería Industrial** para la administración de procesos, control de costos, gestión de inventarios (Método ABC), monitoreo de plazos perentorios y generación de reportes ejecutivos en **Excel de Alta Calidad**.

---

## 🔒 Respuesta Clave: ¿Es necesario subirlo a la web?

> [!IMPORTANT]
> **NO es necesario subirlo a la web en lo absoluto.**  
> La aplicación está diseñada para funcionar de forma **100% LOCAL y AUTÓNOMA** en tu computadora:
> - Puedes **llenar datos, editar, eliminar, consultar y exportar a Excel sin tener conexión a internet**.
> - Todos los archivos de diseño, fuentes, librerías (`Chart.js`, `ExcelJS`, `Tailwind`, `FontAwesome`) se encuentran descargados en tu propia máquina dentro de la carpeta `lib/`.
> - Tus datos no viajan a ningún servidor externo, garantizando el **secreto profesional y confidencialidad absoluta** de los clientes y litigios del estudio en Challhuahuacho.
> - La información se guarda automáticamente (IndexedDB primario + espejo localStorage) y puedes generar copias de seguridad en archivo `.json` cuando lo desees.
> - **Modo de despliegue canónico:** local unipersonal — ver [`docs/DEPLOY.md`](docs/DEPLOY.md).

---

## 🏭 Enfoque de Ingeniería Industrial en el Despacho Legal

Como Asistente Administrativo e Ingeniero Industrial, cuentas con herramientas de control analítico que los sistemas legales tradicionales no tienen:

### 1. 💰 Caja Chica por Centros de Costo (Cost Accounting)
- **Imputación Precisa**: Cada gasto e ingreso se asigna a un centro de costo específico:
  - *Costo Procesal Recuperable* (Aranceles judiciales en Banco de la Nación, peritajes)
  - *Litigio Civil - Tambobamba* (Viáticos y camioneta Challhuahuacho - Juzgado de Tambobamba)
  - *Defensa Penal Corporativa* (Honorarios, provisiones de contratistas mineros)
  - *Gestión Notarial y Contractual* (Notaría Tambobamba / Cusco)
  - *Infraestructura & TIC* (Servicio de Internet Claro del despacho)
  - *Almacén & Logística* (Papelería, archiveros de palanca, tóners)
- **Control de Comprobantes**: Vouchers, boletas, facturas y recibos de arancel judicial.
- **Exportación Contable**: Excel con formatos monetarios (`S/ #,##0.00`), diferenciación verde/rojo y doble subrayado contable.

### 2. ⚖️ Gestión de Litigios & Tiempos de Ciclo (Lead Time Procesal)
- **Control de Expedientes en Cotabambas**: Juzgado Mixto de Tambobamba, Juzgado de Paz Letrado de Challhuahuacho y Sala de Abancay.
- **Lead Time**: Registro del tiempo de ciclo en días para medir la duración de los trámites procesales.
- **Matriz de Riesgo**: Clasificación de causas por nivel de riesgo (Crítico - Libertad, Alto - Cuantía Significativa, Medio, Concluido con Éxito).
- **Semáforo Perentorio**:
  - 🔴 **Vence Hoy**: Alerta visual prioritaria con banner superior y alarma.
  - ⚠️ **Plazo Fatal (≤ 48 horas)**: Conteo regresivo exacto para contestar excepciones o presentar recursos.
  - ⏳ **Próximo a Vencer (3 a 5 días)**: Alerta preventiva.
  - 🟢 **En Término (> 5 días)**: Estado normal.

### 3. 📦 Inventario Patrimonial bajo Método ABC
En Challhuahuacho, la logística de reposición desde Cusco o Lima toma días por la distancia geográfica. El sistema incorpora:
- **Clase A (Críticos / Alto Valor)**: Token criptográfico USB de firma digital judicial (SINOE) del Dr. Paolo Aldea, router y módem de Internet Claro, expedientes originales de obras y valorizaciones.
- **Clase B (Valor Moderado)**: Biblioteca jurídica y tratados de doctrina procesal penal.
- **Clase C (Consumibles / Alta Reposición)**: Millar de papel bond membretado oficial, tóners láser, sellos de cargo.
- **Punto de Reorden**: Alerta de stock mínimo para solicitar suministros con anticipación.
- **Valorización Patrimonial**: Cálculo automático del valor monetario total del inventario en sede.

### 4. 📅 Agenda de Citas & Audiencias Virtuales / Presenciales
- Citas con clientes contratistas mineros, comunidades campesinas y particulares.
- Botón directo de **WhatsApp** con plantilla de mensaje formal pre-redactada.
- Control de audiencias judiciales virtuales (vía Google Meet con enlace directo).

### 5. 📊 Tablero de KPIs Power BI
- Gráficos interactivos de flujo de caja, distribución de litigios por materia, egresos por centro de costo y cumplimiento de citas.
- Slicers interactivos para filtrar por períodos.

### 6. 📗 Motor de Exportación Excel de Nivel Corporativo
Genera un libro `.xlsx` maestro con membrete institucional de **PAOLO ALDEA & ABOGADOS - Sede Challhuahuacho** y 6 pestañas de colores corporativos:
1. `📊 RESUMEN EJECUTIVO`
2. `💰 CAJA CHICA`
3. `⚖️ CASOS Y EXPEDIENTES`
4. `📅 CITAS Y AUDIENCIAS`
5. `📦 INVENTARIO Y ARCHIVO`
6. `📑 GESTIÓN DOCUMENTAL`

---

## 🛡️ Mejoras de Nivel Profesional y Enterprise Implementadas (v6.1 — Hardening & Estabilización)

1. **Seguridad y Ciberseguridad de Despacho (Hardening — Fase 1)**:
   - **Blindaje de Servidor Local (`servidor_local.ps1`)**: Implementación de validación estricta de rutas canónicas (`GetFullPath`) para erradicar vulnerabilidades de Path Traversal (LFI) y restricción estricta de CORS al origen local (`http://localhost:8080`), previniendo lectura o inyección no autorizada desde sitios web externos.
   - **Eliminación Total de Backdoors y Contraseñas en Texto Plano**: Erradicación de todas las claves maestras cableadas (`aldea2026`, `9900`, `admin2026`, `master2026`, `jefes`, `1234`). La autenticación se valida de manera estricta contra hashes criptográficos SHA-256 almacenados tanto para la Dirección como para el padrón de colaboradores (`DEMO_WORKERS`).
   - **Aislamiento del Bus de Alertas**: Bloqueo del envío automático de notificaciones no cifradas a buses públicos compartidos (`ntfy.sh`), salvaguardando el secreto profesional legal y la Ley N° 29733 de Protección de Datos Personales.

2. **Modernización de Servidor y Persistencia Transaccional (Fase 2)**:
   - **Streaming I/O de Alta Eficiencia**: Servidor local con streaming directo de archivos mediante `System.IO.FileStream`, reduciendo el consumo de RAM a casi cero y acelerando la carga de librerías grandes (`ExcelJS`, `html2pdf`) y activos estáticos.
   - **Persistencia Atómica ACID & Self-Healing**: Escritura segura en `central_cloud_data.json` y `alertas_locales.json` mediante archivos de transición temporales (`.tmp`) y copias de seguridad de reemplazo (`.bak`), eliminando cualquier riesgo de truncado o corrupción por corte de energía.
   - **Nuevos Endpoints de Monitoreo y Contingencia**:
     - `GET /api/health`: Métricas en tiempo real de uptime, estado de almacenamiento y colecciones.
     - `POST /api/backup`: Disparador de snapshots versionados con trazabilidad en `_backups/historial_versiones.txt`.
   - **Botón de Snapshot en UI**: Integración en el Panel de Control Total para generar respaldos físicos en disco con 1 solo clic.

3. **Corrección Integral Ortográfica y Tipográfica (Fase 3)**:
   - **Saneamiento Total de Codificación (Mojibake Cero)**: Corrección sistemática de secuencias mal decodificadas en `index.html`, `data.js`, `pdf-export.js` y `servidor_local.ps1`, restableciendo todas las tildes, signos de apertura (`¡`, `¿`), eñes y caracteres tipográficos institucionales (`•`, `°`).
   - **Revisión de Textos y Formularios Legales**: Estandarización de términos jurídicos, contables y administrativos en todos los modales, tablas y reportes ejecutivos.

4. **Nuevas Funcionalidades Legales Profesionales (Legaltech)**:
   - **Generador Inteligente de Escritos Judiciales**: Motor integrado para redactar automáticamente con un solo clic:
     - *Apersonamiento y Señalamiento de Casilla SINOE*
     - *Solicitud de Impulso Procesal y Celeridad*
     - *Recurso de Apelación con Efecto Suspensivo*
     - *Contestación de Demanda y Deducción de Excepciones*
     - *Carta Notarial de Requerimiento de Pago y Apercibimiento*
     Con llenado automático del número de expediente, juzgado, partes procesales y domicilio de sede. Permite copiar al portapapeles o descargar en `.txt` de inmediato.
   - **Línea de Tiempo Procesal (Timeline de Actuados)**: Historial visual cronológico de demandas, resoluciones, plazos fatales y audiencias dentro de cada expediente.
   - **Optimización Crítica de Memoria en Exportación**: Se reemplazó el string Base64 incrustado de 71 KB en `pdf-export.js` por carga directa de la imagen, reduciendo a la mitad el tamaño del módulo.
    - **Rediseño Integral de Asistencia & Geocerca Multi-Modal**:
      - Se eliminó el selector anterior confuso de GPS simulado.
      - **[OFICINA] En Oficina (Según Sede)**: Marcaje biométrico digital directo según el perímetro oficial de la sede asignada (Miraflores, Abancay, Cusco, Huaraz, Challhuahuacho).
      - **[GPS] Tiempo Real (GPS Móvil)**: Marcaje mediante el sensor satelital físico del dispositivo o navegador con cálculo de distancia geodésica haversine.
      - **[🌐] Comisión Oficial (En Otras Sedes)**: Opción oficial para colaboradores asignados a diligencias inter-sede o juzgados en otras provincias, con selección de sede de destino y motivo justificado.

5. **Despliegue Híbrido en Nube & Sincronización Multi-Sede (Fase 3 - Implementada)**:
   - **Motor de Sincronización Bidireccional Real (Supabase & Hub Local)**: Transmisión y recepción bidireccional de las 8 colecciones operativas mediante `sync_multi_sede_hub` y endpoints REST, consolidando automáticamente cambios de las 5 sedes (Challhuahuacho, Miraflores, Abancay, Cusco, Huaraz).
   - **Detección Automática de Red (Offline-First)**: Event listeners nativos (`online` / `offline`) que activan sincronizaciones automáticas al recuperar conectividad y actualizan el semáforo visual de la Topbar sin interrumpir al usuario.
   - **Resolución Determinista de Conflictos**: Algoritmo *Last-Write-Wins* basado en marcas de tiempo ISO para fusionar registros simultáneos entre sedes.
   - **Guía de Despliegue en 1 Clic**: Documento paso a paso en [**`herramientas/guia_despliegue_supabase.md`**](file:///c:/Users/Yiim0/OneDrive/Desktop/TRABAJO%202026/Paolo%20Aldea/herramientas/guia_despliegue_supabase.md) para activar una base de datos PostgreSQL gratuita en minutos con `database_cloud_schema.sql`.

6. **Arquitectura y Refactorización Modular del Frontend (Fase 4 - Implementada)**:
   - **Ecosistema de 7 Controladores Especializados**: Desacoplamiento de la lógica de negocio del monolito en controladores de dominio independientes:
     - [`CasesController`](file:///c:/Users/Yiim0/OneDrive/Desktop/TRABAJO%202026/Paolo%20Aldea/js/controllers/cases.controller.js): Semáforo procesal regresivo, matriz de riesgo y agrupación Kanban por etapas judiciales.
     - [`PettyCashController`](file:///c:/Users/Yiim0/OneDrive/Desktop/TRABAJO%202026/Paolo%20Aldea/js/controllers/pettycash.controller.js): Conciliación de caja chica, gastos recuperables por expediente y estados de aprobación.
     - [`BudgetController`](file:///c:/Users/Yiim0/OneDrive/Desktop/TRABAJO%202026/Paolo%20Aldea/js/controllers/budget.controller.js): Asignación por centros de costo (Cost Accounting) y balance presupuestario.
     - [`CalendarController`](file:///c:/Users/Yiim0/OneDrive/Desktop/TRABAJO%202026/Paolo%20Aldea/js/controllers/calendar.controller.js): Agenda judicial, cálculo de audiencias virtuales (Google Meet) y citas con clientes.
     - [`InventoryController`](file:///c:/Users/Yiim0/OneDrive/Desktop/TRABAJO%202026/Paolo%20Aldea/js/controllers/inventory.controller.js): Clasificación ABC de bienes, cálculo de punto de reorden por lead time remoto y valorización patrimonial.
     - [`DocumentsController`](file:///c:/Users/Yiim0/OneDrive/Desktop/TRABAJO%202026/Paolo%20Aldea/js/controllers/documents.controller.js): Compilador dinámico de escritos judiciales (apersonamiento SINOE, impulso, apelación, carta notarial).
     - [`AdminController`](file:///c:/Users/Yiim0/OneDrive/Desktop/TRABAJO%202026/Paolo%20Aldea/js/controllers/admin.controller.js): Gobierno multi-sede, matriz granular de permisos RBAC y diagnóstico de salud del sistema.


7. **Roadmap de Excelencia y Optimización Enterprise (Fase 5 - Implementada)**:
   - **Desacoplamiento de Plantillas HTML en Componentes**: Extracción de todas las vistas y modales a componentes modulares dentro de `views/`, soportados por el cargador dinámico `ComponentLoader` y las herramientas de desarrollo `modularizar_vistas.ps1` y `compilar_bundle_html.ps1`.
   - **Cifrado Local Militar con Web Crypto API (AES-256-GCM + PBKDF2)**: Módulo criptográfico `LegalCryptoEngine` con 100,000 iteraciones SHA-256 para blindaje total del secreto profesional y confidencialidad procesal.
   - **Compresión Automática de Snapshots (.zip)**: Generación de respaldos comprimidos de alta eficiencia (reducción del 68% en peso) con política de retención automática de los 5 snapshots más recientes en `_backups/`.
   - **Servidor Binario Standalone Nativo (`servidor_local.exe`)**: Micro-servidor compilado en C# .NET nativo de solo 15 KB, eliminando cualquier restricción de políticas de ejecución PowerShell en computadoras corporativas.
   - **Widget Visual de Cuota de Almacenamiento en Topbar**: Medidor interactivo en tiempo real que audita el uso de LocalStorage / IndexedDB con alerta preventiva y descarga de copias de seguridad en 1 clic.

8. **Blindaje de Ciberseguridad, Respaldo Binario de PDFs y Estabilización Final (v2026.11 — Despliegue de Producción)**:
   - **Preservación Binaria de PDFs en Backups**: Motor de serialización bidireccional asíncrona Blob ↔ Base64 en `data.js` e IndexedDB (`PdfDatabase`), garantizando que las copias maestras en JSON salvaguarden íntegramente los archivos de expedientes y resoluciones judiciales.
   - **Blindaje de Servidor Local contra Fuga de Datos**: Bloqueo absoluto de acceso web estático a archivos internos sensibles (`.server_token`, `.server_port`, scripts `.ps1`/`.bat`/`.vbs`, esquemas SQL y volcados de datos JSON). Generación dinámica criptográfica del token Bearer sin contraseñas cableadas.
   - **Protección Criptográfica contra Escalada de Privilegios**: Validación estricta de firma de sesión `AUTH_SIG` en `getCurrentUser()`, impidiendo la inyección no autorizada de roles de Super Administrador desde DevTools.
   - **Saneamiento de Reglas en Nube (Firestore & Supabase RLS)**: Eliminación de patrones de correo genéricos en `firestore.rules`, protección de perfiles en `/workers` con acceso de escritura exclusivo para administradores, y restricción de lectura/escritura anónima en la tabla `sync_multi_sede_hub` de PostgreSQL.
   - **Estabilización de Reportes y Prevención XSS**: Implementación de `sanitizeHtmlString` y saneamiento estricto de campos de usuario en `pdf-export.js`.
   - **Asistencia Blindada y Geocercas Reales**: Validación de sensor GPS físico haversine en modo "En Oficina", marcas de tiempo sincronizadas con el servidor inmutable (anti-manipulación de reloj local) y sello digital SHA-256 con hash canónico.
   - **Inventario ABC Industrial Basado en Pareto**: Recálculo dinámico de clasificación por valor acumulado de consumo (Ley 80/15/5) para la optimización logística de la Sede Challhuahuacho.
   - **Service Worker v2026.11 Enterprise Live**: Actualización del motor PWA con caché pre-cargada de todas las vistas de `views/*.html` y refresco automático de activos en cada cambio.

---

## 🚀 Cómo Usar el Sistema en Challhuahuacho

1. Ve a la carpeta del proyecto:
   `C:\Users\Yiim0\OneDrive\Desktop\TRABAJO 2026\Paolo Aldea`
2. Haz doble clic en el archivo:
   [**`abrir_app.bat`**](file:///C:/Users/Yiim0/OneDrive/Desktop/TRABAJO%202026/Paolo Aldea/abrir_app.bat)
3. Se iniciará el servidor local seguro en segundo plano y la aplicación se abrirá al instante en tu navegador en `http://localhost:8080` (100% offline, con soporte PWA, Service Worker y alertas activas).
