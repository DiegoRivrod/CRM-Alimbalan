import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface VendedorResumen {
  fuerza_de_venta: string
  total_ventas: number
  total_kg: number
  clientes_atendidos: number
  num_facturas: number
  visitas_realizadas: number
  meta_total: number
  pct_cumplimiento: number
  semanas: { semana: string; ventas: number }[]
}

export interface VendedorTopCliente {
  idcliente: string
  nombre: string
  total_ventas: number
  total_kg: number
  num_facturas: number
  ultima_fecha: string
}

export interface VendedorLineaVenta {
  lineas: string
  total_ventas: number
  total_kg: number
}

// ── useVendedores — métricas agregadas por fuerza_de_venta ───────────────────

export function useVendedores(mes?: string, anio?: number) {
  const q = useQuery({
    queryKey: ['vendedores', 'lista', { mes: mes ?? null, anio: anio ?? null }],
    queryFn: async (): Promise<VendedorResumen[]> => {
      // Facturas filtradas
      let req = supabase
        .from('facturas')
        .select('fuerza_de_venta,valortotal,pesokgrtot,idcliente,semana,mes,anio')
        .neq('tipodocume', 'Notas de Crédito')
        .gt('valortotal', 0)

      if (mes)  req = req.eq('mes', mes.toUpperCase())
      if (anio) req = req.eq('anio', anio)

      const { data: rawFacturas, error } = await req
      if (error) throw new Error(error.message)
      const facturas = (rawFacturas ?? []) as Array<{
        fuerza_de_venta: string | null; valortotal: number | null; pesokgrtot: number | null
        idcliente: string | null; semana: string | null; mes: string | null; anio: number | null
      }>

      const [{ data: rawVisitas }, { data: rawMetas }, { data: rawClientes }] = await Promise.all([
        supabase.from('visitas').select('fuerza_de_venta,marca_temporal'),
        supabase.from('metas').select('cod,meta'),
        supabase.from('clientes').select('responsable,cod'),
      ])

      const visitas  = (rawVisitas  ?? []) as Array<{ fuerza_de_venta: string | null; marca_temporal: string }>
      const metas    = (rawMetas    ?? []) as Array<{ cod: string; meta: number | null }>
      const clientes = (rawClientes ?? []) as Array<{ responsable: string | null; cod: string | null }>
      void clientes  // referenciado solo para mantener forma de la query (no usado en agregación)

      // Mapa de meta total por fuerza_de_venta (vía prefijo del cod)
      const metaPorFDV = new Map<string, number>()
      for (const m of metas) {
        const fdv = m.cod.split('-')[0]
        metaPorFDV.set(fdv, (metaPorFDV.get(fdv) ?? 0) + (m.meta ?? 0))
      }

      // Visitas por fuerza_de_venta
      const visitasPorFDV = new Map<string, number>()
      for (const v of visitas) {
        if (!v.fuerza_de_venta) continue
        visitasPorFDV.set(v.fuerza_de_venta, (visitasPorFDV.get(v.fuerza_de_venta) ?? 0) + 1)
      }

      // Agregar facturas
      type Acum = {
        ventas: number; kg: number; clientesSet: Set<string>
        facturas: number; semanas: Map<string, number>
      }
      const agg = new Map<string, Acum>()

      for (const f of facturas) {
        const fdv = f.fuerza_de_venta ?? 'Sin asignar'
        if (!agg.has(fdv)) {
          agg.set(fdv, { ventas: 0, kg: 0, clientesSet: new Set(), facturas: 0, semanas: new Map() })
        }
        const a = agg.get(fdv)!
        a.ventas   += f.valortotal ?? 0
        a.kg       += f.pesokgrtot ?? 0
        a.facturas += 1
        if (f.idcliente) a.clientesSet.add(f.idcliente)
        if (f.semana) a.semanas.set(f.semana, (a.semanas.get(f.semana) ?? 0) + (f.valortotal ?? 0))
      }

      const result: VendedorResumen[] = []
      for (const [fdv, a] of agg.entries()) {
        const meta = metaPorFDV.get(fdv) ?? 0
        result.push({
          fuerza_de_venta:    fdv,
          total_ventas:       Math.round(a.ventas),
          total_kg:           Math.round(a.kg),
          clientes_atendidos: a.clientesSet.size,
          num_facturas:       a.facturas,
          visitas_realizadas: visitasPorFDV.get(fdv) ?? 0,
          meta_total:         meta,
          pct_cumplimiento:   meta > 0 ? Math.round((a.ventas / meta) * 100) : 0,
          semanas: ['SEMANA 1','SEMANA 2','SEMANA 3','SEMANA 4'].map(s => ({
            semana: s,
            ventas: Math.round(a.semanas.get(s) ?? 0),
          })),
        })
      }

      result.sort((a, b) => b.total_ventas - a.total_ventas)
      return result
    },
  })

  return {
    vendedores: q.data ?? [],
    loading: q.isLoading,
    error: q.error ? q.error.message : null,
  }
}

// ── useVendedorDetalle — top clientes y líneas de un vendedor ────────────────

export function useVendedorDetalle(fuerza: string, mes?: string, anio?: number) {
  const q = useQuery({
    queryKey: ['vendedores', 'detalle', fuerza, { mes: mes ?? null, anio: anio ?? null }],
    enabled: !!fuerza,
    queryFn: async () => {
      let req = supabase
        .from('facturas')
        .select('idcliente,nombre,valortotal,pesokgrtot,lineas,fecha')
        .eq('fuerza_de_venta', fuerza)
        .neq('tipodocume', 'Notas de Crédito')
        .gt('valortotal', 0)

      if (mes)  req = req.eq('mes', mes.toUpperCase())
      if (anio) req = req.eq('anio', anio)

      const { data: rawF } = await req
      const facturas = (rawF ?? []) as Array<{
        idcliente: string | null; nombre: string | null; valortotal: number | null
        pesokgrtot: number | null; lineas: string | null; fecha: string
      }>

      type CAcum = { nombre: string; ventas: number; kg: number; count: number; ultima: string }
      const cMap = new Map<string, CAcum>()
      type LAcum = { ventas: number; kg: number }
      const lMap = new Map<string, LAcum>()

      for (const f of facturas) {
        if (f.idcliente) {
          const c = cMap.get(f.idcliente) ?? { nombre: f.nombre ?? '', ventas: 0, kg: 0, count: 0, ultima: f.fecha }
          c.ventas += f.valortotal ?? 0
          c.kg     += f.pesokgrtot ?? 0
          c.count  += 1
          if (f.fecha > c.ultima) c.ultima = f.fecha
          cMap.set(f.idcliente, c)
        }
        if (f.lineas) {
          const l = lMap.get(f.lineas) ?? { ventas: 0, kg: 0 }
          l.ventas += f.valortotal ?? 0
          l.kg     += f.pesokgrtot ?? 0
          lMap.set(f.lineas, l)
        }
      }

      const topClientes: VendedorTopCliente[] = [...cMap.entries()]
        .map(([id, c]) => ({
          idcliente: id, nombre: c.nombre,
          total_ventas: Math.round(c.ventas), total_kg: Math.round(c.kg),
          num_facturas: c.count, ultima_fecha: c.ultima,
        }))
        .sort((a, b) => b.total_ventas - a.total_ventas)
        .slice(0, 10)

      const lineas: VendedorLineaVenta[] = [...lMap.entries()]
        .map(([l, v]) => ({ lineas: l, total_ventas: Math.round(v.ventas), total_kg: Math.round(v.kg) }))
        .sort((a, b) => b.total_ventas - a.total_ventas)

      return { topClientes, lineas }
    },
  })

  return {
    topClientes: q.data?.topClientes ?? [],
    lineas: q.data?.lineas ?? [],
    loading: q.isLoading,
  }
}
