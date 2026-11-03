# Guía de despliegue Supabase (Modo B)

> **Actualizado 2026-11:** el esquema legado `database_cloud_schema.sql` fue **eliminado** (políticas `anon` inseguras).  
> Usa únicamente la migración Zero-Trust.

## Fuente de verdad

| Recurso | Ruta |
|---------|------|
| Migración SQL | [`supabase/migrations/20261102_enterprise_zero_trust.sql`](../supabase/migrations/20261102_enterprise_zero_trust.sql) |
| Checklist multi-sede | [`docs/AUDIT_CHECKLIST_MULTI_SEDE.md`](../docs/AUDIT_CHECKLIST_MULTI_SEDE.md) |
| Deploy dual-mode | [`docs/DEPLOY.md`](../docs/DEPLOY.md) |
| Variables de entorno | [`.env.example`](../.env.example) |

## Pasos rápidos

1. En Supabase → **SQL Editor**, ejecuta el contenido completo de `20261102_enterprise_zero_trust.sql`.
2. En Netlify, configura `ALLOWED_ORIGIN`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` (ver `.env.example`).
3. Crea usuarios Auth con `app_metadata.role` + `app_metadata.branch_id`.
4. Verifica que `POST /api/attendance-validate` sin Bearer responda **401**.

Detalle completo: **[`docs/DEPLOY.md`](../docs/DEPLOY.md)**.

## Prohibido

- Reintroducir políticas `TO anon` en tablas operativas.
- Poner `SUPABASE_SERVICE_ROLE_KEY` en el navegador o en `public-config`.
- Usar un schema SQL distinto al de `supabase/migrations/`.
