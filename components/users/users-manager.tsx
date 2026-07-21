'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  Shield,
  UserPlus,
  Trash2,
  Pencil,
  Plus,
  Check,
  X,
  Loader2,
  KeyRound,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ALL_PERMISSIONS, type PermissionKey } from '@/lib/permissions'
import {
  createUser,
  updateUserRole,
  setUserActive,
  deleteUser,
  saveRole,
  deleteRole,
  type AdminUserRow,
} from '@/app/actions/users'
import type { Role } from '@/lib/db/schema'

type Tab = 'users' | 'roles'

export function UsersManager({
  users,
  roles,
  currentUserId,
}: {
  users: AdminUserRow[]
  roles: Role[]
  currentUserId: string
}) {
  const [tab, setTab] = useState<Tab>('users')

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Пользователи и роли
          </h1>
          <p className="text-sm text-muted-foreground">
            Управление доступом сотрудников к разделам админ-центра
          </p>
        </div>
      </header>

      <div className="flex gap-1 border-b border-border">
        <TabButton active={tab === 'users'} onClick={() => setTab('users')}>
          Пользователи ({users.length})
        </TabButton>
        <TabButton active={tab === 'roles'} onClick={() => setTab('roles')}>
          Роли ({roles.length})
        </TabButton>
      </div>

      {tab === 'users' ? (
        <UsersTab users={users} roles={roles} currentUserId={currentUserId} />
      ) : (
        <RolesTab roles={roles} />
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? 'border-primary text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}

function UsersTab({
  users,
  roles,
  currentUserId,
}: {
  users: AdminUserRow[]
  roles: Role[]
  currentUserId: string
}) {
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'manager' })

  const roleName = (code: string) => roles.find((r) => r.code === code)?.name ?? code

  function handleCreate() {
    startTransition(async () => {
      const res = await createUser(form)
      if (res.success) {
        toast.success('Пользователь создан')
        setOpen(false)
        setForm({ name: '', email: '', password: '', role: 'manager' })
      } else {
        toast.error(res.error ?? 'Ошибка')
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="size-4" />
              Добавить пользователя
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Новый пользователь</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="u-name">Имя</Label>
                <Input
                  id="u-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="u-email">Email</Label>
                <Input
                  id="u-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="u-pass">Пароль</Label>
                <Input
                  id="u-pass"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Роль</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm({ ...form, role: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.code}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreate}
                disabled={pending || !form.name || !form.email || form.password.length < 8}
              >
                {pending && <Loader2 className="size-4 animate-spin" />}
                Создать
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Пользователь</th>
              <th className="px-4 py-3 font-medium">Роль</th>
              <th className="px-4 py-3 font-medium">Статус</th>
              <th className="px-4 py-3 font-medium text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                roles={roles}
                roleName={roleName}
                isSelf={u.id === currentUserId}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function UserRow({
  user,
  roles,
  roleName,
  isSelf,
}: {
  user: AdminUserRow
  roles: Role[]
  roleName: (code: string) => string
  isSelf: boolean
}) {
  const [pending, startTransition] = useTransition()

  return (
    <tr className="hover:bg-muted/30">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-foreground">
              {user.name} {isSelf && <span className="text-xs text-muted-foreground">(вы)</span>}
            </p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <Select
          value={user.role}
          disabled={pending || (isSelf && user.role === 'admin')}
          onValueChange={(v) =>
            startTransition(async () => {
              const res = await updateUserRole(user.id, v)
              if (res.success) toast.success('Роль обновлена')
              else toast.error('Ошибка')
            })
          }
        >
          <SelectTrigger className="h-8 w-40">
            <SelectValue>{roleName(user.role)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {roles.map((r) => (
              <SelectItem key={r.id} value={r.code}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-4 py-3">
        <button
          disabled={pending || isSelf}
          onClick={() =>
            startTransition(async () => {
              const res = await setUserActive(user.id, !user.isActive)
              if (!res.success) toast.error(res.error ?? 'Ошибка')
            })
          }
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            user.isActive
              ? 'bg-success/15 text-success'
              : 'bg-muted text-muted-foreground'
          } ${isSelf ? 'cursor-default' : 'cursor-pointer'}`}
        >
          {user.isActive ? <Check className="size-3" /> : <X className="size-3" />}
          {user.isActive ? 'Активен' : 'Отключён'}
        </button>
      </td>
      <td className="px-4 py-3 text-right">
        {!isSelf && (
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => {
              if (!confirm(`Удалить пользователя ${user.name}?`)) return
              startTransition(async () => {
                const res = await deleteUser(user.id)
                if (res.success) toast.success('Пользователь удалён')
                else toast.error(res.error ?? 'Ошибка')
              })
            }}
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        )}
      </td>
    </tr>
  )
}

function RolesTab({ roles }: { roles: Role[] }) {
  const [editing, setEditing] = useState<Role | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          Создать роль
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {roles.map((role) => (
          <div key={role.id} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {role.code === 'admin' ? (
                    <KeyRound className="size-4" />
                  ) : (
                    <Shield className="size-4" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-foreground">{role.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {role.isSystem ? 'Системная' : 'Пользовательская'}
                  </p>
                </div>
              </div>
            </div>
            {role.description && (
              <p className="mt-3 text-sm text-muted-foreground">{role.description}</p>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Доступов:{' '}
              <span className="font-medium text-foreground">
                {(role.permissions as string[]).includes('*')
                  ? 'все разделы'
                  : (role.permissions as string[]).length}
              </span>
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(role)}>
                <Pencil className="size-3.5" />
                Изменить
              </Button>
              {!role.isSystem && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    if (!confirm(`Удалить роль ${role.name}?`)) return
                    const res = await deleteRole(role.id)
                    if (res.success) toast.success('Роль удалена')
                    else toast.error(res.error ?? 'Ошибка')
                  }}
                >
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {(editing || creating) && (
        <RoleDialog
          role={editing}
          onClose={() => {
            setEditing(null)
            setCreating(false)
          }}
        />
      )}
    </div>
  )
}

function RoleDialog({ role, onClose }: { role: Role | null; onClose: () => void }) {
  const [pending, startTransition] = useTransition()
  const isAdminRole = role?.code === 'admin'
  const [name, setName] = useState(role?.name ?? '')
  const [code, setCode] = useState(role?.code ?? '')
  const [description, setDescription] = useState(role?.description ?? '')
  const [permissions, setPermissions] = useState<string[]>(
    role ? (role.permissions as string[]) : [],
  )

  const allSelected = permissions.includes('*')

  function toggle(key: PermissionKey) {
    setPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key],
    )
  }

  function handleSave() {
    startTransition(async () => {
      const res = await saveRole({
        id: role?.id,
        code: code || name.toLowerCase().replace(/\s+/g, '_'),
        name,
        description,
        permissions: isAdminRole ? ['*'] : permissions,
      })
      if (res.success) {
        toast.success('Роль сохранена')
        onClose()
      } else {
        toast.error(res.error ?? 'Ошибка')
      }
    })
  }

  const groups = Array.from(new Set(ALL_PERMISSIONS.map((p) => p.group)))

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{role ? 'Редактирование роли' : 'Новая роль'}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="r-name">Название</Label>
              <Input id="r-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="r-code">Код</Label>
              <Input
                id="r-code"
                value={code}
                disabled={!!role}
                placeholder="manager"
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="r-desc">Описание</Label>
            <Input
              id="r-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {isAdminRole ? (
            <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
              Роль администратора всегда имеет полный доступ ко всем разделам.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Label>Доступ к разделам</Label>
              {groups.map((group) => (
                <div key={group}>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {group}
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {ALL_PERMISSIONS.filter((p) => p.group === group).map((perm) => (
                      <label
                        key={perm.key}
                        className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-2.5 text-sm hover:bg-muted/50"
                      >
                        <input
                          type="checkbox"
                          checked={allSelected || permissions.includes(perm.key)}
                          onChange={() => toggle(perm.key)}
                          className="size-4 accent-primary"
                        />
                        <span className="text-foreground">{perm.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={pending || !name}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
