import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryClient } from '@/lib/queryClient'

// ── Tipos ────────────────────────────────────────────────────────────────────

export type EstadoProspecto = 'nuevo' | 'seguimiento' | 'convertido' | 'perdido'

export interface ProspectoRow {
  id: string
  nombre: string
  contacto: string | null
  fuerza_de_venta: string
  zona: string | null
  especie: string | null
  potencial_tn: number | null
  marcas_consume: string | null
  estado: EstadoProspecto
  idcliente_sugerido: string | null
  match_confianza: number | null
  match_aprobado: boolean
  match_aprobado_at: string | null
  primera_factura_docventa: string | null
  fecha_conversion: string | null
  created_at: string
  updated_at: string
  // joins opcionales
  visita_id: string | null
  cliente_sugerido_nombre?: string | null
}

export interface ProspectoDetalle extends ProspectoRow {
  visita: {
    marca_temporal: string
    localizacion: string | null
    especie: string | null
    tipo_cliente: string | null
    animales: number | null
    granjas: number | null
    potencial_consumo_tn: number | null
    marcas_consume: string | null
    lineas_productos: string | null
    problema_abastecimiento: string | null
    procedencia: string | null
  } | null
  cliente_sugerido: {
    idcliente: string
    nombre: string
    departamento: string | null
    zona: string | null
    responsable: string | null
    canal_cluster: string | null
  } | null
}

export interface ClienteSimilar {
  idcliente: string
  nombre: string
  departamento: string | null
  zona: string | null
  responsable: string | null
  similitud: number // 0-1
}

// ── Utilidades de similitud (puras, no necesitan React) ──────────────────────

function normalizarNombre(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quitar acentos
    .replace(/\b(s\.?a\.?c?\.?|e\.?i\.?r\.?l\.?|s\.?r\.?l\.?|s\.?a\.?|sac|eirl|srl|sa)\b/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function similitudTrigrama(a: string, b: string): number {
  if (a === b) return 1
  if (a.length < 2 || b.length < 2) return 0

  const trigramas = (s: string): Set<string> => {
    const t = new Set<string>()
    const padded = `  ${s} `
    for (let i = 0; i < padded.length - 2; i++) t.add(padded.slice(i, i + 3))
    return t
  }

  const ta = trigramas(a)
  const tb = trigramas(b)
  let interseccion = 0
  ta.forEach(t => { if (tb.has(t)) interseccion++ })
  return (2 * interseccion) / (ta.size + tb.size)
}

export function buscarClientesSimilares(
  nombre: string,
  clientes: { idcliente: string; nombre: string; departamento: string | null; zona: string | null; responsable: string | null }[],
  topN = 5
): ClienteSimilar[] {
  const query = normalizarNombre(nombre)
  return clientes
    .map(c => ({
      ...c,
      similitud: similitudTrigrama(query, normalizarNombre(c.nombre)),
    }))
    .filter(c => c.similitud > 0.2)
    .sort((a, b) => b.similitud - a.similitud)
    .slice(0, topN)
}

// ── useProspectos — lista filtrable ──────────────────────────────────────────

export function useProspectos(
  filtroEstado: EstadoProspecto | 'todos' = 'todos',
  filtroFuerza?: string,
) {
  const q = useQuery({
    queryKey: ['prospectos', 'lista', { estado: filtroEstado, fuerza: filtroFuerza ?? null }],
    queryFn: async (): Promise<ProspectoRow[]> => {
      let req = supabase
        .from('prospectos')
        .select(`
          id, nombre, contacto, fuerza_de_venta, zona, especie,
          potencial_tn, marcas_consume, estado,
          idcliente_sugerido, match_confianza, match_aprobado,
          match_aprobado_at, primera_factura_docventa,
          fecha_conversion, created_at, updated_at, visita_id
        `)
        .order('created_at', { ascending: false })

      if (filtroEstado !== 'todos') req = req.eq('estado', filtroEstado)
      if (filtroFuerza)              req = req.eq('fuerza_de_venta', filtroFuerza)

      const { data: rawData, error } = await req
      if (error) throw new Error(error.message)

      const rows = (rawData ?? []) as ProspectoRow[]

      // Enriquecer con nombre del cliente sugerido en una segunda query
      const ids = [...new Set(rows.map(p => p.idcliente_sugerido).filter(Boolean))] as string[]
      const nombresPorId: Record<string, string> = {}

      if (ids.length > 0) {
        const { data: clientes } = await supabase
          .from('clientes')
          .select('idcliente, nombre')
          .in('idcliente', ids)
        ;(clientes as Array<{ idcliente: string; nombre: string }> ?? [])
          .forEach(c => { nombresPorId[c.idcliente] = c.nombre })
      }

      return rows.map(p => ({
        ...p,
        estado: p.estado as EstadoProspecto,
        cliente_sugerido_nombre: p.idcliente_sugerido ? nombresPorId[p.idcliente_sugerido] ?? null : null,
      }))
    },
  })

  return {
    prospectos: q.data ?? [],
    loading: q.isLoading,
    error: q.error ? q.error.message : null,
    recargar: () => q.refetch(),
  }
}

// ── useProspectoDetalle — detalle con visita y cliente sugerido ──────────────

export function useProspectoDetalle(id: string) {
  const q = useQuery({
    queryKey: ['prospectos', 'detalle', id],
    enabled: !!id,
    queryFn: async (): Promise<ProspectoDetalle> => {
      const { data: rawP, error } = await supabase
        .from('prospectos')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !rawP) throw new Error(error?.message ?? 'No encontrado')

      const p = rawP as ProspectoRow

      const [visRes, cliRes] = await Promise.all([
        p.visita_id
          ? supabase.from('visitas')
              .select('marca_temporal,localizacion,especie,tipo_cliente,animales,granjas,potencial_consumo_tn,marcas_consume,lineas_productos,problema_abastecimiento,procedencia')
              .eq('id', p.visita_id)
              .single()
          : Promise.resolve({ data: null }),
        p.idcliente_sugerido
          ? supabase.from('clientes')
              .select('idcliente,nombre,departamento,zona,responsable,canal_cluster')
              .eq('idcliente', p.idcliente_sugerido)
              .single()
          : Promise.resolve({ data: null }),
      ])

      return {
        ...p,
        estado: p.estado as EstadoProspecto,
        visita: (visRes.data as ProspectoDetalle['visita']) ?? null,
        cliente_sugerido: (cliRes.data as ProspectoDetalle['cliente_sugerido']) ?? null,
      }
    },
  })

  return {
    prospecto: q.data ?? null,
    loading: q.isLoading,
    error: q.error ? q.error.message : null,
    recargar: () => q.refetch(),
  }
}

// ── Acciones (auto-invalidan cache de prospectos al terminar) ────────────────

function invalidarProspectos() {
  queryClient.invalidateQueries({ queryKey: ['prospectos'] })
}

export async function aprobarMatch(
  prospectoId: string,
  idcliente: string,
  confianza: number,
  usuarioId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('prospectos')
    .update({
      idcliente_sugerido:  idcliente,
      match_confianza:     confianza,
      match_aprobado:      true,
      match_aprobado_por:  usuarioId,
      match_aprobado_at:   new Date().toISOString(),
      estado:              'seguimiento',
    } as never)
    .eq('id', prospectoId)
  if (!error) invalidarProspectos()
  return { error: error?.message ?? null }
}

export async function rechazarMatch(prospectoId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('prospectos')
    .update({
      idcliente_sugerido: null,
      match_confianza:    null,
      match_aprobado:     false,
      match_aprobado_por: null,
      match_aprobado_at:  null,
    } as never)
    .eq('id', prospectoId)
  if (!error) invalidarProspectos()
  return { error: error?.message ?? null }
}

export async function cambiarEstado(
  prospectoId: string,
  estado: EstadoProspecto,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('prospectos')
    .update({ estado: estado as string } as never)
    .eq('id', prospectoId)
  if (!error) invalidarProspectos()
  return { error: error?.message ?? null }
}
