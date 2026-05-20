import { Clock, AlertTriangle, UserX, TrendingDown, Target, Upload } from 'lucide-react'
import type { Notificacion } from '@/types/supabase'

const TIPO_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  tarea_vencida:             { icon: AlertTriangle, color: 'text-red-500' },
  tarea_asignada:            { icon: Clock,         color: 'text-blue-500' },
  prospecto_sin_actividad:   { icon: UserX,         color: 'text-orange-500' },
  cliente_inactivo:          { icon: TrendingDown,   color: 'text-yellow-600' },
  meta_por_cumplir:          { icon: Target,        color: 'text-purple-500' },
  importacion_completada:    { icon: Upload,        color: 'text-green-500' },
}

function tiempoRelativo(fecha: string): string {
  const diff = Date.now() - new Date(fecha).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Ahora'
  if (mins < 60) return `Hace ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `Hace ${hrs}h`
  const dias = Math.floor(hrs / 24)
  if (dias < 7) return `Hace ${dias}d`
  return new Date(fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
}

interface Props {
  notificacion: Notificacion
  onClick: (notificacion: Notificacion) => void
}

export default function NotificacionItem({ notificacion, onClick }: Props) {
  const cfg = TIPO_CONFIG[notificacion.tipo] ?? TIPO_CONFIG.tarea_asignada
  const Icon = cfg.icon

  return (
    <button
      onClick={() => onClick(notificacion)}
      className={`w-full text-left flex items-start gap-3 px-4 py-3 transition-colors
        ${notificacion.leida ? 'bg-white' : 'bg-blue-50/50'}
        hover:bg-muted/50`}
    >
      {/* Icono */}
      <span className={`mt-0.5 shrink-0 ${cfg.color}`}>
        <Icon className="w-4 h-4" />
      </span>

      {/* Contenido */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-tight ${notificacion.leida ? 'text-muted-foreground' : 'font-medium text-foreground'}`}>
          {notificacion.titulo}
        </p>
        {notificacion.mensaje && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notificacion.mensaje}</p>
        )}
        <p className="text-[10px] text-muted-foreground mt-1">{tiempoRelativo(notificacion.created_at)}</p>
      </div>

      {/* Dot no leída */}
      {!notificacion.leida && (
        <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
      )}
    </button>
  )
}
