import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryClient } from '@/lib/queryClient'
import type { Notificacion } from '@/types/supabase'

export function useNotificaciones() {
  const q = useQuery({
    queryKey: ['notificaciones', 'usuario-actual'],
    queryFn: async (): Promise<Notificacion[]> => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      const { data, error } = await supabase
        .from('notificaciones')
        .select('*')
        .eq('usuario_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw new Error(error.message)
      return (data ?? []) as Notificacion[]
    },
  })

  // Suscripción Realtime: inyectamos directo al cache para no tener que refetch
  useEffect(() => {
    let cancelado = false

    const setup = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelado) return

      const channel = supabase
        .channel('notificaciones-realtime')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notificaciones',
            filter: `usuario_id=eq.${user.id}`,
          },
          (payload) => {
            const nueva = payload.new as Notificacion
            queryClient.setQueryData<Notificacion[]>(
              ['notificaciones', 'usuario-actual'],
              prev => [nueva, ...(prev ?? [])].slice(0, 50),
            )
          },
        )
        .subscribe()

      return () => { supabase.removeChannel(channel) }
    }

    let cleanup: (() => void) | undefined
    setup().then(fn => { cleanup = fn })

    return () => {
      cancelado = true
      cleanup?.()
    }
  }, [])

  const notificaciones = q.data ?? []
  const conteoNoLeidas = notificaciones.filter(n => !n.leida).length

  // ── Acciones con optimistic update ─────────────────────────────────────────

  async function marcarLeida(id: string) {
    // Optimistic: actualizar cache YA antes de esperar al server
    queryClient.setQueryData<Notificacion[]>(
      ['notificaciones', 'usuario-actual'],
      prev => (prev ?? []).map(n => n.id === id ? { ...n, leida: true } : n),
    )

    await supabase
      .from('notificaciones')
      .update({ leida: true } as never)
      .eq('id', id)
  }

  async function marcarTodasLeidas() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    queryClient.setQueryData<Notificacion[]>(
      ['notificaciones', 'usuario-actual'],
      prev => (prev ?? []).map(n => ({ ...n, leida: true })),
    )

    await supabase
      .from('notificaciones')
      .update({ leida: true } as never)
      .eq('usuario_id', user.id)
      .eq('leida', false)
  }

  return {
    notificaciones,
    loading: q.isLoading,
    conteoNoLeidas,
    marcarLeida,
    marcarTodasLeidas,
    recargar: () => q.refetch(),
  }
}
