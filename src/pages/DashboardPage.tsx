import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatSoles = (n: number) =>
  `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 0 })}`

const SEMANAS = ['SEMANA 1', 'SEMANA 2', 'SEMANA 3', 'SEMANA 4']
const SEMANAS_SHORT = ['S1', 'S2', 'S3', 'S4']

const MESES_ES = [
  'ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO',
  'JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE',
]

function mesAnterior(mes: string, anio: number): { mes: string; anio: number } {
  const idx = MESES_ES.indexOf(mes)
  if (idx === 0) return { mes: MESES_ES[11], anio: anio - 1 }
  return { mes: MESES_ES[idx - 1], anio }
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface FacturaRow {
  semana: string | null
  valortotal: number
  idcliente: string
  nombre: string
}

interface KpiCards {
  clientesActivos: number | null
  ventasMes: number | null
  prospectosMes: number | null
  actividadMes: number | null
}

interface MetaRow {
  meta_soles: number | null
}

// ── Tooltip personalizado ─────────────────────────────────────────────────────

function TooltipSoles({ active, payload, label }: {
  active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-border rounded-lg p-3 shadow-sm text-sm">
      <p className="font-medium mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {formatSoles(p.value)}
        </p>
      ))}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function DashboardPage() {
  const { profile } = useAuth()

  const ahora      = new Date()
  const mesActual  = MESES_ES[ahora.getMonth()]
  const anioActual = ahora.getFullYear()
  const { mes: mesAnt, anio: anioAnt } = mesAnterior(mesActual, anioActual)
  const iniciomes  = new Date(anioActual, ahora.getMonth(), 1).toISOString()

  const [kpis, setKpis] = useState<KpiCards>({
    clientesActivos: null, ventasMes: null, prospectosMes: null, actividadMes: null,
  })
  const [factActual, setFactActual] = useState<FacturaRow[]>([])
  const [factAnterior, setFactAnterior] = useState<FacturaRow[]>([])
  const [metaSoles, setMetaSoles] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const cargar = async () => {
      const [clientesRes, prospectosMesRes, actividadRes, factActualRes, factAnteriorRes, metasRes] =
        await Promise.all([
          supabase.from('clientes').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVO'),
          supabase.from('prospectos').select('*', { count: 'exact', head: true }).in('estado', ['nuevo', 'seguimiento']),
          supabase.from('actividad').select('*', { count: 'exact', head: true }).gte('created_at', iniciomes),
          supabase.from('facturas').select('semana,valortotal,idcliente,nombre').eq('mes', mesActual).eq('anio', anioActual),
          supabase.from('facturas').select('semana,valortotal,idcliente,nombre').eq('mes', mesAnt).eq('anio', anioAnt),
          supabase.from('metas').select('meta_soles').eq('mes', mesActual).eq('anio', anioActual),
        ])

      const rowsActual   = (factActualRes.data ?? []) as FacturaRow[]
      const rowsAnterior = (factAnteriorRes.data ?? []) as FacturaRow[]
      const totalVentas  = rowsActual.reduce((s, f) => s + (f.valortotal ?? 0), 0)

      setKpis({
        clientesActivos: clientesRes.count ?? 0,
        ventasMes:       totalVentas,
        prospectosMes:   prospectosMesRes.count ?? 0,
        actividadMes:    actividadRes.count ?? 0,
      })
      // Meta total del mes (suma de todas las metas de vendedores)
      const metaTotal = ((metasRes.data ?? []) as MetaRow[])
        .reduce((s, m) => s + (m.meta_soles ?? 0), 0)

      setFactActual(rowsActual)
      setFactAnterior(rowsAnterior)
      setMetaSoles(metaTotal > 0 ? metaTotal : null)
      setLoading(false)
    }
    cargar()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Datos para gráfica de barras (S1-S4 mes actual) ───────────────────────
  const dataSemanas = useMemo(() => {
    const agg: Record<string, number> = {}
    for (const s of SEMANAS) agg[s] = 0
    for (const f of factActual) {
      if (f.semana && agg[f.semana] !== undefined) agg[f.semana] += f.valortotal ?? 0
    }
    return SEMANAS.map((s, i) => ({ semana: SEMANAS_SHORT[i], ventas: Math.round(agg[s]) }))
  }, [factActual])

  // ── Datos para comparativa (mes actual vs anterior) ───────────────────────
  const dataComparativa = useMemo(() => {
    const aggAct: Record<string, number> = {}
    const aggAnt: Record<string, number> = {}
    for (const s of SEMANAS) { aggAct[s] = 0; aggAnt[s] = 0 }
    for (const f of factActual)   if (f.semana && aggAct[f.semana] !== undefined) aggAct[f.semana] += f.valortotal ?? 0
    for (const f of factAnterior) if (f.semana && aggAnt[f.semana] !== undefined) aggAnt[f.semana] += f.valortotal ?? 0
    return SEMANAS.map((s, i) => ({
      semana:   SEMANAS_SHORT[i],
      actual:   Math.round(aggAct[s]),
      anterior: Math.round(aggAnt[s]),
    }))
  }, [factActual, factAnterior])

  // ── Forecasting al cierre del mes ─────────────────────────────────────────
  const forecast = useMemo(() => {
    const diasTotalesMes = new Date(anioActual, ahora.getMonth() + 1, 0).getDate()
    const diaActual = ahora.getDate()
    const ventasAcum = factActual.reduce((s, f) => s + (f.valortotal ?? 0), 0)
    if (diaActual === 0) return null
    const proyeccion = Math.round((ventasAcum / diaActual) * diasTotalesMes)
    const pctMes = Math.round((diaActual / diasTotalesMes) * 100)
    const pctMeta = metaSoles && metaSoles > 0 ? Math.round((proyeccion / metaSoles) * 100) : null
    const pctAvanceMeta = metaSoles && metaSoles > 0 ? Math.round((ventasAcum / metaSoles) * 100) : null
    return { proyeccion, pctMes, pctMeta, pctAvanceMeta, diasTotalesMes, diaActual, ventasAcum }
  }, [factActual, metaSoles, ahora, anioActual])

  // ── Top 5 clientes del mes ────────────────────────────────────────────────
  const top5 = useMemo(() => {
    const agg: Record<string, { nombre: string; total: number }> = {}
    for (const f of factActual) {
      if (!agg[f.idcliente]) agg[f.idcliente] = { nombre: f.nombre, total: 0 }
      agg[f.idcliente].total += f.valortotal ?? 0
    }
    return Object.entries(agg)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5)
      .map(([id, { nombre, total }]) => ({ id, nombre, total: Math.round(total) }))
  }, [factActual])

  // ── KPI cards ─────────────────────────────────────────────────────────────
  const cards = [
    { label: 'Clientes activos',    value: kpis.clientesActivos !== null ? String(kpis.clientesActivos) : '—' },
    { label: `Ventas ${mesActual.slice(0, 3).toLowerCase()}.`, value: kpis.ventasMes !== null ? formatSoles(kpis.ventasMes) : '—' },
    { label: 'Prospectos abiertos', value: kpis.prospectosMes  !== null ? String(kpis.prospectosMes)  : '—' },
    { label: 'Actividad del mes',   value: kpis.actividadMes   !== null ? String(kpis.actividadMes)   : '—' },
  ]

  const skeletonCard = <div className="h-24 bg-muted animate-pulse rounded-xl" />

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-1">Dashboard</h2>
        <p className="text-muted-foreground text-sm">
          Bienvenido, {profile?.nombre} · <span className="capitalize">{profile?.rol}</span>
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <div key={i}>{skeletonCard}</div>)
          : cards.map(({ label, value }) => (
              <div key={label} className="bg-white rounded-xl border border-border p-5">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-2xl font-semibold mt-1">{value}</p>
              </div>
            ))
        }
      </div>

      {/* Widget de Forecasting */}
      {!loading && forecast && (
        <div className="bg-white border border-border rounded-xl p-5">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h3 className="text-sm font-semibold">Proyección al cierre — {mesActual}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Día {forecast.diaActual} de {forecast.diasTotalesMes} ({forecast.pctMes}% del mes transcurrido)
              </p>
            </div>
            {forecast.pctMeta !== null && (
              <span className={`flex items-center gap-1 text-sm font-semibold px-3 py-1 rounded-full
                ${forecast.pctMeta >= 100 ? 'bg-green-100 text-green-700' :
                  forecast.pctMeta >= 80  ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-600'}`}>
                {forecast.pctMeta >= 100
                  ? <TrendingUp className="w-4 h-4" />
                  : forecast.pctMeta >= 80
                    ? <Minus className="w-4 h-4" />
                    : <TrendingDown className="w-4 h-4" />}
                {forecast.pctMeta}% de la meta
              </span>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Acumulado actual</p>
              <p className="text-xl font-semibold">{formatSoles(forecast.ventasAcum)}</p>
              {forecast.pctAvanceMeta !== null && (
                <p className="text-xs text-muted-foreground mt-0.5">{forecast.pctAvanceMeta}% de la meta</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Proyección al cierre</p>
              <p className="text-xl font-semibold text-blue-600">{formatSoles(forecast.proyeccion)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">a ritmo actual</p>
            </div>
            {metaSoles && (
              <div>
                <p className="text-xs text-muted-foreground">Meta del mes</p>
                <p className="text-xl font-semibold">{formatSoles(metaSoles)}</p>
                <p className={`text-xs mt-0.5 font-medium ${
                  forecast.proyeccion >= metaSoles ? 'text-green-600' : 'text-red-500'
                }`}>
                  {forecast.proyeccion >= metaSoles
                    ? `+${formatSoles(forecast.proyeccion - metaSoles)} sobre meta`
                    : `−${formatSoles(metaSoles - forecast.proyeccion)} bajo meta`}
                </p>
              </div>
            )}
          </div>

          {/* Barra de progreso */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Avance del mes</span>
              <span>{forecast.pctMes}%</span>
            </div>
            <div className="relative h-2 bg-muted rounded-full overflow-hidden">
              {/* Barra de ventas acumuladas */}
              <div
                className="absolute inset-y-0 left-0 bg-blue-500 rounded-full transition-all"
                style={{ width: `${Math.min(forecast.pctAvanceMeta ?? forecast.pctMes, 100)}%` }}
              />
              {/* Marcador del día actual en el mes */}
              <div
                className="absolute inset-y-0 w-0.5 bg-gray-400"
                style={{ left: `${forecast.pctMes}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Gráficas */}
      <div className="grid lg:grid-cols-2 gap-6">

        {/* Barras: ventas por semana mes actual */}
        <div className="bg-white border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-1">Ventas por semana — {mesActual}</h3>
          <p className="text-xs text-muted-foreground mb-4">Valor total facturado por semana</p>
          {loading
            ? <div className="h-48 bg-muted animate-pulse rounded-lg" />
            : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dataSemanas} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="semana" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} width={42} />
                  <Tooltip content={<TooltipSoles />} />
                  <Bar dataKey="ventas" name="Ventas" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </div>

        {/* Líneas: comparativa mes actual vs anterior */}
        <div className="bg-white border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-1">Comparativa semana a semana</h3>
          <p className="text-xs text-muted-foreground mb-4">
            <span className="text-blue-600 font-medium">{mesActual}</span> vs{' '}
            <span className="text-gray-400 font-medium">{mesAnt}</span>
          </p>
          {loading
            ? <div className="h-48 bg-muted animate-pulse rounded-lg" />
            : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={dataComparativa} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="semana" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} width={42} />
                  <Tooltip content={<TooltipSoles />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="actual"   name={mesActual} stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="anterior" name={mesAnt}    stroke="#94a3b8" strokeWidth={2} dot={{ r: 4 }} strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
            )
          }
        </div>
      </div>

      {/* Top 5 clientes del mes */}
      <div className="bg-white border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold mb-4">Top 5 clientes — {mesActual}</h3>
        {loading
          ? <div className="h-32 bg-muted animate-pulse rounded-lg" />
          : top5.length === 0
            ? <p className="text-sm text-muted-foreground">Sin datos para el mes actual.</p>
            : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left pb-2 font-medium text-muted-foreground">#</th>
                    <th className="text-left pb-2 font-medium text-muted-foreground">Cliente</th>
                    <th className="text-right pb-2 font-medium text-muted-foreground">Total</th>
                    <th className="text-right pb-2 font-medium text-muted-foreground w-32">Participación</th>
                  </tr>
                </thead>
                <tbody>
                  {top5.map(({ id, nombre, total }, i) => {
                    const maxTotal = top5[0].total
                    const pct = maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 0
                    return (
                      <tr key={id} className="border-b border-border/40 last:border-0">
                        <td className="py-2.5 pr-3 text-muted-foreground font-medium">{i + 1}</td>
                        <td className="py-2.5">
                          <p className="font-medium truncate max-w-[260px]">{nombre}</p>
                          <p className="text-xs text-muted-foreground">#{id}</p>
                        </td>
                        <td className="py-2.5 text-right font-semibold">{formatSoles(total)}</td>
                        <td className="py-2.5 pl-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-muted rounded-full h-1.5">
                              <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )
        }
      </div>
    </div>
  )
}
