/**
 * ABAL+ — Lógica pura del programa de fidelización (puntos + tiers).
 *
 * Estas funciones replican lo que hace la Edge Function `calcular-puntos`
 * (supabase/functions/calcular-puntos/index.ts). Si cambias una regla aquí,
 * cambia también allá (no hay codegen ni shared module entre Vite y Deno).
 *
 * El módulo es 100% puro: ninguna función toca red, DB ni el DOM.
 */

import type { Tier } from '@/types/supabase'

// ─── Constantes ──────────────────────────────────────────────────────────────

export const TIER_THRESHOLDS = { bronce: 0, plata: 3000, oro: 8000 } as const

export const BONUS_DIVERSIFICACION = 150  // ≥3 líneas distintas en el mes
export const BONUS_FRECUENCIA      = 100  // ≥3 semanas distintas en el mes

export const TIER_CONFIG = {
  bronce: { emoji: '🥉', label: 'Bronce', bg: 'bg-amber-100 text-amber-800', bar: 'bg-amber-400' },
  plata:  { emoji: '🥈', label: 'Plata',  bg: 'bg-slate-100 text-slate-600', bar: 'bg-slate-400' },
  oro:    { emoji: '🥇', label: 'Oro',     bg: 'bg-yellow-100 text-yellow-700', bar: 'bg-yellow-500' },
} as const

const MESES_ES = [
  'ENERO', 'FEBRERO', 'MARZO',    'ABRIL',
  'MAYO',  'JUNIO',   'JULIO',    'AGOSTO',
  'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
] as const

export type Mes = (typeof MESES_ES)[number]

const MESES_NUM: Record<string, number> = Object.fromEntries(
  MESES_ES.map((m, i) => [m, i + 1])
)

// ─── tier(puntos): asignación a partir de puntos rolling 12m ─────────────────

export function tier(puntos: number): Tier {
  if (puntos >= TIER_THRESHOLDS.oro)   return 'oro'
  if (puntos >= TIER_THRESHOLDS.plata) return 'plata'
  return 'bronce'
}

// ─── ultimos12Meses: ventana rolling de 12 meses (mes ref incluido) ───────────

export function ultimos12Meses(anioRef: number, mesRef: string): Array<{ anio: number; mes: Mes }> {
  const mesRefUpper = mesRef.toUpperCase()
  let mesNum = MESES_NUM[mesRefUpper]
  if (!mesNum) {
    throw new Error(`Mes inválido: "${mesRef}". Usar nombre en español en mayúsculas.`)
  }

  const result: Array<{ anio: number; mes: Mes }> = []
  let anio = anioRef

  for (let i = 0; i < 12; i++) {
    result.push({ anio, mes: MESES_ES[mesNum - 1] })
    mesNum--
    if (mesNum < 1) { mesNum = 12; anio-- }
  }
  return result
}

// ─── calcularPuntosCliente: suma puntos de un cliente para un mes ─────────────

export interface FacturaParaPuntos {
  cantidadar: number | null
  valortotal: number | null
  lineas: string | null
  semana: string | null
}

export interface PuntosCalculados {
  pts_volumen: number
  pts_valor: number
  pts_diversificacion: number
  pts_frecuencia: number
  total_puntos: number
  sacos_total: number
  valor_total: number
  lineas_distintas: number
  semanas_distintas: number
}

export function calcularPuntosCliente(facturas: FacturaParaPuntos[]): PuntosCalculados {
  let sacos = 0
  let valor = 0
  const lineas  = new Set<string>()
  const semanas = new Set<string>()

  for (const f of facturas) {
    sacos += f.cantidadar ?? 0
    valor += f.valortotal ?? 0
    if (f.lineas) lineas.add(f.lineas.trim())
    if (f.semana) semanas.add(f.semana.trim())
  }

  const pts_volumen         = Math.floor(sacos)
  const pts_valor           = Math.floor(valor / 100) * 2
  const lineas_distintas    = lineas.size
  const semanas_distintas   = semanas.size
  const pts_diversificacion = lineas_distintas  >= 3 ? BONUS_DIVERSIFICACION : 0
  const pts_frecuencia      = semanas_distintas >= 3 ? BONUS_FRECUENCIA      : 0

  return {
    pts_volumen,
    pts_valor,
    pts_diversificacion,
    pts_frecuencia,
    total_puntos: pts_volumen + pts_valor + pts_diversificacion + pts_frecuencia,
    sacos_total: sacos,
    valor_total: valor,
    lineas_distintas,
    semanas_distintas,
  }
}

// ─── nextTierInfo: cuánto falta para el siguiente tier ────────────────────────

export function nextTierInfo(tierActual: string, puntos12m: number) {
  if (tierActual === 'oro') return null
  const next: 'plata' | 'oro' = tierActual === 'bronce' ? 'plata' : 'oro'
  const threshold = TIER_THRESHOLDS[next]
  const faltan = Math.max(0, threshold - puntos12m)
  const pct = Math.min(100, Math.round((puntos12m / threshold) * 100))
  return { next, threshold, faltan, pct }
}
