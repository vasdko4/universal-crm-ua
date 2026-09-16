import { requirePermission } from '@/lib/session'
import { DEFAULTS, getStoreSettingsInternal } from '@/lib/store-settings'
import { SettingsManager } from '@/components/settings/settings-manager'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  await requirePermission('settings')
  // Live store_settings rows can predate later columns / JSON shapes. Never
  // 500 the admin screen — fall back to DEFAULTS so the form still opens.
  const settings = await getStoreSettingsInternal().catch((err) => {
    console.error('[admin/settings] getStoreSettingsInternal failed:', (err as Error).message)
    return DEFAULTS
  })
  return <SettingsManager initial={settings} />
}
