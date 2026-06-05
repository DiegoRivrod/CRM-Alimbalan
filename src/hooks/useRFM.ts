import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type SegmentoRFM =
  | 'champion'
  | 'leal'
  | 'potencial'
  | 'riesgo'
  | 'inactivo'
  | 'nuevo'
  | 'dormido'

export interface ClienteRFM {
  idcliente: string
  nombre: string
  fuerza_de_venta: string | null
  zona: string | null
  departamento: string | null
  // Métricas crudas
  dias_inactividad: number          // días desde última factura
  frecuencia: number                // meses distintos con compra en últimos 12m
  monto_12m: number                 // soles facturados en últimos 12m
  ultima_compra: string             // fecha ISO
  // Scores 1-5
  r_score: number
  f_score: number
  m_score: number
  rfm_score: number                 // suma r+f+m (3-15)
  segmento: SegmentoRFM
}

// Asigna score 1-5 basado en cuartiles (ascendente o descendente)
function asignarScore(valores: number[], valor: number, ascendente: boolean): number {
  const sorted = [...valores].sort((a, b) => a - b)
  const n = sorted.length
  if (n === 0) return 3
  const p20 = sorted[Math.floor(n * 0.2)]
  const p40 = sorted[Math.floor(n * 0.4)]
  const p60 = sorted[Math.floor(n * 0.6)]
  const p80 = sorted[Math.floor(n * 0.8)]

  if (ascendente) {
    // Mayor valor → mayor score
    if (valor >= p80) return 5
    if (valor >= p60) return 4
    if (valor >= p40) return 3
    if (valor >= p20) return 2
    return 1
  } else {
    // Menor valor → mayor score (para recencia: menos días = más reciente)
    if (valor <= p20) return 5
    if (valor <= p40) return 4
    if (valor <= p60) return 3
    if (valor <= p80) return 2
    return 1
  }
}

function clasificarSegmento(r: number, f: number, m: number, diasInactividad: number): SegmentoRFM {
  const rfm = r + f + m
  if (diasInactividad > 180) return 'dormido'
  if (r >= 4 && f >= 4 && m >= 4) return 'champion'
  if (r >= 3 && f >= 3) return 'leal'
  if (r >= 3 && rfm >= 9) return 'potencial'
  if (r <= 2 && rfm >= 8) return 'riesgo'
  if (f === 1 && diasInactividad < 60) return 'nuevo'
  return 'inactivo'
}

export const SEGMENTO_CONFIG: Record<SegmentoRFM, { label: string; color: string; bg: string; descripcion: string }> = {
  champion:  { label: 'Campeón',      color: 'text-emerald-700', bg: 'bg-emerald-50',  descripcion: 'Compra frecuente, alto monto, muy reciente' },
  leal:      { label: 'Leal',         color: 'text-blue-700',    bg: 'bg-blue-50',     descripcion: 'Compra regularmente, buen historial' },
  potencial: { label: 'Potencial',    color: 'text-violet-700',  bg: 'bg-violet-50',   descripcion: 'Reciente y con buen monto, puede crecer' },
  riesgo:    { label: 'En riesgo',    color: 'text-amber-700',   bg: 'bg-amber-50',    descripcion: 'Antes activo, ahora sin compras recientes' },
  nuevo:     { label: 'Nuevo',        color: 'text-cyan-700',    bg: 'bg-cyan-50',     descripcion: 'Primera compra o cliente reciente' },
  inactivo:  { label: 'Inactivo',     color: 'text-gray-600',    bg: 'bg-gray-100',    descripcion: 'Compras esporádicas o bajas' },
  dormido:   { label: 'Dormido',      color: 'text-red-700',     bg: 'bg-red-50',      descripcion: 'Sin compras en más de 6 meses' },
}

export function useRFM(filtroFuerza?: string) {
  const q = useQuery({
    queryKey: ['rfm', 'cartera', { fuerza: filtroFuerza ?? null }],
    queryFn: async (): Promise<ClienteRFM[]> => {
      const hoy = new Date()
      const hace12m = new Date(hoy.getFullYear() - 1, hoy.getMonth(), hoy.getDate()).toISOString().slice(0, 10)

      // Traer facturas de los últimos 12 meses
      let req = supabase
        .from('facturas')
        .select('idcliente, nombre, fecha, valortotal, fuerza_de_venta, zona, departamento')
        .gte('fecha', hace12m)
        .order('fecha', { ascending: false })

      if (filtroFuerza) req = req.eq('fuerza_de_venta', filtroFuerza)

      const { data, error } = await req
      if (error) throw new Error(error.message)

      const rows = (data ?? []) as Array<{
        idcliente: string
        nombre: string
        fecha: string
        valortotal: number
        fuerza_de_venta: string | null
        zona: string | null
        departamento: string | null
      }>

      // Agrupar por cliente
      const porCliente = new Map<string, typeof rows>()
      for (const row of rows) {
        if (!porCliente.has(row.idcliente)) porCliente.set(row.idcliente, [])
        porCliente.get(row.idcliente)!.push(row)
      }

      // Calcular métricas por cliente
      const metricas = Array.from(porCliente.entries()).map(([idcliente, facturas]) => {
        const ultima  = facturas[0].fecha   // ya ordenado desc
        const meses   = new Set(facturas.map(f => f.fecha.slice(0, 7))).size
        const monto   = facturas.reduce((s, f) => s + (f.valortotal ?? 0), 0)
        const dias    = Math.floor((hoy.getTime() - new Date(ultima).getTime()) / 86400000)
        return {
          idcliente,
          nombre:          facturas[0].nombre,
          fuerza_de_venta: facturas[0].fuerza_de_venta,
          zona:            facturas[0].zona,
          departamento:    facturas[0].departamento,
          dias_inactividad: dias,
          frecuencia:      meses,
          monto_12m:       Math.round(monto),
          ultima_compra:   ultima,
        }
      })

      // Calcular scores basados en percentiles de toda la cartera
      const todosR = metricas.map(m => m.dias_inactividad)
      const todosF = metricas.map(m => m.frecuencia)
      const todosM = metricas.map(m => m.monto_12m)

      return metricas.map(m => {
        const r = asignarScore(todosR, m.dias_inactividad, false) // menos días = mejor
        const f = asignarScore(todosF, m.frecuencia,       true)
        const mv = asignarScore(todosM, m.monto_12m,        true)
        return {
          ...m,
          r_score:   r,
          f_score:   f,
          m_score:   mv,
          rfm_score: r + f + mv,
          segmento:  clasificarSegmento(r, f, mv, m.dias_inactividad),
        }
      }).sort((a, b) => b.rfm_score - a.rfm_score)
    },
    staleTime: 5 * 60 * 1000, // 5 min — cálculo costoso
  })

  return {
    clientes: q.data ?? [],
    loading: q.isLoading,
    error: q.error ? (q.error as Error).message : null,
  }
}
