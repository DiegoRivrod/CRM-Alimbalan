import { describe, it, expect } from 'vitest'
import {
  tier,
  ultimos12Meses,
  calcularPuntosCliente,
  nextTierInfo,
  TIER_THRESHOLDS,
  BONUS_DIVERSIFICACION,
  BONUS_FRECUENCIA,
  type FacturaParaPuntos,
} from './abalPlus'

// ─── tier(puntos) ────────────────────────────────────────────────────────────

describe('tier — asignación según puntos rolling 12m', () => {
  it.each([
    [0,     'bronce'],
    [1,     'bronce'],
    [2_999, 'bronce'],
    [3_000, 'plata'],
    [5_000, 'plata'],
    [7_999, 'plata'],
    [8_000, 'oro'],
    [50_000,'oro'],
  ])('puntos=%i → %s', (puntos, esperado) => {
    expect(tier(puntos)).toBe(esperado)
  })

  it('los umbrales exactos están publicados en TIER_THRESHOLDS', () => {
    expect(TIER_THRESHOLDS).toEqual({ bronce: 0, plata: 3000, oro: 8000 })
  })
})

// ─── ultimos12Meses ──────────────────────────────────────────────────────────

describe('ultimos12Meses — ventana rolling de 12 meses', () => {
  it('devuelve exactamente 12 elementos', () => {
    expect(ultimos12Meses(2026, 'ABRIL')).toHaveLength(12)
  })

  it('el primer elemento es el mes de referencia', () => {
    const v = ultimos12Meses(2026, 'ABRIL')
    expect(v[0]).toEqual({ anio: 2026, mes: 'ABRIL' })
  })

  it('retrocede mes a mes y atraviesa correctamente el cambio de año', () => {
    const v = ultimos12Meses(2026, 'ABRIL')
    // ABR-26, MAR-26, FEB-26, ENE-26, DIC-25, NOV-25, ..., MAY-25
    expect(v[0]).toEqual({ anio: 2026, mes: 'ABRIL' })
    expect(v[3]).toEqual({ anio: 2026, mes: 'ENERO' })
    expect(v[4]).toEqual({ anio: 2025, mes: 'DICIEMBRE' })
    expect(v[11]).toEqual({ anio: 2025, mes: 'MAYO' })
  })

  it('funciona con mes de referencia en mayúsculas y minúsculas', () => {
    expect(ultimos12Meses(2026, 'enero')[0]).toEqual({ anio: 2026, mes: 'ENERO' })
  })

  it('lanza error con nombre de mes inválido', () => {
    expect(() => ultimos12Meses(2026, 'APRIL')).toThrow(/Mes inválido/)
  })
})

// ─── calcularPuntosCliente ───────────────────────────────────────────────────

describe('calcularPuntosCliente — reglas de puntos del mes', () => {
  const facturaBase: FacturaParaPuntos = {
    cantidadar: 10,
    valortotal: 1500,
    lineas: 'CUYES',
    semana: 'SEMANA 1',
  }

  it('puntos = sin facturas → todo en cero', () => {
    const r = calcularPuntosCliente([])
    expect(r.total_puntos).toBe(0)
    expect(r.pts_volumen).toBe(0)
    expect(r.pts_valor).toBe(0)
  })

  it('pts_volumen = floor(sum(sacos)) — 1 pt por saco', () => {
    const r = calcularPuntosCliente([
      { ...facturaBase, cantidadar: 10.7 },
      { ...facturaBase, cantidadar: 5.4 },
    ])
    // sum=16.1 → floor=16
    expect(r.pts_volumen).toBe(16)
  })

  it('pts_valor = floor(sum(valor)/100) * 2 — 2 pts por cada S/.100', () => {
    const r = calcularPuntosCliente([
      { ...facturaBase, valortotal: 1500 },
      { ...facturaBase, valortotal: 250 },
    ])
    // sum=1750 → 17*2 = 34
    expect(r.pts_valor).toBe(34)
  })

  it('NO da bonus de diversificación con 2 líneas distintas', () => {
    const r = calcularPuntosCliente([
      { ...facturaBase, lineas: 'CUYES' },
      { ...facturaBase, lineas: 'TRUCHAS' },
    ])
    expect(r.lineas_distintas).toBe(2)
    expect(r.pts_diversificacion).toBe(0)
  })

  it('da BONUS_DIVERSIFICACION (150) con 3+ líneas distintas', () => {
    const r = calcularPuntosCliente([
      { ...facturaBase, lineas: 'CUYES' },
      { ...facturaBase, lineas: 'TRUCHAS' },
      { ...facturaBase, lineas: 'AVES' },
    ])
    expect(r.lineas_distintas).toBe(3)
    expect(r.pts_diversificacion).toBe(BONUS_DIVERSIFICACION)
  })

  it('NO da bonus de frecuencia con 2 semanas distintas', () => {
    const r = calcularPuntosCliente([
      { ...facturaBase, semana: 'SEMANA 1' },
      { ...facturaBase, semana: 'SEMANA 2' },
    ])
    expect(r.semanas_distintas).toBe(2)
    expect(r.pts_frecuencia).toBe(0)
  })

  it('da BONUS_FRECUENCIA (100) con 3+ semanas distintas', () => {
    const r = calcularPuntosCliente([
      { ...facturaBase, semana: 'SEMANA 1' },
      { ...facturaBase, semana: 'SEMANA 2' },
      { ...facturaBase, semana: 'SEMANA 3' },
    ])
    expect(r.semanas_distintas).toBe(3)
    expect(r.pts_frecuencia).toBe(BONUS_FRECUENCIA)
  })

  it('total_puntos = volumen + valor + diversificación + frecuencia', () => {
    // 100 sacos, S/.10000, 3 líneas, 4 semanas
    const r = calcularPuntosCliente([
      { cantidadar: 100, valortotal: 10000, lineas: 'A', semana: 'SEMANA 1' },
      { cantidadar: 0,   valortotal: 0,     lineas: 'B', semana: 'SEMANA 2' },
      { cantidadar: 0,   valortotal: 0,     lineas: 'C', semana: 'SEMANA 3' },
      { cantidadar: 0,   valortotal: 0,     lineas: 'C', semana: 'SEMANA 4' },
    ])
    // 100 + 200 + 150 + 100 = 550
    expect(r.pts_volumen).toBe(100)
    expect(r.pts_valor).toBe(200)
    expect(r.pts_diversificacion).toBe(150)
    expect(r.pts_frecuencia).toBe(100)
    expect(r.total_puntos).toBe(550)
  })

  it('ignora cantidadar/valortotal nulos sin romperse', () => {
    const r = calcularPuntosCliente([
      { cantidadar: null, valortotal: null, lineas: 'CUYES', semana: 'SEMANA 1' },
    ])
    expect(r.pts_volumen).toBe(0)
    expect(r.pts_valor).toBe(0)
  })

  it('hace trim de líneas y semanas para no contar duplicados por espacios', () => {
    const r = calcularPuntosCliente([
      { ...facturaBase, lineas: 'CUYES'  },
      { ...facturaBase, lineas: ' CUYES' },
      { ...facturaBase, lineas: 'CUYES ' },
    ])
    expect(r.lineas_distintas).toBe(1)
  })
})

// ─── nextTierInfo ────────────────────────────────────────────────────────────

describe('nextTierInfo — progreso al siguiente tier', () => {
  it('cliente bronce con 0 puntos → faltan 3000 a plata (0%)', () => {
    const info = nextTierInfo('bronce', 0)
    expect(info).toEqual({ next: 'plata', threshold: 3000, faltan: 3000, pct: 0 })
  })

  it('cliente bronce con 1500 puntos → 50% del camino a plata', () => {
    const info = nextTierInfo('bronce', 1500)
    expect(info?.pct).toBe(50)
    expect(info?.faltan).toBe(1500)
    expect(info?.next).toBe('plata')
  })

  it('cliente plata con 5000 puntos → faltan 3000 a oro (62%)', () => {
    const info = nextTierInfo('plata', 5000)
    expect(info?.next).toBe('oro')
    expect(info?.threshold).toBe(8000)
    expect(info?.faltan).toBe(3000)
    expect(info?.pct).toBe(63)  // round(5000/8000*100) = round(62.5) = 63
  })

  it('cliente oro → null (no hay tier superior)', () => {
    expect(nextTierInfo('oro', 12_000)).toBeNull()
  })

  it('cuando ya superaste el umbral, faltan = 0 y pct = 100', () => {
    // Caso borde: tienes 9000 pero seguías en plata (aún no se recalcularon tiers)
    const info = nextTierInfo('plata', 9000)
    expect(info?.faltan).toBe(0)
    expect(info?.pct).toBe(100)
  })
})
