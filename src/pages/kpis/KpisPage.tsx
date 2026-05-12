import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, TrendingDown, TrendingUp, Download } from 'lucide-react'
import { useVendedores } from '@/hooks/useVendedores'
import { useKpisExtras } from '@/hooks/useKpis'
import { exportarKpisVendedores, exportarClientesInactivos } from '@/lib/exportar'

const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
               'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']

const DIAS_INACTIVO_OPTS = [30, 60, 90, 120]

const formatSoles = (n: number) =>
  `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 0 })}`

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-border rounded-xl p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold mt-1">{value}</p>
      {sub ? <p className="text-xs text-muted-foreground mt-1">{sub}</p> : null}
    </div>
  )
}

function BarraMeta({ pct }: { pct: number }) {
  const color = pct >= 100 ? 'bg-green-500' : pct >= 70 ? 'bg-yellow-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 bg-muted rounded-full h-2">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="text-xs font-semibold w-10 text-right">{pct}%</span>
    </div>
  )
}

export default function KpisPage() {
  const anioActual = new Date().getFullYear()
  const mesActual = MESES[new Date().getMonth()]

  const [mes, setMes] = useState(mesActual)
  const [anio, setAnio] = useState(anioActual)
  const [diasInactivos, setDiasInactivos] = useState(60)

  const { vendedores, loading: loadingV, error: errV } = useVendedores(mes, anio)
  const {
    clientesInactivos,
    prospectosAbiertos,
    semanaStats,
    loading: loadingK,
    error: errK,
  } = useKpisExtras(mes, anio, diasInactivos)

  const loading = loadingV || loadingK
  const error = errV || errK

  const totalVentas = vendedores.reduce((s, v) => s + v.total_ventas, 0)
  const totalMeta = vendedores.reduce((s, v) => s + v.meta_total, 0)
  const pctGeneral = totalMeta > 0 ? Math.round((totalVentas / totalMeta) * 100) : 0

  const maxSemanaVentas = Math.max(1, ...(semanaStats?.porSemana.map((s) => s.ventas) ?? [1]))

  if (error) return <div className="text-red-500 text-sm">Error: {error}</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">KPIs</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Resumen operativo — mismo período que ventas por vendedor
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {MESES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <select
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value))}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {[2024, 2025, 2026].map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Inactivos</span>
            <select
              value={diasInactivos}
              onChange={(e) => setDiasInactivos(Number(e.target.value))}
              className="px-2 py-2 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {DIAS_INACTIVO_OPTS.map((d) => (
                <option key={d} value={d}>
                  {`> ${d} d`}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Cumplimiento global" value={`${pctGeneral}%`} sub={totalMeta ? `${formatSoles(totalVentas)} / ${formatSoles(totalMeta)}` : 'Sin meta consolidada'} />
        <KpiCard
          label="Clientes inactivos"
          value={String(clientesInactivos.length)}
          sub={`Sin compra efectiva > ${diasInactivos} días (según tu rol)`}
        />
        <KpiCard
          label="Prospectos abiertos"
          value={String(prospectosAbiertos)}
          sub="Estados nuevo + seguimiento"
        />
        <KpiCard
          label="Fuerzas de venta"
          value={String(vendedores.length)}
          sub="Con ventas en el período"
        />
      </div>

      {semanaStats && (
        <div className="bg-white border border-border rounded-xl p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div>
              <h3 className="font-semibold text-sm">Ventas por semana del mes</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Misma agrupación SEMANA 1–4 que el ETL de facturas
              </p>
            </div>
            {semanaStats.esMesSeleccionadoIgualCalendario && semanaStats.semanaCalendario ? (
              <div className="text-sm rounded-lg bg-muted/50 px-3 py-2 shrink-0">
                <span className="text-muted-foreground">{semanaStats.semanaCalendario}</span>
                <span className="mx-2">vs</span>
                <span className="text-muted-foreground">
                  {semanaStats.semanaAnterior ?? '—'}
                </span>
                <span className="ml-2 font-semibold tabular-nums">
                  {formatSoles(semanaStats.ventasSemanaCalendario)}
                </span>
                <span className="text-muted-foreground mx-1">/</span>
                <span className="tabular-nums">{formatSoles(semanaStats.ventasSemanaAnterior)}</span>
                {semanaStats.pctCambioSemanal != null && (
                  <span
                    className={`ml-2 inline-flex items-center gap-0.5 font-medium ${
                      semanaStats.pctCambioSemanal >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {semanaStats.pctCambioSemanal >= 0 ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                    {semanaStats.pctCambioSemanal > 0 ? '+' : ''}
                    {semanaStats.pctCambioSemanal}%
                  </span>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Selecciona el mes y año calendario actual para ver comparativa semana contra semana anterior en el mes.
              </p>
            )}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {semanaStats.porSemana.map((s) => (
              <div key={s.label} className="space-y-1">
                <p className="text-[10px] uppercase text-muted-foreground truncate">{s.label}</p>
                <div className="h-24 flex items-end rounded-md bg-muted/40 overflow-hidden px-1 pb-1">
                  <div
                    className="w-full bg-primary/80 rounded-sm transition-all min-h-[4px]"
                    style={{ height: `${(s.ventas / maxSemanaVentas) * 100}%` }}
                  />
                </div>
                <p className="text-xs font-medium tabular-nums">{formatSoles(s.ventas)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2 flex-wrap">
          <h3 className="font-semibold text-sm">Cumplimiento por fuerza de venta</h3>
          <div className="flex items-center gap-3">
            <button
              onClick={() => exportarKpisVendedores(vendedores, mes, anio)}
              disabled={loading || vendedores.length === 0}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Excel
            </button>
            <Link
              to="/vendedores"
              className="text-xs text-primary flex items-center gap-0.5 hover:underline"
            >
              Ver módulo <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Fuerza de venta</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Ventas</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Meta</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground min-w-[140px]">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 4 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-muted animate-pulse rounded w-full max-w-[120px]" />
                        </td>
                      ))}
                    </tr>
                  ))
                : vendedores.map((v) => (
                    <tr key={v.fuerza_de_venta} className="hover:bg-muted/10">
                      <td className="px-4 py-2 font-medium">{v.fuerza_de_venta}</td>
                      <td className="px-4 py-2 text-right">{formatSoles(v.total_ventas)}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground">
                        {v.meta_total > 0 ? formatSoles(v.meta_total) : '—'}
                      </td>
                      <td className="px-4 py-2">
                        {v.meta_total > 0 ? (
                          <BarraMeta pct={v.pct_cumplimiento} />
                        ) : (
                          <span className="text-xs text-muted-foreground">Sin meta</span>
                        )}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-semibold text-sm">Clientes inactivos</h3>
            <p className="text-xs text-muted-foreground">
              Vista `clientes_ultima_factura` — último doc válido con más de {diasInactivos} días o sin historial
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => exportarClientesInactivos(clientesInactivos, diasInactivos)}
              disabled={loading || clientesInactivos.length === 0}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Excel
            </button>
            <Link
              to="/prospectos"
              className="text-xs text-primary flex items-center gap-0.5 hover:underline"
            >
              Prospectos <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur">
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Cliente</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Responsable</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Última compra</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Días</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground text-sm">
                    Cargando…
                  </td>
                </tr>
              ) : clientesInactivos.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground text-sm">
                    Ningún cliente supera el umbral en tu alcance.
                  </td>
                </tr>
              ) : (
                clientesInactivos.map((c) => (
                  <tr key={c.idcliente} className="hover:bg-muted/10">
                    <td className="px-4 py-2">
                      <Link
                        to={`/clientes/${encodeURIComponent(c.idcliente)}`}
                        className="hover:text-primary hover:underline"
                      >
                        {c.nombre}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">{c.responsable ?? '—'}</td>
                    <td className="px-4 py-2 text-right text-xs">
                      {c.ultima_fecha_factura ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {c.dias_sin_compra != null ? c.dias_sin_compra : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
