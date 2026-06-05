import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface PinMapa {
  id: string
  lat: number
  lng: number
  tipo: 'cliente' | 'prospecto'
  nombre: string
  fuerza_de_venta: string
  zona: string | null
  especie: string | null
  ultima_visita: string        // ISO date string
  idcliente: string | null
}

export function useMapa(filtroFuerza?: string) {
  const q = useQuery({
    queryKey: ['mapa', 'visitas', { fuerza: filtroFuerza ?? null }],
    queryFn: async (): Promise<PinMapa[]> => {
      let req = supabase
        .from('visitas')
        .select('id, marca_temporal, fuerza_de_venta, latitud, longitud, zona, especie, es_cliente_nuevo, idcliente, nombre_cliente_nuevo')
        .not('latitud', 'is', null)
        .not('longitud', 'is', null)
        .order('marca_temporal', { ascending: false })

      if (filtroFuerza) req = req.eq('fuerza_de_venta', filtroFuerza)

      const { data, error } = await req
      if (error) throw new Error(error.message)

      const rows = (data ?? []) as Array<{
        id: string
        marca_temporal: string
        fuerza_de_venta: string
        latitud: number
        longitud: number
        zona: string | null
        especie: string | null
        es_cliente_nuevo: boolean
        idcliente: string | null
        nombre_cliente_nuevo: string | null
      }>

      // Agrupar por idcliente (para clientes existentes) o por id (para prospectos)
      // Solo el pin más reciente por cliente/prospecto
      const seenClientes = new Set<string>()
      const seenProspectos = new Set<string>()
      const pins: PinMapa[] = []

      for (const v of rows) {
        if (!v.es_cliente_nuevo && v.idcliente) {
          if (seenClientes.has(v.idcliente)) continue
          seenClientes.add(v.idcliente)
          pins.push({
            id: `c-${v.idcliente}`,
            lat: v.latitud,
            lng: v.longitud,
            tipo: 'cliente',
            nombre: v.idcliente,           // se enriquece abajo
            fuerza_de_venta: v.fuerza_de_venta,
            zona: v.zona,
            especie: v.especie,
            ultima_visita: v.marca_temporal,
            idcliente: v.idcliente,
          })
        } else {
          // prospecto (visita a cliente nuevo)
          const key = v.nombre_cliente_nuevo ?? v.id
          if (seenProspectos.has(key)) continue
          seenProspectos.add(key)
          pins.push({
            id: `p-${v.id}`,
            lat: v.latitud,
            lng: v.longitud,
            tipo: 'prospecto',
            nombre: v.nombre_cliente_nuevo ?? 'Prospecto sin nombre',
            fuerza_de_venta: v.fuerza_de_venta,
            zona: v.zona,
            especie: v.especie,
            ultima_visita: v.marca_temporal,
            idcliente: null,
          })
        }
      }

      // Enriquecer nombres de clientes existentes
      const clienteIds = pins.filter(p => p.tipo === 'cliente' && p.idcliente).map(p => p.idcliente!)
      if (clienteIds.length > 0) {
        const { data: clientes } = await supabase
          .from('clientes')
          .select('idcliente, nombre')
          .in('idcliente', clienteIds)
        const nombreMap: Record<string, string> = {}
        ;(clientes as Array<{ idcliente: string; nombre: string }> ?? []).forEach(c => {
          nombreMap[c.idcliente] = c.nombre
        })
        for (const pin of pins) {
          if (pin.tipo === 'cliente' && pin.idcliente && nombreMap[pin.idcliente]) {
            pin.nombre = nombreMap[pin.idcliente]
          }
        }
      }

      return pins
    },
  })

  // Lista única de fuerzas para el filtro
  const fuerzas = [...new Set((q.data ?? []).map(p => p.fuerza_de_venta))].sort()

  return {
    pins: q.data ?? [],
    fuerzas,
    loading: q.isLoading,
    error: q.error ? (q.error as Error).message : null,
  }
}
