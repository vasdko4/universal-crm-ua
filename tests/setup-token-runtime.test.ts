import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}))

import { existsSync, writeFileSync } from 'node:fs'

const mockedExistsSync = vi.mocked(existsSync)
const mockedWriteFileSync = vi.mocked(writeFileSync)

describe('ensureSetupToken runtime behavior', () => {
  const originalSetupToken = process.env.SETUP_TOKEN
  const originalVercel = process.env.VERCEL

  beforeEach(() => {
    vi.resetModules()
    mockedExistsSync.mockReset().mockReturnValue(false)
    mockedWriteFileSync.mockReset()
    delete process.env.SETUP_TOKEN
    delete process.env.VERCEL
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    if (originalSetupToken === undefined) delete process.env.SETUP_TOKEN
    else process.env.SETUP_TOKEN = originalSetupToken
    if (originalVercel === undefined) delete process.env.VERCEL
    else process.env.VERCEL = originalVercel
    vi.restoreAllMocks()
  })

  it('keeps generated tokens in memory without writing files on Vercel', async () => {
    process.env.VERCEL = '1'
    const { ensureSetupToken, getConfiguredSetupToken } = await import('@/lib/setup-token')

    const { token, generated } = ensureSetupToken()

    expect(generated).toBe(true)
    expect(getConfiguredSetupToken()).toBe(token)
    expect(mockedWriteFileSync).not.toHaveBeenCalled()
  })

  it('attempts persistence and logs write failures at most once per instance', async () => {
    mockedWriteFileSync.mockImplementation(() => {
      throw new Error('EROFS')
    })
    const errorSpy = vi.spyOn(console, 'error')
    const { ensureSetupToken } = await import('@/lib/setup-token')

    ensureSetupToken()
    delete process.env.SETUP_TOKEN
    ensureSetupToken()

    expect(mockedWriteFileSync).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledWith('[setup] could not persist .setup-token:', 'EROFS')
  })
})
