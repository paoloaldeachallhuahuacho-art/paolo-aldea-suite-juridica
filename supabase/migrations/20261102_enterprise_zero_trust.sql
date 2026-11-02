-- ==============================================================================
-- PAOLO ALDEA — Enterprise Zero-Trust Schema (Dual-Mode / Modo B)
-- PostgreSQL 14+ / Supabase. Acceso público denegado. RLS por branch_id + JWT.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------- Helpers JWT ----------
CREATE OR REPLACE FUNCTION public.jwt_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'role', ''),
    NULLIF(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role', ''),
    'authenticated'
  );
$$;

CREATE OR REPLACE FUNCTION public.jwt_branch_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'branch_id', ''),
    NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'branch_id', ''),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.jwt_role() IN ('super_admin', 'service_role');
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.server_ts = NOW();
  NEW.version = COALESCE(OLD.version, 0) + 1;
  RETURN NEW;
END;
$$;

-- ---------- branches ----------
CREATE TABLE IF NOT EXISTS public.branches (
  id TEXT PRIMARY KEY,
  codigo TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  ciudad TEXT,
  departamento TEXT,
  direccion TEXT,
  telefono TEXT,
  latitud NUMERIC(10, 7) NOT NULL,
  longitud NUMERIC(10, 7) NOT NULL,
  radio_geocerca_metros INTEGER NOT NULL DEFAULT 100 CHECK (radio_geocerca_metros > 0),
  activa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- user_profiles / user_roles ----------
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_uid UUID UNIQUE NOT NULL,
  worker_code TEXT UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE,
  dni TEXT,
  branch_id TEXT NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  role TEXT NOT NULL CHECK (role IN (
    'super_admin', 'socio', 'admin', 'abogado',
    'asistente_legal', 'asistente_admin', 'accountant'
  )),
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  server_ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_uid UUID NOT NULL,
  role TEXT NOT NULL,
  branch_id TEXT REFERENCES public.branches(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_by UUID,
  UNIQUE (auth_uid, role, branch_id)
);

CREATE OR REPLACE FUNCTION public.deny_user_roles_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'user_roles is append-only / immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_roles_immutable ON public.user_roles;
CREATE TRIGGER trg_user_roles_immutable
  BEFORE UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.deny_user_roles_mutation();

-- ---------- cases ----------
CREATE TABLE IF NOT EXISTS public.cases (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  expediente TEXT NOT NULL,
  caratula TEXT NOT NULL,
  materia TEXT,
  cliente TEXT,
  juzgado TEXT,
  estado TEXT DEFAULT 'En trámite',
  etapa TEXT,
  vencimiento DATE,
  abogado_asignado TEXT,
  notas_confidenciales TEXT,
  assigned_auth_uid UUID,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  server_ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1
);

DROP TRIGGER IF EXISTS trg_cases_updated ON public.cases;
CREATE TRIGGER trg_cases_updated
  BEFORE UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- attendance_punches ----------
CREATE TABLE IF NOT EXISTS public.attendance_punches (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  auth_uid UUID NOT NULL,
  worker_code TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('ENTRADA', 'SALIDA', 'ALMUERZO_OUT', 'ALMUERZO_IN', 'DILIGENCIA')),
  client_ts TIMESTAMPTZ NOT NULL,
  server_ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  latitud NUMERIC(10, 7),
  longitud NUMERIC(10, 7),
  accuracy_m NUMERIC(10, 2),
  distance_m NUMERIC(10, 2),
  within_geofence BOOLEAN NOT NULL DEFAULT false,
  validation_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (validation_status IN ('accepted', 'rejected', 'pending', 'external_ok')),
  spoof_suspected BOOLEAN NOT NULL DEFAULT false,
  ip_address TEXT,
  user_agent TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1
);

-- ---------- petty cash + ledger (double-entry) ----------
CREATE TABLE IF NOT EXISTS public.petty_cash_entries (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  concepto TEXT NOT NULL,
  categoria TEXT,
  monto_centavos BIGINT NOT NULL CHECK (monto_centavos > 0),
  tipo TEXT NOT NULL CHECK (tipo IN ('Ingreso', 'Egreso')),
  workflow_state TEXT NOT NULL DEFAULT 'requested'
    CHECK (workflow_state IN (
      'requested', 'branch_approved', 'disbursed', 'reconciled', 'rejected'
    )),
  expediente TEXT,
  comprobante TEXT,
  created_by UUID,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  server_ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1
);

DROP TRIGGER IF EXISTS trg_petty_updated ON public.petty_cash_entries;
CREATE TRIGGER trg_petty_updated
  BEFORE UPDATE ON public.petty_cash_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_petty_cash_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  allowed BOOLEAN := false;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.workflow_state IS DISTINCT FROM NEW.workflow_state THEN
    allowed :=
      (OLD.workflow_state = 'requested' AND NEW.workflow_state IN ('branch_approved', 'rejected')) OR
      (OLD.workflow_state = 'branch_approved' AND NEW.workflow_state IN ('disbursed', 'rejected')) OR
      (OLD.workflow_state = 'disbursed' AND NEW.workflow_state IN ('reconciled', 'rejected'));
    IF NOT allowed THEN
      RAISE EXCEPTION 'Invalid petty cash transition: % -> %', OLD.workflow_state, NEW.workflow_state;
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND (
    OLD.monto_centavos IS DISTINCT FROM NEW.monto_centavos OR
    OLD.tipo IS DISTINCT FROM NEW.tipo
  ) AND OLD.workflow_state IN ('disbursed', 'reconciled') THEN
    RAISE EXCEPTION 'Immutable financial fields after disbursement';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_petty_transition ON public.petty_cash_entries;
CREATE TRIGGER trg_petty_transition
  BEFORE UPDATE ON public.petty_cash_entries
  FOR EACH ROW EXECUTE FUNCTION public.enforce_petty_cash_transition();

CREATE TABLE IF NOT EXISTS public.petty_cash_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id TEXT NOT NULL REFERENCES public.petty_cash_entries(id) ON DELETE RESTRICT,
  branch_id TEXT NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  account_code TEXT NOT NULL,
  debit_centavos BIGINT NOT NULL DEFAULT 0 CHECK (debit_centavos >= 0),
  credit_centavos BIGINT NOT NULL DEFAULT 0 CHECK (credit_centavos >= 0),
  memo TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ledger_one_side CHECK (
    (debit_centavos > 0 AND credit_centavos = 0) OR
    (credit_centavos > 0 AND debit_centavos = 0)
  )
);

CREATE OR REPLACE FUNCTION public.deny_ledger_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'petty_cash_ledger is append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_ledger_immutable ON public.petty_cash_ledger;
CREATE TRIGGER trg_ledger_immutable
  BEFORE UPDATE OR DELETE ON public.petty_cash_ledger
  FOR EACH ROW EXECUTE FUNCTION public.deny_ledger_mutation();

-- ---------- budgets ----------
CREATE TABLE IF NOT EXISTS public.budgets (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  anio INTEGER NOT NULL,
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  categoria TEXT NOT NULL,
  presupuestado_centavos BIGINT NOT NULL DEFAULT 0 CHECK (presupuestado_centavos >= 0),
  ejecutado_centavos BIGINT NOT NULL DEFAULT 0 CHECK (ejecutado_centavos >= 0),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  server_ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE (branch_id, anio, mes, categoria)
);

-- ---------- case_documents ----------
CREATE TABLE IF NOT EXISTS public.case_documents (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  case_id TEXT REFERENCES public.cases(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  sha256 TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  server_ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1
);

-- ---------- audit_logs (append-only) ----------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
  auth_uid UUID,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id TEXT,
  before_state JSONB,
  after_state JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.deny_audit_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_immutable ON public.audit_logs;
CREATE TRIGGER trg_audit_immutable
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.deny_audit_mutation();

-- ---------- Indexes ----------
CREATE INDEX IF NOT EXISTS idx_cases_branch ON public.cases(branch_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cases_server_ts ON public.cases(server_ts DESC);
CREATE INDEX IF NOT EXISTS idx_att_branch_ts ON public.attendance_punches(branch_id, server_ts DESC);
CREATE INDEX IF NOT EXISTS idx_petty_branch ON public.petty_cash_entries(branch_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_budget_branch ON public.budgets(branch_id, anio, mes);
CREATE INDEX IF NOT EXISTS idx_profiles_auth ON public.user_profiles(auth_uid);

-- ---------- Haversine + attendance RPC ----------
CREATE OR REPLACE FUNCTION public.haversine_meters(
  lat1 NUMERIC, lon1 NUMERIC, lat2 NUMERIC, lon2 NUMERIC
) RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (
    2 * 6371000 * ASIN(SQRT(
      POWER(SIN(RADIANS((lat2 - lat1) / 2)), 2) +
      COS(RADIANS(lat1)) * COS(RADIANS(lat2)) *
      POWER(SIN(RADIANS((lon2 - lon1) / 2)), 2)
    ))
  )::NUMERIC;
$$;

CREATE OR REPLACE FUNCTION public.validate_attendance_punch(
  p_id TEXT,
  p_branch_id TEXT,
  p_event_type TEXT,
  p_client_ts TIMESTAMPTZ,
  p_lat NUMERIC,
  p_lon NUMERIC,
  p_accuracy NUMERIC DEFAULT NULL,
  p_spoof BOOLEAN DEFAULT false,
  p_ip TEXT DEFAULT NULL,
  p_ua TEXT DEFAULT NULL,
  p_worker_code TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch public.branches%ROWTYPE;
  v_dist NUMERIC;
  v_skew NUMERIC;
  v_status TEXT;
  v_within BOOLEAN;
  v_uid UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_spoof THEN
    RAISE EXCEPTION 'Spoofed location rejected';
  END IF;
  v_skew := ABS(EXTRACT(EPOCH FROM (clock_timestamp() - p_client_ts)));
  IF v_skew > 60 THEN
    RAISE EXCEPTION 'Client clock skew too large (% s)', v_skew;
  END IF;
  SELECT * INTO v_branch FROM public.branches WHERE id = p_branch_id AND activa;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown branch';
  END IF;
  IF NOT public.is_super_admin() AND public.jwt_branch_id() IS DISTINCT FROM p_branch_id THEN
    RAISE EXCEPTION 'Branch mismatch';
  END IF;

  v_dist := public.haversine_meters(p_lat, p_lon, v_branch.latitud, v_branch.longitud);
  v_within := v_dist <= v_branch.radio_geocerca_metros;
  v_status := CASE WHEN v_within THEN 'accepted' ELSE 'rejected' END;
  IF p_event_type = 'DILIGENCIA' AND NOT v_within THEN
    v_status := 'external_ok';
  END IF;
  IF v_status = 'rejected' AND p_event_type <> 'DILIGENCIA' THEN
    RAISE EXCEPTION 'Outside geofence (% m)', v_dist;
  END IF;

  INSERT INTO public.attendance_punches (
    id, branch_id, auth_uid, worker_code, event_type, client_ts, latitud, longitud,
    accuracy_m, distance_m, within_geofence, validation_status, spoof_suspected,
    ip_address, user_agent
  ) VALUES (
    p_id, p_branch_id, v_uid, p_worker_code, p_event_type, p_client_ts, p_lat, p_lon,
    p_accuracy, v_dist, v_within, v_status, COALESCE(p_spoof, false), p_ip, p_ua
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.audit_logs (branch_id, auth_uid, action, table_name, record_id, after_state, ip_address, user_agent)
  VALUES (p_branch_id, v_uid, 'ATTENDANCE_PUNCH', 'attendance_punches', p_id,
    jsonb_build_object('status', v_status, 'distance_m', v_dist, 'event', p_event_type),
    p_ip, p_ua);

  RETURN jsonb_build_object(
    'ok', true,
    'validation_status', v_status,
    'distance_m', v_dist,
    'within_geofence', v_within
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.budget_run_rate(p_branch_id TEXT, p_anio INTEGER, p_mes INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_budget BIGINT;
  v_spent BIGINT;
  v_day INTEGER;
  v_days INTEGER;
  v_run BIGINT;
BEGIN
  IF NOT public.is_super_admin() AND public.jwt_branch_id() IS DISTINCT FROM p_branch_id THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT COALESCE(SUM(presupuestado_centavos), 0), COALESCE(SUM(ejecutado_centavos), 0)
    INTO v_budget, v_spent
  FROM public.budgets
  WHERE branch_id = p_branch_id AND anio = p_anio AND mes = p_mes AND deleted_at IS NULL;

  v_day := GREATEST(EXTRACT(DAY FROM CURRENT_DATE)::INT, 1);
  v_days := EXTRACT(DAY FROM (DATE_TRUNC('month', make_date(p_anio, p_mes, 1)) + INTERVAL '1 month - 1 day'))::INT;
  IF v_day = 0 THEN v_run := 0; ELSE v_run := (v_spent * v_days) / v_day; END IF;

  RETURN jsonb_build_object(
    'presupuestado_centavos', v_budget,
    'ejecutado_centavos', v_spent,
    'utilization_bps', CASE WHEN v_budget = 0 THEN 0 ELSE (v_spent * 10000) / v_budget END,
    'projected_month_centavos', v_run,
    'remaining_centavos', GREATEST(v_budget - v_spent, 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_petty_cash(
  p_entry_id TEXT,
  p_new_state TEXT,
  p_debit_account TEXT DEFAULT '1101',
  p_credit_account TEXT DEFAULT '2101'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.petty_cash_entries%ROWTYPE;
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_row FROM public.petty_cash_entries WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entry not found'; END IF;
  IF NOT public.is_super_admin() AND public.jwt_branch_id() IS DISTINCT FROM v_row.branch_id THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.petty_cash_entries SET workflow_state = p_new_state WHERE id = p_entry_id;

  IF p_new_state = 'disbursed' THEN
    INSERT INTO public.petty_cash_ledger (entry_id, branch_id, account_code, debit_centavos, credit_centavos, memo, created_by)
    VALUES
      (p_entry_id, v_row.branch_id, p_debit_account,
        CASE WHEN v_row.tipo = 'Egreso' THEN v_row.monto_centavos ELSE 0 END,
        CASE WHEN v_row.tipo = 'Ingreso' THEN v_row.monto_centavos ELSE 0 END,
        'Disbursement debit', v_uid),
      (p_entry_id, v_row.branch_id, p_credit_account,
        CASE WHEN v_row.tipo = 'Ingreso' THEN v_row.monto_centavos ELSE 0 END,
        CASE WHEN v_row.tipo = 'Egreso' THEN v_row.monto_centavos ELSE 0 END,
        'Disbursement credit', v_uid);
  END IF;

  INSERT INTO public.audit_logs (branch_id, auth_uid, action, table_name, record_id, after_state)
  VALUES (v_row.branch_id, v_uid, 'PETTY_TRANSITION', 'petty_cash_entries', p_entry_id,
    jsonb_build_object('state', p_new_state));

  RETURN jsonb_build_object('ok', true, 'state', p_new_state);
END;
$$;

-- ---------- RLS ----------
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_punches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.petty_cash_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.petty_cash_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Revoke anon
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- branches: authenticated read
DROP POLICY IF EXISTS branches_select ON public.branches;
CREATE POLICY branches_select ON public.branches FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS branches_write_sa ON public.branches;
CREATE POLICY branches_write_sa ON public.branches FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- profiles
DROP POLICY IF EXISTS profiles_select ON public.user_profiles;
CREATE POLICY profiles_select ON public.user_profiles FOR SELECT TO authenticated
  USING (public.is_super_admin() OR auth_uid = auth.uid() OR branch_id = public.jwt_branch_id());
DROP POLICY IF EXISTS profiles_update_self ON public.user_profiles;
CREATE POLICY profiles_update_self ON public.user_profiles FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR auth_uid = auth.uid())
  WITH CHECK (public.is_super_admin() OR auth_uid = auth.uid());

-- user_roles read
DROP POLICY IF EXISTS roles_select ON public.user_roles;
CREATE POLICY roles_select ON public.user_roles FOR SELECT TO authenticated
  USING (public.is_super_admin() OR auth_uid = auth.uid());
DROP POLICY IF EXISTS roles_insert_sa ON public.user_roles;
CREATE POLICY roles_insert_sa ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

-- Generic branch isolation helper pattern for transactional tables
DROP POLICY IF EXISTS cases_all ON public.cases;
CREATE POLICY cases_all ON public.cases FOR ALL TO authenticated
  USING (public.is_super_admin() OR (branch_id = public.jwt_branch_id() AND deleted_at IS NULL))
  WITH CHECK (public.is_super_admin() OR branch_id = public.jwt_branch_id());

DROP POLICY IF EXISTS att_all ON public.attendance_punches;
CREATE POLICY att_all ON public.attendance_punches FOR ALL TO authenticated
  USING (public.is_super_admin() OR branch_id = public.jwt_branch_id() OR auth_uid = auth.uid())
  WITH CHECK (public.is_super_admin() OR branch_id = public.jwt_branch_id());

DROP POLICY IF EXISTS petty_all ON public.petty_cash_entries;
CREATE POLICY petty_all ON public.petty_cash_entries FOR ALL TO authenticated
  USING (public.is_super_admin() OR (branch_id = public.jwt_branch_id() AND deleted_at IS NULL))
  WITH CHECK (public.is_super_admin() OR branch_id = public.jwt_branch_id());

DROP POLICY IF EXISTS ledger_select ON public.petty_cash_ledger;
CREATE POLICY ledger_select ON public.petty_cash_ledger FOR SELECT TO authenticated
  USING (public.is_super_admin() OR branch_id = public.jwt_branch_id());
DROP POLICY IF EXISTS ledger_insert ON public.petty_cash_ledger;
CREATE POLICY ledger_insert ON public.petty_cash_ledger FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR branch_id = public.jwt_branch_id());

DROP POLICY IF EXISTS budgets_all ON public.budgets;
CREATE POLICY budgets_all ON public.budgets FOR ALL TO authenticated
  USING (public.is_super_admin() OR (branch_id = public.jwt_branch_id() AND deleted_at IS NULL))
  WITH CHECK (public.is_super_admin() OR branch_id = public.jwt_branch_id());

DROP POLICY IF EXISTS docs_all ON public.case_documents;
CREATE POLICY docs_all ON public.case_documents FOR ALL TO authenticated
  USING (public.is_super_admin() OR (branch_id = public.jwt_branch_id() AND deleted_at IS NULL))
  WITH CHECK (public.is_super_admin() OR branch_id = public.jwt_branch_id());

DROP POLICY IF EXISTS audit_select ON public.audit_logs;
CREATE POLICY audit_select ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_super_admin() OR branch_id = public.jwt_branch_id() OR auth_uid = auth.uid());
DROP POLICY IF EXISTS audit_insert ON public.audit_logs;
CREATE POLICY audit_insert ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Confidential notes: only super_admin|admin|abogado via view
CREATE OR REPLACE VIEW public.cases_safe AS
SELECT
  c.id, c.branch_id, c.expediente, c.caratula, c.materia, c.cliente, c.juzgado,
  c.estado, c.etapa, c.vencimiento, c.abogado_asignado, c.assigned_auth_uid,
  CASE
    WHEN public.is_super_admin() OR public.jwt_role() IN ('admin', 'abogado', 'socio')
    THEN c.notas_confidenciales
    ELSE NULL
  END AS notas_confidenciales,
  c.deleted_at, c.created_at, c.updated_at, c.server_ts, c.version
FROM public.cases c;

-- ---------- Seed 5 branches (coords alineadas a SEDES_CONFIG) ----------
INSERT INTO public.branches (id, codigo, nombre, ciudad, departamento, direccion, telefono, latitud, longitud, radio_geocerca_metros)
VALUES
  ('miraflores', 'MIR', 'Sede Miraflores (Lima)', 'Lima', 'Lima', 'Miraflores - Lima', '+51 (01) 445-8920', -12.1226280, -77.0114260, 100),
  ('abancay', 'ABN', 'Sede Abancay', 'Abancay', 'Apurímac', 'Abancay, Apurímac', '+51 (083) 321-456', -13.6356460, -72.8776140, 100),
  ('cusco', 'CUZ', 'Sede Cusco', 'Cusco', 'Cusco', 'Wanchaq, Cusco', '+51 (084) 245-789', -13.5227850, -71.9699630, 100),
  ('huaraz', 'HRZ', 'Sede Huaraz', 'Huaraz', 'Áncash', 'Jr. Gabino Uribe 650, Huaraz', '+51 (043) 421-980', -9.5305000, -77.5242000, 100),
  ('challhuahuacho', 'CHL', 'Sede Challhuahuacho', 'Challhuahuacho', 'Apurímac', 'Av. Los Mineros, Challhuahuacho', '+51 943 410 215', -14.1166670, -72.2450000, 100)
ON CONFLICT (id) DO UPDATE SET
  latitud = EXCLUDED.latitud,
  longitud = EXCLUDED.longitud,
  radio_geocerca_metros = EXCLUDED.radio_geocerca_metros,
  nombre = EXCLUDED.nombre,
  updated_at = NOW();

-- Storage bucket note (run in Supabase dashboard / storage API):
-- insert into storage.buckets (id, name, public) values ('case-files', 'case-files', false);
-- Policies should restrict to folder prefix = branch_id.

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT, INSERT ON public.petty_cash_ledger TO authenticated;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_attendance_punch TO authenticated;
GRANT EXECUTE ON FUNCTION public.budget_run_rate TO authenticated;
GRANT EXECUTE ON FUNCTION public.transition_petty_cash TO authenticated;
GRANT EXECUTE ON FUNCTION public.haversine_meters TO authenticated;
