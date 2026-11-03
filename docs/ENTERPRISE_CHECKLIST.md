# Checklist Enterprise — Paolo Aldea & Abogados

**Objetivo:** go-live Zero-Trust multi-sede en Cloudflare Pages + Supabase.  
**URL:** https://paoloaldea-abogados.pages.dev/  
**Edge canónico:** `/api/<fn>` (código en `cloudflare/functions/`; ya no hay carpeta `netlify/`)

Leyenda: `PASS` verificado · `WARN` riesgo conocido · `PENDING` manual restante · `FAIL` bloqueante

---

## Resumen de salida

| Nivel | Criterio | Estado |
|-------|----------|--------|
| **Compartir al equipo** | Infra + Seguridad + Auth + Sync/RLS edge + Caja/Asistencia cableados | **Listo técnico** — falta solo QA de campo (`docs/QA_CAMPO_GO_LIVE.md`) |
| **Enterprise completo** | + GPS real en sede + 2 dispositivos humanos | PASS técnico local; QA de campo PENDING |

---

## A. Infraestructura

| ID | Control | Estado | Evidencia |
|----|---------|--------|-----------|
| INF-01 | Sitio en Cloudflare Pages | PASS | URL producción |
| INF-02 | `GET /api/public-config` enterprise | PASS | `enterprise=true` |
| INF-03 | Env Pages configuradas | PASS | Origin gate + config |
| INF-04 | Migraciones Supabase | PASS* | Auth registry + app_records en uso (*confirmar SQL Editor si se recrea proyecto) |
| INF-05 | Worker `/api/*` | PASS | Adapter + tests |
| INF-06 | Sin carpeta `netlify/` / sin `netlify.toml` | PASS | Funciones en `cloudflare/functions/` |

## B. Seguridad

| ID | Control | Estado | Evidencia |
|----|---------|--------|-----------|
| SEC-01 | public-config sin service_role | PASS | |
| SEC-02 | Origin inválido → 401 | PASS | |
| SEC-03 | Rutas sensibles 404 | PASS | docs/sql/cloudflare/… |
| SEC-04 | sync-pull sin token → 401 | PASS | |
| SEC-05 | attendance-validate sin auth → 401 | PASS | |
| SEC-06 | petty-cash-transition sin auth → 401 | PASS | |
| SEC-07 | Headers CSP/HSTS | PASS | |
| SEC-08 | auth-staff-upsert exige syncToken + rol admin | **PATCHED_LOCAL** | Prod aún abierta hasta redeploy; limpiar AUDIT-PROBE-DO-NOT-KEEP |
| SEC-09 | sync-push deletedIds filtra sede | **PATCHED_LOCAL** | Redeploy obligatorio |
| SEC-10 | auth-login no filtra hashes a no-admin | **PATCHED_LOCAL** | Redeploy obligatorio |
| SEC-11 | Rate-limit auth-login | PASS | Edge live: 12×200 + 8×429/min; lock 8 fallos/15min |
| AUTH-05 | No password en claro al Worker | PASS | auth-login exige challenge+proofs |

## C. Auth

| ID | Control | Estado | Evidencia |
|----|---------|--------|-----------|
| AUTH-01 | Firma bootstrapped | PASS | staffCount≥1 |
| AUTH-02 | Re-bootstrap 409 | PASS | |
| AUTH-03 | Challenge + proofs | PASS | |
| AUTH-04 | Login real con claves del despacho | PENDING | Operativo humano |
| UX-01 | Entregar credenciales al equipo | PENDING | Canal seguro |

## D. Sync / RLS edge

| ID | Control | Estado | Evidencia |
|----|---------|--------|-----------|
| SYNC-01 | Pull+push tras login (`CloudDataSync.afterLogin`) | PASS | Código + syncToken |
| SYNC-02 | Outbox schedulePush al persistir | PASS | `data.js` → CloudDataSync |
| SYNC-03 | LWW server-side en sync-push | PASS | Skip si remoto más nuevo |
| RLS-01 | Sede B no publica en sede A (edge filter) | PASS | sync-push branch guard + test |
| RLS-02 | Admin sede no lee otra sede (sync-pull filter) | PASS | `normalizeBranch` |
| RLS-03 | super_admin ve todas | PASS | `branchFilter=null` |
| RLS-04 | Storage case-files policies | PENDING | Opcional; sync actual usa app_records |

## E. Asistencia

| ID | Control | Estado | Evidencia |
|----|---------|--------|-----------|
| ATT-01 | Marcaje con syncToken + geocerca | PASS | attendance-validate dual auth |
| ATT-02 | Fuera de radio (no DILIGENCIA) → 403 | PASS | Haversine edge |
| ATT-03 | DILIGENCIA fuera → external_ok | PASS | |
| ATT-04 | Clock skew >60s → 400 | PASS | |
| ATT-05 | Spoof → 403 | PASS | |
| ATT-FIELD | GPS real en Challhuahuacho | PENDING | Prueba en sede |

## F. Caja chica

| ID | Control | Estado | Evidencia |
|----|---------|--------|-----------|
| CASH-01 | elevar → `branch_approved` (edge) | PASS | UI + CashManager |
| CASH-02 | aprobar → `disbursed` (edge) | PASS | No salta requested→disbursed |
| CASH-03 | Salto requested→disbursed → 409 | PASS | ALLOWED map |
| CASH-04 | rechazar → `rejected` | PASS | UI wired |
| CASH-FIELD | Ciclo completo con 2 roles en UI | PENDING | Admin + asistente |

## G. Regresión

| ID | Control | Estado | Evidencia |
|----|---------|--------|-----------|
| REG-01 | `npm test` verde | PASS | Incluye enterprise-sync-rls |

---

## Arquitectura edge (post-migración)

```
Cliente  →  /api/<fn>  →  _worker.js  →  cloudflare/adapter.js  →  cloudflare/functions/*
                                                                  ↑
                                                         (ya no existe netlify/)
```

Alias: `/.netlify/functions/*` sigue respondiendo por compatibilidad de caché vieja.

## Procedimiento rápido

```powershell
$base = 'https://paoloaldea-abogados.pages.dev'
Invoke-RestMethod "$base/api/public-config"
Invoke-RestMethod "$base/api/auth-firm-status"
# Esperado 401:
try { Invoke-WebRequest "$base/api/sync-pull" -Method POST -Body '{}' -ContentType 'application/json' } catch { $_.Exception.Response.StatusCode }
```
