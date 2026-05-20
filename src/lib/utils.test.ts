import { describe, it, expect } from 'vitest'
import { cn, formatCurrency, formatNumber } from './utils'

describe('cn (classname merge)', () => {
  it('combina clases correctamente', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('resuelve conflictos de tailwind', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2')
  })

  it('maneja valores falsy', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz')
  })
})

describe('formatCurrency', () => {
  it('formatea soles peruanos', () => {
    const result = formatCurrency(1500)
    expect(result).toContain('1')
    expect(result).toContain('500')
  })
})

describe('formatNumber', () => {
  it('formatea con separador de miles', () => {
    const result = formatNumber(12345)
    expect(result).toContain('12')
    expect(result).toContain('345')
  })
})
