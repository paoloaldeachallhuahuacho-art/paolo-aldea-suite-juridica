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
| **Activación** | Netlify env `SUPABASE_URL` + `SUPABASE_ANON_KEY` + `ALLOWED_ORIGIN` (exacto) |
| **Auth** | Supabase Auth JWT con `app_metadata.role` + `app_metadata.branch_id` |
| **Datos** | PostgreSQL + outbox IndexedDB + LWW `server_ts` |
| **Edge** | `attendance-validate`, `petty-cash-transition`, `public-config`, `telegram-proxy` |
| **Schema** | [`20261102`](../supabase/migrations/20261102_enterprise_zero_trust.sql) + [`20261102b`](../supabase/migrations/20261102b_firm_auth_registry.sql) + [`20261102d_app_records_sync.sql`](../supabase/migrations/20261102d_app_records_sync.sql) |
| **Auditoría** | [`docs/AUDIT_CHECKLIST_MULTI_SEDE.md`](AUDIT_CHECKLIST_MULTI_SEDE.md) |

### Auth multi-dispositivo (Super Admin compartido)
1. En Supabase SQL Editor ejecute **también** `20261102b_firm_auth_registry.sql`.
2. Netlify Functions: `auth-firm-status`, `auth-bootstrap`, `auth-login`, `auth-staff-upsert`.
3. Al crear el Super Admin en un PC/celular, se publica en `staff_directory`.
4. Otro dispositivo vacío ya **no** pide “crear admin”: muestra login y valida contra la nube.
5. Variables en Netlify (valores solo en el panel, no en el repo): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_ORIGIN` (= URL exacta del sitio, sin barra final).

### Sync de datos (casos, citas, caja, presupuestos, inventario, documentos, asistencia, personal)
1. En Supabase SQL Editor ejecute `20261102d_app_records_sync.sql`.
2. Edge: `sync-pull`, `sync-push` (token HMAC emitido por `auth-login`).
3. Tras login online el cliente hace pull (LWW) y push de lo local; cada guardado encola push.

### Roles JWT
`super_admin` | `admin` (BranchAdmin) | `abogado` | `asistente_*` | `accountant`

### Edge Functions — auth obligatoria
| Function | Requisitos |
|----------|------------|
| `attendance-validate` | `Origin === ALLOWED_ORIGIN` + `Authorization: Bearer <supabase access_token>` → RPC `validate_attendance_punch` **como usuario** (anon key). Sin fallback service_role. |
| `petty-cash-transition` | Igual → RPC `transition_petty_cash` como usuario. |
| `telegram-proxy` | Origin + Bearer Firebase ID token + `FIREBASE_API_KEY`. |
| `public-config` | Solo anon URL/key; nunca service_role. |

`SUPABASE_SERVICE_ROLE_KEY` puede existir en Netlify para tareas admin futuras, pero **no** se usa en las rutas de marcaje/caja anteriores.

### Prohibido en Modo B
- Anonymous Firebase / anon Supabase policies
- Service role en el navegador
- Telegram token en cliente
- Confiar solo en Haversine client-side para aceptar marcajes
- Fallback REST con service_role si falla el RPC

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
| B | `POST /.netlify/functions/attendance-validate` | Geocerca server (JWT + Origin) |
| B | `POST /.netlify/functions/petty-cash-transition` | Flujo caja (JWT + Origin) |
