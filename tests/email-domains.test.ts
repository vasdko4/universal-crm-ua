import { describe, it, expect } from 'vitest'
import { isAllowedEmailDomain, getEmailDomain } from '@/lib/shop/email-domains'

describe('isAllowedEmailDomain', () => {
  it('accepts popular consumer providers', () => {
    expect(isAllowedEmailDomain('user@gmail.com')).toBe(true)
    expect(isAllowedEmailDomain('user@ukr.net')).toBe(true)
    expect(isAllowedEmailDomain('user@outlook.com')).toBe(true)
  })

  it('accepts a corporate domain', () => {
    expect(isAllowedEmailDomain('shop@magazine.store')).toBe(true)
    expect(isAllowedEmailDomain('ops@techno-store.com.ua')).toBe(true)
  })

  it('rejects disposable mailboxes and junk', () => {
    expect(isAllowedEmailDomain('a@mailinator.com')).toBe(false)
    expect(isAllowedEmailDomain('a@yopmail.com')).toBe(false)
    expect(isAllowedEmailDomain('nodomain')).toBe(false)
    expect(isAllowedEmailDomain('a@localhost')).toBe(false)
  })

  it('parses the domain', () => {
    expect(getEmailDomain('A.B@Gmail.COM')).toBe('gmail.com')
  })
})
