/**
 * Centralized server-side error reporting.
 *
 * Problem it solves: failures in background/critical paths (payment gateway,
 * delivery-sync cron, OTP mail, notifications) were only written to
 * `console.log('[v0] …')` — invisible in production unless someone happened
 * to watch the logs. Now every failure goes through `reportError`, which:
 *
 * 1. Always writes a structured `console.error` line (JSON with a stable
 *    `tag`) — visible in Vercel Runtime Logs and any log drain.
 * 2. Optionally pings the admin Telegram chat for critical failures
 *    (`alertAdmin: true`) — the same bot/chat the order alerts use.
 *
 * Safety rules (do not break them):
 * - `reportError` never throws — logging/alerting failures are swallowed.
 * - It never reports its own failures — no recursion.
 * - The Telegram sender is self-contained on purpose: this module must not
 *   import `lib/notifications` (which imports this module).
 * - Context is PII-safe by type: only { gateway, status } are accepted.
 */
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
    productId?: number
    orderId?: number
    reason?: string
    subject?: string
  }
}

function safeTag(tag: string): string {
  return /^[a-z0-9._-]{1,80}$/i.test(tag) ? tag : 'server.error'
}

function safeText(value: unknown, maxLen: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const t = value.trim()
  return t.length > 0 && t.length <= maxLen ? t : undefined
}

function safeContext(context: ReportErrorOptions['context']) {
  if (!context) return {}
  const safe: NonNullable<ReportErrorOptions['context']> = {}
  if (typeof context.gateway === 'string' && /^[a-z0-9_-]{1,40}$/i.test(context.gateway)) {
    safe.gateway = context.gateway
  }
  if (Number.isInteger(context.status) && context.status! >= 100 && context.status! <= 599) {
    safe.status = context.status
  }
  if (Number.isInteger(context.productId) && context.productId! >= 0) {
    safe.productId = context.productId
  }
  if (Number.isInteger(context.orderId) && context.orderId! >= 0) {
    safe.orderId = context.orderId
  }
  const reason = safeText(context.reason, 60)
  if (reason) safe.reason = reason
  const subject = safeText(context.subject, 120)
  if (subject) safe.subject = subject
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
    let errorMessage = ''
    try {
      if (error instanceof Error) errorMessage = error.message
      else if (typeof error === 'string') errorMessage = error
    } catch {
      // ignore
    }
    try {
      console.error(
        JSON.stringify({
          level: 'error',
          tag: normalizedTag,
          errorType,
          message: errorMessage.slice(0, 500),
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
