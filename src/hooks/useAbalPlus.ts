import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryClient } from '@/lib/queryClient'
import type { TierCliente, PuntosMensuales } from '@/types/supabase'

// ── useTiersClientes — batch para la lista de clientes ──────────────────────

export function useTiersClientes() {
  const q = useQuery({
    queryKey: ['abal-plus', 'tiers'],
    queryFn: async (): Promise<Map<string, TierCliente>> => {
      const { data, error } = await supabase.from('tiers_clientes').select('*')
      if (error) throw new Error(error.message)
      const map = new Map<string, TierCliente>()
      for (const t of (data ?? []) as Array<TierCliente>) map.set(t.idcliente, t)
      return map
    },
  })

  return {
    tiers: q.data ?? new Map<string, TierCliente>(),
    loading: q.isLoading,
  }
}

// ── useAbalPlusCliente — tier + historial de puntos de un cliente ───────────

export function useAbalPlusCliente(idcliente: string) {
  const q = useQuery({
    queryKey: ['abal-plus', 'cliente', idcliente],
    enabled: !!idcliente,
    queryFn: async () => {
      const [t, p] = await Promise.all([
        supabase.from('tiers_clientes').select('*').eq('idcliente', idcliente).maybeSingle(),
        supabase
          .from('puntos_mensuales')
          .select('*')
          .eq('idcliente', idcliente)
          .order('anio', { ascending: false })
          .order('mes', { ascending: false })
          .limit(12),
      ])
      return {
        tier: (t.data as TierCliente | null) ?? null,
        puntos: (p.data ?? []) as Array<PuntosMensuales>,
      }
    },
  })

  return {
    tier: q.data?.tier ?? null,
    puntos: q.data?.puntos ?? [],
    loading: q.isLoading,
  }
}

// ── useAbalPlusDashboard — vista agregada del padrón ABAL+ ──────────────────

export function useAbalPlusDashboard() {
  const q = useQuery({
    queryKey: ['abal-plus', 'dashboard'],
    queryFn: async (): Promise<Array<TierCliente>> => {
      const { data, error } = await supabase
        .from('tiers_clientes')
        .select('*')
        .order('puntos_12m', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as Array<TierCliente>
    },
  })

  return {
    tiers: q.data ?? [],
    loading: q.isLoading,
    error: q.error instanceof Error ? q.error.message : null,
    recargar: () => q.refetch(),
  }
}

// ── useAbalPlusRealtime — invalida cache cuando tiers_clientes cambia ──────

export function useAbalPlusRealtime() {
  useEffect(() => {
    let cancelado = false
    let cleanup: (() => void) | undefined

    const setup = async () => {
      if (cancelado) return
      const channel = supabase
        .channel('tiers-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tiers_clientes' },
          () => {
            queryClient.invalidateQueries({ queryKey: ['abal-plus'] })
          },
        )
        .subscribe()
      return () => { supabase.removeChannel(channel) }
    }

    setup().then(fn => { cleanup = fn })

    return () => {
      cancelado = true
      cleanup?.()
    }
  }, [])
}

// Re-export de helpers puros (lógica testeada en src/lib/abalPlus.ts)
export { TIER_CONFIG, TIER_THRESHOLDS, nextTierInfo } from '@/lib/abalPlus'
