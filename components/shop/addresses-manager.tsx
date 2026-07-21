'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Plus, Pencil, Trash2, Star, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useI18n } from '@/lib/i18n/client'
import {
  saveUserAddress,
  deleteUserAddress,
  setDefaultAddress,
  type UserAddress,
} from '@/app/actions/addresses'
import { cn } from '@/lib/utils'

type FormState = {
  id?: number
  label: string
  firstName: string
  lastName: string
  phone: string
  deliveryMethod: string
  city: string
  branch: string
  branchType: string
  postIndex: string
  isDefault: boolean
}

const emptyForm: FormState = {
  label: '',
  firstName: '',
  lastName: '',
  phone: '',
  deliveryMethod: 'nova_poshta',
  city: '',
  branch: '',
  branchType: 'branch',
  postIndex: '',
  isDefault: false,
}

export function AddressesManager({ initialAddresses }: { initialAddresses: UserAddress[] }) {
  const { dict } = useI18n()
  const t = dict.account
  const router = useRouter()
  const [editing, setEditing] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)

  function startAdd() {
    setEditing({ ...emptyForm })
  }

  function startEdit(a: UserAddress) {
    setEditing({
      id: a.id,
      label: a.label ?? '',
      firstName: a.firstName,
      lastName: a.lastName ?? '',
      phone: a.phone,
      deliveryMethod: a.deliveryMethod,
      city: a.city ?? '',
      branch: a.branch ?? '',
      branchType: a.branchType ?? 'branch',
      postIndex: a.postIndex ?? '',
      isDefault: a.isDefault,
    })
  }

  async function save() {
    if (!editing) return
    if (!editing.firstName.trim() || !editing.phone.trim()) return
    setSaving(true)
    const res = await saveUserAddress({
      id: editing.id,
      label: editing.label || null,
      firstName: editing.firstName,
      lastName: editing.lastName || null,
      phone: editing.phone,
      deliveryMethod: editing.deliveryMethod,
      city: editing.city || null,
      branch: editing.branch || null,
      branchType: editing.branchType,
      postIndex: editing.postIndex || null,
      isDefault: editing.isDefault,
    })
    setSaving(false)
    if (res.ok) {
      setEditing(null)
      router.refresh()
    }
  }

  async function remove(id: number) {
    if (!window.confirm(t.deleteConfirm)) return
    setBusyId(id)
    await deleteUserAddress(id)
    setBusyId(null)
    router.refresh()
  }

  async function makeDefault(id: number) {
    setBusyId(id)
    await setDefaultAddress(id)
    setBusyId(null)
    router.refresh()
  }

  const isUkr = editing?.deliveryMethod === 'ukrposhta'

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">{t.addressesTitle}</h1>
        {!editing && (
          <Button onClick={startAdd} className="gap-1">
            <Plus className="size-4" /> {t.addAddress}
          </Button>
        )}
      </div>

      {editing && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 text-base font-semibold text-foreground">
            {editing.id ? t.editAddress : t.addAddress}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1 sm:col-span-2">
              <Label>{t.addressLabel}</Label>
              <Input
                value={editing.label}
                onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                placeholder={t.addressLabelPlaceholder}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>{t.firstName}</Label>
              <Input
                value={editing.firstName}
                onChange={(e) => setEditing({ ...editing, firstName: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>{t.lastName}</Label>
              <Input
                value={editing.lastName}
                onChange={(e) => setEditing({ ...editing, lastName: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <Label>{t.phone}</Label>
              <Input
                value={editing.phone}
                inputMode="tel"
                onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                placeholder="+380 XX XXX XX XX"
              />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <Label>{t.deliveryMethod}</Label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { value: 'nova_poshta', label: t.novaPoshta },
                    { value: 'ukrposhta', label: t.ukrposhta },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setEditing({ ...editing, deliveryMethod: opt.value })}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                      editing.deliveryMethod === opt.value
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label>{t.city}</Label>
              <Input
                value={editing.city}
                onChange={(e) => setEditing({ ...editing, city: e.target.value })}
              />
            </div>
            {isUkr ? (
              <div className="flex flex-col gap-1">
                <Label>{t.postIndex}</Label>
                <Input
                  value={editing.postIndex}
                  inputMode="numeric"
                  onChange={(e) => setEditing({ ...editing, postIndex: e.target.value })}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <Label>{t.branch}</Label>
                <Input
                  value={editing.branch}
                  onChange={(e) => setEditing({ ...editing, branch: e.target.value })}
                />
              </div>
            )}
            <label className="flex items-center gap-2 sm:col-span-2">
              <input
                type="checkbox"
                checked={editing.isDefault}
                onChange={(e) => setEditing({ ...editing, isDefault: e.target.checked })}
                className="size-4 rounded border-border"
              />
              <span className="text-sm text-foreground">{t.setDefault}</span>
            </label>
          </div>
          <div className="mt-5 flex gap-2">
            <Button onClick={save} disabled={saving} className="gap-1">
              {saving && <Loader2 className="size-4 animate-spin" />}
              {saving ? t.saving : t.save}
            </Button>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>
              {t.cancel}
            </Button>
          </div>
        </div>
      )}

      {!editing && initialAddresses.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card px-6 py-16 text-center">
          <MapPin className="mb-4 size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t.addressesEmpty}</p>
        </div>
      )}

      {!editing && initialAddresses.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {initialAddresses.map((a) => (
            <div
              key={a.id}
              className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 text-primary" />
                  <span className="font-semibold text-foreground">
                    {a.label || a.city || t.navAddresses}
                  </span>
                </div>
                {a.isDefault && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {t.defaultBadge}
                  </span>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                <p className="text-foreground">
                  {a.firstName} {a.lastName}
                </p>
                <p>{a.phone}</p>
                <p>
                  {a.deliveryMethod === 'ukrposhta' ? t.ukrposhta : t.novaPoshta}
                  {a.city ? `, ${a.city}` : ''}
                  {a.branch ? `, ${a.branch}` : ''}
                  {a.postIndex ? `, ${a.postIndex}` : ''}
                </p>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {!a.isDefault && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 px-2 text-xs"
                    disabled={busyId === a.id}
                    onClick={() => makeDefault(a.id)}
                  >
                    <Star className="size-3.5" /> {t.setDefault}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 px-2 text-xs"
                  onClick={() => startEdit(a)}
                >
                  <Pencil className="size-3.5" /> {t.editAddress}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 px-2 text-xs text-destructive hover:text-destructive"
                  disabled={busyId === a.id}
                  onClick={() => remove(a.id)}
                >
                  {busyId === a.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                  {t.deleteAddress}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
