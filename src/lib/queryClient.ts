import { QueryClient } from '@tanstack/react-query'

/**
 * Cliente global de TanStack Query.
 *
 * staleTime 60s   → durante 1 min los datos son "frescos" y no se refetchean.
 * gcTime    5 min → tras desmontar, los datos quedan en cache 5 min antes de borrarse.
 * retry     1     → reintenta una vez antes de mostrar error (las redes flacas).
 * refetchOnWindowFocus=false → evita re-fetch agresivo al volver al tab; en un CRM
 *   interno no aporta y consume cuota Supabase.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
