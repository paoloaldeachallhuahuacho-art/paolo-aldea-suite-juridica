-- ==============================================================================
-- PAOLO ALDEA — Security Hardening (2026.11.14)
-- Corrige jwt_role sombreado por claim PostgREST, congela perfiles y
-- endurece la vista cases_safe con security_invoker.
-- ==============================================================================

-- 1) jwt_role: NUNCA usar el claim PostgREST "role" (authenticated/anon/service_role)
--    como rol de aplicación. Priorizar app_metadata / claim custom user_role.
CREATE OR REPLACE FUNCTION public.jwt_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role', ''),
    NULLIF(current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'role', ''),
    NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'user_role', ''),
    CASE
      WHEN NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '')
           IN ('super_admin', 'socio', 'admin', 'abogado', 'asistente_legal', 'asistente_admin', 'service_role')
      THEN current_setting('request.jwt.claims', true)::jsonb ->> 'role'
      ELSE NULL
    END,
    'authenticated'
  );
$$;

-- 2) Congelar role / branch_id / activo / auth_uid en auto-update de perfiles
DROP POLICY IF EXISTS profiles_update_self ON public.user_profiles;
CREATE POLICY profiles_update_self ON public.user_profiles
FOR UPDATE TO authenticated
USING (public.is_super_admin() OR auth_uid = auth.uid())
WITH CHECK (
  public.is_super_admin()
  OR (
    auth_uid = auth.uid()
    AND role = (SELECT p.role FROM public.user_profiles p WHERE p.id = user_profiles.id)
    AND branch_id IS NOT DISTINCT FROM (SELECT p.branch_id FROM public.user_profiles p WHERE p.id = user_profiles.id)
    AND activo IS NOT DISTINCT FROM (SELECT p.activo FROM public.user_profiles p WHERE p.id = user_profiles.id)
    AND auth_uid IS NOT DISTINCT FROM (SELECT p.auth_uid FROM public.user_profiles p WHERE p.id = user_profiles.id)
  )
);

-- 3) Vista cases_safe: invocar con privilegios del llamador (respeta RLS de cases)
DROP VIEW IF EXISTS public.cases_safe;
CREATE VIEW public.cases_safe
WITH (security_invoker = true)
AS
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

REVOKE ALL ON public.cases_safe FROM anon;
GRANT SELECT ON public.cases_safe TO authenticated;
