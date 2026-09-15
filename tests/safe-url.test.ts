import { describe, it, expect } from 'vitest'
import { safeInternalPath, safeOpenUrl } from '@/lib/safe-url'

describe('safeInternalPath', () => {
  it('keeps same-origin paths', () => {
    expect(safeInternalPath('/account/orders', '/account')).toBe('/account/orders')
    expect(safeInternalPath('/ru/account', '/account')).toBe('/ru/account')
  })

  it('rejects open-redirect tricks', () => {
    expect(safeInternalPath('//evil.example', '/account')).toBe('/account')
    expect(safeInternalPath('/\\evil.example', '/account')).toBe('/account')
    expect(safeInternalPath('https://evil.example', '/account')).toBe('/account')
    expect(safeInternalPath('/%2F%2Fevil.example', '/account')).toBe('/account')
    expect(safeInternalPath('///evil.example', '/account')).toBe('/account')
    expect(safeInternalPath('javascript:alert(1)', '/account')).toBe('/account')
    expect(safeInternalPath(null, '/account')).toBe('/account')
  })
})

describe('safeOpenUrl', () => {
  it('allows relative app paths and https', () => {
    expect(safeOpenUrl('/api/admin/np-label?orderId=1')).toBe('/api/admin/np-label?orderId=1')
    expect(safeOpenUrl('https://novaposhta.ua/tracking/?cargo_number=1')).toContain('novaposhta.ua')
  })

  it('rejects javascript and data URLs', () => {
    expect(safeOpenUrl('javascript:alert(1)')).toBeNull()
    expect(safeOpenUrl('data:text/html,hi')).toBeNull()
    expect(safeOpenUrl('//evil.example')).toBeNull()
  })

  it('allows extra messenger schemes when listed', () => {
    expect(safeOpenUrl('viber://chat?number=%2B380', ['viber:'])).toMatch(/^viber:/)
    expect(safeOpenUrl('sms:+380?body=hi', ['sms:'])).toMatch(/^sms:/)
    expect(safeOpenUrl('viber://chat?number=%2B380')).toBeNull()
  })
})
