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

/**
 * Persist the error to the error_logs table for the admin Error Logs tab.
 * Deduplicates: same tag + errorType within the last hour bumps `occurrences`
 * instead of inserting a row (prevents log flooding). Best-effort, never
 * throws, never calls reportError (no recursion).
 */
async function persistErrorLog(
  tag: string,
  errorType: string,
  context: Record<string, unknown>,
): Promise<void> {
  try {
    const { pool } = await import('@/lib/db')
    const ctxJson = JSON.stringify(context)
    // Bump an existing unresolved entry from the last hour.
    const bumped = await pool.query(
      `UPDATE error_logs
          SET occurrences = occurrences + 1, last_seen = NOW(), context = $3
        WHERE tag = $1 AND message = $2 AND resolved = false
          AND last_seen > NOW() - INTERVAL '1 hour'
        RETURNING id`,
      [tag, errorType, ctxJson],
    )
    if ((bumped.rowCount ?? 0) > 0) return
    await pool.query(
      `INSERT INTO error_logs (tag, message, context) VALUES ($1, $2, $3)`,
      [tag, errorType, ctxJson],
    )
    // Retention: keep the table bounded.
    await pool.query(
      `DELETE FROM error_logs
        WHERE id NOT IN (SELECT id FROM error_logs ORDER BY id DESC LIMIT 5000)`,
    )
  } catch {
    // Best effort — a failing log write must not break the reporter.
  }
}

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

    // Persist for the admin Error Logs tab (best-effort, deduped).
    // Fire and forget — never blocks the caller.
    void persistErrorLog(normalizedTag, errorType, context)

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
