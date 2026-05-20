import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { List, Kanban } from 'lucide-react'
import { useKanban } from '@/hooks/useKanban'
import { useAuth } from '@/lib/auth'
import type { EstadoProspecto, ProspectoRow } from '@/hooks/useProspectos'
import KanbanColumn from '@/components/prospectos/KanbanColumn'
import KanbanCard from '@/components/prospectos/KanbanCard'

export default function KanbanPage() {
  const { isAdmin, isSupervisor } = useAuth()
  const [filtroFuerza, setFiltroFuerza] = useState('')
  const {
    columnas, loading, error, moviendo,
    fuerzas, moverProspecto, puedeTransicionar,
  } = useKanban(filtroFuerza || undefined)

  const [activeProspecto, setActiveProspecto] = useState<ProspectoRow | null>(null)
  const [toast, setToast] = useState<{ msg: string; tipo: 'error' | 'ok' } | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const showToast = useCallback((msg: string, tipo: 'error' | 'ok') => {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 3000)
  }, [])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const prospectoId = event.active.id as string
    for (const col of columnas) {
      const found = col.prospectos.find(p => p.id === prospectoId)
      if (found) { setActiveProspecto(found); break }
    }
  }, [columnas])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveProspecto(null)
    const { active, over } = event
    if (!over) return

    const prospectoId = active.id as string
    const estadoOrigen = (active.data.current as { estado: EstadoProspecto })?.estado
    // El destino puede ser una columna (id = estado) o una card (id = prospecto id dentro de una columna)
    let estadoDestino: EstadoProspecto

    const estadosValidos: EstadoProspecto[] = ['nuevo', 'seguimiento', 'convertido', 'perdido']
    if (estadosValidos.includes(over.id as EstadoProspecto)) {
      estadoDestino = over.id as EstadoProspecto
    } else {
      // Dropped over another card — find which column it belongs to
      for (const col of columnas) {
        if (col.prospectos.some(p => p.id === over.id)) {
          estadoDestino = col.estado
          break
        }
      }
      if (!estadoDestino!) return
    }

    if (estadoOrigen === estadoDestino) return

    if (!puedeTransicionar(estadoOrigen, estadoDestino)) {
      showToast(`No se puede mover de "${estadoOrigen}" a "${estadoDestino}"`, 'error')
      return
    }

    const { error: err } = await moverProspecto(prospectoId, estadoDestino)
    if (err) {
      showToast(`Error: ${err}`, 'error')
    } else {
      showToast('Estado actualizado', 'ok')
    }
  }, [columnas, moverProspecto, puedeTransicionar, showToast])

  if (error) return <div className="text-red-500 text-sm">Error: {error}</div>

  const totalProspectos = columnas.reduce((s, c) => s + c.prospectos.length, 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Pipeline</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Arrastra prospectos entre columnas para cambiar su estado
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {totalProspectos} prospectos
          </span>
          {/* Toggle vista */}
          <div className="flex border border-border rounded-lg overflow-hidden">
            <Link
              to="/prospectos"
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
            >
              <List className="w-4 h-4" /> Lista
            </Link>
            <span className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary/10 text-primary font-medium">
              <Kanban className="w-4 h-4" /> Kanban
            </span>
          </div>
        </div>
      </div>

      {/* Filtro vendedor */}
      {(isAdmin || isSupervisor) && (
        <div>
          <select
            value={filtroFuerza}
            onChange={e => setFiltroFuerza(e.target.value)}
            className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Todos los vendedores</option>
            {fuerzas.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      )}

      {/* Kanban board */}
      {loading ? (
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-96 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {columnas.map(col => (
              <KanbanColumn
                key={col.estado}
                estado={col.estado}
                prospectos={col.prospectos}
              />
            ))}
          </div>

          <DragOverlay>
            {activeProspecto ? (
              <KanbanCard prospecto={activeProspecto} isDragging />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium z-50 transition-opacity
            ${toast.tipo === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}
        >
          {toast.msg}
        </div>
      )}

      {/* Indicador de movimiento */}
      {moviendo && (
        <div className="fixed bottom-6 left-6 px-4 py-2.5 rounded-lg shadow-lg text-sm bg-white border border-border z-50">
          Actualizando estado…
        </div>
      )}
    </div>
  )
}
