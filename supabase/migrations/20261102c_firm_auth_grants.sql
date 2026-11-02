-- Permisos para que Netlify (service_role) pueda leer/escribir el registro de auth.
-- Ejecutar en Supabase → SQL Editor si auth-firm-status devuelve 42501 permission denied.

REVOKE ALL ON TABLE public.firm_settings FROM PUBLIC;
REVOKE ALL ON TABLE public.staff_directory FROM PUBLIC;
REVOKE ALL ON TABLE public.firm_settings FROM anon, authenticated;
REVOKE ALL ON TABLE public.staff_directory FROM anon, authenticated;

GRANT ALL ON TABLE public.firm_settings TO postgres, service_role;
GRANT ALL ON TABLE public.staff_directory TO postgres, service_role;

ALTER TABLE public.firm_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_directory ENABLE ROW LEVEL SECURITY;

INSERT INTO public.firm_settings (key, value)
VALUES ('auth_bootstrapped', '{"bootstrapped": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;
