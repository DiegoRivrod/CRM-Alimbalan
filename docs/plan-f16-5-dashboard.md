# Plan F16.5 — Dashboard global `/abal-plus`

> **Estado al planear (2026-05-25):** lo que falta de F16.5. Los tier badges en `ClientesPage` y la card "Programa ABAL+" en `ClienteDetallePage` **ya están**. Este plan construye el dashboard global del programa.

## Resumen ejecutivo

Crear una página `/abal-plus` (rol gerente/supervisor) que muestre:
1. **Distribución actual del padrón** por tier (Bronce/Plata/Oro) con KPI cards + gráfica recharts.
2. **Ranking de clientes** por puntos rolling 12M con filtro por tier y búsqueda.
3. **Acción "Recalcular puntos"** que dispara la Edge Function `calcular-puntos` para el mes seleccionado.
4. **Export Excel** del ranking.
5. **Realtime**: invalidar cache cuando `tiers_clientes` cambia.

Stack: React + TanStack Query v5 + recharts 3.8.1 + Supabase + Tailwind. **Sin nueva migración** (schema `004_abal_plus.sql` ya tiene todo).

## Convenciones del plan

- Cada fase es ejecutable en **un chat nuevo**, autocontenida con referencias a archivos/líneas existentes.
- Prefijo `[COPY]` = copiar tal cual el snippet del archivo indicado, no inventar APIs.
- Prefijo `[VERIFY]` = paso de verificación obligatorio antes de cerrar la fase.
- Idioma de UI, copy, comentarios: español. Sin `Co-Authored-By: Claude` en commits.

---

## Phase 0 — Documentation Discovery (consolidado)

Esta fase ya se ejecutó. No re-investigues. Estos son los hechos verificados que las fases siguientes asumen:

### Schema ABAL+ (no tocar)

[supabase/migrations/004_abal_plus.sql](../supabase/migrations/004_abal_plus.sql)

- **`puntos_mensuales`** PK `id`, UNIQUE `(idcliente, anio, mes)`, columnas: `idcliente`, `anio`, `mes` ('ENERO'..'DICIEMBRE'), `pts_volumen`, `pts_valor`, `pts_diversificacion`, `pts_frecuencia`, `pts_bonus`, `total_puntos` (GENERATED), `sacos_total`, `valor_total`, `lineas_distintas`, `semanas_distintas`, `calculado_at`.
- **`tiers_clientes`** PK `idcliente`, columnas: `tier` ('bronce'|'plata'|'oro'), `puntos_12m`, `tier_anterior`, `tier_desde`, `actualizado_at`.
- **RLS** ya implementado: gerente/supervisor leen todo; vendedor solo sus clientes. No hace falta nueva policy.
- **NO existe VIEW** de resumen; todas las queries van a las tablas directamente.

### Tipos TS disponibles ([src/types/supabase.ts:281-306](../src/types/supabase.ts#L281-L306))

`Tier`, `PuntosMensuales`, `TierCliente`.

### Hooks y helpers existentes (NO duplicar)

- [src/hooks/useAbalPlus.ts](../src/hooks/useAbalPlus.ts): `useTiersClientes()` (Map<idcliente, TierCliente>), `useAbalPlusCliente(id)` (tier + 12 meses de puntos).
- [src/lib/abalPlus.ts](../src/lib/abalPlus.ts): `TIER_THRESHOLDS`, `TIER_CONFIG`, `tier()`, `nextTierInfo()`, `calcularPuntosCliente()`, `ultimos12Meses()`.
- [src/hooks/useClientes.ts](../src/hooks/useClientes.ts): `useClientes()` retorna lista con `idcliente`, `nombre`, `zona`, `responsable`, etc. (vista `clientes_ultima_factura`).

### Edge Function ([supabase/functions/calcular-puntos/index.ts](../supabase/functions/calcular-puntos/index.ts))

- **Payload:** `POST` opcional `{ "anio": 2026, "mes": "ABRIL" }`. Si se omite → mes anterior automáticamente.
- **Respuesta:** `{ ok, periodo, clientes_procesados, distribucion_tiers: {bronce, plata, oro} }`.
- **Efecto:** UPSERT en `puntos_mensuales` + recalcula rolling 12m + actualiza `tiers_clientes` (incl. `tier_desde` si cambia).

### Patrones a copiar (referencias)

| Necesidad | Archivo | Líneas |
|---|---|---|
| Header dashboard con selects mes/año | [src/pages/kpis/KpisPage.tsx](../src/pages/kpis/KpisPage.tsx) | 68–113 |
| KPI Card component | [src/pages/kpis/KpisPage.tsx](../src/pages/kpis/KpisPage.tsx) | 16–24 |
| Recharts `BarChart` con `ResponsiveContainer` | [src/pages/DashboardPage.tsx](../src/pages/DashboardPage.tsx) | 4–8 (imports) |
| Ruta protegida por rol | [src/App.tsx](../src/App.tsx) | 54–58 |
| Item de Sidebar con icono Lucide + roles | [src/components/layout/Sidebar.tsx](../src/components/layout/Sidebar.tsx) | 9–20 |
| Realtime con `setQueryData` / `invalidateQueries` | [src/hooks/useNotificaciones.ts](../src/hooks/useNotificaciones.ts) | 27–64 |
| Export Excel base + patrón existente | [src/lib/exportar.ts](../src/lib/exportar.ts) | 12–27 (base), 59–77 (clientes) |
| Hook con TanStack Query v5 | [src/hooks/useAbalPlus.ts](../src/hooks/useAbalPlus.ts) | 7–23 |

### Anti-patterns (NO hacer)

- ❌ NO crear nueva migración SQL — el schema está completo.
- ❌ NO duplicar `TIER_CONFIG` ni `nextTierInfo` — importar desde `@/hooks/useAbalPlus` o `@/lib/abalPlus`.
- ❌ NO usar `useEffect` + `useState` para fetch — todo va por TanStack Query v5 con `useQuery`.
- ❌ NO consultar `total_puntos` por SUM en cliente cuando ya hay `tiers_clientes.puntos_12m` precalculado.
- ❌ NO invocar la Edge Function vía `fetch(...)` manual — usar `supabase.functions.invoke('calcular-puntos', { body: {...} })`.
- ❌ NO mostrar la página a vendedores (rol `vendedor`). Roles permitidos: `gerente`, `supervisor`.

---

## Phase 1 — Hook + helper de exportación

**Objetivo:** crear `useAbalPlusDashboard` para alimentar la página, y `exportarTiersAbalPlus` para el botón Excel.

### Archivos a modificar

1. **[src/hooks/useAbalPlus.ts](../src/hooks/useAbalPlus.ts)** — agregar al final del archivo:

```ts
// ── useAbalPlusDashboard — vista agregada del padrón ABAL+ ──────────────────

export function useAbalPlusDashboard() {
  const q = useQuery({
    queryKey: ['abal-plus', 'dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tiers_clientes')
        .select('*')
        .order('puntos_12m', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as Array<TierCliente>
    },
  })

  return {
    tiers: q.data ?? [],
    loading: q.isLoading,
    error: q.error?.message ?? null,
    recargar: () => q.refetch(),
  }
}
```

Razonamiento: ya ordenado en DB, evita reordenar en cliente con 1000+ filas. Query key separada de `['abal-plus', 'tiers']` (la del Map) para no cruzar invalidaciones innecesarias.

2. **[src/lib/exportar.ts](../src/lib/exportar.ts)** — agregar al final:

```ts
import type { TierCliente } from '@/types/supabase'

export function exportarTiersAbalPlus(
  tiers: TierCliente[],
  clientesMap?: Map<string, string>, // idcliente → nombre
) {
  const filas = tiers.map(t => ({
    'ID Cliente':    t.idcliente,
    'Nombre':        clientesMap?.get(t.idcliente) ?? '—',
    'Tier Actual':   t.tier.toUpperCase(),
    'Puntos 12M':    t.puntos_12m,
    'Tier Anterior': t.tier_anterior?.toUpperCase() ?? '—',
    'Desde':         t.tier_desde ?? '—',
    'Actualizado':   new Date(t.actualizado_at).toLocaleDateString('es-PE'),
  }))
  const fecha = new Date().toISOString().split('T')[0]
  descargarExcel(`Tiers_ABAL_Plus_${fecha}`, filas)
}
```

### [VERIFY] Phase 1

```bash
npm run typecheck         # debe pasar sin errores nuevos
npm test                  # 59 tests siguen pasando (no se tocó lógica testeada)
```

Grep de verificación: confirma que NO duplicas `TIER_CONFIG`:

```bash
grep -rn "const TIER_CONFIG" src/   # solo debe aparecer en src/lib/abalPlus.ts
```

---

## Phase 2 — Página base `/abal-plus` con KPI cards de distribución

**Objetivo:** crear el archivo de la página con header, selects mes/año (decorativos en esta fase), KPI cards de conteo por tier.

### Crear archivo nuevo

**[src/pages/abal-plus/AbalPlusDashboard.tsx](../src/pages/abal-plus/AbalPlusDashboard.tsx)** (nuevo):

Estructura mínima:

```tsx
import { useMemo, useState } from 'react'
import { Download, Trophy } from 'lucide-react'
import { useAbalPlusDashboard, TIER_CONFIG } from '@/hooks/useAbalPlus'
import { useClientes } from '@/hooks/useClientes'
import { exportarTiersAbalPlus } from '@/lib/exportar'

const MESES_ES = [
  'ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO',
  'JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE',
] as const

export default function AbalPlusDashboard() {
  const { tiers, loading, error } = useAbalPlusDashboard()
  const { clientes } = useClientes()

  const ahora = new Date()
  const [mes,  setMes]  = useState<string>(MESES_ES[ahora.getMonth()])
  const [anio, setAnio] = useState<number>(ahora.getFullYear())

  const clientesMap = useMemo(
    () => new Map(clientes.map(c => [c.idcliente, c.nombre])),
    [clientes],
  )

  const conteo = useMemo(() => {
    const c = { bronce: 0, plata: 0, oro: 0 }
    for (const t of tiers) c[t.tier]++
    return c
  }, [tiers])

  const total = tiers.length || 1   // evita división por cero

  if (error) return <div className="text-red-500 text-sm">Error: {error}</div>

  return (
    <div className="space-y-4">
      {/* Header — patrón copiado de KpisPage.tsx:68-113 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-500" /> ABAL+ Tiers
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading ? 'Cargando…' : `${tiers.length.toLocaleString()} clientes en el programa`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select value={mes} onChange={e => setMes(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30">
            {MESES_ES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={anio} onChange={e => setAnio(Number(e.target.value))}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30">
            {[2024, 2025, 2026].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <button
            onClick={() => exportarTiersAbalPlus(tiers, clientesMap)}
            disabled={loading || tiers.length === 0}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-40 border border-border rounded-lg px-3 py-1.5"
          >
            <Download className="w-4 h-4" /> Excel
          </button>
        </div>
      </div>

      {/* KPI Cards — distribución por tier */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(['bronce','plata','oro'] as const).map(t => {
          const cfg = TIER_CONFIG[t]
          const n = conteo[t]
          const pct = Math.round((n / total) * 100)
          return (
            <div key={t} className="bg-white border border-border rounded-xl p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Tier {cfg.label}</p>
                <span className="text-2xl">{cfg.emoji}</span>
              </div>
              <p className="text-2xl font-semibold mt-1">{n.toLocaleString('es-PE')}</p>
              <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className={`h-full ${cfg.bar}`} style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{pct}% del padrón</p>
            </div>
          )
        })}
      </div>

      {/* Tabla ranking — placeholder, se completa en Phase 3 */}
      <div className="bg-white border border-border rounded-xl p-6 text-sm text-muted-foreground text-center">
        Ranking de clientes — pendiente Phase 3
      </div>
    </div>
  )
}
```

Razonamiento de detalles:

- `useClientes()` es necesario para mapear `idcliente → nombre` en el Excel. La query ya está en cache global, no agrega round-trip si el usuario llegó desde `/clientes`.
- Los selects mes/año aún no filtran nada en Phase 2; quedan listos para que Phase 4 los conecte al recálculo.
- `TIER_CONFIG[t].bar` ya tiene clases Tailwind precargadas (`bg-amber-400`, etc.), no inventes nuevas.

### [VERIFY] Phase 2

- `npm run typecheck` pasa.
- La página aún no está ruteada — Phase 5 hace eso. No intentes navegar todavía.
- Confirma con `grep` que no duplicaste `MESES_ES`:

```bash
grep -rn "ENERO.*FEBRERO.*MARZO" src/
# debe aparecer en src/lib/abalPlus.ts y src/pages/abal-plus/AbalPlusDashboard.tsx
# (NO importes el de abalPlus.ts porque ese tiene typing más estricto — está ok duplicar las 12 strings)
```

---

## Phase 3 — Tabla ranking + gráfica recharts

**Objetivo:** reemplazar el placeholder con tabla de ranking (paginada, filtrable por tier) + gráfica de barras.

### Modificar [src/pages/abal-plus/AbalPlusDashboard.tsx](../src/pages/abal-plus/AbalPlusDashboard.tsx)

1. **Agregar imports al inicio:**

```tsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useNavigate } from 'react-router-dom'
import { Search, ChevronRight } from 'lucide-react'
import { nextTierInfo } from '@/hooks/useAbalPlus'
```

Recharts ya está en package.json (v3.8.1, verificado). No instalar nada.

2. **Agregar estado de filtros + navegación dentro del componente:**

```tsx
const navigate = useNavigate()
const [filterTier, setFilterTier] = useState<'' | 'bronce' | 'plata' | 'oro'>('')
const [search,     setSearch]     = useState('')
const [page,       setPage]       = useState(1)
const PER_PAGE = 25
```

3. **Calcular `filtrados` y `pagina`:**

```tsx
const filtrados = useMemo(() => {
  const q = search.toLowerCase()
  return tiers.filter(t => {
    if (filterTier && t.tier !== filterTier) return false
    if (q) {
      const nombre = clientesMap.get(t.idcliente)?.toLowerCase() ?? ''
      if (!nombre.includes(q) && !t.idcliente.toLowerCase().includes(q)) return false
    }
    return true
  })
}, [tiers, clientesMap, filterTier, search])

const totalPages = Math.ceil(filtrados.length / PER_PAGE) || 1
const pagina     = filtrados.slice((page - 1) * PER_PAGE, page * PER_PAGE)
```

4. **Reemplazar el placeholder con dos bloques:**

```tsx
{/* Gráfica de distribución */}
<div className="bg-white border border-border rounded-xl p-4">
  <h3 className="text-sm font-semibold mb-3">Distribución del padrón</h3>
  <div className="h-48">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={[
        { tier: 'Bronce', n: conteo.bronce, fill: '#fbbf24' },
        { tier: 'Plata',  n: conteo.plata,  fill: '#94a3b8' },
        { tier: 'Oro',    n: conteo.oro,    fill: '#eab308' },
      ]}>
        <XAxis dataKey="tier" fontSize={12} />
        <YAxis fontSize={12} />
        <Tooltip />
        <Bar dataKey="n" radius={[6, 6, 0, 0]}>
          {[0,1,2].map(i => <Cell key={i} fill={['#fbbf24','#94a3b8','#eab308'][i]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
</div>

{/* Filtros del ranking */}
<div className="flex flex-wrap gap-2 items-center">
  <div className="relative flex-1 min-w-[200px]">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
    <input
      value={search}
      onChange={e => { setSearch(e.target.value); setPage(1) }}
      placeholder="Buscar por nombre o ID…"
      className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
    />
  </div>
  {(['', 'bronce', 'plata', 'oro'] as const).map(t => {
    const cfg = t ? TIER_CONFIG[t] : null
    const label = t ? `${cfg!.emoji} ${cfg!.label}` : 'Todos'
    const n = t ? conteo[t] : tiers.length
    return (
      <button
        key={t || 'todos'}
        onClick={() => { setFilterTier(t); setPage(1) }}
        className={`text-xs px-3 py-1.5 rounded-full border transition-colors font-medium ${
          filterTier === t ? 'ring-2 ring-offset-1 ring-primary/40' : 'hover:opacity-80'
        } ${t && cfg ? cfg.bg : 'border-border text-muted-foreground'}`}
      >
        {label} <span className="opacity-60 font-normal">({n})</span>
      </button>
    )
  })}
</div>

{/* Tabla ranking — patrón copiado de ClientesPage.tsx:166-258 */}
<div className="bg-white border border-border rounded-xl overflow-hidden">
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-muted/40 border-b border-border">
          <th className="text-left px-4 py-3 font-medium text-muted-foreground w-12">#</th>
          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cliente</th>
          <th className="text-center px-4 py-3 font-medium text-muted-foreground">Tier</th>
          <th className="text-right px-4 py-3 font-medium text-muted-foreground">Puntos 12M</th>
          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Próximo hito</th>
          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Desde</th>
          <th className="px-4 py-3"></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {pagina.map((t, idx) => {
          const cfg = TIER_CONFIG[t.tier]
          const info = nextTierInfo(t.tier, t.puntos_12m)
          const rank = (page - 1) * PER_PAGE + idx + 1
          return (
            <tr
              key={t.idcliente}
              onClick={() => navigate(`/clientes/${t.idcliente}`)}
              className="hover:bg-muted/20 cursor-pointer transition-colors"
            >
              <td className="px-4 py-3 text-muted-foreground">{rank}</td>
              <td className="px-4 py-3">
                <div className="font-medium">{clientesMap.get(t.idcliente) ?? '—'}</div>
                <div className="text-xs text-muted-foreground">#{t.idcliente}</div>
              </td>
              <td className="px-4 py-3 text-center">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg}`}>
                  {cfg.emoji} {cfg.label}
                </span>
              </td>
              <td className="px-4 py-3 text-right font-semibold">
                {t.puntos_12m.toLocaleString('es-PE')}
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground">
                {info
                  ? `Faltan ${info.faltan.toLocaleString('es-PE')} para ${TIER_CONFIG[info.next].label}`
                  : 'Tier máximo'}
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground">
                {t.tier_desde ? new Date(t.tier_desde).toLocaleDateString('es-PE') : '—'}
              </td>
              <td className="px-4 py-3"><ChevronRight className="w-4 h-4 text-muted-foreground" /></td>
            </tr>
          )
        })}
      </tbody>
    </table>
  </div>
  {!loading && totalPages > 1 && (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
      <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
      <div className="flex gap-2">
        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
          className="px-3 py-1 text-sm border border-border rounded-lg disabled:opacity-40 hover:bg-muted/20">Anterior</button>
        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
          className="px-3 py-1 text-sm border border-border rounded-lg disabled:opacity-40 hover:bg-muted/20">Siguiente</button>
      </div>
    </div>
  )}
</div>
```

Razonamiento clave:

- Filas son **clickeables hacia `/clientes/:id`** — la card "Programa ABAL+" ya existe ahí, no hay que duplicar UI.
- Paginación a 25 (no 50) porque la tabla tiene más columnas que `/clientes`.
- `nextTierInfo` ya está exportado desde el hook (línea 57 de useAbalPlus.ts). No re-implementar.
- Colores de barras del recharts son hex directos (#fbbf24 etc.) porque recharts no consume clases Tailwind; estos hex matchean los `bg-*-400` del config.

### [VERIFY] Phase 3

- `npm run typecheck` pasa.
- Levantar `npm run dev` y temporalmente apuntar el navegador al componente vía hot edit (o esperar a Phase 5). NO ejecutar verificación visual aún — espera a Phase 5.
- Confirma recharts no duplicado:

```bash
grep -rn "from 'recharts'" src/pages/abal-plus/   # solo en AbalPlusDashboard.tsx
```

---

## Phase 4 — Acción "Recalcular puntos" + Realtime

**Objetivo:** botón que dispara la Edge Function `calcular-puntos` para el mes/año seleccionado y suscripción Realtime a `tiers_clientes`.

### A) Botón "Recalcular puntos"

Agregar en [src/pages/abal-plus/AbalPlusDashboard.tsx](../src/pages/abal-plus/AbalPlusDashboard.tsx) en la sección del header (al lado del botón Excel):

```tsx
import { useMutation } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { supabase } from '@/lib/supabase'
import { RefreshCw } from 'lucide-react'
```

Dentro del componente, antes del `return`:

```tsx
const recalcular = useMutation({
  mutationFn: async () => {
    const { data, error } = await supabase.functions.invoke('calcular-puntos', {
      body: { anio, mes },
    })
    if (error) throw new Error(error.message)
    return data as { ok: boolean; clientes_procesados: number; distribucion_tiers: { bronce: number; plata: number; oro: number } }
  },
  onSuccess: (data) => {
    queryClient.invalidateQueries({ queryKey: ['abal-plus'] })
    alert(`Recalculado para ${mes} ${anio} — ${data.clientes_procesados} clientes procesados.`)
  },
  onError: (err) => {
    alert(`Error al recalcular: ${err.message}`)
  },
})
```

Botón en el header (antes del Excel):

```tsx
<button
  onClick={() => recalcular.mutate()}
  disabled={recalcular.isPending}
  className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 rounded-lg px-3 py-1.5"
>
  <RefreshCw className={`w-4 h-4 ${recalcular.isPending ? 'animate-spin' : ''}`} />
  {recalcular.isPending ? 'Recalculando…' : `Recalcular ${mes} ${anio}`}
</button>
```

Razonamiento:

- `supabase.functions.invoke` es el método oficial del SDK — NO uses `fetch` directo a la URL de la function.
- Invalida `['abal-plus']` con la query key padre — invalida `dashboard` y `tiers` y `cliente:*` de una vez.
- `alert()` es feo pero el proyecto no tiene un sistema de toast común — confirma con el usuario en ejecución si vale la pena meter `sonner`/equivalente. Por ahora `alert` mantiene scope acotado.

### B) Realtime para `tiers_clientes`

Crear un nuevo hook utilitario en [src/hooks/useAbalPlus.ts](../src/hooks/useAbalPlus.ts):

```ts
import { useEffect } from 'react'
import { queryClient } from '@/lib/queryClient'

// ── useAbalPlusRealtime — invalida cache cuando tiers_clientes cambia ───────
export function useAbalPlusRealtime() {
  useEffect(() => {
    let cancelado = false
    const setup = async () => {
      if (cancelado) return
      const channel = supabase
        .channel('tiers-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tiers_clientes' }, () => {
          queryClient.invalidateQueries({ queryKey: ['abal-plus'] })
        })
        .subscribe()
      return () => { supabase.removeChannel(channel) }
    }
    let cleanup: (() => void) | undefined
    setup().then(fn => { cleanup = fn })
    return () => { cancelado = true; cleanup?.() }
  }, [])
}
```

Y en `AbalPlusDashboard.tsx` agregar:

```tsx
import { useAbalPlusRealtime } from '@/hooks/useAbalPlus'

// dentro del componente:
useAbalPlusRealtime()
```

Razonamiento: el patrón sigue exactamente [useNotificaciones.ts:27-64](../src/hooks/useNotificaciones.ts#L27-L64). Usamos `invalidateQueries` en vez de `setQueryData` porque el evento es `*` y el dashboard agrega múltiples queries — más simple invalidar que parchar.

### [VERIFY] Phase 4

- `npm run typecheck` pasa.
- Para probar el recálculo necesitas Supabase corriendo con la Edge Function deployada. Si todavía no está deployada, verifica solo que el botón llama a `invoke` y maneja error 404 sin romper la UI.

```bash
grep -rn "functions.invoke" src/pages/abal-plus/   # debe aparecer 1 vez
```

---

## Phase 5 — Ruta + Sidebar + verificación final

**Objetivo:** exponer la página en la app y verificar end-to-end.

### A) Ruta en [src/App.tsx](../src/App.tsx)

1. Agregar import (cerca del resto de imports de páginas):

```tsx
import AbalPlusDashboard from '@/pages/abal-plus/AbalPlusDashboard'
```

2. Agregar ruta después de la de `/kpis` (línea 58), antes de `/importar`:

```tsx
<Route path="/abal-plus" element={
  <ProtectedRoute roles={['gerente', 'supervisor']}>
    <AbalPlusDashboard />
  </ProtectedRoute>
} />
```

### B) Item de menú en [src/components/layout/Sidebar.tsx](../src/components/layout/Sidebar.tsx)

1. Agregar `Trophy` al import de `lucide-react` (línea 4).
2. Agregar item al array `navItems` (entre `/kpis` e `/importar`):

```ts
{ to: '/abal-plus', label: 'ABAL+',    icon: Trophy, roles: ['gerente', 'supervisor'] },
```

### C) Verificación funcional end-to-end

```bash
# Mata cualquier vite previo
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

npm run typecheck
npm run lint
npm test
npm run dev
```

Abre http://localhost:5178, login como gerente/supervisor:

| Verificación | Esperado |
|---|---|
| `/abal-plus` aparece en sidebar | ✅ con icono trofeo |
| Click → renderiza la página | ✅ sin errores en consola |
| 3 KPI cards muestran conteos | ✅ suman al total de clientes en programa |
| Gráfica de barras se ve | ✅ 3 barras con colores distintos |
| Búsqueda por nombre filtra | ✅ y resetea paginación |
| Filtro por tier filtra | ✅ y suma del conteo en chips = total |
| Click en fila → `/clientes/:id` | ✅ navega correctamente |
| Botón Excel descarga `Tiers_ABAL_Plus_YYYY-MM-DD.xlsx` | ✅ con nombres resueltos |
| Login como vendedor → menú no muestra "ABAL+" | ✅ + acceso directo a URL redirige a `/dashboard` |

Verificación SQL (post-recálculo manual si deployaste la Edge Function):

```sql
select tier, count(*), avg(puntos_12m)::int as avg_puntos
from tiers_clientes
group by tier
order by tier;
```

Debe matchear los KPI cards del dashboard.

### [VERIFY] Phase 5 (final)

- ✅ Todos los tests siguen verdes (no se tocaron archivos testeados salvo agregar exports).
- ✅ Lint limpio.
- ✅ Acceso por rol funciona (vendedor bloqueado, gerente/supervisor pasa).
- ✅ Realtime: abre dos pestañas, ejecuta `update tiers_clientes set tier = 'oro' where idcliente = '<x>'` desde Supabase SQL editor; ambas pestañas deben re-renderizar sin recargar.

### Commit final

```bash
git add src/hooks/useAbalPlus.ts src/lib/exportar.ts src/pages/abal-plus/ src/App.tsx src/components/layout/Sidebar.tsx docs/plan-f16-5-dashboard.md
git commit -m "feat(abal+): F16.5 dashboard /abal-plus con ranking, gráfica y trigger de recálculo"
```

Sin `Co-Authored-By: Claude` (regla global del usuario).

---

## Recordatorio de gaps de la investigación (Phase 0)

Lo que NO planificamos aquí porque sale del scope F16.5:

- **Cron del Edge Function** — la migración 004 lo tiene comentado. Si se quiere ejecución automática mensual, descomentar `cron.schedule(...)` en una migración nueva (010). Conversación pendiente con el usuario sobre `service_role` headers para el cron.
- **Tier badge en `ProspectoDetallePage`** — los prospectos aún no tienen facturas, por definición no entran al programa. NO planificar.
- **Notificaciones cuando un cliente sube de tier** — F16.6 potencial; usa `notificaciones` (migración 006) + el `tier_anterior !== tier` ya guardado.
- **Histórico de cambios de tier** — actualmente solo guardamos `tier_anterior` (1 nivel atrás). Si se quiere histórico completo, necesita tabla nueva `tiers_historial`. NO planificar aquí.

---

## Checklist de archivos tocados

```
[NUEVO]   src/pages/abal-plus/AbalPlusDashboard.tsx
[MODIF]   src/hooks/useAbalPlus.ts          (+ useAbalPlusDashboard, useAbalPlusRealtime)
[MODIF]   src/lib/exportar.ts                (+ exportarTiersAbalPlus)
[MODIF]   src/App.tsx                        (+ ruta /abal-plus)
[MODIF]   src/components/layout/Sidebar.tsx  (+ item ABAL+, + Trophy)
[NUEVO]   docs/plan-f16-5-dashboard.md       (este archivo)
```

Sin migraciones SQL nuevas. Sin nuevas dependencias npm.
