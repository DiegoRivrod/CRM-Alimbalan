import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

// ── Tipos ────────────────────────────────────────────────────────────────────

export type TipoEvento = 'visita' | 'tarea'

export interface EventoCalendario {
  id: string
  tipo: TipoEvento
  fecha: string          // YYYY-MM-DD
  titulo: string
  detalle: string | null
  fuerza_de_venta: string
  // Metadata extra
  ref_id: string
  ref_url: string        // ruta para navegar
  meta?: Record<string, string | number | null>
}

// ── Helpers de fecha ─────────────────────────────────────────────────────────

export function primerDiaMes(anio: number, mes: number): Date {
  return new Date(anio, mes, 1)
}

export function ultimoDiaMes(anio: number, mes: number): Date {
  return new Date(anio, mes + 1, 0)
}

export function formatISO(d: Date): string {
  return d.toISOString().split('T')[0]
}

const MESES_ES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

export function nombreMes(mes: number): string {
  return MESES_ES[mes] ?? ''
}

// ── Hook principal ───────────────────────────────────────────────────────────

export function useCalendario(anio: number, mes: number, filtroFuerza?: string) {
  const [eventos, setEventos] = useState<EventoCalendario[]>([])
  const [loading, setLoading] = useState(true)

  const inicio = formatISO(primerDiaMes(anio, mes))
  const fin = formatISO(ultimoDiaMes(anio, mes))

  const cargar = useCallback(async () => {
    setLoading(true)

    // Query visitas en el rango
    let qVisitas = supabase
      .from('visitas')
      .select('id, marca_temporal, fuerza_de_venta, localizacion, nombre_cliente_nuevo, numero_visita, especie, es_cliente_nuevo')
      .gte('marca_temporal', `${inicio}T00:00:00`)
      .lte('marca_temporal', `${fin}T23:59:59`)

    if (filtroFuerza) qVisitas = qVisitas.eq('fuerza_de_venta', filtroFuerza)

    // Query tareas en el rango
    const qTareas = supabase
      .from('tareas')
      .select('id, titulo, descripcion, tipo, prioridad, estado, fecha_vencimiento, asignado_a')
      .gte('fecha_vencimiento', inicio)
      .lte('fecha_vencimiento', fin)

    const [visitasRes, tareasRes, perfilesRes] = await Promise.all([
      qVisitas,
      qTareas,
      supabase.from('profiles').select('id, nombre, fuerza_de_venta'),
    ])

    // Mapa de perfiles para resolver nombres
    const perfiles: Record<string, { nombre: string; fuerza_de_venta: string | null }> = {}
    ;((perfilesRes.data ?? []) as { id: string; nombre: string; fuerza_de_venta: string | null }[])
      .forEach(p => { perfiles[p.id] = p })

    const eventosVisitas: EventoCalendario[] = ((visitasRes.data ?? []) as Array<{
      id: string; marca_temporal: string; fuerza_de_venta: string;
      localizacion: string | null; nombre_cliente_nuevo: string | null;
      numero_visita: number; especie: string | null; es_cliente_nuevo: boolean;
    }>).map(v => ({
      id: `visita-${v.id}`,
      tipo: 'visita' as const,
      fecha: v.marca_temporal.split('T')[0],
      titulo: v.nombre_cliente_nuevo ?? `Visita #${v.numero_visita}`,
      detalle: [v.localizacion, v.especie].filter(Boolean).join(' · ') || null,
      fuerza_de_venta: v.fuerza_de_venta,
      ref_id: v.id,
      ref_url: '/visitas',
      meta: { es_cliente_nuevo: v.es_cliente_nuevo ? 'Sí' : 'No' },
    }))

    const eventosTareas: EventoCalendario[] = ((tareasRes.data ?? []) as Array<{
      id: string; titulo: string; descripcion: string | null; tipo: string;
      prioridad: string; estado: string; fecha_vencimiento: string; asignado_a: string;
    }>)
      .filter(t => {
        if (!filtroFuerza) return true
        const perfil = perfiles[t.asignado_a]
        return perfil?.fuerza_de_venta === filtroFuerza
      })
      .map(t => ({
        id: `tarea-${t.id}`,
        tipo: 'tarea' as const,
        fecha: t.fecha_vencimiento,
        titulo: t.titulo,
        detalle: t.descripcion,
        fuerza_de_venta: perfiles[t.asignado_a]?.fuerza_de_venta ?? '',
        ref_id: t.id,
        ref_url: '/tareas',
        meta: {
          asignado: perfiles[t.asignado_a]?.nombre ?? 'Sin asignar',
          prioridad: t.prioridad,
          estado: t.estado,
        },
      }))

    setEventos([...eventosVisitas, ...eventosTareas])
    setLoading(false)
  }, [inicio, fin, filtroFuerza])

  useEffect(() => { cargar() }, [cargar])

  // Agrupar por día
  const eventosPorDia = useMemo(() => {
    const mapa: Record<string, EventoCalendario[]> = {}
    for (const ev of eventos) {
      if (!mapa[ev.fecha]) mapa[ev.fecha] = []
      mapa[ev.fecha].push(ev)
    }
    return mapa
  }, [eventos])

  // Fuerzas de venta únicas
  const fuerzas = useMemo(() => {
    return [...new Set(eventos.map(e => e.fuerza_de_venta).filter(Boolean))].sort()
  }, [eventos])

  return { eventos, eventosPorDia, loading, fuerzas, recargar: cargar }
}
