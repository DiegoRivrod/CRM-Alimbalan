import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Users, ShoppingBag, Eye, TrendingUp } from 'lucide-react'
import { useVendedores, useVendedorDetalle } from '@/hooks/useVendedores'

const formatSoles = (n: number) =>
  `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 0 })}`
const formatKg = (n: number) =>
  `${n.toLocaleString('es-PE')} kg`
const formatFecha = (s: string) =>
  new Date(s).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })

export default function VendedorDetallePage() {
  const { id }            = useParams<{ id: string }>()
  const [params]          = useSearchParams()
  const navigate          = useNavigate()
  const fuerza            = decodeURIComponent(id ?? '')
  const mes               = params.get('mes')  ?? undefined
  const anio              = params.get('anio') ? Number(params.get('anio')) : undefined

  const { vendedores, loading: loadingRes } = useVendedores(mes, anio)
  const resumen = vendedores.find(v => v.fuerza_de_venta === fuerza)

  const { topClientes, lineas, loading: loadingDet } = useVendedorDetalle(fuerza, mes, anio)

  const loading = loadingRes || loadingDet

  return (
    <div className="max-w-4xl space-y-6">
      <button onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Volver
      </button>

      {/* Header */}
      <div className="bg-white border border-border rounded-xl p-6">
        <h2 className="text-xl font-semibold">{fuerza}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {mes} {anio} · Fuerza de venta
        </p>
      </div>

      {/* KPIs */}
      {loading
        ? <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white border border-border rounded-xl p-4 animate-pulse">
                <div className="h-3 bg-muted rounded w-16 mb-2" />
                <div className="h-6 bg-muted rounded w-24" />
              </div>
            ))}
          </div>
        : resumen && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiCard icon={<TrendingUp className="w-4 h-4 text-blue-500"/>}
                label="Total ventas" value={formatSoles(resumen.total_ventas)} />
              <KpiCard icon={<ShoppingBag className="w-4 h-4 text-purple-500"/>}
                label="KG vendidos" value={formatKg(resumen.total_kg)} />
              <KpiCard icon={<Users className="w-4 h-4 text-green-500"/>}
                label="Clientes atendidos" value={String(resumen.clientes_atendidos)} />
              <KpiCard icon={<Eye className="w-4 h-4 text-orange-500"/>}
                label="Visitas realizadas" value={String(resumen.visitas_realizadas)} />
            </div>

            {/* Meta y cumplimiento */}
            {resumen.meta_total > 0 && (
              <div className="bg-white border border-border rounded-xl p-5">
                <div className="flex justify-between text-sm mb-3">
                  <span className="font-semibold">Cumplimiento de meta — {mes} {anio}</span>
                  <span className={`font-bold text-lg ${resumen.pct_cumplimiento >= 100 ? 'text-green-600' : resumen.pct_cumplimiento >= 70 ? 'text-yellow-600' : 'text-red-500'}`}>
                    {resumen.pct_cumplimiento}%
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${resumen.pct_cumplimiento >= 100 ? 'bg-green-500' : resumen.pct_cumplimiento >= 70 ? 'bg-yellow-400' : 'bg-red-400'}`}
                    style={{ width: `${Math.min(100, resumen.pct_cumplimiento)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
                  <span>{formatSoles(resumen.total_ventas)} vendido</span>
                  <span>Meta: {formatSoles(resumen.meta_total)}</span>
                </div>

                {/* Desglose por semana */}
                <div className="grid grid-cols-4 gap-2 mt-4">
                  {resumen.semanas.map(s => (
                    <div key={s.semana} className="bg-muted/30 rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground">{s.semana.replace('SEMANA ', 'S')}</p>
                      <p className="text-sm font-semibold mt-1">
                        {s.ventas > 0 ? `S/ ${(s.ventas / 1000).toFixed(0)}k` : '—'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )
      }

      {/* Top clientes */}
      <div className="bg-white border border-border rounded-xl p-5">
        <h3 className="font-semibold mb-4">Top 10 clientes</h3>
        {loading
          ? <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-muted animate-pulse rounded" />
            ))}</div>
          : topClientes.length === 0
            ? <p className="text-sm text-muted-foreground">Sin datos para este período.</p>
            : <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left pb-2 font-medium text-muted-foreground">#</th>
                    <th className="text-left pb-2 font-medium text-muted-foreground">Cliente</th>
                    <th className="text-right pb-2 font-medium text-muted-foreground">Ventas</th>
                    <th className="text-right pb-2 font-medium text-muted-foreground">KG</th>
                    <th className="text-right pb-2 font-medium text-muted-foreground hidden sm:table-cell">Última</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {topClientes.map((c, i) => (
                    <tr key={c.idcliente}
                      onClick={() => navigate(`/clientes/${c.idcliente}`)}
                      className="hover:bg-muted/20 cursor-pointer transition-colors">
                      <td className="py-2.5 pr-2 text-muted-foreground font-mono text-xs">{i + 1}</td>
                      <td className="py-2.5">
                        <p className="font-medium leading-tight">{c.nombre}</p>
                        <p className="text-xs text-muted-foreground">#{c.idcliente}</p>
                      </td>
                      <td className="py-2.5 text-right font-semibold">{formatSoles(c.total_ventas)}</td>
                      <td className="py-2.5 text-right text-muted-foreground">{formatKg(c.total_kg)}</td>
                      <td className="py-2.5 text-right text-muted-foreground hidden sm:table-cell">
                        {formatFecha(c.ultima_fecha)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
        }
      </div>

      {/* Líneas de producto */}
      {!loading && lineas.length > 0 && (
        <div className="bg-white border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-4">Ventas por línea de producto</h3>
          <div className="space-y-3">
            {lineas.map(l => {
              const maxVentas = lineas[0].total_ventas
              const pct = Math.round((l.total_ventas / maxVentas) * 100)
              return (
                <div key={l.lineas}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{l.lineas}</span>
                    <span className="text-muted-foreground">{formatSoles(l.total_ventas)}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="h-2 rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  )
}
