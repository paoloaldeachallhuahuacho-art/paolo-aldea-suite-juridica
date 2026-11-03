-- Caja chica: el trigger de transición también exige rol.
-- Antes cualquier usuario autenticado de la sede podía cambiar workflow_state
-- si respetaba la máquina de estados (RLS petty_all).
-- Aplicar en el SQL editor de Supabase después de 20261102_enterprise_zero_trust.sql.

CREATE OR REPLACE FUNCTION public.enforce_petty_cash_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  allowed BOOLEAN := false;
  v_role TEXT := public.jwt_role();
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.workflow_state IS DISTINCT FROM NEW.workflow_state THEN
    allowed :=
      (OLD.workflow_state = 'requested' AND NEW.workflow_state IN ('branch_approved', 'rejected')) OR
      (OLD.workflow_state = 'branch_approved' AND NEW.workflow_state IN ('disbursed', 'rejected')) OR
      (OLD.workflow_state = 'disbursed' AND NEW.workflow_state IN ('reconciled', 'rejected'));
    IF NOT allowed THEN
      RAISE EXCEPTION 'Invalid petty cash transition: % -> %', OLD.workflow_state, NEW.workflow_state;
    END IF;

    IF NEW.workflow_state IN ('disbursed', 'rejected', 'reconciled')
       AND v_role NOT IN ('super_admin', 'admin', 'socio', 'service_role') THEN
      RAISE EXCEPTION 'Forbidden role for petty cash resolution';
    END IF;

    IF NEW.workflow_state = 'branch_approved'
       AND v_role NOT IN ('super_admin', 'admin', 'socio', 'asistente_admin', 'service_role') THEN
      RAISE EXCEPTION 'Forbidden role for petty cash elevation';
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
