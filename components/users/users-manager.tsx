'use client'

import { useMemo, useState, useTransition } from 'react'
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
  Search,
  Users,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ALL_PERMISSIONS, readPermission, writePermission, type PermissionKey } from '@/lib/permissions'
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
import { useAdminI18n } from '@/lib/i18n/admin/context'
import type { AdminDictionary } from '@/lib/i18n/admin/dictionaries'
import { cn } from '@/lib/utils'

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
  const { dict } = useAdminI18n()
  const t = dict.users

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
            <Users className="size-4 text-primary" />
            <span className="font-semibold text-foreground">{users.length}</span>
            {t.usersCount}
          </span>
          <span className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
            <ShieldCheck className="size-4 text-primary" />
            <span className="font-semibold text-foreground">{roles.length}</span>
            {t.rolesCount}
          </span>
        </div>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="gap-4">
        <TabsList className="w-full justify-start sm:w-auto">
          <TabsTrigger value="users">
            {t.tabUsers}
            <span className="ml-1.5 rounded-full bg-background/80 px-1.5 text-xs tabular-nums">{users.length}</span>
          </TabsTrigger>
          <TabsTrigger value="roles">
            {t.tabRoles}
            <span className="ml-1.5 rounded-full bg-background/80 px-1.5 text-xs tabular-nums">{roles.length}</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-0">
          <UsersTab users={users} roles={roles} currentUserId={currentUserId} t={t} />
        </TabsContent>
        <TabsContent value="roles" className="mt-0">
          <RolesTab roles={roles} t={t} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function UsersTab({
  users,
  roles,
  currentUserId,
  t,
}: {
  users: AdminUserRow[]
  roles: Role[]
  currentUserId: string
  t: AdminDictionary['users']
}) {
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'manager' })

  const roleName = (code: string) => roles.find((r) => r.code === code)?.name ?? code

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q),
    )
  }, [users, query])

  function handleCreate() {
    startTransition(async () => {
      const res = await createUser(form)
      if (res.success) {
        toast.success(t.toastUserCreated)
        setOpen(false)
        setForm({ name: '', email: '', password: '', role: 'manager' })
      } else {
        toast.error(res.error ?? t.genericError)
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setOpen(true)} className="w-full sm:w-auto">
          <UserPlus className="size-4" />
          {t.addUser}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.newUserTitle}</DialogTitle>
            <DialogDescription className="sr-only">{t.newUserTitle}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="u-name">{t.nameLabel}</Label>
              <Input
                id="u-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoComplete="name"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="u-email">{t.emailLabel}</Label>
              <Input
                id="u-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                autoComplete="email"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="u-pass">{t.passwordLabel}</Label>
              <Input
                id="u-pass"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete="new-password"
                minLength={8}
              />
              <p className="text-xs text-muted-foreground">{t.passwordHint}</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t.roleLabel}</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
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
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t.cancel}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={pending || !form.name || !form.email || form.password.length < 8}
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              {t.create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center">
            <Users className="size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{t.emptyUsers}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>{t.colUser}</TableHead>
                <TableHead className="hidden sm:table-cell">{t.colRole}</TableHead>
                <TableHead>{t.colStatus}</TableHead>
                <TableHead className="text-right">{t.colActions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  roles={roles}
                  roleName={roleName}
                  isSelf={u.id === currentUserId}
                  t={t}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}

function UserRow({
  user,
  roles,
  roleName,
  isSelf,
  t,
}: {
  user: AdminUserRow
  roles: Role[]
  roleName: (code: string) => string
  isSelf: boolean
  t: AdminDictionary['users']
}) {
  const [pending, startTransition] = useTransition()

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">
              {user.name}{' '}
              {isSelf && <span className="text-xs font-normal text-muted-foreground">{t.youSuffix}</span>}
            </p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            <div className="mt-1 sm:hidden">
              <Select
                value={user.role}
                disabled={pending || (isSelf && user.role === 'admin')}
                onValueChange={(v) =>
                  startTransition(async () => {
                    const res = await updateUserRole(user.id, v)
                    if (res.success) toast.success(t.toastRoleUpdated)
                    else toast.error(t.genericError)
                  })
                }
              >
                <SelectTrigger className="h-8 w-full">
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
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        <Select
          value={user.role}
          disabled={pending || (isSelf && user.role === 'admin')}
          onValueChange={(v) =>
            startTransition(async () => {
              const res = await updateUserRole(user.id, v)
              if (res.success) toast.success(t.toastRoleUpdated)
              else toast.error(t.genericError)
            })
          }
        >
          <SelectTrigger className="h-8 w-44">
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
      </TableCell>
      <TableCell>
        <button
          type="button"
          disabled={pending || isSelf}
          onClick={() =>
            startTransition(async () => {
              const res = await setUserActive(user.id, !user.isActive)
              if (!res.success) toast.error(res.error ?? t.genericError)
            })
          }
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
            user.isActive ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground',
            isSelf ? 'cursor-default' : 'cursor-pointer hover:opacity-80',
          )}
        >
          {user.isActive ? <Check className="size-3" /> : <X className="size-3" />}
          {user.isActive ? t.active : t.disabled}
        </button>
      </TableCell>
      <TableCell className="text-right">
        {!isSelf && (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-destructive"
            disabled={pending}
            onClick={() => {
              if (!confirm(t.deleteUserConfirm.replace('{name}', user.name))) return
              startTransition(async () => {
                const res = await deleteUser(user.id)
                if (res.success) toast.success(t.toastUserDeleted)
                else toast.error(res.error ?? t.genericError)
              })
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  )
}

function RolesTab({ roles, t }: { roles: Role[]; t: AdminDictionary['users'] }) {
  const [editing, setEditing] = useState<Role | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)} className="w-full sm:w-auto">
          <Plus className="size-4" />
          {t.createRole}
        </Button>
      </div>

      {roles.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card px-4 py-16 text-center">
          <Shield className="size-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">{t.emptyRoles}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {roles.map((role) => {
            const perms = (role.permissions as string[]) ?? []
            const fullAccess = perms.includes('*')
            return (
              <div
                key={role.id}
                className="flex flex-col rounded-xl border border-border bg-card p-5 shadow-[0_1px_0_rgba(15,23,42,0.04)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      {role.code === 'admin' ? <KeyRound className="size-4" /> : <Shield className="size-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{role.name}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{role.code}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {role.isSystem ? t.systemRole : t.customRole}
                  </Badge>
                </div>
                {role.description && (
                  <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{role.description}</p>
                )}
                <p className="mt-auto pt-4 text-xs text-muted-foreground">
                  {t.accessCountLabel}{' '}
                  <span className="font-medium text-foreground">{fullAccess ? t.allSections : perms.length}</span>
                </p>
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(role)}>
                    <Pencil className="size-3.5" />
                    {t.edit}
                  </Button>
                  {!role.isSystem && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={async () => {
                        if (!confirm(t.deleteRoleConfirm.replace('{name}', role.name))) return
                        const res = await deleteRole(role.id)
                        if (res.success) toast.success(t.toastRoleDeleted)
                        else toast.error(res.error ?? t.genericError)
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {(editing || creating) && (
        <RoleDialog
          role={editing}
          t={t}
          onClose={() => {
            setEditing(null)
            setCreating(false)
          }}
        />
      )}
    </div>
  )
}

function RoleDialog({
  role,
  onClose,
  t,
}: {
  role: Role | null
  onClose: () => void
  t: AdminDictionary['users']
}) {
  const [pending, startTransition] = useTransition()
  const isAdminRole = role?.code === 'admin'
  const [name, setName] = useState(role?.name ?? '')
  const [code, setCode] = useState(role?.code ?? '')
  const [description, setDescription] = useState(role?.description ?? '')
  const [permissions, setPermissions] = useState<string[]>(role ? (role.permissions as string[]) : [])

  const allSelected = permissions.includes('*')

  function modeFor(key: PermissionKey): 'none' | 'read' | 'write' {
    if (permissions.includes(writePermission(key)) || permissions.includes(key)) return 'write'
    if (permissions.includes(readPermission(key))) return 'read'
    return 'none'
  }

  function setMode(key: PermissionKey, mode: 'none' | 'read' | 'write') {
    setPermissions((prev) => {
      const without = prev.filter((p) => p !== key && p !== readPermission(key) && p !== writePermission(key))
      if (mode === 'read') return [...without, readPermission(key)]
      if (mode === 'write') return [...without, writePermission(key)]
      return without
    })
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
        toast.success(t.toastRoleSaved)
        onClose()
      } else {
        toast.error(res.error ?? t.genericError)
      }
    })
  }

  const groups = Array.from(new Set(ALL_PERMISSIONS.map((p) => p.group)))

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{role ? t.dialogTitleEdit : t.dialogTitleCreate}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="r-name">{t.nameLabel}</Label>
              <Input id="r-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="r-code">{t.codeLabel}</Label>
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
            <Label htmlFor="r-desc">{t.descriptionLabel}</Label>
            <Input id="r-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          {isAdminRole ? (
            <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              {t.adminRoleHint}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <Label>{t.sectionAccessLabel}</Label>
              {groups.map((group) => (
                <div key={group} className="rounded-xl border border-border p-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{group}</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {ALL_PERMISSIONS.filter((p) => p.group === group).map((perm) => (
                      <div
                        key={perm.key}
                        className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm"
                      >
                        <span className="min-w-0 truncate text-foreground">{perm.label}</span>
                        <select
                          className="h-8 shrink-0 rounded-md border border-border bg-background px-2 text-xs"
                          value={allSelected ? 'write' : modeFor(perm.key)}
                          disabled={allSelected}
                          onChange={(e) => setMode(perm.key, e.target.value as 'none' | 'read' | 'write')}
                        >
                          <option value="none">{t.accessNone}</option>
                          <option value="read">{t.accessRead}</option>
                          <option value="write">{t.accessWrite}</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button onClick={handleSave} disabled={pending || !name}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {t.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
