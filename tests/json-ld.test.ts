import { describe, it, expect } from 'vitest'

// Mirrors the escaping used in components/shop/json-ld.tsx: JSON.stringify()
// never escapes "<", so a customer-submitted review body containing the
// literal text "</script>" could break out of the JSON-LD <script> tag and
// inject arbitrary HTML/script for every visitor of that page (stored XSS).
// Escaping "<" as the JSON-safe \u003c sequence prevents that while staying
// valid, semantically identical JSON (any JSON.parse decodes \u003c back to "<").
function escapeForScriptTag(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

describe('JSON-LD script-tag escaping', () => {
  it('neutralizes a </script> breakout attempt in review text', () => {
    const payload = {
      review: [{ reviewBody: '</script><script>alert(document.cookie)</script>' }],
    }
    const out = escapeForScriptTag(payload)
    expect(out).not.toContain('</script>')
    expect(out).not.toContain('</')
    expect(out).toContain('\\u003c/script>')
  })

  it('round-trips back to the original data through JSON.parse', () => {
    const payload = { name: 'Іменa <b>bold</b> & \'quotes\'', reviewBody: '<script>evil()</script>' }
    const out = escapeForScriptTag(payload)
    expect(JSON.parse(out)).toEqual(payload)
  })

  it('leaves normal structured data untouched', () => {
    const payload = { '@type': 'Product', name: 'iPhone 15 Pro', price: 999 }
    expect(JSON.parse(escapeForScriptTag(payload))).toEqual(payload)
  })
})
