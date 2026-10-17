import { describe, it, expect } from 'vitest'
import { normalizePromProduct, promInStock } from '@/lib/prom/client'
import { isPromSyncDue } from '@/lib/prom/scheduler'

describe('normalizePromProduct', () => {
  it('normalizes a full product payload', () => {
    const p = normalizePromProduct({
      id: 12345678,
      name: 'Навушники Baseus',
      sku: 'BS-123',
      price: '1599.00',
      old_price: '1999',
      quantity: 5,
      presence: 'available',
      characteristics: [
        { name: 'Виробник', value: 'Baseus' },
        { name: 'Колір', value: 'Чорний' },
      ],
    })
    expect(p).not.toBeNull()
    expect(p!.id).toBe(12345678)
    expect(p!.price).toBe(1599)
    expect(p!.oldPrice).toBe(1999)
    expect(p!.quantity).toBe(5)
    expect(p!.sku).toBe('BS-123')
    expect(p!.characteristics).toHaveLength(2)
  })

  it('accepts attribute maps and alternate key names', () => {
    const p = normalizePromProduct({
      id: '87654321',
      title: 'Чохол',
      article: 'ART-1',
      attributes: { Виробник: 'Baseus', '': 'x', Пусто: '' },
    })
    expect(p!.id).toBe(87654321)
    expect(p!.name).toBe('Чохол')
    expect(p!.sku).toBe('ART-1')
    expect(p!.characteristics).toEqual([{ name: 'Виробник', value: 'Baseus' }])
  })

  it('returns null without an id', () => {
    expect(normalizePromProduct({ name: 'x' })).toBeNull()
    expect(normalizePromProduct(null)).toBeNull()
    expect(normalizePromProduct('nope')).toBeNull()
  })

  it('tolerates missing optional fields', () => {
    const p = normalizePromProduct({ id: 1 })
    expect(p!.price).toBeNull()
    expect(p!.quantity).toBeNull()
    expect(p!.characteristics).toEqual([])
  })
})

describe('promInStock', () => {
  it('uses quantity when present', () => {
    expect(promInStock({ id: 1, name: '', sku: null, price: null, oldPrice: null, quantity: 3, presence: null, characteristics: [] })).toBe(true)
    expect(promInStock({ id: 1, name: '', sku: null, price: null, oldPrice: null, quantity: 0, presence: null, characteristics: [] })).toBe(false)
  })

  it('falls back to presence markers', () => {
    const base = { id: 1, name: '', sku: null, price: null, oldPrice: null, quantity: null, characteristics: [] }
    expect(promInStock({ ...base, presence: 'not_available' })).toBe(false)
    expect(promInStock({ ...base, presence: 'available' })).toBe(true)
  })
})

describe('isPromSyncDue', () => {
  const NOW = Date.parse('2026-10-17T12:00:00Z')
  const base = { enabled: true, hasToken: true, intervalMinutes: 60, lastSyncAt: null as string | null }

  it('is due on first run (never synced)', () => {
    expect(isPromSyncDue(base, NOW)).toBe(true)
  })

  it('is not due before the interval elapses', () => {
    expect(isPromSyncDue({ ...base, lastSyncAt: new Date(NOW - 30 * 60_000).toISOString() }, NOW)).toBe(false)
  })

  it('is due after the interval elapses', () => {
    expect(isPromSyncDue({ ...base, lastSyncAt: new Date(NOW - 61 * 60_000).toISOString() }, NOW)).toBe(true)
  })

  it('is not due when disabled or tokenless', () => {
    expect(isPromSyncDue({ ...base, enabled: false }, NOW)).toBe(false)
    expect(isPromSyncDue({ ...base, hasToken: false }, NOW)).toBe(false)
  })

  it('treats a broken lastSyncAt as due', () => {
    expect(isPromSyncDue({ ...base, lastSyncAt: 'not-a-date' }, NOW)).toBe(true)
  })
})
