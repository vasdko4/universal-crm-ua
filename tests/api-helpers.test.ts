import { describe, expect, it } from 'vitest'
import { parseListParams } from '@/lib/api/helpers'

describe('parseListParams', () => {
  it('normalizes non-finite page values instead of passing them to the database', () => {
    expect(parseListParams('https://example.test/api?page=Infinity').page).toBe(1)
    expect(parseListParams('https://example.test/api?page=-Infinity').page).toBe(1)
    expect(parseListParams('https://example.test/api?page=NaN').page).toBe(1)
  })
})
