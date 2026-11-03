-- Registro de autenticación multi-dispositivo (firm_settings + staff_directory)
-- Solo accesible vía Edge Functions con service_role (RLS sin políticas = denegado a anon/authenticated)

CREATE TABLE IF NOT EXISTS public.firm_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.staff_directory (
  id TEXT PRIMARY KEY,
  usuario TEXT NOT NULL,
  email TEXT,
  dni TEXT,
  full_name TEXT NOT NULL,
  cargo TEXT,
  role TEXT NOT NULL DEFAULT 'asistente_admin',
  branch_id TEXT NOT NULL DEFAULT 'challhuahuacho',
  password_hash TEXT NOT NULL,
  pin_hash TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  permisos JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_usuario_lower
  ON public.staff_directory (lower(usuario));
CREATE INDEX IF NOT EXISTS idx_staff_email_lower
  ON public.staff_directory (lower(email));
CREATE INDEX IF NOT EXISTS idx_staff_dni
  ON public.staff_directory (dni);

ALTER TABLE public.firm_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_directory ENABLE ROW LEVEL SECURITY;

-- Sin políticas SELECT/INSERT para anon/authenticated: solo service_role (Edge).
DROP POLICY IF EXISTS firm_settings_deny_all ON public.firm_settings;
DROP POLICY IF EXISTS staff_directory_deny_all ON public.staff_directory;

-- Grants explícitos (evita 42501 permission denied con PostgREST + service_role)
REVOKE ALL ON TABLE public.firm_settings FROM PUBLIC;
REVOKE ALL ON TABLE public.staff_directory FROM PUBLIC;
REVOKE ALL ON TABLE public.firm_settings FROM anon, authenticated;
REVOKE ALL ON TABLE public.staff_directory FROM anon, authenticated;
GRANT ALL ON TABLE public.firm_settings TO postgres, service_role;
GRANT ALL ON TABLE public.staff_directory TO postgres, service_role;

INSERT INTO public.firm_settings (key, value)
VALUES ('auth_bootstrapped', '{"bootstrapped": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;
