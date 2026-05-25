import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface ClienteResumen {
  idcliente: string
  nombre: string
  responsable: string | null
  zona: string | null
  departamento: string | null
  status: string | null
  canal_cluster: string | null
  ultima_fecha_factura: string | null
  ultimo_valor: number | null
  ultimo_kg: number | null
  ultimo_vendedor: string | null
  ultima_linea: string | null
  ultimo_docventa: string | null
}

export interface ClienteDetalle {
  idcliente: string
  nombre: string
  razon_sg: string | null
  responsable: string | null
  zona: string | null
  departamento: string | null
  provincia: string | null
  distrito: string | null
  canal_cluster: string | null
  lista_precios: string | null
  top: string | null
  status: string | null
  meta_semana_1: number | null
  meta_semana_2: number | null
  meta_semana_3: number | null
  meta_semana_4: number | null
}

export interface FacturaTimeline {
  id: string
  fecha: string
  docventa: string
  desarticul: string | null
  lineas: string | null
  marca: string | null
  cantidadar: number | null
  pesokgrtot: number | null
  valortotal: number
  fuerza_de_venta: string | null
  semana: string | null
  mes: string | null
  anio: number | null
  tipodocume: string
}

export interface VisitaTimeline {
  id: string
  marca_temporal: string
  fuerza_de_venta: string
  es_cliente_nuevo: boolean
  especie: string | null
  tipo_cliente: string | null
  potencial_consumo_tn: number | null
  marcas_consume: string | null
  zona: string | null
}

// ── useClientes — lista (resumen con última factura) ────────────────────────

export function useClientes() {
  const q = useQuery({
    queryKey: ['clientes', 'resumen'],
    queryFn: async (): Promise<ClienteResumen[]> => {
      const { data, error } = await supabase
        .from('clientes_ultima_factura')
        .select('*')
        .order('nombre', { ascending: true })
      if (error) throw new Error(error.message)
      return (data ?? []) as ClienteResumen[]
    },
  })

  return {
    clientes: q.data ?? [],
    loading: q.isLoading,
    error: q.error ? q.error.message : null,
  }
}

// ── useClienteDetalle — detalle + timeline de facturas y visitas ────────────

export function useClienteDetalle(idcliente: string) {
  const q = useQuery({
    queryKey: ['clientes', 'detalle', idcliente],
    enabled: !!idcliente,
    queryFn: async () => {
      const [c, f, v] = await Promise.all([
        supabase.from('clientes').select('*').eq('idcliente', idcliente).single(),
        supabase.from('facturas')
          .select('id,fecha,docventa,desarticul,lineas,marca,cantidadar,pesokgrtot,valortotal,fuerza_de_venta,semana,mes,anio,tipodocume')
          .eq('idcliente', idcliente)
          .neq('tipodocume', 'Notas de Crédito')
          .gt('valortotal', 0)
          .order('fecha', { ascending: false })
          .limit(100),
        supabase.from('visitas')
          .select('id,marca_temporal,fuerza_de_venta,es_cliente_nuevo,especie,tipo_cliente,potencial_consumo_tn,marcas_consume,zona')
          .eq('idcliente', idcliente)
          .order('marca_temporal', { ascending: false })
          .limit(50),
      ])

      return {
        cliente: (c.data as ClienteDetalle | null) ?? null,
        facturas: (f.data ?? []) as FacturaTimeline[],
        visitas: (v.data ?? []) as VisitaTimeline[],
      }
    },
  })

  return {
    cliente: q.data?.cliente ?? null,
    facturas: q.data?.facturas ?? [],
    visitas: q.data?.visitas ?? [],
    loading: q.isLoading,
  }
}
