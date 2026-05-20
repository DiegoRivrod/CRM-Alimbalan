import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { EstadoProspecto, ProspectoRow } from '@/hooks/useProspectos'
import KanbanCard from './KanbanCard'

const COLUMN_CONFIG: Record<EstadoProspecto, { label: string; color: string; bgHeader: string }> = {
  nuevo:       { label: 'Nuevos',       color: 'bg-blue-500',   bgHeader: 'bg-blue-50' },
  seguimiento: { label: 'Seguimiento',  color: 'bg-yellow-500', bgHeader: 'bg-yellow-50' },
  convertido:  { label: 'Convertidos',  color: 'bg-green-500',  bgHeader: 'bg-green-50' },
  perdido:     { label: 'Perdidos',     color: 'bg-red-500',    bgHeader: 'bg-red-50' },
}

interface Props {
  estado: EstadoProspecto
  prospectos: ProspectoRow[]
  isOver?: boolean
}

export default function KanbanColumn({ estado, prospectos, isOver }: Props) {
  const { setNodeRef, isOver: dropIsOver } = useDroppable({ id: estado })
  const config = COLUMN_CONFIG[estado]
  const hovering = isOver || dropIsOver

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-h-[400px] rounded-xl border border-border transition-colors
        ${hovering ? 'bg-primary/5 border-primary/30' : 'bg-muted/30'}`}
    >
      {/* Header */}
      <div className={`flex items-center gap-2 px-3 py-2.5 rounded-t-xl ${config.bgHeader}`}>
        <div className={`w-2.5 h-2.5 rounded-full ${config.color}`} />
        <span className="text-sm font-semibold">{config.label}</span>
        <span className="ml-auto text-xs text-muted-foreground bg-white/80 rounded-full px-2 py-0.5 font-medium">
          {prospectos.length}
        </span>
      </div>

      {/* Cards */}
      <SortableContext items={prospectos.map(p => p.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-220px)]">
          {prospectos.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              Sin prospectos
            </p>
          ) : (
            prospectos.map(p => <KanbanCard key={p.id} prospecto={p} />)
          )}
        </div>
      </SortableContext>
    </div>
  )
}
