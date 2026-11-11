import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
}))

import { unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { authorizeSetupToken, getConfiguredSetupToken, revokeSetupToken } from '@/lib/setup-token'

const mockedUnlinkSync = vi.mocked(unlinkSync)
const TOKEN = 'k7Qe2mN9pL4sT1wX8zY0aB3cD6eF'

describe('revokeSetupToken (audit P1: one-shot install token)', () => {
  const originalSetupToken = process.env.SETUP_TOKEN

  beforeEach(() => {
    mockedUnlinkSync.mockReset()
    delete process.env.SETUP_TOKEN
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    if (originalSetupToken === undefined) delete process.env.SETUP_TOKEN
    else process.env.SETUP_TOKEN = originalSetupToken
    vi.restoreAllMocks()
  })

  it('removes the token file and env var, and the token stops validating', () => {
    process.env.SETUP_TOKEN = TOKEN
    expect(authorizeSetupToken(TOKEN)).toBe(true)

    revokeSetupToken()

    expect(mockedUnlinkSync).toHaveBeenCalledWith(join(process.cwd(), '.setup-token'))
    expect(process.env.SETUP_TOKEN).toBeUndefined()
    expect(getConfiguredSetupToken()).toBeNull()
    expect(authorizeSetupToken(TOKEN)).toBe(false)
  })

  it('ignores a missing token file (ENOENT) and still clears the env var', () => {
    const enoent = new Error('ENOENT: no such file') as NodeJS.ErrnoException
    enoent.code = 'ENOENT'
    mockedUnlinkSync.mockImplementation(() => {
      throw enoent
    })
    process.env.SETUP_TOKEN = TOKEN

    expect(() => revokeSetupToken()).not.toThrow()
    expect(process.env.SETUP_TOKEN).toBeUndefined()
    expect(authorizeSetupToken(TOKEN)).toBe(false)
  })

  it('does not throw when unlink fails for another reason (best-effort)', () => {
    const eperm = new Error('EPERM: operation not permitted') as NodeJS.ErrnoException
    eperm.code = 'EPERM'
    mockedUnlinkSync.mockImplementation(() => {
      throw eperm
    })
    process.env.SETUP_TOKEN = TOKEN
    const errorSpy = vi.spyOn(console, 'error')

    expect(() => revokeSetupToken()).not.toThrow()
    expect(process.env.SETUP_TOKEN).toBeUndefined()
    expect(authorizeSetupToken(TOKEN)).toBe(false)
    expect(errorSpy).toHaveBeenCalled()
  })
})
