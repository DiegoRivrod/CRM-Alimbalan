import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { Download, Trophy, Search, ChevronRight, RefreshCw } from 'lucide-react'
import {
  useAbalPlusDashboard,
  useAbalPlusRealtime,
  TIER_CONFIG,
  nextTierInfo,
} from '@/hooks/useAbalPlus'
import { useClientes } from '@/hooks/useClientes'
import { exportarTiersAbalPlus } from '@/lib/exportar'
import { queryClient } from '@/lib/queryClient'
import { supabase } from '@/lib/supabase'

const MESES_ES = [
  'ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO',
  'JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE',
] as const

const TIER_COLORS = { bronce: '#fbbf24', plata: '#94a3b8', oro: '#eab308' } as const

interface RecalcResponse {
  ok: boolean
  periodo: { anio: number; mes: string }
  clientes_procesados: number
  distribucion_tiers: { bronce: number; plata: number; oro: number }
}

export default function AbalPlusDashboard() {
  const { tiers, loading, error } = useAbalPlusDashboard()
  const { clientes } = useClientes()
  const navigate = useNavigate()
  useAbalPlusRealtime()

  const ahora = new Date()
  const [mes,        setMes]        = useState<string>(MESES_ES[ahora.getMonth()])
  const [anio,       setAnio]       = useState<number>(ahora.getFullYear())
  const [filterTier, setFilterTier] = useState<'' | 'bronce' | 'plata' | 'oro'>('')
  const [search,     setSearch]     = useState('')
  const [page,       setPage]       = useState(1)
  const PER_PAGE = 25

  const clientesMap = useMemo(
    () => new Map(clientes.map(c => [c.idcliente, c.nombre])),
    [clientes],
  )

  const conteo = useMemo(() => {
    const c = { bronce: 0, plata: 0, oro: 0 }
    for (const t of tiers) c[t.tier]++
    return c
  }, [tiers])

  const total = tiers.length || 1

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

  const totalPages = Math.max(1, Math.ceil(filtrados.length / PER_PAGE))
  const pagina     = filtrados.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const recalcular = useMutation({
    mutationFn: async (): Promise<RecalcResponse> => {
      const { data, error } = await supabase.functions.invoke('calcular-puntos', {
        body: { anio, mes },
      })
      if (error) throw new Error(error.message)
      return data as RecalcResponse
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['abal-plus'] })
      alert(
        `Recalculado para ${mes} ${anio} — ${data.clientes_procesados} clientes procesados.\n` +
        `Distribución: Bronce ${data.distribucion_tiers.bronce} · ` +
        `Plata ${data.distribucion_tiers.plata} · ` +
        `Oro ${data.distribucion_tiers.oro}`
      )
    },
    onError: (err: Error) => {
      alert(`Error al recalcular: ${err.message}`)
    },
  })

  if (error) return <div className="text-red-500 text-sm">Error: {error}</div>

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-500" /> ABAL+ Tiers
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading ? 'Cargando…' : `${tiers.length.toLocaleString('es-PE')} clientes en el programa`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={mes}
            onChange={e => setMes(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {MESES_ES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select
            value={anio}
            onChange={e => setAnio(Number(e.target.value))}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {[2024, 2025, 2026].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <button
            onClick={() => recalcular.mutate()}
            disabled={recalcular.isPending}
            className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 rounded-lg px-3 py-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${recalcular.isPending ? 'animate-spin' : ''}`} />
            {recalcular.isPending ? 'Recalculando…' : `Recalcular ${mes} ${anio}`}
          </button>
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

      {/* Gráfica de distribución */}
      <div className="bg-white border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-3">Distribución del padrón</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={[
              { tier: 'Bronce', n: conteo.bronce },
              { tier: 'Plata',  n: conteo.plata  },
              { tier: 'Oro',    n: conteo.oro    },
            ]}>
              <XAxis dataKey="tier" fontSize={12} />
              <YAxis fontSize={12} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="n" radius={[6, 6, 0, 0]}>
                <Cell fill={TIER_COLORS.bronce} />
                <Cell fill={TIER_COLORS.plata} />
                <Cell fill={TIER_COLORS.oro} />
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
          const label = t && cfg ? `${cfg.emoji} ${cfg.label}` : 'Todos'
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

      {/* Tabla ranking */}
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
              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-muted animate-pulse rounded w-24" />
                        </td>
                      ))}
                    </tr>
                  ))
                : pagina.map((t, idx) => {
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
                        <td className="px-4 py-3">
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </td>
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
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm border border-border rounded-lg disabled:opacity-40 hover:bg-muted/20 transition-colors"
              >Anterior</button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 text-sm border border-border rounded-lg disabled:opacity-40 hover:bg-muted/20 transition-colors"
              >Siguiente</button>
            </div>
          </div>
        )}

        {!loading && filtrados.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            No hay clientes que coincidan con los filtros.
          </div>
        )}
      </div>
    </div>
  )
}
