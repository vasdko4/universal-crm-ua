'use client'

import type { AdminDictionary } from '@/lib/i18n/admin/dictionaries'
import type { StoreSettingsData } from '@/app/actions/settings-store'

export type SectionProps = {
  data: StoreSettingsData
  setData: React.Dispatch<React.SetStateAction<StoreSettingsData>>
  t: AdminDictionary['settings']
}
