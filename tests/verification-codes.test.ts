import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { hashVerificationCode } from '@/lib/shop/verification-codes'

describe('hashVerificationCode', () => {
  const prev = process.env.BETTER_AUTH_SECRET

  beforeEach(() => {
    process.env.BETTER_AUTH_SECRET = 'test-secret'
  })

  afterEach(() => {
    if (prev === undefined) delete process.env.BETTER_AUTH_SECRET
    else process.env.BETTER_AUTH_SECRET = prev
  })

  it('is deterministic for the same code and differs per code', () => {
    expect(hashVerificationCode('123456')).toBe(hashVerificationCode('123456'))
    expect(hashVerificationCode('123456')).not.toBe(hashVerificationCode('654321'))
    expect(hashVerificationCode('123456')).not.toContain('123456')
    expect(hashVerificationCode('123456')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('depends on the server secret, so a DB leak alone reveals nothing', () => {
    const withSecret = hashVerificationCode('123456')
    process.env.BETTER_AUTH_SECRET = 'another-secret'
    expect(hashVerificationCode('123456')).not.toBe(withSecret)
  })
})
