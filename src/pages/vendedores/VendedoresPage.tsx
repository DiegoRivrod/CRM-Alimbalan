import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useVendedores } from '@/hooks/useVendedores'

const MESES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO',
               'JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE']

const formatSoles = (n: number) =>
  `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 0 })}`

function BarraMeta({ pct }: { pct: number }) {
  const color = pct >= 100 ? 'bg-green-500' : pct >= 70 ? 'bg-yellow-400' : 'bg-red-400'
  const Icon  = pct >= 100 ? TrendingUp : pct >= 70 ? Minus : TrendingDown
  const text  = pct >= 100 ? 'text-green-600' : pct >= 70 ? 'text-yellow-600' : 'text-red-500'
  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <div className="flex-1 bg-muted rounded-full h-2">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className={`text-xs font-semibold flex items-center gap-0.5 w-14 ${text}`}>
        <Icon className="w-3 h-3" />{pct}%
      </span>
    </div>
  )
}

function KpiCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-white border border-border rounded-xl p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-semibold mt-1 ${highlight ? 'text-green-600' : ''}`}>{value}</p>
    </div>
  )
}

export default function VendedoresPage() {
  const anioActual = new Date().getFullYear()
  const mesActual  = MESES[new Date().getMonth()]

  const [mes,  setMes]  = useState(mesActual)
  const [anio, setAnio] = useState(anioActual)

  const { vendedores, loading, error } = useVendedores(mes, anio)
  const navigate = useNavigate()

  const totalVentas = vendedores.reduce((s, v) => s + v.total_ventas, 0)
  const totalMeta   = vendedores.reduce((s, v) => s + v.meta_total,   0)
  const pctGeneral  = totalMeta > 0 ? Math.round((totalVentas / totalMeta) * 100) : 0

  if (error) return <div className="text-red-500 text-sm">Error: {error}</div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Vendedores</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Performance por fuerza de venta</p>
        </div>
        <div className="flex gap-2">
          <select value={mes} onChange={e => setMes(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30">
            {MESES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={anio} onChange={e => setAnio(Number(e.target.value))}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30">
            {[2024, 2025, 2026].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total vendido"    value={formatSoles(totalVentas)} />
        <KpiCard label="Meta total"       value={formatSoles(totalMeta)} />
        <KpiCard label="Cumplimiento"     value={`${pctGeneral}%`} highlight={pctGeneral >= 100} />
        <KpiCard label="Fuerzas de venta" value={String(vendedores.length)} />
      </div>

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">#</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fuerza de venta</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Ventas</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Meta</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground min-w-[180px]">Cumplimiento</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Clientes</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Visitas</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>{Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-muted animate-pulse rounded w-20" />
                      </td>
                    ))}</tr>
                  ))
                : vendedores.map((v, i) => (
                    <tr key={v.fuerza_de_venta}
                      onClick={() => navigate(`/vendedores/${encodeURIComponent(v.fuerza_de_venta)}?mes=${mes}&anio=${anio}`)}
                      className="hover:bg-muted/20 cursor-pointer transition-colors">
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{i + 1}</td>
                      <td className="px-4 py-3 font-medium">{v.fuerza_de_venta}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatSoles(v.total_ventas)}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {v.meta_total > 0 ? formatSoles(v.meta_total) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {v.meta_total > 0
                          ? <BarraMeta pct={v.pct_cumplimiento} />
                          : <span className="text-xs text-muted-foreground">Sin meta</span>}
                      </td>
                      <td className="px-4 py-3 text-right">{v.clientes_atendidos}</td>
                      <td className="px-4 py-3 text-right">{v.visitas_realizadas}</td>
                      <td className="px-4 py-3">
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
