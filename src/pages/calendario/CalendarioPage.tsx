import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { useCalendario, nombreMes } from '@/hooks/useCalendario'
import type { EventoCalendario } from '@/hooks/useCalendario'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import CalendarioMes from '@/components/calendario/CalendarioMes'
import EventoDetalle from '@/components/calendario/EventoDetalle'

export default function CalendarioPage() {
  const { isAdmin, isSupervisor } = useAuth()
  const esSuperior = isAdmin || isSupervisor

  const hoy = new Date()
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [mes, setMes] = useState(hoy.getMonth())
  const [filtroFuerza, setFiltroFuerza] = useState('')
  const [eventoSeleccionado, setEventoSeleccionado] = useState<EventoCalendario | null>(null)

  // Lista de vendedores para el filtro
  const [vendedores, setVendedores] = useState<string[]>([])
  useEffect(() => {
    if (esSuperior) {
      supabase.from('profiles').select('fuerza_de_venta').then(({ data }) => {
        const fuerzas = [...new Set(
          ((data ?? []) as { fuerza_de_venta: string | null }[])
            .map(p => p.fuerza_de_venta)
            .filter(Boolean) as string[]
        )].sort()
        setVendedores(fuerzas)
      })
    }
  }, [esSuperior])

  const { eventosPorDia, loading } = useCalendario(anio, mes, filtroFuerza || undefined)

  // Contar totales del mes
  const totalEventos = Object.values(eventosPorDia).reduce((s, arr) => s + arr.length, 0)
  const totalVisitas = Object.values(eventosPorDia).reduce(
    (s, arr) => s + arr.filter(e => e.tipo === 'visita').length, 0
  )
  const totalTareas = Object.values(eventosPorDia).reduce(
    (s, arr) => s + arr.filter(e => e.tipo === 'tarea').length, 0
  )

  const mesAnterior = () => {
    if (mes === 0) { setMes(11); setAnio(a => a - 1) }
    else setMes(m => m - 1)
  }

  const mesSiguiente = () => {
    if (mes === 11) { setMes(0); setAnio(a => a + 1) }
    else setMes(m => m + 1)
  }

  const irAHoy = () => {
    setAnio(hoy.getFullYear())
    setMes(hoy.getMonth())
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Calendario</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Visitas y tareas programadas del equipo comercial
          </p>
        </div>

        {/* Leyenda */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500" /> Visitas ({totalVisitas})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500" /> Tareas ({totalTareas})
          </span>
        </div>
      </div>

      {/* Navegación de mes + filtro */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={mesAnterior}
            className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <h3 className="text-lg font-semibold min-w-[200px] text-center">
            {nombreMes(mes)} {anio}
          </h3>

          <button
            onClick={mesSiguiente}
            className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={irAHoy}
            className="text-xs text-primary hover:underline ml-2"
          >
            Hoy
          </button>
        </div>

        {esSuperior && (
          <select
            value={filtroFuerza}
            onChange={e => setFiltroFuerza(e.target.value)}
            className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background
                       focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Todos los vendedores</option>
            {vendedores.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        )}
      </div>

      {/* Calendario */}
      {loading ? (
        <div className="h-[500px] bg-muted animate-pulse rounded-xl" />
      ) : (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <CalendarioMes
            anio={anio}
            mes={mes}
            eventosPorDia={eventosPorDia}
            onSelectEvento={setEventoSeleccionado}
          />
        </div>
      )}

      {/* Resumen del mes (si no hay eventos) */}
      {!loading && totalEventos === 0 && (
        <div className="text-center py-8">
          <Calendar className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Sin eventos programados para {nombreMes(mes).toLowerCase()} {anio}
          </p>
        </div>
      )}

      {/* Modal detalle de evento */}
      {eventoSeleccionado && (
        <EventoDetalle
          evento={eventoSeleccionado}
          onCerrar={() => setEventoSeleccionado(null)}
        />
      )}
    </div>
  )
}
