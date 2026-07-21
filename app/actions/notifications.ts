'use server'

import { assertPermission } from '@/lib/session'
import { sendTelegramMessage } from '@/lib/notifications'
import { getStoreSettingsInternal } from '@/lib/store-settings'

/** Sends a test message to verify the Telegram bot token + chat id. */
export async function sendTestTelegram(input?: {
  botToken?: string
  chatId?: string
}): Promise<{ success: boolean; error?: string }> {
  await assertPermission('settings')
  const settings = await getStoreSettingsInternal()
  const botToken = input?.botToken?.trim() || settings.notifications.telegramBotToken
  const chatId = input?.chatId?.trim() || settings.notifications.telegramChatId
  if (!botToken || !chatId) {
    return { success: false, error: 'Укажите токен бота и Chat ID' }
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
