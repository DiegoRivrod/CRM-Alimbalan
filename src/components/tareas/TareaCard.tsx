import { Phone, MapPin, CalendarClock, Banknote, Briefcase, Clock, CheckCircle2, User } from 'lucide-react'
import type { TareaConNombres } from '@/hooks/useTareas'

const TIPO_CONFIG: Record<string, { label: string; icon: React.ElementType; badge: string }> = {
  llamada:      { label: 'Llamada',      icon: Phone,         badge: 'bg-blue-50 text-blue-700' },
  visita:       { label: 'Visita',       icon: MapPin,        badge: 'bg-green-50 text-green-700' },
  seguimiento:  { label: 'Seguimiento',  icon: CalendarClock, badge: 'bg-orange-50 text-orange-700' },
  cobranza:     { label: 'Cobranza',     icon: Banknote,      badge: 'bg-purple-50 text-purple-700' },
  general:      { label: 'General',      icon: Briefcase,     badge: 'bg-gray-100 text-gray-600' },
}

const PRIORIDAD_CONFIG: Record<string, { label: string; badge: string }> = {
  baja:    { label: 'Baja',    badge: 'bg-gray-100 text-gray-500' },
  media:   { label: 'Media',   badge: 'bg-blue-50 text-blue-600' },
  alta:    { label: 'Alta',    badge: 'bg-orange-50 text-orange-600' },
  urgente: { label: 'Urgente', badge: 'bg-red-100 text-red-700' },
}

function esVencida(tarea: TareaConNombres): boolean {
  if (!tarea.fecha_vencimiento) return false
  if (tarea.estado === 'completada' || tarea.estado === 'cancelada') return false
  return new Date(tarea.fecha_vencimiento) < new Date(new Date().toDateString())
}

function formatFechaCorta(fecha: string) {
  return new Date(fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
}

interface Props {
  tarea: TareaConNombres
  onCompletar?: (id: string) => void
  onClick?: () => void
}

export default function TareaCard({ tarea, onCompletar, onClick }: Props) {
  const tipoCfg = TIPO_CONFIG[tarea.tipo] ?? TIPO_CONFIG.general
  const prioCfg = PRIORIDAD_CONFIG[tarea.prioridad] ?? PRIORIDAD_CONFIG.media
  const TipoIcon = tipoCfg.icon
  const vencida = esVencida(tarea)

  return (
    <div
      onClick={onClick}
      className={`bg-white border rounded-xl p-4 space-y-2 transition-colors
        ${vencida ? 'border-red-300 bg-red-50/30' : 'border-border'}
        ${onClick ? 'cursor-pointer hover:shadow-sm' : ''}`}
    >
      {/* Header: titulo + badges */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className={`font-medium text-sm ${tarea.estado === 'completada' ? 'line-through text-muted-foreground' : ''}`}>
            {tarea.titulo}
          </p>
          {tarea.descripcion && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{tarea.descripcion}</p>
          )}
        </div>
        {tarea.estado !== 'completada' && tarea.estado !== 'cancelada' && onCompletar && (
          <button
            onClick={e => { e.stopPropagation(); onCompletar(tarea.id) }}
            title="Completar tarea"
            className="shrink-0 p-1 rounded-md hover:bg-green-100 text-muted-foreground hover:text-green-600 transition-colors"
          >
            <CheckCircle2 className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Badges */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${tipoCfg.badge}`}>
          <TipoIcon className="w-3 h-3" /> {tipoCfg.label}
        </span>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${prioCfg.badge}`}>
          {prioCfg.label}
        </span>
        {tarea.estado === 'en_progreso' && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
            En progreso
          </span>
        )}
        {tarea.estado === 'completada' && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-600">
            Completada
          </span>
        )}
        {tarea.estado === 'cancelada' && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
            Cancelada
          </span>
        )}
      </div>

      {/* Footer: asignado, fecha */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <User className="w-3 h-3" />
          {tarea.asignado_nombre}
        </span>
        {tarea.fecha_vencimiento && (
          <span className={`flex items-center gap-1 ${vencida ? 'text-red-600 font-medium' : ''}`}>
            <Clock className="w-3 h-3" />
            {vencida ? 'Vencida ' : ''}{formatFechaCorta(tarea.fecha_vencimiento)}
          </span>
        )}
        {(tarea.prospecto_nombre || tarea.cliente_nombre) && (
          <span className="truncate max-w-[150px]">
            → {tarea.prospecto_nombre ?? tarea.cliente_nombre}
          </span>
        )}
      </div>
    </div>
  )
}
