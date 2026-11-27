'use server'

import { assertWritePermission } from '@/lib/session'
import { sendTelegramMessage } from '@/lib/notifications'
import { getStoreSettingsInternal } from '@/lib/store-settings'
import { isRateLimited } from '@/lib/api/rate-limit'

// Telegram bot token as issued by @BotFather: <bot-id>:<~35-char secret>.
const TELEGRAM_BOT_TOKEN_RE = /^\d+:[A-Za-z0-9_-]{30,}$/
// Chat id: a user id, or a negative group/supergroup id.
const TELEGRAM_CHAT_ID_RE = /^-?\d+$/

/**
 * Sends a test message to verify the stored Telegram bot token + chat id.
 *
 * Audit #15: the old signature took a caller-supplied token/chatId, so any
 * admin session could use this endpoint as a Telegram relay to an arbitrary
 * bot/chat (spam / phishing from the shop's server IP). The test now uses
 * ONLY the token/chat id saved in settings — save them first, then test.
 * Stored values are format-checked before any outbound call, and the
 * action is capped at 3/min per admin.
 */
export async function sendTestTelegram(): Promise<{ success: boolean; error?: string }> {
  const me = await assertWritePermission('settings')
  if (await isRateLimited('telegram-test', me.id, 3, 60_000)) {
    return { success: false, error: 'Забагато спроб. Спробуйте через хвилину.' }
  }
  const settings = await getStoreSettingsInternal()
  const botToken = (settings.notifications.telegramBotToken ?? '').trim()
  const chatId = (settings.notifications.telegramChatId ?? '').trim()
  if (!botToken || !chatId) {
    return { success: false, error: 'Укажите токен бота и Chat ID' }
  }
  if (!TELEGRAM_BOT_TOKEN_RE.test(botToken) || !TELEGRAM_CHAT_ID_RE.test(chatId)) {
    return { success: false, error: 'Невірний формат токена бота або Chat ID' }
  }
  const ok = await sendTelegramMessage(
    botToken,
    chatId,
    `✅ Тестовое уведомление от магазина «${settings.storeName}». Telegram настроен правильно!`,
  )
  return ok
    ? { success: true }
    : { success: false, error: 'Не удалось отправить. Проверьте токен и Chat ID (напишите боту /start)' }
}
