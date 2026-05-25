/**
 * Edge Function: calcular-puntos
 *
 * Calcula los puntos ABAL+ de todos los clientes para un mes/año dado,
 * hace upsert en puntos_mensuales y recalcula tiers_clientes (rolling 12 meses).
 *
 * POST /functions/v1/calcular-puntos
 * Body (opcional): { "anio": 2026, "mes": "ABRIL" }
 *   → Si se omite, calcula el mes anterior al día de ejecución.
 *
 * Reglas de puntos:
 *   pts_volumen         = sum(cantidadar)              → 1 pt por saco
 *   pts_valor           = floor(sum(valortotal)/100)*2 → 2 pts por S/.100
 *   pts_diversificacion = 150 si lineas_distintas ≥ 3, else 0
 *   pts_frecuencia      = 100 si semanas_distintas ≥ 3, else 0
 *
 * Tiers (rolling 12 meses):
 *   Bronce  0    – 2,999 puntos
 *   Plata   3,000 – 7,999 puntos
 *   Oro     8,000+ puntos
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Constantes ────────────────────────────────────────────────────────────────

const MESES_ES: Record<number, string> = {
  1: 'ENERO', 2: 'FEBRERO', 3: 'MARZO',    4: 'ABRIL',
  5: 'MAYO',  6: 'JUNIO',   7: 'JULIO',    8: 'AGOSTO',
  9: 'SEPTIEMBRE', 10: 'OCTUBRE', 11: 'NOVIEMBRE', 12: 'DICIEMBRE',
}

const MESES_NUM: Record<string, number> = Object.fromEntries(
  Object.entries(MESES_ES).map(([n, s]) => [s, Number(n)])
)

const UMBRAL_PLATA = 3_000
const UMBRAL_ORO   = 8_000

const BONUS_DIVERSIFICACION = 150  // ≥3 líneas distintas en el mes
const BONUS_FRECUENCIA      = 100  // ≥3 semanas distintas en el mes

// ── Helpers ───────────────────────────────────────────────────────────────────

function mesAnterior(): { anio: number; mes: string } {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return { anio: d.getFullYear(), mes: MESES_ES[d.getMonth() + 1] }
}

function tier(puntos: number): 'bronce' | 'plata' | 'oro' {
  if (puntos >= UMBRAL_ORO)   return 'oro'
  if (puntos >= UMBRAL_PLATA) return 'plata'
  return 'bronce'
}

/** Genera los últimos N pares {anio, mes} incluyendo el mes actual como referencia. */
function ultimos12Meses(anioRef: number, mesRef: string): Array<{ anio: number; mes: string }> {
  const result: Array<{ anio: number; mes: string }> = []
  let mesNum = MESES_NUM[mesRef]
  let anio   = anioRef

  for (let i = 0; i < 12; i++) {
    result.push({ anio, mes: MESES_ES[mesNum] })
    mesNum--
    if (mesNum < 1) { mesNum = 12; anio-- }
  }
  return result
}

// ── Handler principal ─────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // ── 1. Determinar mes a calcular ──────────────────────────────────────────
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
  const { anio, mes } = (body.anio && body.mes)
    ? { anio: Number(body.anio), mes: String(body.mes).toUpperCase() }
    : mesAnterior()

  // Validación de inputs
  if (!Number.isInteger(anio) || anio < 2020 || anio > 2100) {
    return new Response(
      JSON.stringify({ ok: false, error: `Año inválido: "${anio}". Debe ser un entero entre 2020 y 2100.` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  if (!MESES_NUM[mes]) {
    return new Response(
      JSON.stringify({ ok: false, error: `Mes inválido: "${mes}". Usar nombre en español en mayúsculas.` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // ── 2. Leer facturas del mes ──────────────────────────────────────────────
  const { data: facturas, error: errFacturas } = await supabase
    .from('facturas')
    .select('idcliente, cantidadar, valortotal, lineas, semana')
    .eq('anio', anio)
    .eq('mes', mes)
    .neq('tipodocume', 'Notas de Crédito')
    .gt('valortotal', 0)
    .not('idcliente', 'is', null)

  if (errFacturas) {
    return new Response(
      JSON.stringify({ ok: false, error: errFacturas.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  if (!facturas || facturas.length === 0) {
    return new Response(
      JSON.stringify({ ok: true, mensaje: `Sin facturas para ${mes} ${anio}`, clientes_procesados: 0 }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  }

  // ── 3. Agrupar por cliente y calcular puntos ──────────────────────────────
  type Acum = {
    sacos:   number
    valor:   number
    lineas:  Set<string>
    semanas: Set<string>
  }

  const agrupado = new Map<string, Acum>()

  for (const f of facturas) {
    if (!f.idcliente) continue
    if (!agrupado.has(f.idcliente)) {
      agrupado.set(f.idcliente, { sacos: 0, valor: 0, lineas: new Set(), semanas: new Set() })
    }
    const acum = agrupado.get(f.idcliente)!
    acum.sacos += f.cantidadar ?? 0
    acum.valor += f.valortotal ?? 0
    if (f.lineas)  acum.lineas.add(f.lineas.trim())
    if (f.semana)  acum.semanas.add(f.semana.trim())
  }

  // ── 4. Construir registros de puntos_mensuales ────────────────────────────
  const registros = Array.from(agrupado.entries()).map(([idcliente, acum]) => {
    const pts_volumen         = Math.floor(acum.sacos)
    const pts_valor           = Math.floor(acum.valor / 100) * 2
    const lineas_distintas    = acum.lineas.size
    const semanas_distintas   = acum.semanas.size
    const pts_diversificacion = lineas_distintas  >= 3 ? BONUS_DIVERSIFICACION : 0
    const pts_frecuencia      = semanas_distintas >= 3 ? BONUS_FRECUENCIA      : 0

    return {
      idcliente,
      anio,
      mes,
      pts_volumen,
      pts_valor,
      pts_diversificacion,
      pts_frecuencia,
      pts_bonus:        0,  // los bonus manuales se aplican vía UPDATE
      sacos_total:      acum.sacos,
      valor_total:      acum.valor,
      lineas_distintas,
      semanas_distintas,
      calculado_at:     new Date().toISOString(),
    }
  })

  // ── 5. Upsert en puntos_mensuales ─────────────────────────────────────────
  const { error: errUpsert } = await supabase
    .from('puntos_mensuales')
    .upsert(registros, { onConflict: 'idcliente,anio,mes' })

  if (errUpsert) {
    return new Response(
      JSON.stringify({ ok: false, error: errUpsert.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // ── 6. Recalcular tiers (rolling 12 meses) ────────────────────────────────
  const ventana = ultimos12Meses(anio, mes)  // los 12 meses incluyendo el actual

  // Leer todos los puntos dentro de la ventana de 12 meses
  const { data: todosLosPuntos, error: errPuntos } = await supabase
    .from('puntos_mensuales')
    .select('idcliente, anio, mes, total_puntos')

  if (errPuntos) {
    return new Response(
      JSON.stringify({ ok: false, error: errPuntos.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // Filtrar solo los registros dentro de la ventana de 12 meses
  const ventanaSet = new Set(ventana.map(v => `${v.anio}-${v.mes}`))
  const puntosEnVentana = (todosLosPuntos ?? []).filter(
    p => ventanaSet.has(`${p.anio}-${p.mes}`)
  )

  // Sumar puntos por cliente en la ventana
  const puntosPorCliente = new Map<string, number>()
  for (const p of puntosEnVentana) {
    puntosPorCliente.set(
      p.idcliente,
      (puntosPorCliente.get(p.idcliente) ?? 0) + (p.total_puntos ?? 0),
    )
  }

  // Leer tiers actuales para detectar cambios
  const { data: tiersActuales } = await supabase
    .from('tiers_clientes')
    .select('idcliente, tier')

  const tierActualMap = new Map((tiersActuales ?? []).map(t => [t.idcliente, t.tier]))

  // Construir upsert de tiers
  const tiersUpsert = Array.from(puntosPorCliente.entries()).map(([idcliente, puntos_12m]) => {
    const nuevoTier   = tier(puntos_12m)
    const tierPrevio  = tierActualMap.get(idcliente) ?? null
    const cambiaDeTier = tierPrevio !== null && tierPrevio !== nuevoTier

    return {
      idcliente,
      tier:          nuevoTier,
      puntos_12m,
      tier_anterior: tierPrevio,
      tier_desde:    cambiaDeTier ? new Date().toISOString().split('T')[0] : undefined,
      actualizado_at: new Date().toISOString(),
    }
  })

  // Clientes con 0 facturas en los 12 meses → bajar a bronce si existen en la tabla
  const clientesConPuntos = new Set(puntosPorCliente.keys())
  const clientesSinPuntos = (tiersActuales ?? [])
    .filter(t => !clientesConPuntos.has(t.idcliente))
    .map(t => ({
      idcliente:    t.idcliente,
      tier:         'bronce' as const,
      puntos_12m:   0,
      tier_anterior: t.tier,
      tier_desde:   t.tier !== 'bronce' ? new Date().toISOString().split('T')[0] : undefined,
      actualizado_at: new Date().toISOString(),
    }))

  const { error: errTiers } = await supabase
    .from('tiers_clientes')
    .upsert([...tiersUpsert, ...clientesSinPuntos], { onConflict: 'idcliente' })

  if (errTiers) {
    return new Response(
      JSON.stringify({ ok: false, error: errTiers.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // ── 7. Respuesta ──────────────────────────────────────────────────────────
  const distribucion = { bronce: 0, plata: 0, oro: 0 }
  for (const [, pts] of puntosPorCliente) {
    distribucion[tier(pts)]++
  }

  return new Response(
    JSON.stringify({
      ok:                  true,
      periodo:             `${mes} ${anio}`,
      clientes_procesados: registros.length,
      distribucion_tiers:  distribucion,
    }),
    { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } },
  )
})
