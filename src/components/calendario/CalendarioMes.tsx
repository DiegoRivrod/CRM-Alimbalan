import { useMemo } from 'react'
import type { EventoCalendario } from '@/hooks/useCalendario'
import { formatISO } from '@/hooks/useCalendario'
import EventoChip from './EventoChip'

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

interface Props {
  anio: number
  mes: number // 0-indexed
  eventosPorDia: Record<string, EventoCalendario[]>
  onSelectEvento: (evento: EventoCalendario) => void
}

interface CeldaDia {
  fecha: string         // YYYY-MM-DD
  dia: number
  esMesActual: boolean
  esHoy: boolean
}

export default function CalendarioMes({ anio, mes, eventosPorDia, onSelectEvento }: Props) {
  const hoyStr = formatISO(new Date())

  const celdas = useMemo((): CeldaDia[] => {
    const primerDia = new Date(anio, mes, 1)
    const ultimoDia = new Date(anio, mes + 1, 0)

    // Lunes = 0, Domingo = 6 (ajustar de JS donde Domingo = 0)
    let diaInicio = primerDia.getDay() - 1
    if (diaInicio < 0) diaInicio = 6 // Domingo

    const resultado: CeldaDia[] = []

    // Días del mes anterior para rellenar
    const diasMesAnterior = new Date(anio, mes, 0).getDate()
    for (let i = diaInicio - 1; i >= 0; i--) {
      const d = diasMesAnterior - i
      const fecha = formatISO(new Date(anio, mes - 1, d))
      resultado.push({ fecha, dia: d, esMesActual: false, esHoy: fecha === hoyStr })
    }

    // Días del mes actual
    for (let d = 1; d <= ultimoDia.getDate(); d++) {
      const fecha = formatISO(new Date(anio, mes, d))
      resultado.push({ fecha, dia: d, esMesActual: true, esHoy: fecha === hoyStr })
    }

    // Rellenar hasta completar filas de 7
    const restantes = 7 - (resultado.length % 7)
    if (restantes < 7) {
      for (let d = 1; d <= restantes; d++) {
        const fecha = formatISO(new Date(anio, mes + 1, d))
        resultado.push({ fecha, dia: d, esMesActual: false, esHoy: fecha === hoyStr })
      }
    }

    return resultado
  }, [anio, mes, hoyStr])

  return (
    <div>
      {/* Header días de la semana */}
      <div className="grid grid-cols-7 border-b border-border">
        {DIAS_SEMANA.map(d => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
            {d}
          </div>
        ))}
      </div>

      {/* Grid de celdas */}
      <div className="grid grid-cols-7 border-l border-border">
        {celdas.map(celda => {
          const eventos = eventosPorDia[celda.fecha] ?? []
          const visitas = eventos.filter(e => e.tipo === 'visita').length
          const tareas = eventos.filter(e => e.tipo === 'tarea').length

          return (
            <div
              key={celda.fecha}
              className={`min-h-[100px] border-r border-b border-border p-1.5 transition-colors
                ${celda.esMesActual ? 'bg-white' : 'bg-muted/20'}
                ${celda.esHoy ? 'bg-primary/5' : ''}`}
            >
              {/* Número de día */}
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full
                  ${celda.esHoy ? 'bg-primary text-primary-foreground' : ''}
                  ${!celda.esMesActual ? 'text-muted-foreground/50' : 'text-foreground'}`}>
                  {celda.dia}
                </span>
                {/* Dots resumen (solo si hay más eventos que los que se muestran) */}
                {eventos.length > 3 && (
                  <span className="text-[10px] text-muted-foreground">+{eventos.length - 3}</span>
                )}
              </div>

              {/* Dots de resumen en mobile */}
              {eventos.length > 0 && (
                <div className="flex gap-0.5 mb-1 md:hidden">
                  {visitas > 0 && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                  {tareas > 0 && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                </div>
              )}

              {/* Chips de eventos (max 3, hidden en mobile) */}
              <div className="hidden md:flex flex-col gap-0.5">
                {eventos.slice(0, 3).map(ev => (
                  <EventoChip key={ev.id} evento={ev} onClick={onSelectEvento} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
