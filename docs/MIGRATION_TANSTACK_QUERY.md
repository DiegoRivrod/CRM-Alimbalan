# Migración a TanStack Query — Plan

**Estado:** Propuesta — no instalado aún.
**Por qué:** El benchmarking (informe QC 2026-05-21) identificó TanStack Query como
estándar 2026 para CRMs React. Reduce código ~30%, da cache compartido, invalidación
selectiva y optimistic updates. Atomic CRM, Refine y la mayoría del ecosistema lo usan.

## Paso 1 — Instalar

```bash
npm install @tanstack/react-query
# Si npm 403:
npm install @tanstack/react-query --strict-ssl false --registry https://registry.npmmirror.com
```

Opcional (devtools en desarrollo):
```bash
npm install -D @tanstack/react-query-devtools
```

## Paso 2 — Crear el cliente

Crear [`src/lib/queryClient.ts`](../src/lib/queryClient.ts):

```ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,        // 1 min — los datos son "frescos" 60s
      gcTime: 5 * 60_000,       // 5 min en cache antes de descartar
      retry: 1,                 // reintentar 1 vez en error
      refetchOnWindowFocus: false,
    },
  },
})
```

## Paso 3 — Envolver `App.tsx`

```tsx
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'

// ...
<ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <BrowserRouter>
        {/* … */}
      </BrowserRouter>
    </AuthProvider>
  </QueryClientProvider>
</ErrorBoundary>
```

## Paso 4 — Migrar un hook (POC: `useClientes`)

**Antes** (40 líneas de useState/useEffect):

```ts
export function useClientes() {
  const [clientes, setClientes] = useState<ClienteResumen[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('clientes_ultima_factura')
        .select('*')
        .order('nombre', { ascending: true })

      if (error) setError(error.message)
      else setClientes((data ?? []) as ClienteResumen[])
      setLoading(false)
    }
    load()
  }, [])

  return { clientes, loading, error }
}
```

**Después** (10 líneas, con cache + invalidación):

```ts
import { useQuery } from '@tanstack/react-query'

export function useClientes() {
  const q = useQuery({
    queryKey: ['clientes', 'resumen'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes_ultima_factura')
        .select('*')
        .order('nombre', { ascending: true })
      if (error) throw new Error(error.message)
      return (data ?? []) as ClienteResumen[]
    },
  })
  return { clientes: q.data ?? [], loading: q.isLoading, error: q.error?.message ?? null }
}
```

Devuelve la misma API pública, así que `ClientesPage.tsx` no cambia.

## Paso 5 — Convención de `queryKey`

Para invalidación selectiva al hacer mutaciones, usar claves jerárquicas:

| Datos | queryKey |
|-------|----------|
| Lista clientes | `['clientes', 'resumen']` |
| Cliente detalle | `['clientes', 'detalle', idcliente]` |
| Facturas cliente | `['facturas', 'cliente', idcliente]` |
| Prospectos por estado | `['prospectos', 'lista', { estado, zona }]` |
| Tiers ABAL+ | `['abal-plus', 'tiers']` |
| Actividad cliente | `['actividad', 'cliente', idcliente]` |

Invalidar al insertar actividad:
```ts
queryClient.invalidateQueries({ queryKey: ['actividad', 'cliente', idcliente] })
```

## Paso 6 — Hooks a migrar (en orden de impacto)

| Hook | Líneas | Prioridad | Notas |
|------|--------|-----------|-------|
| `useClientes` | 90 | Alta | POC, ya descrito arriba |
| `useProspectos` | 280 | Alta | Hot path; gana mucho con cache |
| `useVendedores` | ~150 | Alta | KPI heavy, beneficio claro |
| `useKpis` | ~100 | Media | Mismas fuentes que useVendedores |
| `useAbalPlus` | 72 | Media | Lectura masiva en lista de clientes |
| `useActividad` | 158 | Media | 3 sub-hooks, invalidación cross-cutting |
| `useTareas` | ~250 | Media | Mutaciones con notificaciones |
| `useImportar` | ? | Baja | One-shot, no se beneficia tanto |

## Riesgos / cosas a vigilar

- **No mezclar useState local con queryKey.** Si una página ya hace filtros client-side
  sobre `clientes`, sigue funcionando — pero NO reescribas el filtro como nuevo `useQuery`
  con la misma key porque dispara doble fetch.
- **Mutaciones que tocan varios queries.** Crear actividad invalida
  `['actividad', 'prospecto', id]` y `['actividad', 'cliente', id]` y `['actividad', 'global']`.
  Documentar bien en cada hook.
- **`as never` y los tipos manuales.** Siguen iguales. TanStack Query no requiere codegen.

## Verificación

Después de migrar cada hook:
1. `npm run typecheck`
2. `npm test`
3. Abrir la página correspondiente en dev y verificar:
   - Carga inicial OK
   - Filtros locales OK
   - Si hay mutación: el dato refresca sin recargar manualmente

## Devtools en dev

Si instalaste el paquete opcional:

```tsx
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

<QueryClientProvider client={queryClient}>
  {/* … */}
  {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
</QueryClientProvider>
```
