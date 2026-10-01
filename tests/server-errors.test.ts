import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/store-settings', () => ({
  getStoreSettingsInternal: vi.fn(),
}))

import { getStoreSettingsInternal } from '@/lib/store-settings'
import { reportError } from '@/lib/server-errors'

const mockedSettings = vi.mocked(getStoreSettingsInternal)

describe('reportError', () => {
  let errSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    mockedSettings.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('writes a structured, PII-safe console.error line and never throws', async () => {
    await expect(
      reportError('test.tag', new Error('failed for alice@example.com, +1 555 123 4567'), {
        context: { gateway: 'way_for_pay', status: 502 },
      }),
    ).resolves.toBeUndefined()
    expect(errSpy).toHaveBeenCalledTimes(1)
    const line = JSON.parse(String(errSpy.mock.calls[0][0]))
    expect(line).toEqual({
      level: 'error',
      tag: 'test.tag',
      errorType: 'Error',
      gateway: 'way_for_pay',
      status: 502,
    })
  })

  it('handles non-Error values without logging their contents', async () => {
    await reportError('test.tag', 'private@example.com')
    const line = JSON.parse(String(errSpy.mock.calls[0][0]))
    expect(line.errorType).toBe('string')
    expect(JSON.stringify(line)).not.toContain('private@example.com')
  })

  it('does not touch Telegram or settings without alertAdmin', async () => {
    await reportError('test.tag', new Error('x'))
    expect(fetch).not.toHaveBeenCalled()
    expect(mockedSettings).not.toHaveBeenCalled()
  })

  it('pings the admin Telegram chat when alertAdmin and Telegram are configured', async () => {
    mockedSettings.mockResolvedValue({
      notifications: {
        telegramEnabled: true,
        telegramBotToken: 'tok',
        telegramChatId: 'chat',
      },
    } as never)
    await reportError('cron.delivery-sync', new Error('private@example.com'), {
      alertAdmin: true,
    })
    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.telegram.org/bottok/sendMessage')
    const body = JSON.parse(String(init.body))
    expect(body.chat_id).toBe('chat')
    expect(body.text).toContain('cron.delivery-sync')
    expect(body.text).not.toContain('private@example.com')
  })

  it('escapes the tag in the Telegram alert', async () => {
    mockedSettings.mockResolvedValue({
      notifications: {
        telegramEnabled: true,
        telegramBotToken: 'tok',
        telegramChatId: 'chat',
      },
    } as never)
    await reportError('<b>private@example.com</b>', new Error('failure'), { alertAdmin: true })
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(init.body))
    expect(body.text).toContain('server.error')
    expect(body.text).not.toContain('private@example.com')
  })

  it('skips Telegram when not configured and never throws', async () => {
    mockedSettings.mockResolvedValue({ notifications: {} } as never)
    await expect(reportError('x', new Error('y'), { alertAdmin: true })).resolves.toBeUndefined()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('never throws even when the settings lookup fails', async () => {
    mockedSettings.mockRejectedValue(new Error('db down'))
    await expect(reportError('x', new Error('y'), { alertAdmin: true })).resolves.toBeUndefined()
  })

  it('never throws when console.error itself fails', async () => {
    errSpy.mockImplementation(() => {
      throw new Error('logging unavailable')
    })
    await expect(reportError('x', new Error('y'))).resolves.toBeUndefined()
  })
})
