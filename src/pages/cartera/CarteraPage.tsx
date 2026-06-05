import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Filter, Users, TrendingDown, AlertTriangle, Star } from 'lucide-react'
import { useRFM, SEGMENTO_CONFIG, type SegmentoRFM } from '@/hooks/useRFM'
import { useAuth } from '@/lib/auth'

const SEGMENTOS_ORDEN: SegmentoRFM[] = ['champion', 'leal', 'potencial', 'nuevo', 'riesgo', 'inactivo', 'dormido']

const fmtSoles = (n: number) =>
  `S/ ${n.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`

const fmtDias = (n: number) =>
  n === 1 ? '1 día' : `${n} días`

export default function CarteraPage() {
  const { isAdmin, isSupervisor } = useAuth()
  const [filtroFuerza, setFiltroFuerza]   = useState('')
  const [filtroSegmento, setFiltroSegmento] = useState<SegmentoRFM | 'todos'>('todos')
  const [busqueda, setBusqueda]           = useState('')

  const { clientes, loading, error } = useRFM(filtroFuerza || undefined)

  // Lista única de fuerzas
  const fuerzas = useMemo(
    () => [...new Set(clientes.map(c => c.fuerza_de_venta).filter(Boolean) as string[])].sort(),
    [clientes]
  )

  // Conteo por segmento para las tarjetas resumen
  const conteoSegmentos = useMemo(() => {
    const m: Partial<Record<SegmentoRFM, number>> = {}
    for (const c of clientes) m[c.segmento] = (m[c.segmento] ?? 0) + 1
    return m
  }, [clientes])

  // Clientes filtrados
  const clientesFiltrados = useMemo(() => {
    let r = clientes
    if (filtroSegmento !== 'todos') r = r.filter(c => c.segmento === filtroSegmento)
    if (busqueda) {
      const q = busqueda.toLowerCase()
      r = r.filter(c => c.nombre.toLowerCase().includes(q))
    }
    return r
  }, [clientes, filtroSegmento, busqueda])

  if (error) return <div className="text-red-500 text-sm">Error: {error}</div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold">Análisis de cartera</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Segmentación RFM — Recencia · Frecuencia · Monto (últimos 12 meses)
        </p>
      </div>

      {/* Tarjetas resumen por segmento */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          {SEGMENTOS_ORDEN.map(seg => {
            const cfg   = SEGMENTO_CONFIG[seg]
            const count = conteoSegmentos[seg] ?? 0
            const activo = filtroSegmento === seg
            return (
              <button
                key={seg}
                onClick={() => setFiltroSegmento(activo ? 'todos' : seg)}
                className={`rounded-xl border p-3 text-left transition-all
                  ${activo
                    ? `${cfg.bg} border-current ring-1 ring-current ${cfg.color}`
                    : 'bg-white border-border hover:border-primary/30'}`}
              >
                <p className={`text-xl font-bold ${activo ? cfg.color : 'text-foreground'}`}>
                  {count}
                </p>
                <p className={`text-xs font-medium mt-0.5 ${activo ? cfg.color : 'text-foreground'}`}>
                  {cfg.label}
                </p>
                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 line-clamp-2">
                  {cfg.descripcion}
                </p>
              </button>
            )
          })}
        </div>
      )}

      {/* Alertas rápidas */}
      {!loading && (
        <div className="flex flex-wrap gap-3">
          {(conteoSegmentos['riesgo'] ?? 0) > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span><b>{conteoSegmentos['riesgo']}</b> clientes en riesgo de churn</span>
            </div>
          )}
          {(conteoSegmentos['dormido'] ?? 0) > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              <TrendingDown className="w-4 h-4" />
              <span><b>{conteoSegmentos['dormido']}</b> clientes dormidos (+180 días sin compra)</span>
            </div>
          )}
          {(conteoSegmentos['champion'] ?? 0) > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
              <Star className="w-4 h-4" />
              <span><b>{conteoSegmentos['champion']}</b> clientes campeones — priorizar atención</span>
            </div>
          )}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Buscar cliente…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary w-full max-w-xs"
          />
        </div>
        {(isAdmin || isSupervisor) && fuerzas.length > 0 && (
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={filtroFuerza}
              onChange={e => setFiltroFuerza(e.target.value)}
              className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Todos los vendedores</option>
              {fuerzas.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto">
          <Users className="w-3.5 h-3.5" />
          {clientesFiltrados.length} de {clientes.length} clientes
        </div>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : clientesFiltrados.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          Sin clientes para los filtros seleccionados
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Cliente</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Vendedor</th>
                  <th className="text-center px-3 py-2.5 font-medium text-muted-foreground">Segmento</th>
                  <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Monto 12m</th>
                  <th className="text-center px-3 py-2.5 font-medium text-muted-foreground">Frecuencia</th>
                  <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Inactividad</th>
                  <th className="text-center px-3 py-2.5 font-medium text-muted-foreground">R·F·M</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {clientesFiltrados.map(c => {
                  const cfg = SEGMENTO_CONFIG[c.segmento]
                  return (
                    <tr key={c.idcliente} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5">
                        <Link
                          to={`/clientes/${c.idcliente}`}
                          className="font-medium hover:text-primary hover:underline truncate block max-w-[200px]"
                        >
                          {c.nombre}
                        </Link>
                        {c.zona && (
                          <span className="text-xs text-muted-foreground">{c.zona}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {c.fuerza_de_venta ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium">
                        {fmtSoles(c.monto_12m)}
                      </td>
                      <td className="px-3 py-2.5 text-center text-muted-foreground">
                        {c.frecuencia}m
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className={c.dias_inactividad > 90 ? 'text-red-600 font-medium' : c.dias_inactividad > 45 ? 'text-amber-600' : 'text-muted-foreground'}>
                          {fmtDias(c.dias_inactividad)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="font-mono text-xs text-muted-foreground">
                          {c.r_score}·{c.f_score}·{c.m_score}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
