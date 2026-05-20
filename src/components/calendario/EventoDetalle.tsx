import { X, MapPin, CheckSquare, User, AlertCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { EventoCalendario } from '@/hooks/useCalendario'

const TIPO_CONFIG: Record<string, { label: string; icon: React.ElementType; badge: string }> = {
  visita: { label: 'Visita',  icon: MapPin,      badge: 'bg-green-50 text-green-700' },
  tarea:  { label: 'Tarea',   icon: CheckSquare,  badge: 'bg-blue-50 text-blue-700' },
}

const PRIORIDAD_BADGE: Record<string, string> = {
  baja:    'bg-gray-100 text-gray-500',
  media:   'bg-blue-50 text-blue-600',
  alta:    'bg-orange-50 text-orange-600',
  urgente: 'bg-red-100 text-red-700',
}

const ESTADO_BADGE: Record<string, string> = {
  pendiente:   'bg-yellow-50 text-yellow-700',
  en_progreso: 'bg-indigo-50 text-indigo-600',
  completada:  'bg-green-50 text-green-600',
  cancelada:   'bg-gray-100 text-gray-500',
}

function formatFecha(fecha: string) {
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-PE', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

interface Props {
  evento: EventoCalendario
  onCerrar: () => void
}

export default function EventoDetalle({ evento, onCerrar }: Props) {
  const navigate = useNavigate()
  const cfg = TIPO_CONFIG[evento.tipo] ?? TIPO_CONFIG.tarea
  const Icon = cfg.icon

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onCerrar} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-muted-foreground" />
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badge}`}>
              {cfg.label}
            </span>
          </div>
          <button onClick={onCerrar} className="p-1 hover:bg-muted rounded-md transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          <h3 className="font-semibold text-base">{evento.titulo}</h3>
          <p className="text-sm text-muted-foreground capitalize">{formatFecha(evento.fecha)}</p>

          {evento.detalle && (
            <p className="text-sm text-foreground/80">{evento.detalle}</p>
          )}

          {/* Metadata */}
          <div className="flex flex-wrap gap-2">
            {evento.fuerza_de_venta && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
                <User className="w-3 h-3" />
                {evento.meta?.asignado as string ?? evento.fuerza_de_venta}
              </span>
            )}
            {evento.meta?.prioridad && (
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${PRIORIDAD_BADGE[evento.meta.prioridad as string] ?? ''}`}>
                <AlertCircle className="w-3 h-3 inline mr-0.5" />
                {String(evento.meta.prioridad)}
              </span>
            )}
            {evento.meta?.estado && (
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${ESTADO_BADGE[evento.meta.estado as string] ?? ''}`}>
                {String(evento.meta.estado).replace('_', ' ')}
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-muted/20 flex justify-end">
          <button
            onClick={() => { onCerrar(); navigate(evento.ref_url) }}
            className="text-sm text-primary hover:underline"
          >
            Ir a {cfg.label.toLowerCase()}s →
          </button>
        </div>
      </div>
    </div>
  )
}
