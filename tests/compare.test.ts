import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  COMPARE_MAX_ITEMS,
  COMPARE_STORAGE_KEY,
  addToCompare,
  buildSpecRows,
  cleanCompareIds,
  diffRowFlags,
  isInCompare,
  normalizeSpecValue,
  readCompareIds,
  removeFromCompare,
  toggleCompare,
  writeCompareIds,
} from '@/lib/shop/compare'

function fakeStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, v)
    },
    removeItem: (k: string) => {
      store.delete(k)
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('cleanCompareIds', () => {
  it('de-duplicates and drops invalid ids, preserving order', () => {
    expect(cleanCompareIds([3, 1, 3, 0, -2, 2.5, NaN, '4', null])).toEqual([3, 1, 4])
  })
  it('returns [] for non-array input', () => {
    expect(cleanCompareIds(undefined)).toEqual([])
    expect(cleanCompareIds('nope')).toEqual([])
  })
})

describe('add/remove/toggle/isInCompare', () => {
  it('adds an id', () => {
    const r = addToCompare([1], 2)
    expect(r).toEqual({ ids: [1, 2], added: true, limitReached: false })
  })

  it('does not duplicate an id that is already in the tray', () => {
    const r = addToCompare([1, 2], 2)
    expect(r.ids).toEqual([1, 2])
    expect(r.added).toBe(true)
    expect(r.limitReached).toBe(false)
  })

  it('rejects invalid product ids', () => {
    const r = addToCompare([1], 0)
    expect(r.ids).toEqual([1])
    expect(r.added).toBe(false)
  })

  it(`enforces the max-${COMPARE_MAX_ITEMS} limit`, () => {
    expect(COMPARE_MAX_ITEMS).toBe(4)
    const full = [1, 2, 3, 4]
    const r = addToCompare(full, 5)
    expect(r.ids).toBe(full) // unchanged reference
    expect(r.added).toBe(false)
    expect(r.limitReached).toBe(true)
  })

  it('removes an id', () => {
    expect(removeFromCompare([1, 2, 3], 2)).toEqual([1, 3])
    expect(removeFromCompare([1], 9)).toEqual([1])
  })

  it('toggles: adds when absent, removes when present', () => {
    const added = toggleCompare([1], 2)
    expect(added).toEqual({ ids: [1, 2], added: true, limitReached: false })
    const removed = toggleCompare([1, 2], 2)
    expect(removed).toEqual({ ids: [1], added: false, limitReached: false })
  })

  it('toggle on a full tray reports limitReached', () => {
    const r = toggleCompare([1, 2, 3, 4], 5)
    expect(r.ids).toEqual([1, 2, 3, 4])
    expect(r.added).toBe(false)
    expect(r.limitReached).toBe(true)
  })

  it('isInCompare checks membership', () => {
    expect(isInCompare([1, 2], 2)).toBe(true)
    expect(isInCompare([1, 2], 3)).toBe(false)
  })
})

describe('localStorage persistence', () => {
  it('is SSR-safe: read returns [], write is a no-op without window', () => {
    expect(typeof window).toBe('undefined')
    expect(readCompareIds()).toEqual([])
    expect(() => writeCompareIds([1, 2])).not.toThrow()
  })

  it('round-trips ids through localStorage', () => {
    const storage = fakeStorage()
    vi.stubGlobal('window', { localStorage: storage })
    writeCompareIds([5, 3, 5])
    expect(readCompareIds()).toEqual([5, 3])
    expect(JSON.parse(storage.getItem(COMPARE_STORAGE_KEY)!)).toEqual([5, 3])
  })

  it('returns [] on corrupt data instead of throwing', () => {
    const storage = fakeStorage({ [COMPARE_STORAGE_KEY]: 'not-json{{' })
    vi.stubGlobal('window', { localStorage: storage })
    expect(readCompareIds()).toEqual([])
  })

  it('caps persisted ids at the max limit', () => {
    const storage = fakeStorage({ [COMPARE_STORAGE_KEY]: JSON.stringify([1, 2, 3, 4, 5, 6]) })
    vi.stubGlobal('window', { localStorage: storage })
    expect(readCompareIds()).toEqual([1, 2, 3, 4])
  })
})

describe('normalizeSpecValue', () => {
  it('trims, lowercases and treats null as empty', () => {
    expect(normalizeSpecValue('  128 ГБ ')).toBe('128 гб')
    expect(normalizeSpecValue(null)).toBe('')
  })
})

describe('diffRowFlags (highlight of differing specs)', () => {
  it('flags rows with differing values', () => {
    const flags = diffRowFlags([
      { name: 'Діагональ', values: ['6.1"', '6.7"'] },
      { name: 'Бренд', values: ['Apple', 'apple'] },
      { name: 'Колір', values: [null, 'Чорний'] },
    ])
    expect(flags).toEqual([true, false, true])
  })

  it('returns all-false for a single product or empty rows', () => {
    expect(diffRowFlags([{ name: 'Вага', values: ['200 г'] }])).toEqual([false])
    expect(diffRowFlags([])).toEqual([])
  })

  it('treats whitespace/case-only differences as equal', () => {
    const flags = diffRowFlags([{ name: 'Памʼять', values: ['128 ГБ', ' 128 гб '] }])
    expect(flags).toEqual([false])
  })
})

describe('buildSpecRows', () => {
  it('unions characteristic names in first-appearance order', () => {
    const rows = buildSpecRows([
      {
        characteristics: [
          { name: 'Діагональ', value: '6.1"' },
          { name: 'Памʼять', value: '128 ГБ' },
        ],
        options: [],
      },
      {
        characteristics: [
          { name: 'Памʼять', value: '256 ГБ' },
          { name: 'Камера', value: '48 Мп' },
        ],
        options: [],
      },
    ])
    expect(rows.map((r) => r.name)).toEqual(['Діагональ', 'Памʼять', 'Камера'])
    expect(rows[0].values).toEqual(['6.1"', null])
    expect(rows[1].values).toEqual(['128 ГБ', '256 ГБ'])
  })

  it('merges duplicate characteristic names within one product', () => {
    const rows = buildSpecRows([
      {
        characteristics: [
          { name: 'Колір', value: 'Чорний' },
          { name: 'Колір', value: 'Білий' },
        ],
        options: [],
      },
    ])
    expect(rows).toEqual([{ name: 'Колір', values: ['Чорний, Білий'] }])
  })

  it('appends option axes as rows', () => {
    const rows = buildSpecRows([
      { characteristics: [], options: [{ name: 'Розмір', values: ['S', 'M'] }] },
      { characteristics: [], options: [] },
    ])
    expect(rows).toEqual([{ name: 'Розмір', values: ['S, M', null] }])
  })
})
