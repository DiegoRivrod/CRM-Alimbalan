import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useNavigate } from 'react-router-dom'
import { MapPin, Weight, User, DollarSign } from 'lucide-react'
import type { ProspectoRow } from '@/hooks/useProspectos'

const formatSoles = (n: number) =>
  n === 0 ? null : `S/ ${n.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`

interface Props {
  prospecto: ProspectoRow
  isDragging?: boolean
}

export default function KanbanCard({ prospecto, isDragging }: Props) {
  const navigate = useNavigate()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortDragging,
  } = useSortable({ id: prospecto.id, data: { estado: prospecto.estado } })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortDragging ? 0.5 : 1,
  }

  const dragging = isDragging || isSortDragging
  const montoFmt = formatSoles(prospecto.monto_estimado ?? 0)
  const valorPonderado = montoFmt
    ? Math.round((prospecto.monto_estimado ?? 0) * (prospecto.probabilidad_cierre ?? 20) / 100)
    : null

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => navigate(`/prospectos/${prospecto.id}`)}
      className={`bg-white border border-border rounded-lg p-3 cursor-grab active:cursor-grabbing
        hover:shadow-sm transition-shadow space-y-2 select-none
        ${dragging ? 'shadow-lg ring-2 ring-primary/20' : ''}`}
    >
      {/* Nombre */}
      <p className="font-medium text-sm truncate">{prospecto.nombre}</p>

      {/* Info secundaria */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <User className="w-3 h-3" />
          <span className="truncate max-w-[120px]">{prospecto.fuerza_de_venta}</span>
        </span>
        {prospecto.zona && (
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {prospecto.zona}
          </span>
        )}
        {prospecto.potencial_tn != null && (
          <span className="flex items-center gap-1">
            <Weight className="w-3 h-3" />
            {prospecto.potencial_tn} tn
          </span>
        )}
      </div>

      {/* Monto estimado */}
      {montoFmt && (
        <div className="flex items-center justify-between pt-1 border-t border-border/40">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <DollarSign className="w-3 h-3" />
            {montoFmt}
          </span>
          {valorPonderado != null && valorPonderado > 0 && (
            <span className="text-[10px] text-emerald-600 font-medium">
              ×{prospecto.probabilidad_cierre}% = S/ {valorPonderado.toLocaleString('es-PE')}
            </span>
          )}
        </div>
      )}

      {/* Match badge */}
      {prospecto.match_aprobado && (
        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
          Match aprobado
        </span>
      )}
      {!prospecto.match_aprobado && prospecto.match_confianza !== null && (
        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-100 text-orange-600">
          Sugerido {Math.round(prospecto.match_confianza * 100)}%
        </span>
      )}
    </div>
  )
}
