# GUÍA OFICIAL DE DESPLIEGUE EN LA NUBE (SUPABASE POSTGRESQL)
## PAOLO ALDEA & ABOGADOS | Red Multi-Sede Nacional
*(Challhuahuacho, Miraflores, Abancay, Cusco, Huaraz)*

Esta guía permite activar la **sincronización multi-sede en tiempo real y bidireccional** entre todas las sedes del estudio jurídico utilizando **Supabase (PostgreSQL en la Nube)** con el esquema oficial [`database_cloud_schema.sql`](../database_cloud_schema.sql).

---

### Paso 1: Crear Proyecto Gratuito en Supabase
1. Ingresa a [https://supabase.com](https://supabase.com) e inicia sesión o crea una cuenta gratuita.
2. Haz clic en **"New Project"**.
3. Completa los datos:
   - **Name:** `Paolo Aldea Despacho Legal`
   - **Database Password:** Define una contraseña segura (ej. de 16 caracteres).
   - **Region:** Selecciona `South America (São Paulo)` para menor latencia con Perú.
4. Haz clic en **"Create new project"** y espera 1 a 2 minutos hasta que la base de datos esté lista.

---

### Paso 2: Ejecutar el Esquema de Base de Datos
1. En el menú lateral izquierdo de tu proyecto Supabase, haz clic en **"SQL Editor"** (icono `>_`).
2. Haz clic en **"New Query"**.
3. Abre el archivo [`database_cloud_schema.sql`](../database_cloud_schema.sql) de tu proyecto, copia todo su contenido y pégalo en el editor SQL de Supabase.
4. Haz clic en el botón verde **"RUN"** (o presiona `Ctrl + Enter`).
5. Se crearán automáticamente las 11 tablas maestras del despacho:
   * `sedes` *(con las 5 sedes oficiales y sus coordenadas de geocerca)*
   * `usuarios_colaboradores` *(abogados, socios y personal)*
   * `casos_expedientes` *(litigios CEJ y SINOE)*
   * `caja_chica_gastos` *(asientos contables y comprobantes)*
   * `citas_audiencias` *(Google Meet y salas judiciales)*
   * `inventario_abc` *(activos y suministros notariales)*
   * `documentos_legales` *(resoluciones y contratos)*
   * `presupuestos_operativos` *(centros de costos)*
   * `asistencias_geocerca` *(marcaciones biométricas)*
   * `sync_multi_sede_hub` *(intercambio offline-first de sedes)*
   * `auditoria_trazabilidad` *(log inmutable de seguridad)*

---

### Paso 3: Obtener las Credenciales de Conexión
1. En el menú lateral de Supabase, ve a **"Project Settings"** (icono de engranaje ⚙️) > **"API"**.
2. Copia los siguientes dos valores:
   * **Project URL:** `https://xxxxxxxxxxxxxxxxxxxx.supabase.co`
   * **anon / public key:** Cadena larga de caracteres que empieza por `eyJhbGci...`

---

### Paso 4: Configurar el Sistema en el Despacho
1. Abre tu aplicación con [**`abrir_app.bat`**](../abrir_app.bat).
2. Ingresa con credenciales de **Super Administrador** o haz clic en el engranaje de **Gobierno & Control Total**.
3. Ve a la pestaña **"Ajustes"** o sección **"Live Cloud Sync & Conectividad Multi-Sede"**.
4. Pega los datos:
   * **URL del Endpoint Cloud:** Pega tu Project URL (ej. `https://xxxxxxxx.supabase.co`).
   * **API Key:** Pega tu clave `anon / public`.
   * **Sincronización Automática:** Marca la casilla para que el sistema sincronice automáticamente cada 5 minutos o cuando detecte conexión a internet.
5. Haz clic en **"Probar Conexión"**. El sistema verificará el enlace y mostrará:
   `¡Conexión establecida con éxito con Supabase Cloud (PostgreSQL)!`
6. Haz clic en **"Sincronizar Ahora"**.

---

### 🛡️ ¿Cómo Funciona la Sincronización Offline-First?
* **100% Autónomo Offline:** Si estás en Challhuahuacho o en el Juzgado de Tambobamba sin internet, puedes seguir registrando expedientes, asientos de caja o asistencias con normalidad. Todos los registros se guardan en IndexedDB local.
* **Sincronización Inteligente:** En cuanto el dispositivo detecta internet (o cuando presionas la nube en la barra superior), el sistema:
  1. Envía los cambios locales a Supabase.
  2. Descarga los nuevos expedientes o movimientos generados por las sedes de Miraflores, Abancay, Cusco o Huaraz.
  3. Resuelve cualquier discrepancia mediante la marca de tiempo más reciente (*Last-Write-Wins*).
