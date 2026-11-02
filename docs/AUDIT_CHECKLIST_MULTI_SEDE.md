# Checklist de auditoría multi-sede (Zero-Trust Dual-Mode)

Validar que las 5 sedes (Miraflores, Abancay, Cusco, Huaraz, Challhuahuacho) sincronizan sin carreras y con aislamiento RLS.

## 0. Prerrequisitos
- [ ] Migración aplicada: `supabase/migrations/20261102_enterprise_zero_trust.sql`
- [ ] Netlify env: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_ORIGIN`, `FIREBASE_API_KEY`
- [ ] Usuarios de prueba con JWT `app_metadata.role` + `app_metadata.branch_id`
- [ ] Modo A local sigue funcionando **sin** esas vars (`__ENTERPRISE_CLOUD__ === false`)

## 1. Aislamiento RLS (cross-branch deny)
- [ ] Login como `admin` de Challhuahuacho
- [ ] `SELECT` casos de Cusco → 0 filas / error RLS
- [ ] `INSERT` caso con `branch_id=cusco` → rechazado
- [ ] Login `super_admin` → ve las 5 sedes

## 2. Realtime sin condiciones de carrera
- [ ] Dos navegadores: sede A y sede B
- [ ] Crear expediente en A → aparece en A en <2s; B no lo ve
- [ ] SuperAdmin en tercera ventana ve A y B
- [ ] Editar el mismo registro offline en A, luego online: gana `server_ts` mayor (LWW)
- [ ] Outbox: desconectar red, crear caja, reconectar → flush sin duplicar id

## 3. Asistencia geocercada antifraude
- [ ] Marcaje dentro de radio → `validation_status=accepted`
- [ ] Marcaje fuera de radio (no diligencia) → rechazado por Edge
- [ ] `client_ts` alterado >60s → rechazado
- [ ] Flag spoof → rechazado
- [ ] `audit_logs` contiene IP, UA, distance_m

## 4. Caja chica / ledger
- [ ] Transición `requested → branch_approved → disbursed` OK
- [ ] `requested → disbursed` directo → error trigger/Edge
- [ ] Tras `disbursed`, mutar `monto_centavos` → bloqueado
- [ ] Dos asientos ledger (débito/crédito) suman cero neto
- [ ] `audit_logs` append-only (UPDATE/DELETE fallan)

## 5. Presupuesto
- [ ] RPC `budget_run_rate` sin división por cero (presupuesto 0 → utilization_bps 0)
- [ ] Cliente `PaoloBudgetAnalytics.localAggregate` coincide en céntimos

## 6. Casos / Storage
- [ ] Upload a `case-files/{branch_id}/...`
- [ ] Signed URL expira (~5 min)
- [ ] Usuario otra sede no lista objetos ajenos
- [ ] `notas_confidenciales` ocultas a `asistente_admin` (vista `cases_safe`)

## 7. Netlify / CSP
- [ ] `GET /.netlify/functions/public-config` no expone service role
- [ ] `*.sql`, `/supabase/*`, `/docs/*` → 404
- [ ] Telegram proxy exige Bearer Firebase (503 sin `FIREBASE_API_KEY`)

## 8. Regresión Modo A
- [ ] Sin env cloud: login local, tabs, paginación, lazy libs
- [ ] `npm test` verde
