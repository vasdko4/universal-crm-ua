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
 */
import { getStoreSettingsInternal } from '@/lib/store-settings'

export type ReportErrorOptions = {
  /**
   * Ping the admin Telegram chat. Use only for critical failures
   * (money flow, cron, auth recovery) — not for best-effort notifications,
   * where a Telegram ping about Telegram being down is pointless noise.
   */
  alertAdmin?: boolean
  /** Extra structured context merged into the log line (no PII). */
  context?: Record<string, unknown>
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function reportError(
  tag: string,
  error: unknown,
  opts: ReportErrorOptions = {},
): Promise<void> {
  const message = errorMessage(error)
  const stack =
    error instanceof Error && error.stack
      ? error.stack.split('\n').slice(0, 6).join('\n')
      : undefined
  try {
    // Structured line for Vercel Runtime Logs / log drains.
    console.error(
      JSON.stringify({
        level: 'error',
        tag,
        message,
        ...(opts.context ?? {}),
        ...(stack ? { stack } : {}),
      }),
    )
  } catch {
    // Logging must never throw.
  }

  if (!opts.alertAdmin) return

  try {
    const settings = await getStoreSettingsInternal()
    const n = settings.notifications ?? {}
    if (!n.telegramEnabled || !n.telegramBotToken || !n.telegramChatId) return
    const text = `⚠️ <b>${escHtml(tag)}</b>\n${escHtml(message).slice(0, 900)}`
    // Fire-and-forget: an alerting failure must not recurse into reportError.
    await fetch(`https://api.telegram.org/bot${n.telegramBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: n.telegramChatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(10_000),
    }).catch(() => {})
  } catch {
    // Alerting must never throw.
  }
}
