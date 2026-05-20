import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Tarea, EstadoTarea } from '@/types/supabase'

// ── Tipos para filtros ───────────────────────────────────────────────────────

export interface FiltrosTareas {
  estado?: EstadoTarea | 'todas'
  asignado_a?: string
  prospecto_id?: string
  idcliente?: string
  vencidas?: boolean
}

export interface TareaConNombres extends Tarea {
  asignado_nombre: string
  creador_nombre: string
  prospecto_nombre: string | null
  cliente_nombre: string | null
}

export interface CrearTareaPayload {
  titulo: string
  descripcion?: string
  tipo?: Tarea['tipo']
  prioridad?: Tarea['prioridad']
  fecha_vencimiento?: string | null
  asignado_a: string
  prospecto_id?: string | null
  idcliente?: string | null
}

// ── Helper: resolver nombres ─────────────────────────────────────────────────

async function enriquecerTareas(tareas: Tarea[]): Promise<TareaConNombres[]> {
  if (tareas.length === 0) return []

  const userIds = [...new Set([
    ...tareas.map(t => t.asignado_a),
    ...tareas.map(t => t.creado_por),
  ])]
  const prospectoIds = [...new Set(tareas.map(t => t.prospecto_id).filter(Boolean))] as string[]
  const clienteIds = [...new Set(tareas.map(t => t.idcliente).filter(Boolean))] as string[]

  const [perfilesRes, prospectosRes, clientesRes] = await Promise.all([
    supabase.from('profiles').select('id, nombre').in('id', userIds),
    prospectoIds.length > 0
      ? supabase.from('prospectos').select('id, nombre').in('id', prospectoIds)
      : Promise.resolve({ data: [] }),
    clienteIds.length > 0
      ? supabase.from('clientes').select('idcliente, nombre').in('idcliente', clienteIds)
      : Promise.resolve({ data: [] }),
  ])

  const nombres: Record<string, string> = {}
  ;((perfilesRes.data ?? []) as { id: string; nombre: string }[]).forEach(p => {
    nombres[p.id] = p.nombre
  })

  const prospectosNombres: Record<string, string> = {}
  ;((prospectosRes.data ?? []) as { id: string; nombre: string }[]).forEach(p => {
    prospectosNombres[p.id] = p.nombre
  })

  const clientesNombres: Record<string, string> = {}
  ;((clientesRes.data ?? []) as { idcliente: string; nombre: string }[]).forEach(c => {
    clientesNombres[c.idcliente] = c.nombre
  })

  return tareas.map(t => ({
    ...t,
    asignado_nombre: nombres[t.asignado_a] ?? 'Usuario',
    creador_nombre: nombres[t.creado_por] ?? 'Usuario',
    prospecto_nombre: t.prospecto_id ? prospectosNombres[t.prospecto_id] ?? null : null,
    cliente_nombre: t.idcliente ? clientesNombres[t.idcliente] ?? null : null,
  }))
}

// ── Hook principal ───────────────────────────────────────────────────────────

export function useTareas(filtros: FiltrosTareas = {}) {
  const [tareas, setTareas] = useState<TareaConNombres[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)

    let q = supabase
      .from('tareas')
      .select('*')
      .order('created_at', { ascending: false })

    if (filtros.estado && filtros.estado !== 'todas') {
      q = q.eq('estado', filtros.estado)
    }
    if (filtros.asignado_a) q = q.eq('asignado_a', filtros.asignado_a)
    if (filtros.prospecto_id) q = q.eq('prospecto_id', filtros.prospecto_id)
    if (filtros.idcliente) q = q.eq('idcliente', filtros.idcliente)
    if (filtros.vencidas) {
      q = q.in('estado', ['pendiente', 'en_progreso'])
        .lt('fecha_vencimiento', new Date().toISOString().split('T')[0])
    }

    const { data, error: err } = await q
    if (err) { setError(err.message); setLoading(false); return }

    const enriquecidas = await enriquecerTareas((data ?? []) as Tarea[])
    setTareas(enriquecidas)
    setLoading(false)
  }, [filtros.estado, filtros.asignado_a, filtros.prospecto_id, filtros.idcliente, filtros.vencidas])

  useEffect(() => { cargar() }, [cargar])

  return { tareas, loading, error, recargar: cargar }
}

// ── Acciones ─────────────────────────────────────────────────────────────────

export async function crearTarea(
  payload: CrearTareaPayload
): Promise<{ data: Tarea | null; error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  const { data, error } = await supabase
    .from('tareas')
    .insert({
      titulo: payload.titulo,
      descripcion: payload.descripcion ?? null,
      tipo: payload.tipo ?? 'general',
      prioridad: payload.prioridad ?? 'media',
      fecha_vencimiento: payload.fecha_vencimiento ?? null,
      asignado_a: payload.asignado_a,
      creado_por: user.id,
      prospecto_id: payload.prospecto_id ?? null,
      idcliente: payload.idcliente ?? null,
    } as never)
    .select('*')
    .single()

  if (!error) {
    // Registrar actividad
    await supabase.from('actividad').insert({
      tipo: 'tarea_creada',
      nota: `Tarea creada: ${payload.titulo}`,
      prospecto_id: payload.prospecto_id ?? null,
      idcliente: payload.idcliente ?? null,
      usuario_id: user.id,
    } as never)

    // Notificar al asignado (si es otro usuario)
    if (payload.asignado_a !== user.id) {
      await supabase.from('notificaciones').insert({
        usuario_id: payload.asignado_a,
        tipo: 'tarea_asignada',
        titulo: `Nueva tarea asignada: ${payload.titulo}`,
        mensaje: `Se te ha asignado la tarea "${payload.titulo}"`,
        tarea_id: (data as Tarea)?.id ?? null,
        link: '/tareas',
      } as never)
    }
  }

  return { data: (data as unknown as Tarea) ?? null, error: error?.message ?? null }
}

export async function actualizarTarea(
  id: string,
  cambios: Partial<Pick<Tarea, 'titulo' | 'descripcion' | 'tipo' | 'prioridad' | 'estado' | 'fecha_vencimiento' | 'asignado_a'>>
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('tareas')
    .update(cambios as never)
    .eq('id', id)
  return { error: error?.message ?? null }
}

export async function completarTarea(id: string): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser()

  const { data: tarea, error } = await supabase
    .from('tareas')
    .update({
      estado: 'completada',
      completada_at: new Date().toISOString(),
    } as never)
    .eq('id', id)
    .select('titulo, prospecto_id, idcliente')
    .single()

  if (!error && user && tarea) {
    const t = tarea as { titulo: string; prospecto_id: string | null; idcliente: string | null }
    await supabase.from('actividad').insert({
      tipo: 'tarea_completada',
      nota: `Tarea completada: ${t.titulo}`,
      prospecto_id: t.prospecto_id,
      idcliente: t.idcliente,
      usuario_id: user.id,
    } as never)
  }

  return { error: error?.message ?? null }
}
