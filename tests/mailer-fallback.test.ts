import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/store-settings', () => ({
  getStoreSettingsInternal: vi.fn(),
}))
vi.mock('@/lib/server-errors', () => ({
  reportError: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('nodemailer', () => ({
  default: { createTransport: vi.fn() },
}))

import { getStoreSettingsInternal } from '@/lib/store-settings'
import { reportError } from '@/lib/server-errors'
import { sendMail } from '@/lib/mailer'

const mockedSettings = vi.mocked(getStoreSettingsInternal)
const mockedReport = vi.mocked(reportError)

describe('sendMail SMTP fallback', () => {
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    mockedSettings.mockReset()
    mockedReport.mockReset()
    mockedSettings.mockResolvedValue({ emailSettings: {} } as never)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('in production reports a structured error without leaking PII', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const result = await sendMail({ to: 'user@example.com', subject: 'Code', text: 'secret-code-123' })
    expect(result).toEqual({ sent: false, fallback: true })
    expect(mockedReport).toHaveBeenCalledTimes(1)
    const [tag, err, opts] = mockedReport.mock.calls[0]
    expect(tag).toBe('email.not-configured')
    expect(err).toBeInstanceOf(Error)
    // No recipient, no body in the log line.
    expect(JSON.stringify(opts)).not.toContain('user@example.com')
    expect(JSON.stringify(opts)).not.toContain('secret-code-123')
    expect(logSpy).not.toHaveBeenCalled()
  })

  it('outside production keeps the full fallback dump for testability', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const result = await sendMail({ to: 'user@example.com', subject: 'Code', text: 'secret-code-123' })
    expect(result).toEqual({ sent: false, fallback: true })
    expect(mockedReport).not.toHaveBeenCalled()
    expect(logSpy).toHaveBeenCalledTimes(1)
    expect(String(logSpy.mock.calls[0][0])).toContain('secret-code-123')
  })
})
