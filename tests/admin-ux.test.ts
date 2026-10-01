import { describe, expect, it } from 'vitest'
import {
  addFilterPreset,
  loadFilterPresets,
  persistFilterPresets,
  removeFilterPreset,
  type FilterPreset,
  type KeyValueStorage,
} from '@/lib/admin/filter-presets'
import { resolveVisibleColumns, toggleColumn } from '@/lib/admin/column-visibility'
import { resolveAdminHotkey } from '@/lib/admin/hotkeys'

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => {
      map.set(k, v)
    },
  }
}

const el = (tagName: string, isContentEditable = false) => ({ tagName, isContentEditable })
const key = (k: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean }> = {}) => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...mods,
})

describe('filter presets', () => {
  const KEY = 'admin:presets:products'
  type F = { status?: string; search?: string }

  it('returns [] when nothing is stored', () => {
    expect(loadFilterPresets<F>(memoryStorage(), KEY)).toEqual([])
  })

  it('returns [] for invalid JSON and non-array payloads', () => {
    expect(loadFilterPresets<F>(memoryStorage({ [KEY]: 'not-json' }), KEY)).toEqual([])
    expect(loadFilterPresets<F>(memoryStorage({ [KEY]: '{"a":1}' }), KEY)).toEqual([])
  })

  it('drops malformed entries but keeps valid ones', () => {
    const stored = JSON.stringify([
      { id: 'ok', name: 'Visible', filters: { status: 'visible' } },
      { id: 'bad', name: 42, filters: { status: 'visible' } },
      { id: 'bad2', filters: null },
      'garbage',
    ])
    const loaded = loadFilterPresets<F>(memoryStorage({ [KEY]: stored }), KEY)
    expect(loaded).toEqual([{ id: 'ok', name: 'Visible', filters: { status: 'visible' } }])
  })

  it('persists and reloads presets (roundtrip)', () => {
    const storage = memoryStorage()
    const presets: FilterPreset<F>[] = [
      { id: 'a', name: 'Out of stock', filters: { status: 'out_of_stock' } },
    ]
    persistFilterPresets(storage, KEY, presets)
    expect(loadFilterPresets<F>(storage, KEY)).toEqual(presets)
  })

  it('addFilterPreset trims the name and generates an id', () => {
    const next = addFilterPreset<F>([], '  My preset  ', { status: 'hidden' })
    expect(next).toHaveLength(1)
    expect(next[0].name).toBe('My preset')
    expect(typeof next[0].id).toBe('string')
    expect(next[0].filters).toEqual({ status: 'hidden' })
  })

  it('addFilterPreset ignores blank names and returns the original list', () => {
    const prev: FilterPreset<F>[] = []
    expect(addFilterPreset(prev, '   ', { status: 'visible' })).toBe(prev)
  })

  it('removeFilterPreset drops only the matching id', () => {
    const presets: FilterPreset<F>[] = [
      { id: 'a', name: 'A', filters: {} },
      { id: 'b', name: 'B', filters: {} },
    ]
    expect(removeFilterPreset(presets, 'a').map((p) => p.id)).toEqual(['b'])
    expect(removeFilterPreset(presets, 'missing')).toHaveLength(2)
  })
})

describe('column visibility', () => {
  const ALL = ['sku', 'categories', 'price', 'views', 'stock', 'status']

  it('falls back to all columns when nothing is stored', () => {
    expect(resolveVisibleColumns(null, ALL)).toEqual(ALL)
  })

  it('keeps the stored subset and drops unknown ids', () => {
    expect(resolveVisibleColumns(['price', 'stale', 'sku'], ALL)).toEqual(['price', 'sku'])
  })

  it('falls back to all columns when the stored list is empty', () => {
    expect(resolveVisibleColumns([], ALL)).toEqual(ALL)
  })

  it('toggleColumn removes a visible column', () => {
    expect(toggleColumn(['sku', 'price', 'stock'], ALL, 'price')).toEqual(['sku', 'stock'])
  })

  it('toggleColumn adds a hidden column preserving display order', () => {
    expect(toggleColumn(['stock', 'sku'], ALL, 'price')).toEqual(['sku', 'price', 'stock'])
  })
})

describe('admin hotkeys', () => {
  it('maps / to focus-search on the page body', () => {
    expect(resolveAdminHotkey(key('/'), el('BODY'))).toBe('focus-search')
  })

  it('maps n/N to new-item', () => {
    expect(resolveAdminHotkey(key('n'), el('DIV'))).toBe('new-item')
    expect(resolveAdminHotkey(key('N'), el('DIV'))).toBe('new-item')
  })

  it('maps Escape to escape', () => {
    expect(resolveAdminHotkey(key('Escape'), el('DIV'))).toBe('escape')
  })

  it('ignores modifier combos', () => {
    expect(resolveAdminHotkey(key('/', { ctrlKey: true }), el('BODY'))).toBeNull()
    expect(resolveAdminHotkey(key('n', { metaKey: true }), el('BODY'))).toBeNull()
    expect(resolveAdminHotkey(key('n', { altKey: true }), el('BODY'))).toBeNull()
  })

  it('never hijacks typing inside form fields', () => {
    for (const tag of ['INPUT', 'TEXTAREA', 'SELECT']) {
      expect(resolveAdminHotkey(key('/'), el(tag))).toBeNull()
      expect(resolveAdminHotkey(key('n'), el(tag))).toBeNull()
    }
    expect(resolveAdminHotkey(key('n'), el('DIV', true))).toBeNull()
    expect(resolveAdminHotkey(key('Escape'), el('INPUT'))).toBeNull()
  })

  it('ignores unrelated keys', () => {
    expect(resolveAdminHotkey(key('x'), el('BODY'))).toBeNull()
    expect(resolveAdminHotkey(key('Enter'), el('BODY'))).toBeNull()
  })
})
