import { getGroups } from '@/app/actions/groups'
import { GroupsManager } from '@/components/groups-manager'

export const dynamic = 'force-dynamic'

export default async function GroupsPage() {
  const groups = await getGroups()
  return <GroupsManager groups={groups} />
}
