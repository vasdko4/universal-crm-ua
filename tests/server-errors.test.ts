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

  it('writes a structured console.error line and never throws', async () => {
    await expect(
      reportError('test.tag', new Error('boom'), { context: { orderId: 1 } }),
    ).resolves.toBeUndefined()
    expect(errSpy).toHaveBeenCalledTimes(1)
    const line = JSON.parse(String(errSpy.mock.calls[0][0]))
    expect(line.level).toBe('error')
    expect(line.tag).toBe('test.tag')
    expect(line.message).toBe('boom')
    expect(line.orderId).toBe(1)
    expect(line.stack).toContain('Error: boom')
  })

  it('handles non-Error values', async () => {
    await reportError('test.tag', 'plain string failure')
    const line = JSON.parse(String(errSpy.mock.calls[0][0]))
    expect(line.message).toBe('plain string failure')
  })

  it('does not touch Telegram or settings without alertAdmin', async () => {
    await reportError('test.tag', new Error('x'))
    expect(fetch).not.toHaveBeenCalled()
    expect(mockedSettings).not.toHaveBeenCalled()
  })

  it('pings the admin Telegram chat when alertAdmin and telegram is configured', async () => {
    mockedSettings.mockResolvedValue({
      notifications: {
        telegramEnabled: true,
        telegramBotToken: 'tok',
        telegramChatId: 'chat',
      },
    } as never)
    await reportError('cron.delivery-sync', new Error('dead'), { alertAdmin: true })
    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.telegram.org/bottok/sendMessage')
    const body = JSON.parse(String(init.body))
    expect(body.chat_id).toBe('chat')
    expect(body.text).toContain('cron.delivery-sync')
    expect(body.text).toContain('dead')
  })

  it('escapes HTML in the Telegram alert', async () => {
    mockedSettings.mockResolvedValue({
      notifications: {
        telegramEnabled: true,
        telegramBotToken: 'tok',
        telegramChatId: 'chat',
      },
    } as never)
    await reportError('t', new Error('<b>oops</b> & more'), { alertAdmin: true })
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(init.body))
    expect(body.text).toContain('&lt;b&gt;oops&lt;/b&gt; &amp; more')
  })

  it('skips Telegram when not configured and never throws', async () => {
    mockedSettings.mockResolvedValue({ notifications: {} } as never)
    await expect(
      reportError('x', new Error('y'), { alertAdmin: true }),
    ).resolves.toBeUndefined()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('never throws even when the settings lookup fails', async () => {
    mockedSettings.mockRejectedValue(new Error('db down'))
    await expect(
      reportError('x', new Error('y'), { alertAdmin: true }),
    ).resolves.toBeUndefined()
  })
})
