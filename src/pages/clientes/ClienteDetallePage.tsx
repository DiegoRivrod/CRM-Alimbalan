import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ShoppingBag, Eye, MapPin, Phone, Building2, Tag, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useClienteDetalle } from '@/hooks/useClientes'
import ActividadTimeline from '@/components/actividad/ActividadTimeline'

function diasDesde(fecha: string | null): number | null {
  if (!fecha) return null
  return Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000)
}

function SaludBadge({ ultimaFecha }: { ultimaFecha: string | null }) {
  const dias = diasDesde(ultimaFecha)
  if (dias === null)
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Sin compras</span>
  if (dias <= 30)
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700"><TrendingUp className="w-3 h-3"/>Al día · hace {dias}d</span>
  if (dias <= 60)
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700"><Minus className="w-3 h-3"/>En riesgo · hace {dias}d</span>
  return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-600"><TrendingDown className="w-3 h-3"/>Inactivo · hace {dias}d</span>
}

const formatSoles = (n: number | null) =>
  n == null ? '—' : `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 0 })}`
const formatKg = (n: number | null) =>
  n == null ? '—' : `${n.toLocaleString('es-PE')} kg`
const formatFecha = (s: string | null) => {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
}
const formatDateTime = (s: string | null) => {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

type TimelineItem =
  | { type: 'factura'; fecha: string; data: import('@/hooks/useClientes').FacturaTimeline }
  | { type: 'visita';  fecha: string; data: import('@/hooks/useClientes').VisitaTimeline  }

export default function ClienteDetallePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { cliente, facturas, visitas, loading } = useClienteDetalle(id ?? '')

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse max-w-4xl">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-32 bg-muted rounded-xl" />
        <div className="h-64 bg-muted rounded-xl" />
      </div>
    )
  }

  if (!cliente) return (
    <div className="text-muted-foreground text-sm">Cliente no encontrado.</div>
  )

  // Construir timeline unificado ordenado por fecha desc
  const timeline: TimelineItem[] = [
    ...facturas.map(f => ({ type: 'factura' as const, fecha: f.fecha, data: f })),
    ...visitas.map(v => ({ type: 'visita'  as const, fecha: v.marca_temporal, data: v })),
  ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())

  // Totales del mes visible
  const totalVentas = facturas.reduce((s, f) => s + (f.valortotal ?? 0), 0)
  const totalKg     = facturas.reduce((s, f) => s + (f.pesokgrtot ?? 0), 0)
  const metaTotal   = (cliente.meta_semana_1 ?? 0) + (cliente.meta_semana_2 ?? 0) +
                      (cliente.meta_semana_3 ?? 0) + (cliente.meta_semana_4 ?? 0)
  const pctMeta     = metaTotal > 0 ? Math.round((totalVentas / metaTotal) * 100) : null

  return (
    <div className="max-w-4xl space-y-6">
      {/* Back */}
      <button
        onClick={() => navigate('/clientes')}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Volver a clientes
      </button>

      {/* Header del cliente */}
      <div className="bg-white border border-border rounded-xl p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-semibold">{cliente.nombre}</h2>
            <p className="text-sm text-muted-foreground mt-1">#{cliente.idcliente}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <SaludBadge ultimaFecha={facturas[0]?.fecha ?? null} />
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              cliente.status?.toUpperCase() === 'ACTIVO'
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-500'
            }`}>
              {cliente.status ?? 'Sin estado'}
            </span>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
          <InfoRow icon={<Building2 className="w-4 h-4"/>} label="Fuerza de venta" value={cliente.responsable} />
          <InfoRow icon={<MapPin className="w-4 h-4"/>}    label="Zona" value={cliente.zona} />
          <InfoRow icon={<MapPin className="w-4 h-4"/>}    label="Ubicación"
            value={[cliente.departamento, cliente.provincia, cliente.distrito].filter(Boolean).join(' › ')} />
          <InfoRow icon={<Tag className="w-4 h-4"/>}       label="Canal" value={cliente.canal_cluster} />
          <InfoRow icon={<Tag className="w-4 h-4"/>}       label="Lista precios" value={cliente.lista_precios} />
          <InfoRow icon={<Phone className="w-4 h-4"/>}     label="TOP" value={cliente.top} />
        </div>
      </div>

      {/* KPIs del cliente */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Facturas" value={String(facturas.length)} />
        <KpiCard label="Total vendido" value={formatSoles(totalVentas)} />
        <KpiCard label="Total kg" value={formatKg(totalKg)} />
        <KpiCard label="Visitas" value={String(visitas.length)} />
      </div>

      {/* Barra de meta si aplica */}
      {pctMeta !== null && (
        <div className="bg-white border border-border rounded-xl p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium">Cumplimiento de meta</span>
            <span className="font-semibold">{pctMeta}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${pctMeta >= 100 ? 'bg-green-500' : pctMeta >= 70 ? 'bg-yellow-400' : 'bg-red-400'}`}
              style={{ width: `${Math.min(100, pctMeta)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>{formatSoles(totalVentas)} vendido</span>
            <span>Meta: {formatSoles(metaTotal)}</span>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="bg-white border border-border rounded-xl p-6">
        <h3 className="font-semibold mb-5">
          Timeline — {timeline.length} eventos
        </h3>

        {timeline.length === 0 && (
          <p className="text-sm text-muted-foreground">Sin actividad registrada.</p>
        )}

        <ol className="relative border-l border-border ml-3 space-y-6">
          {timeline.map((item, i) => (
            <li key={i} className="ml-6">
              <span className={`absolute -left-3 flex items-center justify-center w-6 h-6 rounded-full ring-4 ring-white ${
                item.type === 'factura' ? 'bg-blue-100' : 'bg-green-100'
              }`}>
                {item.type === 'factura'
                  ? <ShoppingBag className="w-3 h-3 text-blue-600" />
                  : <Eye className="w-3 h-3 text-green-600" />
                }
              </span>

              {item.type === 'factura' ? (
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">Factura</span>
                    <span className="text-xs text-muted-foreground">{formatFecha(item.fecha)}</span>
                    <span className="text-xs text-muted-foreground font-mono">{item.data.docventa}</span>
                  </div>
                  <p className="text-sm font-medium mt-1">{item.data.desarticul ?? '—'}</p>
                  <div className="flex gap-4 text-xs text-muted-foreground mt-0.5">
                    <span>{item.data.lineas}</span>
                    <span>{formatSoles(item.data.valortotal)}</span>
                    <span>{formatKg(item.data.pesokgrtot)}</span>
                    <span>{item.data.semana} · {item.data.mes} {item.data.anio}</span>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium bg-green-50 text-green-700 px-2 py-0.5 rounded-full">Visita</span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(item.fecha)}</span>
                    {item.data.es_cliente_nuevo && (
                      <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">Cliente nuevo</span>
                    )}
                  </div>
                  <p className="text-sm font-medium mt-1">{item.data.fuerza_de_venta}</p>
                  <div className="flex gap-4 text-xs text-muted-foreground mt-0.5 flex-wrap">
                    {item.data.especie    && <span>Especie: {item.data.especie}</span>}
                    {item.data.tipo_cliente && <span>{item.data.tipo_cliente}</span>}
                    {item.data.potencial_consumo_tn && <span>Potencial: {item.data.potencial_consumo_tn} TN</span>}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>

      {/* Timeline de actividad */}
      <ActividadTimeline idcliente={id} />
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-muted-foreground shrink-0">{icon}</span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value || '—'}</p>
      </div>
    </div>
  )
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-border rounded-xl p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold mt-1">{value}</p>
    </div>
  )
}
