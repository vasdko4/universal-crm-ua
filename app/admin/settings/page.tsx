import { requirePermission } from '@/lib/session'
import { getStoreSettings } from '@/app/actions/settings-store'
import { SettingsManager } from '@/components/settings/settings-manager'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  await requirePermission('settings')
  const settings = await getStoreSettings()
  return <SettingsManager initial={settings} />
}
