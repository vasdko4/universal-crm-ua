'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  createCustomer,
  updateCustomer,
  type CustomerListItem,
} from '@/app/actions/customers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2 } from 'lucide-react'
import { useAdminI18n } from '@/lib/i18n/admin/context'

type ContactRow = { key: string; type: string; value: string }

let rowCounter = 0
function newRow(type = 'viber', value = ''): ContactRow {
  rowCounter += 1
  return { key: `row-${rowCounter}`, type, value }
}

export function CustomerDialog({
  open,
  onOpenChange,
  customer,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer: CustomerListItem | null
  onSaved: () => void
}) {
  const { dict } = useAdminI18n()
  const t = dict.customers
  const CHANNEL_OPTIONS = [
    { value: 'viber', label: t.contactViber },
    { value: 'skype', label: t.contactSkype },
    { value: 'whatsapp', label: t.contactWhatsapp },
    { value: 'telegram', label: t.contactTelegram },
    { value: 'email', label: t.contactEmail },
    { value: 'phone', label: t.contactPhone },
  ]
  const [isPending, startTransition] = useTransition()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [score, setScore] = useState('100')
  const [note, setNote] = useState('')
  const [contacts, setContacts] = useState<ContactRow[]>([])

  const isEdit = !!customer

  // Reset the form whenever the dialog (re-)opens or the customer being
  // edited changes, while it's open. Done as a render-time adjustment
  // (comparing against the previous "open state key") instead of an effect,
  // so React doesn't warn about setState calls directly inside an effect
  // body — behavior is identical to the original effect.
  const openKey = open ? (customer ? `edit-${customer.id}` : 'new') : null
  const [prevOpenKey, setPrevOpenKey] = useState<string | null>(null)
  if (openKey !== prevOpenKey) {
    setPrevOpenKey(openKey)
    if (openKey !== null) {
      if (customer) {
        setFirstName(customer.firstName)
        setLastName(customer.lastName ?? '')
        setPhone(customer.phone)
        setEmail(customer.email ?? '')
        setScore(String(customer.reliabilityScore))
        setNote(customer.note ?? '')
        setContacts(customer.contacts.map((c) => newRow(c.type, c.value)))
      } else {
        setFirstName('')
        setLastName('')
        setPhone('')
        setEmail('')
        setScore('100')
        setNote('')
        setContacts([])
      }
    }
  }

  function addRow() {
    setContacts((prev) => [...prev, newRow()])
  }

  function updateRow(key: string, patch: Partial<ContactRow>) {
    setContacts((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  function removeRow(key: string) {
    setContacts((prev) => prev.filter((r) => r.key !== key))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const input = {
      firstName,
      lastName,
      phone,
      email,
      reliabilityScore: Number(score) || 0,
      note,
      contacts: contacts.map((c) => ({ type: c.type, value: c.value })),
    }
    startTransition(async () => {
      const res = customer
        ? await updateCustomer(customer.id, input)
        : await createCustomer(input)
      if (res.success) {
        toast.success(isEdit ? t.toastUpdated : t.toastCreated)
        onOpenChange(false)
        onSaved()
      } else {
        toast.error(res.error ?? t.toastSaveError)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? t.dialogEditTitle : t.dialogNewTitle}</DialogTitle>
          <DialogDescription>
            {t.dialogHint}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cust-first">{t.firstName}</Label>
              <Input
                id="cust-first"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder={t.firstNamePlaceholder}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cust-last">{t.lastName}</Label>
              <Input
                id="cust-last"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder={t.lastNamePlaceholder}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cust-phone">{t.mainPhone}</Label>
              <Input
                id="cust-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+380671234567"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cust-email">{t.email}</Label>
              <Input
                id="cust-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@example.com"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="cust-score">{t.reliabilityScore}</Label>
            <Input
              id="cust-score"
              type="number"
              min={0}
              max={100}
              value={score}
              onChange={(e) => setScore(e.target.value)}
              className="sm:w-40"
            />
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label>{t.contactChannels}</Label>
              <Button type="button" variant="outline" size="sm" onClick={addRow}>
                <Plus className="size-4" />
                {t.addChannel}
              </Button>
            </div>

            {contacts.length === 0 ? (
              <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
                {t.noChannels}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {contacts.map((row) => (
                  <div key={row.key} className="flex items-center gap-2">
                    <Select value={row.type} onValueChange={(v) => updateRow(row.key, { type: v })}>
                      <SelectTrigger className="w-40 shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CHANNEL_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={row.value}
                      onChange={(e) => updateRow(row.key, { value: e.target.value })}
                      placeholder={t.channelValuePlaceholder}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeRow(row.key)}
                      aria-label={t.removeChannelAria}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="cust-note">{t.note}</Label>
            <Textarea
              id="cust-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t.notePlaceholder}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t.cancel}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? t.saving : isEdit ? t.save : t.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
