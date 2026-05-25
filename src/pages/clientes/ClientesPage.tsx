import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ChevronRight, TrendingUp, TrendingDown, Minus, Download } from 'lucide-react'
import { useClientes } from '@/hooks/useClientes'
import { useTiersClientes, TIER_CONFIG } from '@/hooks/useAbalPlus'
import { exportarClientes } from '@/lib/exportar'

const formatSoles = (n: number | null) =>
  n == null ? '—' : `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 0 })}`

const formatKg = (n: number | null) =>
  n == null ? '—' : `${n.toLocaleString('es-PE')} kg`

const formatFecha = (s: string | null) => {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
}

function diasDesde(fecha: string | null): number | null {
  if (!fecha) return null
  return Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000)
}

function BadgeStatus({ status }: { status: string | null }) {
  const activo = status?.toUpperCase() === 'ACTIVO'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
      activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
    }`}>
      {activo ? 'Activo' : (status ?? 'Sin estado')}
    </span>
  )
}

function InactividadBadge({ dias }: { dias: number | null }) {
  if (dias === null) return <span className="text-xs text-muted-foreground">Sin compras</span>
  if (dias <= 30)  return <span className="text-xs font-medium text-green-600 flex items-center gap-1"><TrendingUp className="w-3 h-3"/>Reciente</span>
  if (dias <= 60)  return <span className="text-xs font-medium text-yellow-600 flex items-center gap-1"><Minus className="w-3 h-3"/>+30 días</span>
  return <span className="text-xs font-medium text-red-500 flex items-center gap-1"><TrendingDown className="w-3 h-3"/>+{dias}d inactivo</span>
}

export default function ClientesPage() {
  const { clientes, loading, error } = useClientes()
  const { tiers } = useTiersClientes()
  const navigate = useNavigate()

  const [search,       setSearch]       = useState('')
  const [filterZona,   setFilterZona]   = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterSalud,  setFilterSalud]  = useState('')
  const [page,         setPage]         = useState(1)
  const PER_PAGE = 50

  const zonas = useMemo(() => [...new Set(clientes.map(c => c.zona).filter(Boolean))].sort(), [clientes])

  // Conteo por salud (para los badges del filtro)
  const conteoSalud = useMemo(() => {
    let alDia = 0, riesgo = 0, inactivo = 0, sinCompras = 0
    for (const c of clientes) {
      const d = diasDesde(c.ultima_fecha_factura)
      if (d === null)  sinCompras++
      else if (d <= 30) alDia++
      else if (d <= 60) riesgo++
      else              inactivo++
    }
    return { alDia, riesgo, inactivo, sinCompras }
  }, [clientes])

  const filtrados = useMemo(() => {
    const q = search.toLowerCase()
    return clientes.filter(c => {
      if (q && !c.nombre.toLowerCase().includes(q) && !c.idcliente.includes(q)) return false
      if (filterZona   && c.zona !== filterZona)                    return false
      if (filterStatus && c.status?.toUpperCase() !== filterStatus) return false
      if (filterSalud) {
        const d = diasDesde(c.ultima_fecha_factura)
        if (filterSalud === 'al_dia'    && !(d !== null && d <= 30))  return false
        if (filterSalud === 'riesgo'    && !(d !== null && d > 30 && d <= 60)) return false
        if (filterSalud === 'inactivo'  && !(d !== null && d > 60))   return false
        if (filterSalud === 'sin'       && d !== null)                return false
      }
      return true
    })
  }, [clientes, search, filterZona, filterStatus, filterSalud])

  const totalPages = Math.ceil(filtrados.length / PER_PAGE)
  const pagina     = filtrados.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  if (error) return <div className="text-red-500 text-sm">Error: {error}</div>

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Clientes</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading ? 'Cargando...' : `${filtrados.length.toLocaleString()} de ${clientes.length.toLocaleString()} clientes`}
          </p>
        </div>
        <button
          onClick={() => exportarClientes(filtrados)}
          disabled={loading || filtrados.length === 0}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors border border-border rounded-lg px-3 py-1.5"
        >
          <Download className="w-4 h-4" /> Excel
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar por nombre o ID..."
            className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <select
          value={filterZona}
          onChange={e => { setFilterZona(e.target.value); setPage(1) }}
          className="px-3 py-2 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Todas las zonas</option>
          {zonas.map(z => <option key={z!} value={z!}>{z}</option>)}
        </select>

        <select
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
          className="px-3 py-2 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Todos los estados</option>
          <option value="ACTIVO">Activo</option>
          <option value="INACTIVO">Inactivo</option>
        </select>
      </div>

      {/* Filtro de salud (semáforo) */}
      {!loading && (
        <div className="flex flex-wrap gap-2">
          {[
            { key: '',          label: 'Todos',         cls: 'border-border text-muted-foreground',                     count: clientes.length },
            { key: 'al_dia',    label: '● Al día',      cls: 'border-green-300 text-green-700 bg-green-50',             count: conteoSalud.alDia },
            { key: 'riesgo',    label: '● En riesgo',   cls: 'border-yellow-300 text-yellow-700 bg-yellow-50',          count: conteoSalud.riesgo },
            { key: 'inactivo',  label: '● Inactivo',    cls: 'border-red-300 text-red-600 bg-red-50',                   count: conteoSalud.inactivo },
            { key: 'sin',       label: '○ Sin compras', cls: 'border-gray-300 text-gray-500 bg-gray-50',                count: conteoSalud.sinCompras },
          ].map(({ key, label, cls, count }) => (
            <button
              key={key}
              onClick={() => { setFilterSalud(key); setPage(1) }}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors font-medium ${cls} ${
                filterSalud === key ? 'ring-2 ring-offset-1 ring-primary/40' : 'hover:opacity-80'
              }`}
            >
              {label} <span className="opacity-60 font-normal">({count})</span>
            </button>
          ))}
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cliente</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Zona</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Vendedor</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Última compra</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Valor</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">KG</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actividad</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">ABAL+</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 9 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-muted animate-pulse rounded w-24" />
                        </td>
                      ))}
                    </tr>
                  ))
                : pagina.map(c => {
                    const dias = diasDesde(c.ultima_fecha_factura)
                    return (
                      <tr
                        key={c.idcliente}
                        onClick={() => navigate(`/clientes/${c.idcliente}`)}
                        className="hover:bg-muted/20 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground leading-tight">{c.nombre}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                            <span>#{c.idcliente}</span>
                            <BadgeStatus status={c.status} />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{c.zona ?? '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs max-w-[140px] truncate">
                          {c.responsable ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{formatFecha(c.ultima_fecha_factura)}</td>
                        <td className="px-4 py-3 text-right font-medium">{formatSoles(c.ultimo_valor)}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{formatKg(c.ultimo_kg)}</td>
                        <td className="px-4 py-3"><InactividadBadge dias={dias} /></td>
                        <td className="px-4 py-3 text-center">
                          {(() => {
                            const t = tiers.get(c.idcliente)
                            if (!t) return <span className="text-xs text-muted-foreground">—</span>
                            const cfg = TIER_CONFIG[t.tier]
                            return (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg}`}>
                                {cfg.emoji} {cfg.label}
                              </span>
                            )
                          })()}
                        </td>
                        <td className="px-4 py-3">
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </td>
                      </tr>
                    )
                  })
              }
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-sm text-muted-foreground">
              Página {page} de {totalPages}
            </span>
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
      </div>
    </div>
  )
}
