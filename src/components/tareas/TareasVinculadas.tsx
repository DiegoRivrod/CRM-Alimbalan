import { useState } from 'react'
import { Plus, CheckSquare } from 'lucide-react'
import { useTareas, completarTarea } from '@/hooks/useTareas'
import TareaCard from './TareaCard'
import TareaFormDialog from './TareaFormDialog'

interface Props {
  prospecto_id?: string | null
  prospecto_nombre?: string | null
  idcliente?: string | null
  cliente_nombre?: string | null
}

export default function TareasVinculadas({ prospecto_id, prospecto_nombre, idcliente, cliente_nombre }: Props) {
  const [dialogAbierto, setDialogAbierto] = useState(false)

  const filtros = prospecto_id
    ? { prospecto_id }
    : idcliente
      ? { idcliente }
      : {}

  const { tareas, loading, recargar } = useTareas(filtros)

  const handleCompletar = async (id: string) => {
    await completarTarea(id)
    recargar()
  }

  return (
    <div className="bg-white border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <CheckSquare className="w-4 h-4" />
          Tareas
          {tareas.length > 0 && (
            <span className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5">
              {tareas.filter(t => t.estado === 'pendiente' || t.estado === 'en_progreso').length} pendientes
            </span>
          )}
        </h3>
        <button
          onClick={() => setDialogAbierto(true)}
          className="flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <Plus className="w-4 h-4" /> Nueva tarea
        </button>
      </div>

      {loading ? (
        <div className="h-16 bg-muted animate-pulse rounded-lg" />
      ) : tareas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin tareas vinculadas.</p>
      ) : (
        <div className="space-y-2">
          {tareas.map(t => (
            <TareaCard key={t.id} tarea={t} onCompletar={handleCompletar} />
          ))}
        </div>
      )}

      <TareaFormDialog
        abierto={dialogAbierto}
        onCerrar={() => setDialogAbierto(false)}
        onCreada={recargar}
        prospecto_id={prospecto_id}
        prospecto_nombre={prospecto_nombre}
        idcliente={idcliente}
        cliente_nombre={cliente_nombre}
      />
    </div>
  )
}
