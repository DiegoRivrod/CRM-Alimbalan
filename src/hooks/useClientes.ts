import { useEffect, useState } from 'react'
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

export function useClientes() {
  const [clientes, setClientes] = useState<ClienteResumen[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      // Usamos la vista clientes_ultima_factura definida en el schema
      const { data, error } = await supabase
        .from('clientes_ultima_factura')
        .select('*')
        .order('nombre', { ascending: true })

      if (error) setError(error.message)
      else setClientes((data ?? []) as ClienteResumen[])
      setLoading(false)
    }
    load()
  }, [])

  return { clientes, loading, error }
}

export function useClienteDetalle(idcliente: string) {
  const [cliente, setCliente]   = useState<ClienteDetalle | null>(null)
  const [facturas, setFacturas] = useState<FacturaTimeline[]>([])
  const [visitas, setVisitas]   = useState<VisitaTimeline[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    if (!idcliente) return
    async function load() {
      setLoading(true)
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
      setCliente(c.data as ClienteDetalle | null)
      setFacturas((f.data ?? []) as FacturaTimeline[])
      setVisitas((v.data ?? []) as VisitaTimeline[])
      setLoading(false)
    }
    load()
  }, [idcliente])

  return { cliente, facturas, visitas, loading }
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
