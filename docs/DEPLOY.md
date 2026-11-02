# Modo de despliegue — PAOLO ALDEA Suite Jurídica

**Arquitectura dual (Zero-Trust):** Modo A local siempre disponible; Modo B enterprise se activa solo con variables Netlify/Supabase.

---

## Modo A — Local unipersonal (siempre soportado)

| | |
|---|---|
| **Cuándo** | Una PC de despacho, sin depender de internet |
| **Arranque** | `abrir_app.bat` → `servidor_local.ps1` → `http://localhost:<puerto>/` |
| **Datos** | IndexedDB primario; localStorage espejo/stub |
| **Auth** | Bootstrap + PBKDF2; sesión `AUTH_SIG`; APIs cookie/Bearer pairing |
| **Flag** | `window.__ENTERPRISE_CLOUD__ === false` |

### Checklist
1. No commitear `.server_token`, `.server_pairing`, `.env`, ni datos reales en `central_cloud_data.json`.
2. Primer usuario vía bootstrap.
3. Backups `_backups/` o export JSON.

---

## Modo B — Multi-sede nube Zero-Trust (enterprise)

| | |
|---|---|
| **Cuándo** | 5 sedes sincronizadas con RLS y Realtime |
| **Activación** | Netlify env `SUPABASE_URL` + `SUPABASE_ANON_KEY` (+ service role solo en Functions) |
| **Auth** | Supabase Auth JWT con `app_metadata.role` + `app_metadata.branch_id` |
| **Datos** | PostgreSQL + outbox IndexedDB + LWW `server_ts` |
| **Edge** | `attendance-validate`, `petty-cash-transition`, `public-config`, `telegram-proxy` |
| **Schema** | [`supabase/migrations/20261102_enterprise_zero_trust.sql`](../supabase/migrations/20261102_enterprise_zero_trust.sql) |
| **Auditoría** | [`docs/AUDIT_CHECKLIST_MULTI_SEDE.md`](AUDIT_CHECKLIST_MULTI_SEDE.md) |

### Roles JWT
`super_admin` | `admin` (BranchAdmin) | `abogado` | `asistente_*` | `accountant`

### Prohibido en Modo B
- Anonymous Firebase / anon Supabase policies
- Service role en el navegador
- Telegram token en cliente
- Confiar solo en Haversine client-side para aceptar marcajes

---

## Modo C — Híbrido descontrolado (evitar)

Mezclar hub PowerShell público + Firestore + Supabase sin SyncManager/RLS.  
Si se necesita offline+cloud: usar **Modo B** con outbox (no abrir el hub PS a Internet).

---

## Endpoints

| Modo | Ruta | Uso |
|------|------|-----|
| A | `POST /api/session` | Pairing local |
| A | `POST /api/cloud_sync` + `GET /api/cloud_snapshot` | Sync LAN |
| B | `GET /.netlify/functions/public-config` | Anon config |
| B | `POST /.netlify/functions/attendance-validate` | Geocerca server |
| B | `POST /.netlify/functions/petty-cash-transition` | Flujo caja |
