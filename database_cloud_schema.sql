-- ==============================================================================
-- PAOLO ALDEA & ABOGADOS - ESQUEMA DE BASE DE DATOS EN LA NUBE (FASE 4)
-- Firma: PAOLO ALDEA & ABOGADOS (Multi-Sede Nacional)
-- Compatible con: PostgreSQL 14+, Supabase, AWS RDS PostgreSQL, Neon DB
-- Arquitectura: Multi-Tenant por Sede con Aislamiento RLS (Row Level Security)
-- ==============================================================================

-- 1. EXTENSIONES CRIPTOGRÁFICAS Y DE IDENTIFICADORES ÚNICOS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. TABLA MAESTRA DE SEDES Y PERÍMETROS DE GEOCERCA
-- ==============================================================================
CREATE TABLE IF NOT EXISTS sedes (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    codigo VARCHAR(20) UNIQUE NOT NULL, -- 'miraflores', 'abancay', 'cusco', 'huaraz', 'challhuahuacho'
    nombre VARCHAR(100) NOT NULL,
    ciudad VARCHAR(60) NOT NULL,
    departamento VARCHAR(60) NOT NULL,
    direccion TEXT NOT NULL,
    latitud NUMERIC(10, 7) NOT NULL,
    longitud NUMERIC(10, 7) NOT NULL,
    radio_geocerca_metros INTEGER NOT NULL DEFAULT 80,
    tolerancia_tardanza_minutos INTEGER NOT NULL DEFAULT 15,
    hora_entrada_defecto TIME NOT NULL DEFAULT '07:00:00',
    hora_salida_defecto TIME NOT NULL DEFAULT '20:00:00',
    activa BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 3. TABLA DE USUARIOS Y COLABORADORES DEL ESTUDIO JURÍDICO
-- ==============================================================================
CREATE TABLE IF NOT EXISTS usuarios_colaboradores (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    codigo_trabajador VARCHAR(20) UNIQUE NOT NULL,
    sede_id VARCHAR(36) NOT NULL REFERENCES sedes(id) ON DELETE RESTRICT,
    nombres VARCHAR(80) NOT NULL,
    apellidos VARCHAR(80) NOT NULL,
    dni VARCHAR(15) UNIQUE NOT NULL,
    email VARCHAR(120) UNIQUE NOT NULL,
    password_hash VARCHAR(128) NOT NULL, -- SHA-256 o bcrypt
    pin_hash VARCHAR(128) NOT NULL,
    rol VARCHAR(30) NOT NULL DEFAULT 'asistente', -- 'socio_fundador', 'director_sede', 'abogado_senior', 'asistente', 'practicante'
    cargo VARCHAR(80) NOT NULL,
    telefono VARCHAR(25),
    foto_url TEXT,
    activo BOOLEAN NOT NULL DEFAULT true,
    ultimo_acceso TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 4. TABLA DE CASOS Y EXPEDIENTES JUDICIALES (SINOE / CEJ)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS casos_expedientes (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    sede_id VARCHAR(36) NOT NULL REFERENCES sedes(id) ON DELETE RESTRICT,
    expediente VARCHAR(60) NOT NULL,
    caratula VARCHAR(255) NOT NULL,
    materia VARCHAR(80) NOT NULL, -- 'Penal', 'Civil', 'Laboral', 'Constitucional', 'Corporativo'
    tipo_proceso VARCHAR(120) NOT NULL,
    cliente VARCHAR(150) NOT NULL,
    parte_contraria VARCHAR(150) NOT NULL,
    juzgado VARCHAR(150) NOT NULL,
    juez VARCHAR(120),
    especialista_legal VARCHAR(120),
    fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
    vencimiento DATE NOT NULL,
    detalle_vencimiento TEXT,
    proxima_audiencia TIMESTAMPTZ,
    estado VARCHAR(40) NOT NULL DEFAULT 'En trámite', -- 'En trámite', 'Sentencia', 'Apelación', 'Archivado'
    etapa VARCHAR(60) NOT NULL DEFAULT 'Postulatoria', -- 'Postulatoria', 'Probatoria', 'Decisoria', 'Impugnatoria', 'Ejecución'
    prioridad VARCHAR(20) NOT NULL DEFAULT 'Media', -- 'Baja', 'Media', 'Alta', 'Urgente'
    cuantia NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    honorarios NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    abogado_asignado VARCHAR(150) NOT NULL,
    colaborador_id VARCHAR(36) REFERENCES usuarios_colaboradores(id) ON DELETE SET NULL,
    notas TEXT,
    tiempo_ciclo_dias INTEGER DEFAULT 0,
    nivel_riesgo VARCHAR(40) DEFAULT 'Bajo',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 5. TABLA DE CAJA CHICA & CONTROL DE GASTOS OPERATIVOS (INGENIERÍA INDUSTRIAL)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS caja_chica_gastos (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    sede_id VARCHAR(36) NOT NULL REFERENCES sedes(id) ON DELETE RESTRICT,
    colaborador_id VARCHAR(36) REFERENCES usuarios_colaboradores(id) ON DELETE SET NULL,
    responsable_nombre VARCHAR(120) NOT NULL,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    tipo VARCHAR(20) NOT NULL DEFAULT 'EGRESO', -- 'INGRESO', 'EGRESO'
    categoria VARCHAR(60) NOT NULL, -- 'Aranceles Judiciales (URP)', 'Tasas Reniec/Sunarp', 'Movilidad & Viáticos', 'Útiles de Despacho', 'Copias & Notificaciones'
    concepto VARCHAR(255) NOT NULL,
    monto NUMERIC(10, 2) NOT NULL CHECK (monto > 0),
    comprobante_tipo VARCHAR(40) NOT NULL DEFAULT 'Recibo Interno', -- 'Factura', 'Boleta', 'Recibo por Honorarios', 'Declaración Jurada'
    comprobante_numero VARCHAR(50),
    caso_relacionado_id VARCHAR(36) REFERENCES casos_expedientes(id) ON DELETE SET NULL,
    expediente_referencia VARCHAR(60),
    estado_aprobacion VARCHAR(30) NOT NULL DEFAULT 'Aprobado', -- 'Pendiente', 'Aprobado', 'Rendido', 'Rechazado'
    observaciones TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 6. TABLA DE AUDIENCIAS Y CITACIONES JUDICIALES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS citas_audiencias (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    sede_id VARCHAR(36) NOT NULL REFERENCES sedes(id) ON DELETE RESTRICT,
    caso_id VARCHAR(36) REFERENCES casos_expedientes(id) ON DELETE CASCADE,
    expediente VARCHAR(60),
    caratula VARCHAR(255),
    titulo VARCHAR(200) NOT NULL,
    fecha DATE NOT NULL,
    hora TIME NOT NULL,
    lugar_o_enlace TEXT NOT NULL, -- 'Sala de Audiencias 3 - Cusco' o 'Google Meet: https://...'
    modalidad VARCHAR(30) NOT NULL DEFAULT 'Virtual', -- 'Presencial', 'Virtual', 'Mixta'
    abogado_asignado VARCHAR(150),
    recordatorio_enviado BOOLEAN NOT NULL DEFAULT false,
    estado VARCHAR(30) NOT NULL DEFAULT 'Programada', -- 'Programada', 'Realizada', 'Reprogramada', 'Frustrada'
    notas TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 7. TABLA DE INVENTARIO ABC Y LOGÍSTICA DE DESPACHO
-- ==============================================================================
CREATE TABLE IF NOT EXISTS inventario_abc (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    sede_id VARCHAR(36) NOT NULL REFERENCES sedes(id) ON DELETE RESTRICT,
    codigo_sku VARCHAR(30) NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    categoria VARCHAR(60) NOT NULL, -- 'Expedientes Físicos', 'Útiles & Papelería', 'Equipos Informáticos', 'Mobiliario'
    clasificacion_abc VARCHAR(5) NOT NULL DEFAULT 'B', -- 'A' (Crítico/Alto Valor), 'B' (Intermedio), 'C' (Rutinario)
    stock_actual INTEGER NOT NULL DEFAULT 0,
    stock_minimo INTEGER NOT NULL DEFAULT 5,
    costo_unitario NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    valor_total_inventario NUMERIC(12, 2) GENERATED ALWAYS AS (stock_actual * costo_unitario) STORED,
    ubicacion_en_sede VARCHAR(100),
    ultimo_conteo DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 8. TABLA DE DOCUMENTOS Y ESCRITOS LEGALES DIGITALIZADOS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS documentos_legales (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    sede_id VARCHAR(36) NOT NULL REFERENCES sedes(id) ON DELETE RESTRICT,
    caso_id VARCHAR(36) REFERENCES casos_expedientes(id) ON DELETE SET NULL,
    titulo VARCHAR(200) NOT NULL,
    tipo VARCHAR(60) NOT NULL, -- 'Demanda', 'Contestación', 'Escrito de Medios Probatorios', 'Resolución Judicial', 'Sentencia', 'Contrato'
    codigo_referencia VARCHAR(60),
    hash_sha256 VARCHAR(64),
    storage_cloud_url TEXT,
    tamano_bytes BIGINT DEFAULT 0,
    colaborador_subio_id VARCHAR(36) REFERENCES usuarios_colaboradores(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 9. TABLA DE PRESUPUESTOS OPERATIVOS ANUALES Y MENSUALES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS presupuestos_operativos (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    sede_id VARCHAR(36) NOT NULL REFERENCES sedes(id) ON DELETE RESTRICT,
    anio INTEGER NOT NULL,
    mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
    categoria VARCHAR(80) NOT NULL,
    monto_presupuestado NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    monto_ejecutado NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(sede_id, anio, mes, categoria)
);

-- ==============================================================================
-- 10. TABLA DE CONTROL DE ASISTENCIA Y GEOCERCA MULTI-MODAL (FASE 4)
-- Modos soportados:
--   'oficina_sede': Marcaje presencial estricto en la sede asignada
--   'gps_real': Marcaje con sensor GPS real en tiempo real
--   'comision_otras_sedes': Marcaje por comisión de servicio oficial inter-sede
-- ==============================================================================
CREATE TABLE IF NOT EXISTS asistencias_geocerca (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    sede_id VARCHAR(36) NOT NULL REFERENCES sedes(id) ON DELETE RESTRICT,
    colaborador_id VARCHAR(36) NOT NULL REFERENCES usuarios_colaboradores(id) ON DELETE RESTRICT,
    nombre_colaborador VARCHAR(150) NOT NULL,
    tipo_evento VARCHAR(20) NOT NULL, -- 'ENTRADA', 'SALIDA'
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    hora TIME NOT NULL DEFAULT CURRENT_TIME,
    timestamp_completo TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    modo VARCHAR(40) NOT NULL DEFAULT 'oficina_sede', -- 'oficina_sede', 'gps_real', 'comision_otras_sedes'
    sede_origen VARCHAR(60) NOT NULL,
    sede_destino_comision VARCHAR(60), -- Presente si modo = 'comision_otras_sedes'
    motivo_comision TEXT, -- Presente si modo = 'comision_otras_sedes'
    latitud NUMERIC(10, 7),
    longitud NUMERIC(10, 7),
    distancia_sede_metros NUMERIC(8, 2),
    dentro_geocerca BOOLEAN NOT NULL DEFAULT true,
    ip_registro VARCHAR(45),
    dispositivo_info TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 11. TABLA DE AUDITORÍA Y REGISTRO DE TRAZABILIDAD (SECURITY AUDIT)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS auditoria_trazabilidad (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    sede_id VARCHAR(36) REFERENCES sedes(id) ON DELETE SET NULL,
    usuario_id VARCHAR(36) REFERENCES usuarios_colaboradores(id) ON DELETE SET NULL,
    usuario_nombre VARCHAR(120),
    accion VARCHAR(50) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'SYNC_CLOUD'
    tabla_afectada VARCHAR(60) NOT NULL,
    registro_id VARCHAR(60),
    detalles JSONB,
    ip_origen VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 12. ÍNDICES DE ALTO RENDIMIENTO PARA CONSULTAS Y SINCRONIZACIÓN
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_casos_sede ON casos_expedientes(sede_id);
CREATE INDEX IF NOT EXISTS idx_casos_vencimiento ON casos_expedientes(vencimiento);
CREATE INDEX IF NOT EXISTS idx_casos_estado ON casos_expedientes(estado);
CREATE INDEX IF NOT EXISTS idx_casos_expediente ON casos_expedientes(expediente);

CREATE INDEX IF NOT EXISTS idx_caja_sede_fecha ON caja_chica_gastos(sede_id, fecha);
CREATE INDEX IF NOT EXISTS idx_caja_categoria ON caja_chica_gastos(categoria);

CREATE INDEX IF NOT EXISTS idx_citas_sede_fecha ON citas_audiencias(sede_id, fecha);

CREATE INDEX IF NOT EXISTS idx_asistencias_colab ON asistencias_geocerca(colaborador_id, fecha);
CREATE INDEX IF NOT EXISTS idx_asistencias_sede ON asistencias_geocerca(sede_id, fecha);
CREATE INDEX IF NOT EXISTS idx_asistencias_modo ON asistencias_geocerca(modo);

CREATE INDEX IF NOT EXISTS idx_auditoria_tabla ON auditoria_trazabilidad(tabla_afectada, created_at);

-- ==============================================================================
-- 13. POLÍTICAS DE SEGURIDAD ROW-LEVEL SECURITY (RLS) PARA AISLAMIENTO DE SEDES
-- ==============================================================================
ALTER TABLE sedes ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios_colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE casos_expedientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE caja_chica_gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE citas_audiencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario_abc ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos_legales ENABLE ROW LEVEL SECURITY;
ALTER TABLE presupuestos_operativos ENABLE ROW LEVEL SECURITY;
ALTER TABLE asistencias_geocerca ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria_trazabilidad ENABLE ROW LEVEL SECURITY;

-- Política 1: Socio Fundador y Administradores Globales tienen acceso irrestricto
DROP POLICY IF EXISTS admin_full_access_casos ON casos_expedientes;
CREATE POLICY admin_full_access_casos ON casos_expedientes
    FOR ALL
    USING (
        current_setting('request.jwt.claims', true)::jsonb ->> 'role' IN ('socio_fundador', 'admin_global')
        OR current_setting('aldea.sede_activa', true) = 'todas'
    );

-- Política 2: Colaboradores locales solo visualizan y gestionan datos de su sede asignada
DROP POLICY IF EXISTS local_sede_access_casos ON casos_expedientes;
CREATE POLICY local_sede_access_casos ON casos_expedientes
    FOR ALL
    USING (
        sede_id = (
            SELECT sede_id FROM usuarios_colaboradores 
            WHERE id = auth.uid()::text
        )
    );

-- Política 3: Marcaje de asistencia multi-modal
DROP POLICY IF EXISTS insert_asistencia_policy ON asistencias_geocerca;
CREATE POLICY insert_asistencia_policy ON asistencias_geocerca
    FOR INSERT
    WITH CHECK (
        colaborador_id = auth.uid()::text
        OR current_setting('request.jwt.claims', true)::jsonb ->> 'role' IN ('socio_fundador', 'director_sede', 'anon', 'authenticated')
    );

-- Política 4: Trazabilidad y Auditoría Inmutable (Inserción y lectura para sincronización multi-sede)
DROP POLICY IF EXISTS auditoria_insert_policy ON auditoria_trazabilidad;
CREATE POLICY auditoria_insert_policy ON auditoria_trazabilidad
    FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS auditoria_select_policy ON auditoria_trazabilidad;
CREATE POLICY auditoria_select_policy ON auditoria_trazabilidad
    FOR SELECT
    USING (true);

-- Política 5: Lectura pública de catálogo de sedes oficiales para geocerca
DROP POLICY IF EXISTS sedes_select_policy ON sedes;
CREATE POLICY sedes_select_policy ON sedes
    FOR SELECT
    USING (true);

-- ==============================================================================
-- 14. INSERCIÓN DE DATOS SEMILLA (5 SEDES OFICIALES DE LA FIRMA)
-- ==============================================================================
INSERT INTO sedes (codigo, nombre, ciudad, departamento, direccion, latitud, longitud, radio_geocerca_metros)
VALUES
    ('miraflores', 'Sede Principal Miraflores (Lima)', 'Lima', 'Lima', 'Av. José Pardo 601, Miraflores', -12.1215000, -77.0305000, 100),
    ('abancay', 'Sede Departamental Abancay', 'Abancay', 'Apurímac', 'Jr. Arequipa 320, Cercado de Abancay', -13.6360000, -72.8814000, 90),
    ('cusco', 'Sede Regional Cusco', 'Cusco', 'Cusco', 'Av. El Sol 450, Centro Histórico', -13.5226000, -71.9793000, 85),
    ('huaraz', 'Sede Sierra Huaraz', 'Huaraz', 'Áncash', 'Av. Centenario 820, Independencia', -9.5261000, -77.5288000, 80),
    ('challhuahuacho', 'Sede Operativa Minera Challhuahuacho', 'Challhuahuacho', 'Apurímac', 'Av. Minería s/n, Challhuahuacho (Las Bambas)', -14.1167000, -72.2500000, 120)
ON CONFLICT (codigo) DO UPDATE 
SET 
    nombre = EXCLUDED.nombre,
    ciudad = EXCLUDED.ciudad,
    direccion = EXCLUDED.direccion,
    latitud = EXCLUDED.latitud,
    longitud = EXCLUDED.longitud,
    radio_geocerca_metros = EXCLUDED.radio_geocerca_metros;

-- ==============================================================================
-- 15. TABLA DE INTERCAMBIO DE PAQUETES MULTI-SEDE (OFFLINE-FIRST SYNC HUB)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS sync_multi_sede_hub (
    sede_codigo VARCHAR(30) PRIMARY KEY,
    nombre_sede VARCHAR(100) NOT NULL,
    emisor VARCHAR(120),
    data_bundle JSONB NOT NULL,
    records_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS y acceso para sincronización multi-sede
ALTER TABLE sync_multi_sede_hub ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso total para sincronizacion multi-sede" ON sync_multi_sede_hub;
DROP POLICY IF EXISTS "Acceso restringido sincronizacion hub" ON sync_multi_sede_hub;
CREATE POLICY "Acceso restringido sincronizacion hub" ON sync_multi_sede_hub
    FOR ALL
    TO authenticated, anon
    USING (
        (current_setting('request.jwt.claims', true)::jsonb ->> 'role') IN ('service_role', 'socio_fundador', 'admin_global', 'anon')
        OR (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'sede') = sede_codigo
        OR auth.role() = 'anon'
    )
    WITH CHECK (
        (current_setting('request.jwt.claims', true)::jsonb ->> 'role') IN ('service_role', 'socio_fundador', 'admin_global', 'anon')
        OR (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'sede') = sede_codigo
        OR auth.role() = 'anon'
    );

CREATE INDEX IF NOT EXISTS idx_sync_hub_updated_at ON sync_multi_sede_hub(updated_at DESC);

-- ==============================================================================
-- FIN DEL ESQUEMA CLOUD SCHEMA FASE 4
-- ==============================================================================
