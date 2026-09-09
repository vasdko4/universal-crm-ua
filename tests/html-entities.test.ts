import { describe, it, expect } from 'vitest'
import { decodeHtmlEntities } from '@/lib/html-entities'

describe('decodeHtmlEntities', () => {
  it('turns Prom hex apostrophes into a real apostrophe', () => {
    expect(decodeHtmlEntities("Потужна м&#x27;ясорубка з")).toBe("Потужна м'ясорубка з")
    expect(decodeHtmlEntities("Потужна м&#X27;ясорубка")).toBe("Потужна м'ясорубка")
  })

  it('decodes decimal apostrophes and named entities', () => {
    expect(decodeHtmlEntities("м&#39;ясорубка")).toBe("м'ясорубка")
    expect(decodeHtmlEntities('&quot;foo&quot; & bar')).toBe('"foo" & bar')
  })

  it('leaves already-plain text alone', () => {
    expect(decodeHtmlEntities("Потужна м'ясорубка")).toBe("Потужна м'ясорубка")
  })
})
