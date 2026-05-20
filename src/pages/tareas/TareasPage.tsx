import { useState, useMemo, useEffect } from 'react'
import { Plus, CheckSquare, ListFilter } from 'lucide-react'
import { useTareas, completarTarea } from '@/hooks/useTareas'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import type { EstadoTarea } from '@/types/supabase'
import TareaCard from '@/components/tareas/TareaCard'
import TareaFormDialog from '@/components/tareas/TareaFormDialog'

const TABS: { value: EstadoTarea | 'todas' | 'vencidas'; label: string }[] = [
  { value: 'todas',       label: 'Todas' },
  { value: 'pendiente',   label: 'Pendientes' },
  { value: 'en_progreso', label: 'En progreso' },
  { value: 'completada',  label: 'Completadas' },
  { value: 'vencidas',    label: 'Vencidas' },
]

export default function TareasPage() {
  const { isAdmin, isSupervisor } = useAuth()
  const esSuperior = isAdmin || isSupervisor

  const [tab, setTab] = useState<EstadoTarea | 'todas' | 'vencidas'>('pendiente')
  const [filtroAsignado, setFiltroAsignado] = useState('')
  const [dialogAbierto, setDialogAbierto] = useState(false)

  // Usuarios para filtro
  const [usuarios, setUsuarios] = useState<{ id: string; nombre: string }[]>([])
  useEffect(() => {
    if (esSuperior) {
      supabase.from('profiles').select('id, nombre').then(({ data }) => {
        setUsuarios((data ?? []) as { id: string; nombre: string }[])
      })
    }
  }, [esSuperior])

  const filtros = useMemo(() => {
    if (tab === 'vencidas') return { vencidas: true, asignado_a: filtroAsignado || undefined }
    return {
      estado: tab as EstadoTarea | 'todas',
      asignado_a: filtroAsignado || undefined,
    }
  }, [tab, filtroAsignado])

  const { tareas, loading, recargar } = useTareas(filtros)

  const handleCompletar = async (id: string) => {
    await completarTarea(id)
    recargar()
  }

  // Conteos por estado (solo de las tareas visibles sin filtro de tab)
  const { tareas: todasTareas } = useTareas({ asignado_a: filtroAsignado || undefined })
  const conteos = useMemo(() => {
    const c: Record<string, number> = { todas: 0, pendiente: 0, en_progreso: 0, completada: 0, vencidas: 0 }
    const hoy = new Date(new Date().toDateString())
    for (const t of todasTareas) {
      c.todas++
      c[t.estado] = (c[t.estado] ?? 0) + 1
      if (
        t.fecha_vencimiento &&
        (t.estado === 'pendiente' || t.estado === 'en_progreso') &&
        new Date(t.fecha_vencimiento) < hoy
      ) {
        c.vencidas++
      }
    }
    return c
  }, [todasTareas])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Tareas</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gestión de tareas y recordatorios del equipo comercial
          </p>
        </div>
        <button
          onClick={() => setDialogAbierto(true)}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm px-4 py-2 rounded-lg
                     hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> Nueva tarea
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map(t => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.value
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
            {(conteos[t.value] ?? 0) > 0 && (
              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs ${
                t.value === 'vencidas' && conteos.vencidas > 0
                  ? 'bg-red-100 text-red-700'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {conteos[t.value]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filtros */}
      {esSuperior && (
        <div className="flex items-center gap-2">
          <ListFilter className="w-4 h-4 text-muted-foreground" />
          <select
            value={filtroAsignado}
            onChange={e => setFiltroAsignado(e.target.value)}
            className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background
                       focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Todos los usuarios</option>
            {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </select>
        </div>
      )}

      {/* Lista de tareas */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : tareas.length === 0 ? (
        <div className="text-center py-12">
          <CheckSquare className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {tab === 'vencidas' ? 'No hay tareas vencidas' : 'No hay tareas en esta categoría'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tareas.map(t => (
            <TareaCard key={t.id} tarea={t} onCompletar={handleCompletar} />
          ))}
        </div>
      )}

      {/* Dialog nueva tarea */}
      <TareaFormDialog
        abierto={dialogAbierto}
        onCerrar={() => setDialogAbierto(false)}
        onCreada={recargar}
      />
    </div>
  )
}
