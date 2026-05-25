# CRM Comercial — ALIMENTOS BALANCEADOS DEL PERU S.A.C.

> **Antes de hacer cambios significativos**: lee [HANDOFF.md](./HANDOFF.md) (retomada rápida) y solo después abre [PROGRESO_CRM.md](./PROGRESO_CRM.md) si necesitas detalle de schema/ETL/RLS.

## Optimización de tokens en sesión nueva

1. **Empezar siempre por** [HANDOFF.md](./HANDOFF.md) — ~170 líneas con estado actual + patrones.
2. **Solo abrir [PROGRESO_CRM.md](./PROGRESO_CRM.md)** si tocas: schema, joins, RLS, ETL, reglas de reasignación, prospectos.
3. **NO leas archivos >300 líneas completos** sin justificación. Usa:
   - `Grep` para localizar la función/sección exacta.
   - `Read` con `offset` y `limit` apuntando solo a las líneas necesarias.
4. **NO re-deduzcas patrones** — están listados abajo, solo aplícalos.
5. **NO reabras hooks ya migrados a TanStack Query** salvo que el cambio sea sobre ese hook.

## Mapa rápido del proyecto

| Necesitas tocar… | Ir a… |
|---|---|
| Routing / providers globales | [src/App.tsx](src/App.tsx) |
| Auth | [src/lib/auth.tsx](src/lib/auth.tsx), guard [src/components/layout/ProtectedRoute.tsx](src/components/layout/ProtectedRoute.tsx) |
| Cliente Supabase | [src/lib/supabase.ts](src/lib/supabase.ts) |
| Defaults TanStack Query | [src/lib/queryClient.ts](src/lib/queryClient.ts) |
| Tipos manuales (sin codegen) | [src/types/supabase.ts](src/types/supabase.ts) |
| Lógica ETL | [src/lib/etl.ts](src/lib/etl.ts) (+ tests) |
| Lógica ABAL+ (espejo del Edge Function) | [src/lib/abalPlus.ts](src/lib/abalPlus.ts) (+ tests) |
| Migraciones | [supabase/migrations/](supabase/migrations/) (001–008) |
| Edge Functions | [supabase/functions/](supabase/functions/) (sync-maestros, sync-visitas, calcular-puntos, whatsapp-webhook) |
| Tests RLS estructurales | [supabase/tests/rls.test.sql](supabase/tests/rls.test.sql) |
| CI/CD | [.github/workflows/ci.yml](.github/workflows/ci.yml), [deploy-production.yml](.github/workflows/deploy-production.yml) |

## Patrones obligatorios (úsalos sin re-deducir)

### Fetching → TanStack Query v5
```ts
import { useQuery } from '@tanstack/react-query'
const q = useQuery({
  queryKey: ['recurso', 'detalle', filtros],
  queryFn: async (): Promise<Tipo[]> => { /* ... */ },
})
return { items: q.data ?? [], loading: q.isLoading, recargar: () => q.refetch() }
```

### Mutaciones → invalidate
```ts
import { queryClient } from '@/lib/queryClient'
queryClient.invalidateQueries({ queryKey: ['recurso'] })
```

### Realtime → setQueryData (sin refetch)
```ts
queryClient.setQueryData<T[]>(key, prev => [nueva, ...(prev ?? [])])
```

### Optimistic update
```ts
queryClient.setQueryData<T[]>(key, prev => (prev ?? []).map(...))
await supabase.from('t').update(...)
```

### `q.data ?? []` rompe useMemo → estabilizar
```ts
const items = useMemo(() => q.data ?? [], [q.data])
```

### Supabase sin codegen
```ts
const rows = (data ?? []) as Array<MiTipo>             // SELECT
await supabase.from('x').update({...} as never)        // mutación
```

### RLS — INSERT siempre con `with check`
```sql
create policy "x_insert" on public.x for insert with check (usuario_id = auth.uid());
```

## Reglas críticas

- **Facturas inmutables**: nunca `DELETE`. Re-importar = `UPSERT` con `facturas_linea_unica`.
- **Commits sin `Co-Authored-By: Claude`** (regla global del usuario).
- **npm 403**: `npm install --strict-ssl false --registry https://registry.npmmirror.com`.
- **Responder siempre en español** y explicar el porqué.
- **Editor del usuario**: Cursor.

## Desarrollo

```bash
npm run dev          # http://localhost:5178 (puerto fijado en vite.config.ts)
npm run typecheck
npm test             # Vitest, 59 tests
npm run lint
```
