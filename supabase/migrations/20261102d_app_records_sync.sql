-- Almacén genérico multi-colección para sync multi-dispositivo (casos, citas, caja, etc.)
CREATE TABLE IF NOT EXISTS public.app_records (
  collection TEXT NOT NULL,
  id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT 'challhuahuacho',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  deleted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  server_ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (collection, id)
);

CREATE INDEX IF NOT EXISTS idx_app_records_branch
  ON public.app_records(collection, branch_id)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_app_records_server_ts
  ON public.app_records(server_ts DESC);

ALTER TABLE public.app_records ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.app_records FROM PUBLIC;
REVOKE ALL ON TABLE public.app_records FROM anon, authenticated;
GRANT ALL ON TABLE public.app_records TO postgres, service_role;
