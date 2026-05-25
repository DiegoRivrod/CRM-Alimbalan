# HANDOFF — CRM + ABAL+ (2026-05-21, fin de día)

> **Único archivo a leer al retomar.** Identidad + qué cambió + qué sigue. Patrones y reglas viven en `CLAUDE.md`, `PROGRESO_CRM.md` y memoria auto (`project_patterns.md` se carga solo).

## Identidad

- **Empresa:** ABAL S.A.C — Alimentos Balanceados del Perú
- **Repo:** https://github.com/DiegoRivrod/CRM-Alimbalan
- **Local:** `C:\Users\supervisor.ventas\Desktop\crm\` · Dev: `npm run dev` → http://localhost:5178
- **Supabase ID:** `hbxfohohfuzzihjhzhcy`
- **Stack:** React 19 + TS + Vite + Tailwind + shadcn/ui · TanStack Query v5 · Supabase · Vitest · Vercel

## Estado al cerrar (2026-05-21 noche)

### Trabajo de QA del día (todo en local, sin commit)
- **Migración 007 RLS fix** (`actividad_insert with check usuario_id = auth.uid()`). ✅ Aplicada en prod.
- **TanStack Query v5** migrado en los 9 hooks de fetching + ErrorBoundary + 59 tests Vitest pasando.
- **CI** ampliada con job `db-validate` (Postgres 15 service container).
- **Validaciones** en Edge Functions: year range, whitelist, payload limit.
- **WhatsApp**: Edge Function `whatsapp-webhook` (HMAC) + migración 008 → ambas creadas, NO deployadas.
- **README.md** reescrito CRM-specific.
- **Pure module** `src/lib/abalPlus.ts` (+ tests) espejo del Edge Function calcular-puntos.

### Sesión de tarde: arreglar importación de visitas (3 bugs latentes)
Empezamos verificando si la cadena Forms → Sheet → ETL → tabla `visitas` funcionaba. Resultado: **la tabla estaba vacía** y al subir el CSV destapamos tres bugs encadenados.

| Bug | Causa | Fix |
|---|---|---|
| 1058 filas → 0 visitas | `XLSX.read` lee CSV UTF-8 como Latin1, rompe headers con `¿` y devuelve fechas como serial Excel | Reemplazado por **Papa Parse** en `parseVisitasCSV` + helper `parseFechaPeruana` (D/M/YYYY → ISO) en `etl.ts` |
| `there is no unique or exclusion constraint...` | El schema 001 nunca tuvo UNIQUE en `(marca_temporal, fuerza_de_venta, numero_visita)` pero el upsert lo necesita | **Migración 009** `visitas_unica`. ✅ Aplicada en prod por el usuario |
| `violates check constraint visita_cliente_check` | (a) El Google Form devuelve **NOMBRE** del cliente en `SELECCIONE EL CLIENTE`, no IDCLIENTE; (b) 22 filas tienen una fecha donde iba Si/No | **etl.ts**: reclasificar a `es_cliente_nuevo=true` si no es "Si" pero tampoco hay clienteSeleccionado válido. **ImportarPage**: cargar clientes y resolver `nombre → idcliente` antes del upsert; lo que no matchee se reclasifica como nuevo |

### Archivos modificados HOY (no commiteados)
```
M  src/lib/googleSheets.ts            ← Papa Parse en parseVisitasCSV
M  src/lib/etl.ts                     ← parseFechaPeruana + reclasificación defensiva
M  src/lib/etl.test.ts                ← fixture de fecha a formato peruano D/M/YYYY
M  src/pages/importar/ImportarPage.tsx ← resolver idcliente por nombre antes del upsert
M  package.json + package-lock.json   ← + papaparse + @types/papaparse
?? supabase/migrations/009_visitas_unique.sql   ← UNIQUE constraint. ✅ Aplicada en prod
?? Registro de visita a clientes TECNICOS - TECNICOS (2).csv  ← CSV de prueba
```

## Acción pendiente al retomar mañana

**Probar la importación de visitas con los 3 fixes activos.** El dev server ya quedó corriendo en localhost:5178 al cerrar, pero al volver lo más limpio es:

1. Matar nodes: `Get-Process node | Stop-Process -Force` (PowerShell).
2. `npm run dev`.
3. `Ctrl+Shift+R` en el navegador para descartar bundle viejo.
4. Login → `/importar` → paso 3 → subir `Registro de visita a clientes TECNICOS - TECNICOS (2).csv`.
5. Esperar **`~1036 visitas insertadas · N prospectos creados`** (N entre 186 y ~600 dependiendo de cuántos nombres matcheen con `clientes.nombre`).

### Verificación SQL post-importación
```sql
select
  count(*) as total,
  count(*) filter (where idcliente is not null) as con_idcliente,
  count(*) filter (where es_cliente_nuevo) as nuevos_prospectos,
  count(*) filter (where latitud is not null) as con_gps
from visitas;
```
Esperado: total ~1036, con_idcliente entre 186 y ~850, con_gps cercano al total.

### Si funciona → siguientes pasos en orden
1. **Verificar UI** — abrir `/clientes`, elegir uno con visitas, ver que aparezcan en el timeline (KPI "Visitas" y filas tipo visita junto a facturas).
2. **Commit grande** de todo el día. Sugerencia: `feat(qa): RLS fix + TanStack Query + ETL visitas (papaparse + idcliente by name) + tests`. **Sin `Co-Authored-By: Claude`**.
3. **Decidir si automatizar el sync de visitas** (Edge Function + pg_cron diario) o dejarlo manual. Conversación pendiente del día.
4. WhatsApp Cloud API (acción manual 3) — guía en `docs/WHATSAPP_INTEGRATION.md`.
5. ~~F16.5 dashboard `/abal-plus`~~ ✅ entregado en commit `14a6e02` (2026-05-25).
6. **CI/CD Fase 3 + 4** — código en rama `feat/cicd-f3-f4`. Pendientes manuales antes de mergear: ver bloque "Smoke tests" abajo.

### Smoke tests post-deploy (Fase 3-4) — acciones manuales

Antes de mergear `feat/cicd-f3-f4` a `main`, configurar (una sola vez):

1. **Crear usuario e2e en Supabase** (Dashboard → Authentication → Users):
   - Email: `e2e@abal.test` · password generado · luego SQL:
     `insert into public.perfiles (id, email, rol) values ('<uuid>', 'e2e@abal.test', 'gerente');`
2. **Secrets de GitHub** (`gh secret set ...`):
   - `SUPABASE_E2E_USER_EMAIL` = `e2e@abal.test`
   - `SUPABASE_E2E_USER_PASSWORD` = `<password>`
3. **Deploy Hook en Vercel** (Settings → Git → Deploy Hooks):
   - Outgoing webhook · evento "Production Deployment Succeeded"
   - URL: `https://api.github.com/repos/DiegoRivrod/CRM-Alimbalan/dispatches`
   - Headers: `Authorization: Bearer <PAT>`, `Accept: application/vnd.github+json`
   - Payload: `{"event_type":"vercel.deployment.success","client_payload":{"url":"<url>","target":"production"}}`
4. **Aplicar migración 008** a prod (`supabase db push --linked` desde local, una vez).
5. **Branch protection** en GitHub Settings → Branches → `main`: require status checks `Lint`, `Type Check`, `Tests`, `DB Validate`, `Build`.

Verificación end-to-end: push trivial a `main` → CI verde → Vercel deploya → Deploy Hook dispara workflow `Smoke (post-deploy)` → Playwright verde.

### Si NO funciona
- Si vuelve a aparecer `violates check constraint` → me decís cuántas y qué casos. Probable: alguna fila pasó el filtro pero la lógica de reclasificación dejó algún edge case.
- Si aparece `violates foreign key constraint visitas_idcliente_fkey` → un `idcliente` resuelto no existe en `clientes`. Hay que ver el SQL exacto del error y comparar con `clientes`.

## Dónde buscar lo demás (no duplicar aquí)

| Necesitas… | Está en… |
|---|---|
| Reglas de commit, npm, lectura de archivos, idioma | `~/.claude/CLAUDE.md` (global) + `crm/CLAUDE.md` (proyecto) |
| Patrones TanStack Query / RLS / Realtime / Supabase / ETL | memoria `project_patterns.md` (auto-cargada) + `crm/CLAUDE.md` |
| Mapa "necesitas tocar X → ir a Y" | `crm/CLAUDE.md` |
| Schema, joins, ETL detallado, trigramas | `PROGRESO_CRM.md` |
| Fases F1–F20 y calidad QA | `PROGRESO_CRM.md` (tabla) |
| Detalle deploy / Vercel / gh CLI | memoria `project_github_deploy` |
| Diff sin commit | `git status` |

## Nota técnica importante para mañana

El bug del Google Form que devuelve **nombre** en lugar de **idcliente** está enmascarado por la resolución que hicimos en `ImportarPage`. La solución ideal a futuro sería cambiar el Form para que el dropdown devuelva el IDCLIENTE como valor (en lugar del nombre como label), pero requiere acceso a la edición del Form. Por ahora la resolución client-side funciona bien.
