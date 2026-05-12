import { useState } from 'react'
import { Phone, FileText, CalendarClock, CheckCircle, Plus } from 'lucide-react'
import { useActividadProspecto, useActividadCliente } from '@/hooks/useActividad'
import type { TipoActividad } from '@/types/supabase'

// ── Helpers visuales ──────────────────────────────────────────────────────────

const TIPO_CONFIG: Record<TipoActividad, { label: string; icon: React.ElementType; color: string; badge: string }> = {
  llamada:        { label: 'Llamada',        icon: Phone,         color: 'text-blue-600',   badge: 'bg-blue-50 text-blue-700' },
  nota:           { label: 'Nota',           icon: FileText,      color: 'text-gray-500',   badge: 'bg-gray-100 text-gray-600' },
  seguimiento:    { label: 'Seguimiento',    icon: CalendarClock, color: 'text-orange-500', badge: 'bg-orange-50 text-orange-700' },
  match_aprobado: { label: 'Match aprobado', icon: CheckCircle,   color: 'text-green-600',  badge: 'bg-green-50 text-green-700' },
}

const TIPOS_MANUALES: TipoActividad[] = ['llamada', 'nota', 'seguimiento']

function formatFecha(s: string) {
  return new Date(s).toLocaleString('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// ── Formulario de nueva actividad ─────────────────────────────────────────────

function FormActividad({
  onGuardar,
}: {
  onGuardar: (tipo: TipoActividad, nota?: string) => Promise<void>
}) {
  const [tipo, setTipo] = useState<TipoActividad>('llamada')
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [abierto, setAbierto] = useState(false)

  const handleSubmit = async () => {
    if (tipo === 'nota' && !nota.trim()) return
    setGuardando(true)
    await onGuardar(tipo, nota.trim() || undefined)
    setNota('')
    setTipo('llamada')
    setAbierto(false)
    setGuardando(false)
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="flex items-center gap-2 text-sm text-primary hover:underline"
      >
        <Plus className="w-4 h-4" /> Registrar actividad
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
      {/* Selector de tipo */}
      <div className="flex gap-2 flex-wrap">
        {TIPOS_MANUALES.map(t => (
          <button
            key={t}
            onClick={() => setTipo(t)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              tipo === t
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            {TIPO_CONFIG[t].label}
          </button>
        ))}
      </div>

      {/* Nota */}
      <textarea
        rows={2}
        placeholder={tipo === 'nota' ? 'Escribe la nota (requerido)…' : 'Agrega un comentario (opcional)…'}
        value={nota}
        onChange={e => setNota(e.target.value)}
        className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background
                   focus:outline-none focus:ring-1 focus:ring-primary resize-none"
      />

      {/* Acciones */}
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={guardando || (tipo === 'nota' && !nota.trim())}
          className="bg-primary text-primary-foreground text-sm px-4 py-1.5 rounded-lg
                     hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {guardando ? 'Guardando…' : 'Registrar'}
        </button>
        <button
          onClick={() => { setAbierto(false); setNota('') }}
          className="text-sm px-4 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ── Timeline visual ───────────────────────────────────────────────────────────

function ListaActividades({ actividades }: { actividades: import('@/hooks/useActividad').ActividadConAutor[] }) {
  if (actividades.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin actividad registrada aún.</p>
  }

  return (
    <ol className="relative border-l border-border/60 ml-3 space-y-4">
      {actividades.map(act => {
        const cfg = TIPO_CONFIG[act.tipo]
        const Icon = cfg.icon
        return (
          <li key={act.id} className="ml-5">
            <span
              className={`absolute -left-3 flex items-center justify-center w-6 h-6 rounded-full bg-background border border-border ${cfg.color}`}
            >
              <Icon className="w-3 h-3" />
            </span>
            <div className="bg-background border border-border/60 rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badge}`}>
                  {cfg.label}
                </span>
                <span className="text-xs text-muted-foreground">{act.autor_nombre}</span>
                <span className="text-xs text-muted-foreground ml-auto">{formatFecha(act.created_at)}</span>
              </div>
              {act.nota && (
                <p className="text-sm text-foreground/80 whitespace-pre-wrap">{act.nota}</p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

interface Props {
  prospecto_id?: string
  idcliente?: string
}

function ConProspecto({ prospecto_id }: { prospecto_id: string }) {
  const { actividades, loading, crearActividad } = useActividadProspecto(prospecto_id)
  return (
    <div className="space-y-4">
      <FormActividad onGuardar={crearActividad} />
      {loading
        ? <div className="h-16 bg-muted animate-pulse rounded-lg" />
        : <ListaActividades actividades={actividades} />
      }
    </div>
  )
}

function ConCliente({ idcliente }: { idcliente: string }) {
  const { actividades, loading, crearActividad } = useActividadCliente(idcliente)
  return (
    <div className="space-y-4">
      <FormActividad onGuardar={crearActividad} />
      {loading
        ? <div className="h-16 bg-muted animate-pulse rounded-lg" />
        : <ListaActividades actividades={actividades} />
      }
    </div>
  )
}

export default function ActividadTimeline({ prospecto_id, idcliente }: Props) {
  return (
    <div className="bg-white border border-border rounded-xl p-5 space-y-4">
      <h3 className="font-semibold text-sm">Actividad</h3>
      {prospecto_id
        ? <ConProspecto prospecto_id={prospecto_id} />
        : idcliente
          ? <ConCliente idcliente={idcliente} />
          : <p className="text-sm text-muted-foreground">Sin contexto.</p>
      }
    </div>
  )
}
