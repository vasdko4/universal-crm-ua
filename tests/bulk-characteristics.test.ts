import { describe, it, expect } from 'vitest'
import {
  BRAND_CHAR_NAME,
  MAX_BULK_CHARS,
  normalizeBulkCharacteristics,
  planCharacteristicUpserts,
} from '@/lib/products/bulk-characteristics'

describe('normalizeBulkCharacteristics', () => {
  it('maps brand to the canonical characteristic name', () => {
    expect(normalizeBulkCharacteristics('Samsung', [])).toEqual([
      { name: BRAND_CHAR_NAME, value: 'Samsung' },
    ])
  })

  it('drops empty names and values instead of erasing data', () => {
    const out = normalizeBulkCharacteristics('', [
      { name: '', value: 'x' },
      { name: 'Колір', value: '' },
      { name: '  ', value: '  ' },
      { name: 'Колір', value: 'Чорний' },
    ])
    expect(out).toEqual([{ name: 'Колір', value: 'Чорний' }])
  })

  it('dedupes case-insensitively, first wins, brand wins over manual row', () => {
    const out = normalizeBulkCharacteristics('Samsung', [
      { name: 'колір', value: 'Чорний' },
      { name: 'Колір', value: 'Білий' },
      { name: 'бренд', value: 'LG' },
    ])
    expect(out).toEqual([
      { name: BRAND_CHAR_NAME, value: 'Samsung' },
      { name: 'колір', value: 'Чорний' },
    ])
  })

  it('trims and caps name length at 255', () => {
    const out = normalizeBulkCharacteristics('', [{ name: ` ${'a'.repeat(300)} `, value: 'v' }])
    expect(out[0].name).toHaveLength(255)
    expect(out[0].value).toBe('v')
  })

  it(`caps at ${MAX_BULK_CHARS} pairs`, () => {
    const chars = Array.from({ length: 20 }, (_, i) => ({ name: `Х${i}`, value: 'v' }))
    expect(normalizeBulkCharacteristics('', chars)).toHaveLength(MAX_BULK_CHARS)
  })

  it('returns empty when nothing meaningful was entered', () => {
    expect(normalizeBulkCharacteristics('   ', [{ name: '', value: '' }])).toEqual([])
  })
})

describe('planCharacteristicUpserts', () => {
  const existing = [
    { id: 1, name: 'Бренд', value: 'LG', sortOrder: 0 },
    { id: 2, name: 'Колір', value: 'Чорний', sortOrder: 1 },
  ]

  it('updates changed values, keeps original name casing', () => {
    const plan = planCharacteristicUpserts(existing, [
      { name: 'бренд', value: 'Samsung' },
      { name: 'Колір', value: 'Чорний' },
    ])
    expect(plan.toUpdate).toEqual([{ id: 1, value: 'Samsung' }])
    expect(plan.toInsert).toEqual([])
  })

  it('inserts missing names', () => {
    const plan = planCharacteristicUpserts(existing, [{ name: 'Памʼять', value: '128 ГБ' }])
    expect(plan.toUpdate).toEqual([])
    expect(plan.toInsert).toEqual([{ name: 'Памʼять', value: '128 ГБ' }])
  })

  it('does not touch identical values', () => {
    const plan = planCharacteristicUpserts(existing, [
      { name: 'Бренд', value: 'LG' },
      { name: 'Колір', value: 'Чорний' },
    ])
    expect(plan.toUpdate).toEqual([])
    expect(plan.toInsert).toEqual([])
  })
})
