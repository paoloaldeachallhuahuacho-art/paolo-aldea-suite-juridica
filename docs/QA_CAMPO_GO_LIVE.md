# QA de campo — Go-live (15–20 min)

URL: https://paoloaldea-abogados.pages.dev/

## 1. Login real (2 roles)

| Paso | Acción | Esperado |
|------|--------|----------|
| 1.1 | Login `admin` en PC A | Entra; topbar muestra usuario; sin errores en consola |
| 1.2 | F5 | Pide login de nuevo (política de sesión) |
| 1.3 | Login `abogado.ch` o `asistente.ch` en PC/celular B | Entra; **no** ve panel Master / Roles |

## 2. Sync multi-dispositivo

| Paso | Acción | Esperado |
|------|--------|----------|
| 2.1 | En A (admin): crear un caso de prueba en Challhuahuacho | Guarda local |
| 2.2 | Esperar ~5 s / cambiar de pestaña | Semáforo sync OK |
| 2.3 | En B (mismo rol sede o admin): login fresco | El caso aparece tras pull |
| 2.4 | En B editar el mismo caso; en A refrescar módulo | Gana el más reciente (LWW) |

## 3. Caja chica (2 roles)

| Paso | Acción | Esperado |
|------|--------|----------|
| 3.1 | Asistente: crear egreso → estado solicitado | Visible |
| 3.2 | Admin: elevar / aprobar según UI | `branch_approved` → `disbursed` |
| 3.3 | Intentar saltar a desembolsado desde solicitado (si la UI lo permite) | Rechazado / 409 |

## 4. Asistencia GPS (en Challhuahuacho)

| Paso | Acción | Esperado |
|------|--------|----------|
| 4.1 | En oficina, modalidad “En Oficina” + GPS real | Marcaje aceptado (≤100 m) |
| 4.2 | Fuera del radio (sin diligencia) | Rechazado |
| 4.3 | Comisión / diligencia fuera | Pendiente o `external_ok` según flujo |

## 5. Cierre

- Borrar el caso/caja de prueba o dejarlos marcados `PRUEBA QA`.
- Confirmar que solo existen los 4 staff reales en Personal.
