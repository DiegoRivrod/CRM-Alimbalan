import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { crearTarea, type CrearTareaPayload } from '@/hooks/useTareas'
import type { Tarea } from '@/types/supabase'

interface Props {
  abierto: boolean
  onCerrar: () => void
  onCreada: () => void
  // Pre-fill opcionales
  prospecto_id?: string | null
  prospecto_nombre?: string | null
  idcliente?: string | null
  cliente_nombre?: string | null
}

const TIPOS: { value: Tarea['tipo']; label: string }[] = [
  { value: 'llamada',     label: 'Llamada' },
  { value: 'visita',      label: 'Visita' },
  { value: 'seguimiento', label: 'Seguimiento' },
  { value: 'cobranza',    label: 'Cobranza' },
  { value: 'general',     label: 'General' },
]

const PRIORIDADES: { value: Tarea['prioridad']; label: string }[] = [
  { value: 'baja',    label: 'Baja' },
  { value: 'media',   label: 'Media' },
  { value: 'alta',    label: 'Alta' },
  { value: 'urgente', label: 'Urgente' },
]

export default function TareaFormDialog({
  abierto, onCerrar, onCreada,
  prospecto_id, prospecto_nombre,
  idcliente, cliente_nombre,
}: Props) {
  const { user, isAdmin, isSupervisor } = useAuth()
  const esSuperior = isAdmin || isSupervisor

  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [tipo, setTipo] = useState<Tarea['tipo']>('general')
  const [prioridad, setPrioridad] = useState<Tarea['prioridad']>('media')
  const [fechaVenc, setFechaVenc] = useState('')
  const [asignadoA, setAsignadoA] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Lista de usuarios para el select de asignado
  const [usuarios, setUsuarios] = useState<{ id: string; nombre: string; rol: string }[]>([])

  useEffect(() => {
    if (!abierto) return
    // Reset form
    setTitulo('')
    setDescripcion('')
    setTipo('general')
    setPrioridad('media')
    setFechaVenc('')
    setAsignadoA(user?.id ?? '')
    setErrorMsg(null)

    // Cargar usuarios
    if (esSuperior) {
      supabase.from('profiles').select('id, nombre, rol').then(({ data }) => {
        setUsuarios((data ?? []) as { id: string; nombre: string; rol: string }[])
      })
    }
  }, [abierto, user?.id, esSuperior])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!titulo.trim()) return

    setGuardando(true)
    setErrorMsg(null)

    const payload: CrearTareaPayload = {
      titulo: titulo.trim(),
      descripcion: descripcion.trim() || undefined,
      tipo,
      prioridad,
      fecha_vencimiento: fechaVenc || null,
      asignado_a: asignadoA || user!.id,
      prospecto_id: prospecto_id ?? null,
      idcliente: idcliente ?? null,
    }

    const { error } = await crearTarea(payload)
    setGuardando(false)

    if (error) {
      setErrorMsg(error)
    } else {
      onCreada()
      onCerrar()
    }
  }

  if (!abierto) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onCerrar} />

      {/* Dialog */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-semibold text-lg">Nueva tarea</h3>
          <button onClick={onCerrar} className="p-1 hover:bg-muted rounded-md transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Vinculación (read-only) */}
          {(prospecto_nombre || cliente_nombre) && (
            <div className="text-sm bg-muted/30 rounded-lg px-3 py-2">
              <span className="text-muted-foreground">Vinculada a: </span>
              <span className="font-medium">
                {prospecto_nombre ? `Prospecto: ${prospecto_nombre}` : `Cliente: ${cliente_nombre}`}
              </span>
            </div>
          )}

          {/* Título */}
          <div>
            <label className="block text-sm font-medium mb-1">Título *</label>
            <input
              type="text"
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Ej: Llamar para seguimiento de cotización"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background
                         focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium mb-1">Descripción</label>
            <textarea
              rows={2}
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              placeholder="Detalles adicionales (opcional)"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background
                         focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          {/* Tipo + Prioridad (row) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Tipo</label>
              <select
                value={tipo}
                onChange={e => setTipo(e.target.value as Tarea['tipo'])}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background
                           focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Prioridad</label>
              <select
                value={prioridad}
                onChange={e => setPrioridad(e.target.value as Tarea['prioridad'])}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background
                           focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {PRIORIDADES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>

          {/* Fecha vencimiento */}
          <div>
            <label className="block text-sm font-medium mb-1">Fecha de vencimiento</label>
            <input
              type="date"
              value={fechaVenc}
              onChange={e => setFechaVenc(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background
                         focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Asignado a */}
          {esSuperior ? (
            <div>
              <label className="block text-sm font-medium mb-1">Asignar a</label>
              <select
                value={asignadoA}
                onChange={e => setAsignadoA(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background
                           focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {usuarios.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.nombre} ({u.rol})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Se asignará a ti automáticamente.</p>
          )}

          {/* Error */}
          {errorMsg && <p className="text-sm text-red-500">{errorMsg}</p>}

          {/* Acciones */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCerrar}
              className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!titulo.trim() || guardando}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg
                         hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {guardando ? 'Creando…' : 'Crear tarea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
