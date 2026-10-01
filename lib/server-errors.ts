import { getStoreSettingsInternal } from '@/lib/store-settings'

export type ReportErrorOptions = {
  /**
   * Ping the admin Telegram chat. Use only for critical failures
   * (money flow, cron, auth recovery) — not for best-effort notifications,
   * where a Telegram ping about Telegram being down is pointless noise.
   */
  alertAdmin?: boolean
  /** Only non-sensitive operational metadata is accepted. */
  context?: {
    gateway?: string
    status?: number
  }
}

function safeTag(tag: string): string {
  return /^[a-z0-9._-]{1,80}$/i.test(tag) ? tag : 'server.error'
}

function safeContext(context: ReportErrorOptions['context']) {
  if (!context) return {}
  const safe: { gateway?: string; status?: number } = {}
  if (typeof context.gateway === 'string' && /^[a-z0-9_-]{1,40}$/i.test(context.gateway)) {
    safe.gateway = context.gateway
  }
  if (Number.isInteger(context.status) && context.status! >= 100 && context.status! <= 599) {
    safe.status = context.status
  }
  return safe
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Reports operational failures without logging exception messages or stacks,
 * which may contain credentials, customer data, or request payloads.
 * This module deliberately does not import notifications: reporter failures
 * are swallowed here rather than reported recursively.
 */
export async function reportError(
  tag: string,
  error: unknown,
  opts: ReportErrorOptions = {},
): Promise<void> {
  try {
    const normalizedTag = safeTag(tag)
    let errorType: string = typeof error
    try {
      if (error instanceof Error) errorType = 'Error'
    } catch {
      // Treat unusual proxy objects as opaque.
    }

    const context = safeContext(opts.context)
    try {
      console.error(
        JSON.stringify({
          level: 'error',
          tag: normalizedTag,
          errorType,
          ...context,
        }),
      )
    } catch {
      // Logging must never interfere with the operation being reported.
    }

    if (!opts.alertAdmin) return

    try {
      const settings = await getStoreSettingsInternal()
      const notifications = settings.notifications
      if (
        !notifications?.telegramEnabled ||
        !notifications.telegramBotToken ||
        !notifications.telegramChatId
      ) {
        return
      }

      const text = `⚠️ <b>${escapeHtml(normalizedTag)}</b>\nA server-side failure was recorded. Check runtime logs.`
      await fetch(`https://api.telegram.org/bot${notifications.telegramBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: notifications.telegramChatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(10_000),
      }).catch(() => {})
    } catch {
      // Alerting failures must not throw or recursively report themselves.
    }
  } catch {
    // The reporter is best-effort, including malformed runtime inputs.
  }
}
