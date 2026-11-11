import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..')
const source = (file: string) => readFileSync(resolve(root, file), 'utf8')

// Audit 71 guard: Prom lists variants as separate product rows
// (is_variation + variation_group_id / variation_base_id — confirmed by
// live probe 11.11.2026), but the API sync has no variant mapping, so a
// variant row must never match an engine product and overwrite its
// price/stock with the variant's values.
describe('Prom variation guard (audit 71)', () => {
  it('sync filters variation rows out before indexing/matching', () => {
    const src = source('lib/prom/sync.ts')
    // Filtered right after the fetch, before the promById/promBySku index.
    expect(src).toContain('promProducts.filter((p) => p.isVariation)')
    expect(src).toContain('promProducts = promProducts.filter((p) => !p.isVariation)')
    expect(src.indexOf('variationRows')).toBeLessThan(src.indexOf('promById'))
    expect(src).toContain('variationsSkipped')
    expect(src).toContain('варіантів пропущено:')
  })

  it('client parses the variation fields (live API shape)', () => {
    const src = source('lib/prom/client.ts')
    expect(src).toContain('isVariation: boolean')
    expect(src).toContain('variationGroupId')
    expect(src).toContain('variationBaseId')
    expect(src).toContain("pick(r, 'variation_group_id')")
    expect(src).toContain("pick(r, 'variation_base_id')")
  })
})
