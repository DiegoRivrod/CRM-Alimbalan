# CRM Comercial — Progreso del Proyecto

**Empresa:** ALIMENTOS BALANCEADOS DEL PERU S.A.C.
**Última actualización:** 2026-05-21
**Stack:** React 19 + TypeScript + Vite + Tailwind + shadcn/ui · TanStack Query v5 · Supabase (Postgres + Auth + RLS + Edge Functions) · Vercel
**Repo:** https://github.com/DiegoRivrod/CRM-Alimbalan
**Supabase project ID:** `hbxfohohfuzzihjhzhcy`
**Dev:** `npm run dev` → http://localhost:5178

> Para retomada rápida ver primero **[HANDOFF.md](./HANDOFF.md)**.
> Para reglas operativas (commits, npm, lectura de archivos) ver **[CLAUDE.md](./CLAUDE.md)**.

---

## Estado de Fases

| Fase | Módulo | Estado |
|------|--------|--------|
| F1 | Setup + Schema + Auth + RLS + Routing | ✅ |
| F2 | ETL + ImportarPage + Edge Functions sync | ✅ |
| F3 | Módulo Clientes (lista + detalle) | ✅ |
| F4 | Módulo Vendedores (performance + metas) | ✅ |
| F5 | Módulo Prospectos (lista + detalle + match) | ✅ |
| F6 | KPIs automáticos | ✅ |
| F7 | Actividad y call center | ✅ |
| F8 | Auto-conversión prospecto al importar facturas | ✅ |
| F9 | Semáforo de salud del cliente | ✅ |
| F10 | Dashboard con gráficas de tendencia | ✅ |
| F11 | Historial de importaciones | ✅ |
| F12 | Exportación a Excel | ✅ |
| F13 | Búsqueda global | ✅ |
| F14 | Filtros avanzados en Prospectos | ✅ |
| F15 | Sync automático de maestros (pg_cron) | ✅ |
| F16.1–4 | ABAL+ schema + Edge Function + Badge + Detalle | ✅ |
| F16.5 | ABAL+ dashboard `/abal-plus` | 🔲 |
| F17 | Pipeline Kanban (@dnd-kit) | ✅ |
| F18 | Tareas y Recordatorios | ✅ |
| F19 | Calendario de Actividades (vista mensual) | ✅ |
| F20 | Notificaciones In-App (Supabase Realtime) | ✅ |

### Calidad / infraestructura (post-QA 2026-05-21)
| Item | Estado |
|------|--------|
| **RLS fix crítico**: migración 007 (`actividad_insert with check usuario_id = auth.uid()`) | ✅ aplicada en prod |
| **TanStack Query v5** en 9 hooks de fetching | ✅ |
| **ErrorBoundary** envolviendo el árbol | ✅ |
| **Vitest**: 59 tests pasando (utils 5 · etl 25 · abalPlus 28) | ✅ |
| **CI/CD Fase 1+2**: lint + typecheck + test + db-validate → build | ✅ |
| **CI db-validate**: bootstrap auth schema, corre migraciones + RLS tests | ✅ |
| **Validaciones Edge Functions**: year range, whitelist, payload limit | ✅ |
| **Edge Function `whatsapp-webhook`** con HMAC | ✅ creada · 🔲 deployar |
| **Migración 008 WhatsApp** | ✅ creada · 🔲 aplicar |
| **CI/CD Fase 3** (deploy Supabase consolidado + endpoint `health`) | ✅ código en `feat/cicd-f3-f4` · 🔲 merge + manuales |
| **CI/CD Fase 4** (smoke tests Playwright + branch protection) | ✅ código en `feat/cicd-f3-f4` · 🔲 secrets + Deploy Hook Vercel |

---

## Arquitectura del código

```
crm/
├── src/
│   ├── App.tsx                          ErrorBoundary > QueryClientProvider > AuthProvider > Router
│   ├── components/
│   │   ├── ErrorBoundary.tsx
│   │   ├── actividad/ActividadTimeline.tsx
│   │   └── layout/{AppLayout,Sidebar,ProtectedRoute}.tsx
│   ├── lib/
│   │   ├── supabase.ts          cliente Supabase
│   │   ├── queryClient.ts       defaults TanStack Query
│   │   ├── auth.tsx             AuthProvider + useAuth
│   │   ├── etl.ts (+ .test.ts)  ETL browser-side (xlsx)
│   │   ├── googleSheets.ts      sync maestros
│   │   ├── exportar.ts          exportación xlsx
│   │   ├── abalPlus.ts (+ .test.ts)   módulo puro espejo del Edge Function calcular-puntos
│   │   └── utils.ts (+ .test.ts)
│   ├── types/supabase.ts        tipos TS manuales (sin codegen)
│   ├── hooks/                   useClientes, useProspectos, useVendedores, useAbalPlus,
│   │                            useKpis, useActividad, useTareas, useCalendario,
│   │                            useNotificaciones, useKanban
│   └── pages/
│       ├── auth/LoginPage.tsx
│       ├── clientes/{ClientesPage,ClienteDetallePage}.tsx
│       ├── vendedores/{VendedoresPage,VendedorDetallePage}.tsx
│       ├── prospectos/{ProspectosPage,ProspectoDetallePage,KanbanPage}.tsx
│       ├── importar/ImportarPage.tsx
│       ├── kpis/KpisPage.tsx
│       ├── tareas/TareasPage.tsx
│       ├── calendario/CalendarioPage.tsx
│       ├── DashboardPage.tsx
│       └── VisitasPage.tsx
├── supabase/
│   ├── migrations/001..008.sql
│   ├── functions/{sync-maestros,sync-visitas,calcular-puntos,whatsapp-webhook}/
│   └── tests/rls.test.sql (+ README.md)
├── docs/{MIGRATION_TANSTACK_QUERY,WHATSAPP_INTEGRATION}.md
├── .github/workflows/{ci,deploy-production}.yml
├── HANDOFF.md                  ← retomada de sesión
├── PROGRESO_CRM.md             ← este archivo (fuente de verdad)
└── CLAUDE.md                   ← reglas operativas
```

---

## Schema de Base de Datos

### Orden de dependencia
`profiles → clientes → productos → metas → facturas → visitas → prospectos → actividad → tareas → notificaciones → abal+ → whatsapp_mensajes`

### Joins clave
| Campo | Une |
|-------|-----|
| `idcliente` (padStart 6) | clientes ↔ facturas ↔ visitas |
| `idarticulo` | facturas ↔ productos |
| `cod` / `cod_meta` | clientes / facturas ↔ metas |
| `docventa` = `idserie + '-' + numero` | clave única de factura |
| `fuerza_de_venta` | campo RLS para filtrar por vendedor |

### Tabla `prospectos` (clave F5)
```sql
id uuid PK · visita_id uuid → visitas.id · nombre text · contacto text
fuerza_de_venta text · zona text · especie text · potencial_tn numeric
estado text CHECK ('nuevo','seguimiento','convertido','perdido')
idcliente_sugerido text → clientes.idcliente · match_confianza numeric (0-1)
match_aprobado boolean · match_aprobado_por uuid → profiles.id · match_aprobado_at timestamptz
primera_factura_docventa text · fecha_conversion date
```

---

## Roles y RLS

| Rol | Acceso |
|-----|--------|
| `gerente` | SELECT en todo |
| `supervisor` | SELECT en todo + UPDATE en prospectos (aprobación match) |
| `vendedor` | SELECT donde `fuerza_de_venta = su propio valor` |

Campo RLS: `fuerza_de_venta` (viene de `profiles.fuerza_de_venta`). En clientes: `responsable = fuerza_de_venta`.

**⚠️ Regla de oro RLS:** toda policy de INSERT debe usar `with check (usuario_id = auth.uid())`, no solo `auth.uid() is not null`. Ejemplo correcto en `007_fix_rls_actividad_insert.sql`.

---

## Lógica ETL (browser-side, `src/lib/etl.ts`)

### Facturas
1. Join facturas + productos (`IDARTICULO`)
2. Join + clientes (`IDCLIENTE`)
3. Join + metas (`COD`)
4. Calcular `SEMANA`: días 1-8=S1, 9-15=S2, 16-22=S3, 23-30=S4
5. Reasignar `FUERZA_DE_VENTA` por reglas de negocio (ver abajo)
6. Filtrar `CLIENTE VARIOS` y `VALORTOTAL=0`
7. Upsert con constraint `facturas_linea_unica (idserie, numero, idarticulo)`

### Reglas de reasignación FUERZA_DE_VENTA
- Truchas + Puno → VENDEDOR ZONA PUNO
- VITAMAXPRO/INVITA + Puno → ASESORA COMERCIAL 2
- VITAMAXPRO/INVITA + Apurímac/Junín → ASESORA COMERCIAL 2
- VITAMAXPRO AQUA + VENDEDOR COBERTURA AREQUIPA → ASESORA COMERCIAL 1
- ASESORA COMERCIAL 1 + VITAMAXPRO AQUA → cod_meta = `ASESORA COMERCIAL 1-ArequipaExtrusion`
- LLAMOCCA HANCCO MAGDALENA + ARENAS → VENDEDOR TÉCNICO AREQUIPA

### Omisiones esperadas (~43% de filas)
`CLIENTE VARIOS` · `VALORTOTAL=0` · `IDARTICULO` sin match · duplicado por clave natural.
Referencia ABRIL_2026: 2,017 procesadas / 1,570 omitidas ✅

### Visitas (Google Forms)
- Forma captura hasta 4 visitas por fila (prefijos 001/002/003/004) → normalización wide→long
- Si `es_cliente_nuevo=true` → crea registro en `prospectos`

---

## ⚠️ Reglas Críticas

- **Facturas inmutables:** nunca `DELETE`. Re-importar = `UPSERT` con `facturas_linea_unica`.
- **npm con error 403:** `npm install --strict-ssl false --registry https://registry.npmmirror.com`
- **Commits sin `Co-Authored-By: Claude`** (regla global del usuario).
- **No leer archivos >300 líneas completos** sin justificación; usa Grep o Read con offset/limit.

---

## Patrones de código vigentes

### TanStack Query — fetching estándar
```ts
const q = useQuery({
  queryKey: ['recurso', 'detalle', filtros],
  queryFn: async (): Promise<Tipo[]> => {
    const { data, error } = await supabase.from('t').select('*')
    if (error) throw new Error(error.message)
    return (data ?? []) as Tipo[]
  },
})
```
Defaults en [src/lib/queryClient.ts](src/lib/queryClient.ts): `staleTime 60s · gcTime 5min · retry 1 · refetchOnWindowFocus off`.

### Mutaciones (fuera del hook) invalidan cache
```ts
export async function actualizar(id, cambios) {
  await supabase.from('t').update(cambios as never).eq('id', id)
  queryClient.invalidateQueries({ queryKey: ['recurso'] })
}
```

### Optimistic update
```ts
queryClient.setQueryData<T[]>(key, prev => (prev ?? []).map(...))
await supabase.from('t').update(...)
```

### Realtime → cache (sin refetch)
```ts
supabase.channel(name).on('postgres_changes', { event, schema, table, filter }, p => {
  queryClient.setQueryData<T[]>(key, prev => [p.new as T, ...(prev ?? [])])
}).subscribe()
```

### Estabilizar referencia derivada de `q.data`
```ts
const items = useMemo(() => q.data ?? [], [q.data])
```
Sin esto, `q.data ?? []` crea array nuevo cada render y rompe `useMemo` dependientes.

### Supabase sin codegen
```ts
const rows = (data ?? []) as Array<MiTipo>          // SELECT → cast
await supabase.from('t').update({...} as never)     // mutación → as never
```

### Similitud trigramas (F5 prospectos)
Normaliza (minúsculas, sin acentos, sin "SAC/EIRL/SRL") → trigramas de 3 chars → similitud = `2·|A∩B| / (|A|+|B|)`. Umbral 20%, top 5. Computación client-side sobre ~1,450 clientes (~50KB).

---

## Pendientes

### Producto
- **F16.5** — Dashboard `/abal-plus` (distribución por tier, ranking, clientes cerca de subir).

### Integraciones
- **WhatsApp Cloud API** — Edge Function `whatsapp-webhook` lista, falta:
  1. Aplicar migración `008_whatsapp_mensajes.sql` en SQL Editor.
  2. Crear Meta app + secrets `WHATSAPP_VERIFY_TOKEN` + `WHATSAPP_APP_SECRET`.
  3. `supabase functions deploy whatsapp-webhook --no-verify-jwt`.
  4. Guía: [docs/WHATSAPP_INTEGRATION.md](docs/WHATSAPP_INTEGRATION.md).

### CI/CD Fase 3 — Deploy automático (código entregado en `feat/cicd-f3-f4`)

**Lo que ya está en código:**
- `.github/workflows/deploy-production.yml` consolidado: `supabase functions deploy` (sin nombre) despliega **todas** las funciones bajo `supabase/functions/`. Cobertura: `sync-visitas`, `sync-maestros`, `calcular-puntos`, `whatsapp-webhook`, `health`.
- `supabase/config.toml`: `verify_jwt = false` declarado por función (reemplaza los flags CLI `--no-verify-jwt`). Fuente: https://supabase.com/docs/guides/functions/auth
- `supabase/functions/health/index.ts`: endpoint para smoke tests (`select 1` con anon key — valida cadena anon→RLS).
- `setup-cli@v1` → `setup-cli@v2`.

**Acciones manuales pendientes (una vez):**
1. Verificar `gh secret list` incluye `SUPABASE_ACCESS_TOKEN` y `SUPABASE_PROJECT_REF`.
2. Aplicar migración 008 (`whatsapp-webhook`) desde local: `supabase db push --linked`.
3. Confirmar que Vercel tiene `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en Production env.

### CI/CD Fase 4 — Smoke tests + branch protection (código entregado en `feat/cicd-f3-f4`)

**Lo que ya está en código:**
- `playwright.config.ts` + `e2e/smoke.spec.ts` con tests `@smoke` (login + dashboard + abal-plus + kpis).
- `@playwright/test ^1.60.0` añadido a `devDependencies`.
- `.github/workflows/smoke.yml`: trigger `repository_dispatch` con tipo `vercel.deployment.success` (también `workflow_dispatch` manual). Sube `playwright-report` como artifact ante fallo.
- ESLint: `e2e/`, `playwright-report/`, `test-results/` excluidos.

**Acciones manuales pendientes (una vez):**
1. Crear usuario `e2e@abal.test` en Supabase + insertar en `public.perfiles` con `rol='gerente'`.
2. `gh secret set SUPABASE_E2E_USER_EMAIL` y `gh secret set SUPABASE_E2E_USER_PASSWORD`.
3. Deploy Hook en Vercel (Settings → Git → Deploy Hooks) → `https://api.github.com/repos/DiegoRivrod/CRM-Alimbalan/dispatches` con `{"event_type":"vercel.deployment.success","client_payload":{"url":"<deployment_url>","target":"production"}}`.
4. Branch protection en GitHub → Settings → Branches → `main`: require status checks `Lint`, `Type Check`, `Tests`, `DB Validate`, `Build`.

**Anti-patrones a NO introducir:**
- ❌ Vercel CLI deploy desde Actions (la integración Git nativa es lo recomendado por Vercel — KB 2026).
- ❌ `on: deployment_status` (deprecado).
- ❌ `SUPABASE_SERVICE_ROLE_KEY` en smoke tests (bypassa RLS, falsos positivos).
- ❌ Editar migraciones ya aplicadas (hash mismatch).

---

## Comandos útiles

```bash
npm run dev          # http://localhost:5178
npm run build
npm run typecheck
npm test             # Vitest (59 tests)
npm run test:watch
npm run lint
vercel --prod        # deploy manual (plugin Vercel desactivado por defecto)
```
