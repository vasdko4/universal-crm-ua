import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalizeCatalogPaging } from '@/lib/shop/catalog-paging'

const root = resolve(import.meta.dirname, '..')
const source = (file: string) => readFileSync(resolve(root, file), 'utf8')

describe('normalizeCatalogPaging', () => {
  it('passes normal values through', () => {
    expect(normalizeCatalogPaging(2, 24)).toEqual({ page: 2, perPage: 24 })
    expect(normalizeCatalogPaging(undefined, undefined)).toEqual({ page: 1, perPage: 12 })
  })

  it('rejects NaN and Infinity with defaults', () => {
    expect(normalizeCatalogPaging(NaN, NaN)).toEqual({ page: 1, perPage: 12 })
    expect(normalizeCatalogPaging(Infinity, Infinity)).toEqual({ page: 1, perPage: 12 })
  })

  it('floors fractions and clamps to the valid range', () => {
    expect(normalizeCatalogPaging(2.9, 24.7)).toEqual({ page: 2, perPage: 24 })
    expect(normalizeCatalogPaging(0, 0)).toEqual({ page: 1, perPage: 1 })
    expect(normalizeCatalogPaging(-5, -3)).toEqual({ page: 1, perPage: 1 })
  })

  it('caps deep pages and oversized pages', () => {
    expect(normalizeCatalogPaging(10000, 100)).toEqual({ page: 100, perPage: 48 })
  })
})

describe('admin-logs search SQL', () => {
  it('has no stray quote after the last ESCAPE clause', () => {
    const logs = source('app/actions/admin-logs.ts')
    const bs = String.fromCharCode(92) // one backslash, built, not typed
    // The bug was `ESCAPE '\\'')` — an extra quote that made every search
    // produce malformed SQL. The fixed clause ends `ESCAPE '\\')`.
    expect(logs).not.toContain(`ESCAPE '${bs}${bs}'')`)
    expect(logs).toContain(`ESCAPE '${bs}${bs}')`)
  })
})

describe('catalog isFiltered', () => {
  it('covers every param parseParams applies to the selection', () => {
    const page = source('app/(shop)/catalog/page.tsx')
    const block = page.slice(page.indexOf('const isFiltered'), page.indexOf('const title'))
    for (const param of [
      "get('discount') === '1'",
      "get('popular') === '1'",
      "get('minPrice')",
      "get('maxPrice')",
      "get('chars')",
      "get('sort') !== 'popular'",
    ]) {
      expect(block).toContain(param)
    }
  })
})

describe('analytics beacon fallback', () => {
  it('falls back to fetch when sendBeacon refuses the payload', () => {
    const track = source('lib/shop/track.ts')
    expect(track).toContain('queued = navigator.sendBeacon')
    expect(track).toContain('if (!queued) sendViaFetch()')
  })
})

describe('favorites id cap', () => {
  it('bounds both public id lists', () => {
    const fav = source('app/actions/favorites.ts')
    expect(fav).toContain('MAX_FAVORITE_IDS = 100')
    expect(fav.match(/\.slice\(0, MAX_FAVORITE_IDS\)/g)).toHaveLength(2)
  })
})

describe('setDefaultAddress', () => {
  it('rolls back and reports not_found when the id is not yours', () => {
    const addresses = source('app/actions/addresses.ts')
    expect(addresses).toContain('if (res.rowCount === 0)')
    expect(addresses).toContain("error: 'not_found'")
    const manager = source('components/shop/addresses-manager.tsx')
    expect(manager).toContain('if (!res.ok) setFormError')
  })
})
