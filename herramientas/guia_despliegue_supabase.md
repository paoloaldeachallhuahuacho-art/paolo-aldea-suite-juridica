# Guía de despliegue Supabase (Modo B)

> **Actualizado 2026-11-15:** el esquema legado `database_cloud_schema.sql` fue **eliminado**.  
> Usa únicamente las migraciones Zero-Trust en `supabase/migrations/`.

## Fuente de verdad

| Recurso | Ruta |
|---------|------|
| Migración base | [`supabase/migrations/20261102_enterprise_zero_trust.sql`](../supabase/migrations/20261102_enterprise_zero_trust.sql) |
| Hardening seguridad | [`supabase/migrations/20261114_security_hardening.sql`](../supabase/migrations/20261114_security_hardening.sql) |
| Gate caja chica | [`supabase/migrations/20261103_petty_cash_role_gate.sql`](../supabase/migrations/20261103_petty_cash_role_gate.sql) |
| Deploy dual-mode | [`docs/DEPLOY.md`](../docs/DEPLOY.md) |
| Variables de entorno | [`.env.example`](../.env.example) |

## Pasos rápidos

1. En Supabase → **SQL Editor**, ejecuta en orden: `20261102_*`, `20261102b_*` … `20261103_*`, y **obligatorio** `20261114_security_hardening.sql`.
2. En Cloudflare Pages, configura `ALLOWED_ORIGIN`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SYNC_TOKEN_SECRET` (distinto del service_role).
3. Crea usuarios Auth con `app_metadata.role` + `app_metadata.branch_id` (nunca confiar solo en el claim PostgREST `role`).
4. Verifica que `POST /api/attendance-validate` sin Bearer responda **401**.

Detalle completo: **[`docs/DEPLOY.md`](../docs/DEPLOY.md)**.

## Prohibido

- Reintroducir políticas `TO anon` en tablas operativas.
- Poner `SUPABASE_SERVICE_ROLE_KEY` en el navegador o en `public-config`.
- Usar un schema SQL distinto al de `supabase/migrations/`.
