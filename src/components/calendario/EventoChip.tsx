import type { EventoCalendario } from '@/hooks/useCalendario'

const TIPO_STYLE: Record<string, { dot: string; text: string }> = {
  visita: { dot: 'bg-green-500', text: 'text-green-700' },
  tarea:  { dot: 'bg-blue-500',  text: 'text-blue-700' },
}

interface Props {
  evento: EventoCalendario
  onClick: (evento: EventoCalendario) => void
}

export default function EventoChip({ evento, onClick }: Props) {
  const style = TIPO_STYLE[evento.tipo] ?? TIPO_STYLE.tarea

  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(evento) }}
      className="flex items-center gap-1 w-full text-left px-1 py-0.5 rounded hover:bg-muted/60 transition-colors group"
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
      <span className={`text-[10px] leading-tight truncate ${style.text} group-hover:underline`}>
        {evento.titulo}
      </span>
    </button>
  )
}
