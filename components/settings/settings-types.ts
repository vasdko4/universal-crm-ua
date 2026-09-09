'use client'

import type { AdminDictionary } from '@/lib/i18n/admin/dictionaries'
import type { StoreSettingsData, WeekDay, WidgetChannelKey } from '@/app/actions/settings-store'

export type SectionProps = {
  data: StoreSettingsData
  setData: React.Dispatch<React.SetStateAction<StoreSettingsData>>
  t: AdminDictionary['settings']
}

export function getWeekDays(t: AdminDictionary['settings']): { key: WeekDay; label: string }[] {
  return [
    { key: 'mon', label: t.weekMon },
    { key: 'tue', label: t.weekTue },
    { key: 'wed', label: t.weekWed },
    { key: 'thu', label: t.weekThu },
    { key: 'fri', label: t.weekFri },
    { key: 'sat', label: t.weekSat },
    { key: 'sun', label: t.weekSun },
  ]
}

export function getWidgetChannels(
  t: AdminDictionary['settings'],
): { key: WidgetChannelKey; label: string; placeholder: string; hint: string }[] {
  return [
    { key: 'phone', label: t.channelPhoneLabel, placeholder: '+380 00 000 00 00', hint: t.channelPhoneHint },
    { key: 'whatsapp', label: t.channelWhatsappLabel, placeholder: '+380 00 000 00 00', hint: t.channelWhatsappHint },
    { key: 'telegram', label: t.channelTelegramLabel, placeholder: t.channelTelegramPlaceholder, hint: t.channelTelegramHint },
    { key: 'viber', label: t.channelViberLabel, placeholder: '+380 00 000 00 00', hint: t.channelViberHint },
    { key: 'email', label: t.channelEmailLabel, placeholder: 'shop@example.com', hint: t.channelEmailHint },
  ]
}

export const SOCIALS: { key: keyof StoreSettingsData['social']; label: string }[] = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'telegram', label: 'Telegram' },
  { key: 'viber', label: 'Viber' },
  { key: 'tiktok', label: 'TikTok' },
]
