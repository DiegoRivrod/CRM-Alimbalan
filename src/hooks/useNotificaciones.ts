import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Notificacion } from '@/types/supabase'

export function useNotificaciones() {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data } = await supabase
      .from('notificaciones')
      .select('*')
      .eq('usuario_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    setNotificaciones((data ?? []) as Notificacion[])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // Suscripción Realtime para nuevas notificaciones
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
            setNotificaciones(prev => [nueva, ...prev].slice(0, 50))
          }
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

  const conteoNoLeidas = notificaciones.filter(n => !n.leida).length

  const marcarLeida = useCallback(async (id: string) => {
    await supabase
      .from('notificaciones')
      .update({ leida: true } as never)
      .eq('id', id)

    setNotificaciones(prev =>
      prev.map(n => n.id === id ? { ...n, leida: true } : n)
    )
  }, [])

  const marcarTodasLeidas = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from('notificaciones')
      .update({ leida: true } as never)
      .eq('usuario_id', user.id)
      .eq('leida', false)

    setNotificaciones(prev => prev.map(n => ({ ...n, leida: true })))
  }, [])

  return {
    notificaciones,
    loading,
    conteoNoLeidas,
    marcarLeida,
    marcarTodasLeidas,
    recargar: cargar,
  }
}
