import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Actividad, TipoActividad } from '@/types/supabase'

export type ActividadConAutor = Actividad & { autor_nombre: string }

// ── Helper: resolver nombres de autores ──────────────────────────────────────

async function resolverAutores(
  actividades: Actividad[]
): Promise<ActividadConAutor[]> {
  if (actividades.length === 0) return []

  const ids = [...new Set(actividades.map(a => a.usuario_id))]
  const { data: perfiles } = await supabase
    .from('profiles')
    .select('id, nombre')
    .in('id', ids)

  const mapaAutores: Record<string, string> = {}
  ;(perfiles ?? []).forEach((p: { id: string; nombre: string }) => {
    mapaAutores[p.id] = p.nombre
  })

  return actividades.map(a => ({
    ...a,
    autor_nombre: mapaAutores[a.usuario_id] ?? 'Usuario',
  }))
}

// ── crearActividad (compartido) ───────────────────────────────────────────────

async function insertarActividad(payload: {
  tipo: TipoActividad
  nota?: string
  prospecto_id?: string
  idcliente?: string
}): Promise<ActividadConAutor | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: raw, error } = await supabase
    .from('actividad')
    .insert({
      tipo: payload.tipo,
      nota: payload.nota ?? null,
      prospecto_id: payload.prospecto_id ?? null,
      idcliente: payload.idcliente ?? null,
      usuario_id: user.id,
    } as never)
    .select('*')
    .single()

  if (error || !raw) return null

  const { data: perfil } = await supabase
    .from('profiles')
    .select('nombre')
    .eq('id', user.id)
    .single()

  return {
    ...(raw as Actividad),
    autor_nombre: (perfil as { nombre: string } | null)?.nombre ?? 'Tú',
  }
}

// ── useActividadProspecto ─────────────────────────────────────────────────────

export function useActividadProspecto(prospecto_id: string) {
  const [actividades, setActividades] = useState<ActividadConAutor[]>([])
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    if (!prospecto_id) return
    setLoading(true)
    const { data: raw } = await supabase
      .from('actividad')
      .select('*')
      .eq('prospecto_id', prospecto_id)
      .order('created_at', { ascending: false })

    const lista = await resolverAutores((raw ?? []) as Actividad[])
    setActividades(lista)
    setLoading(false)
  }, [prospecto_id])

  useEffect(() => { cargar() }, [cargar])

  const crearActividad = useCallback(
    async (tipo: TipoActividad, nota?: string) => {
      const nueva = await insertarActividad({ tipo, nota, prospecto_id })
      if (nueva) setActividades(prev => [nueva, ...prev])
    },
    [prospecto_id]
  )

  return { actividades, loading, crearActividad }
}

// ── useActividadCliente ───────────────────────────────────────────────────────

export function useActividadCliente(idcliente: string) {
  const [actividades, setActividades] = useState<ActividadConAutor[]>([])
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    if (!idcliente) return
    setLoading(true)
    const { data: raw } = await supabase
      .from('actividad')
      .select('*')
      .eq('idcliente', idcliente)
      .order('created_at', { ascending: false })

    const lista = await resolverAutores((raw ?? []) as Actividad[])
    setActividades(lista)
    setLoading(false)
  }, [idcliente])

  useEffect(() => { cargar() }, [cargar])

  const crearActividad = useCallback(
    async (tipo: TipoActividad, nota?: string) => {
      const nueva = await insertarActividad({ tipo, nota, idcliente })
      if (nueva) setActividades(prev => [nueva, ...prev])
    },
    [idcliente]
  )

  return { actividades, loading, crearActividad }
}

// ── useActividadGlobal (para call center) ────────────────────────────────────

export function useActividadGlobal(limite = 20) {
  const [actividades, setActividades] = useState<ActividadConAutor[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const cargar = async () => {
      const { data: raw } = await supabase
        .from('actividad')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limite)

      const lista = await resolverAutores((raw ?? []) as Actividad[])
      setActividades(lista)
      setLoading(false)
    }
    cargar()
  }, [limite])

  return { actividades, loading }
}
