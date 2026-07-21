import { requirePermission } from '@/lib/session'
import { listUsers, listRoles } from '@/app/actions/users'
import { UsersManager } from '@/components/users/users-manager'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const me = await requirePermission('users')
  const [users, roles] = await Promise.all([listUsers(), listRoles()])
  return <UsersManager users={users} roles={roles} currentUserId={me.id} />
}
