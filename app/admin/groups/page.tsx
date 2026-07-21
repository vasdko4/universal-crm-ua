import { getGroups } from '@/app/actions/groups'
import { GroupsManager } from '@/components/groups-manager'
import { requirePermission } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function GroupsPage() {
  await requirePermission('groups')
  const groups = await getGroups()
  return <GroupsManager groups={groups} />
}
