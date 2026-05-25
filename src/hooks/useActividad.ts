import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryClient } from '@/lib/queryClient'
import type { Actividad, TipoActividad } from '@/types/supabase'

export type ActividadConAutor = Actividad & { autor_nombre: string }

// ── Helper: resolver nombres de autores ──────────────────────────────────────

async function resolverAutores(
  actividades: Actividad[],
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

// ── insertarActividad (mutación; invalida cache después) ─────────────────────

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

  // Invalidar todas las vistas de actividad para que se refresquen
  queryClient.invalidateQueries({ queryKey: ['actividad'] })

  return {
    ...(raw as Actividad),
    autor_nombre: (perfil as { nombre: string } | null)?.nombre ?? 'Tú',
  }
}

// ── useActividadProspecto ────────────────────────────────────────────────────

export function useActividadProspecto(prospecto_id: string) {
  const q = useQuery({
    queryKey: ['actividad', 'prospecto', prospecto_id],
    enabled: !!prospecto_id,
    queryFn: async (): Promise<ActividadConAutor[]> => {
      const { data: raw, error } = await supabase
        .from('actividad')
        .select('*')
        .eq('prospecto_id', prospecto_id)
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return resolverAutores((raw ?? []) as Actividad[])
    },
  })

  return {
    actividades: q.data ?? [],
    loading: q.isLoading,
    crearActividad: async (tipo: TipoActividad, nota?: string) => {
      await insertarActividad({ tipo, nota, prospecto_id })
      // El invalidate dentro de insertarActividad ya refresca esta query
    },
  }
}

// ── useActividadCliente ──────────────────────────────────────────────────────

export function useActividadCliente(idcliente: string) {
  const q = useQuery({
    queryKey: ['actividad', 'cliente', idcliente],
    enabled: !!idcliente,
    queryFn: async (): Promise<ActividadConAutor[]> => {
      const { data: raw, error } = await supabase
        .from('actividad')
        .select('*')
        .eq('idcliente', idcliente)
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return resolverAutores((raw ?? []) as Actividad[])
    },
  })

  return {
    actividades: q.data ?? [],
    loading: q.isLoading,
    crearActividad: async (tipo: TipoActividad, nota?: string) => {
      await insertarActividad({ tipo, nota, idcliente })
    },
  }
}

// ── useActividadGlobal (call center) ─────────────────────────────────────────

export function useActividadGlobal(limite = 20) {
  const q = useQuery({
    queryKey: ['actividad', 'global', limite],
    queryFn: async (): Promise<ActividadConAutor[]> => {
      const { data: raw, error } = await supabase
        .from('actividad')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limite)
      if (error) throw new Error(error.message)
      return resolverAutores((raw ?? []) as Actividad[])
    },
  })

  return {
    actividades: q.data ?? [],
    loading: q.isLoading,
  }
}
