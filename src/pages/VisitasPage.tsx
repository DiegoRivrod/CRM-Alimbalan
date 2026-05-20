import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Phone, FileText, CalendarClock, CheckCircle, ArrowRight, ClipboardPlus, ClipboardCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import type { TipoActividad } from '@/types/supabase'
import { useActividadGlobal } from '@/hooks/useActividad'

// ── Helpers ───────────────────────────────────────────────────────────────────

const TIPO_ICON: Record<TipoActividad, React.ElementType> = {
  llamada:           Phone,
  nota:              FileText,
  seguimiento:       CalendarClock,
  match_aprobado:    CheckCircle,
  tarea_creada:      ClipboardPlus,
  tarea_completada:  ClipboardCheck,
}

const TIPO_BADGE: Record<TipoActividad, string> = {
  llamada:           'bg-blue-50 text-blue-700',
  nota:              'bg-gray-100 text-gray-600',
  seguimiento:       'bg-orange-50 text-orange-700',
  match_aprobado:    'bg-green-50 text-green-700',
  tarea_creada:      'bg-indigo-50 text-indigo-700',
  tarea_completada:  'bg-emerald-50 text-emerald-700',
}

const TIPO_LABEL: Record<TipoActividad, string> = {
  llamada:           'Llamada',
  nota:              'Nota',
  seguimiento:       'Seguimiento',
  match_aprobado:    'Match aprobado',
  tarea_creada:      'Tarea creada',
  tarea_completada:  'Tarea completada',
}

function formatFecha(s: string) {
  return new Date(s).toLocaleString('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// ── Tipos locales ─────────────────────────────────────────────────────────────

interface ProspectoSeguimiento {
  id: string
  nombre: string
  fuerza_de_venta: string
  zona: string | null
  updated_at: string
}

// ── Sección: prospectos en seguimiento ────────────────────────────────────────

function SeccionSeguimientos() {
  const [prospectos, setProspectos] = useState<ProspectoSeguimiento[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const cargar = async () => {
      const { data } = await supabase
        .from('prospectos')
        .select('id, nombre, fuerza_de_venta, zona, updated_at')
        .eq('estado', 'seguimiento')
        .order('updated_at', { ascending: true })
        .limit(50)

      setProspectos((data ?? []) as ProspectoSeguimiento[])
      setLoading(false)
    }
    cargar()
  }, [])

  if (loading) {
    return <div className="h-24 bg-muted animate-pulse rounded-xl" />
  }

  if (prospectos.length === 0) {
    return (
      <div className="bg-white border border-border rounded-xl p-5">
        <p className="text-sm text-muted-foreground">No hay prospectos en seguimiento actualmente.</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Prospecto</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Vendedor</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Zona</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Desde</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {prospectos.map(p => (
            <tr key={p.id} className="border-b border-border/60 last:border-0 hover:bg-muted/20 transition-colors">
              <td className="px-4 py-3 font-medium">{p.nombre}</td>
              <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{p.fuerza_de_venta}</td>
              <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{p.zona ?? '—'}</td>
              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                {new Date(p.updated_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  to={`/prospectos/${p.id}`}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Ver <ArrowRight className="w-3 h-3" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Sección: actividad reciente ───────────────────────────────────────────────

function SeccionActividad() {
  const { actividades, loading } = useActividadGlobal(20)

  if (loading) {
    return <div className="h-32 bg-muted animate-pulse rounded-xl" />
  }

  if (actividades.length === 0) {
    return (
      <div className="bg-white border border-border rounded-xl p-5">
        <p className="text-sm text-muted-foreground">Sin actividad registrada aún.</p>
      </div>
    )
  }

  return (
    <ol className="relative border-l border-border/60 ml-3 space-y-4">
      {actividades.map(act => {
        const Icon = TIPO_ICON[act.tipo]
        return (
          <li key={act.id} className="ml-5">
            <span className="absolute -left-3 flex items-center justify-center w-6 h-6 rounded-full bg-background border border-border text-muted-foreground">
              <Icon className="w-3 h-3" />
            </span>
            <div className="bg-white border border-border/60 rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TIPO_BADGE[act.tipo]}`}>
                  {TIPO_LABEL[act.tipo]}
                </span>
                <span className="text-xs text-muted-foreground">{act.autor_nombre}</span>
                <span className="text-xs text-muted-foreground ml-auto">{formatFecha(act.created_at)}</span>
              </div>
              {act.nota && <p className="text-sm text-foreground/80 whitespace-pre-wrap">{act.nota}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function VisitasPage() {
  const { isAdmin, isSupervisor } = useAuth()
  const esSuperior = isAdmin || isSupervisor

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-1">Actividad</h2>
        <p className="text-muted-foreground text-sm">
          Seguimiento de prospectos y registro de actividad del equipo comercial.
        </p>
      </div>

      {esSuperior && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Prospectos en seguimiento
          </h3>
          <SeccionSeguimientos />
        </section>
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Actividad reciente
        </h3>
        <SeccionActividad />
      </section>
    </div>
  )
}
