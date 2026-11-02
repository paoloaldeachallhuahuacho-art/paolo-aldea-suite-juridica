# Modo de despliegue — PAOLO ALDEA Suite Jurídica

**Decisión Semana 4:** el modo soportado por defecto es **Local unipersonal (hub en sede)**.  
Nube multi-sede e híbrido quedan documentados como opcionales y no se mezclan en el mismo arranque.

---

## Modo A — Local unipersonal (recomendado)

| | |
|---|---|
| **Cuándo** | Una PC de despacho (Challhuahuacho u otra sede), sin depender de internet |
| **Arranque** | `abrir_app.bat` → `servidor_local.ps1` → navegador en `http://localhost:<puerto>/` |
| **Datos** | IndexedDB primario (`PaoloAldeaJuridicoDB_v2`); localStorage solo espejo/stub |
| **Auth** | Bootstrap de primer arranque + PBKDF2; sesión con `AUTH_SIG`; APIs con cookie/Bearer de pairing |
| **Sync** | Opcional entre PCs de la misma LAN vía `/api/cloud_sync` + snapshot `/api/cloud_snapshot` |
| **Prohibido** | Tokens Telegram en el cliente; Anonymous Firebase; hashes default en repo |

### Checklist operativo
1. No commitear `.server_token`, `.server_pairing`, `.env`, ni `central_cloud_data.json` con datos reales.
2. Primer usuario: pantalla de bootstrap (crea `super_admin`).
3. Backups: `_backups/` vía `/api/backup` o export JSON desde la UI.
4. Librerías pesadas (Chart/Excel/PDF) se cargan solo al usarse.

---

## Modo B — Multi-sede nube (opcional)

| | |
|---|---|
| **Cuándo** | Varias sedes necesitan consolidar expedientes/caja |
| **Requisitos** | Firebase Auth **real** (sin Anonymous); `firestore.rules` por rol/sede; Telegram solo vía Netlify proxy con secretos en env |
| **No usar** | Servidor PowerShell público a internet; secretos en `settings` sincronizados |

Activar solo cuando Modo A esté estable y haya responsable de cloud (App Check, rotación de claves).

---

## Modo C — Híbrido (evitar)

Mezclar hub local + Firestore + Supabase en el mismo flujo sin política clara viola el secreto profesional y complica incidentes.  
Si se necesita: documentar qué colecciones salen del despacho y base legal (Ley 29733) **antes** de encender sync.

---

## Mapa rápido de endpoints locales

| Método | Ruta | Uso |
|--------|------|-----|
| POST | `/api/session` | Emparejar cookie de sesión (pairing one-time) |
| POST | `/api/cloud_sync` | Merge multi-sede → ACK liviano |
| GET | `/api/cloud_snapshot` | Stream del JSON central (hidratación) |
| GET | `/api/health` | Salud del hub |
| POST | `/api/backup` | Snapshot zip allowlist |

---

## Relación con PRs de hardening

- Semana 1: APIs autenticadas + clean slate de credenciales  
- Semana 2: Firebase/XSS/Telegram proxy  
- Semana 3: shell liviano + lazy libs + paginación  
- Semana 4: IndexedDB primario, controllers diferidos, sync ACK + este documento  
