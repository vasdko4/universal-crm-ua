'use client'

import { useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import {
  Store,
  Share2,
  Mail,
  BarChart3,
  ImageIcon,
  Loader2,
  Save,
  Palette,
  Check,
  Globe,
  Phone,
  Plus,
  Trash2,
  Clock,
  MapPin,
  MessageCircle,
  Power,
  Search,
  Bell,
  Send,
  Upload,
  X,
  KeyRound,
  Eye,
  EyeOff,
  LayoutTemplate,
} from 'lucide-react'
import { TEMPLATES } from '@/lib/shop/templates'
import { cn } from '@/lib/utils'
import { useAdminI18n } from '@/lib/i18n/admin/context'
import type { AdminDictionary } from '@/lib/i18n/admin/dictionaries'
import { useClientOrigin } from '@/lib/hooks/use-client-only'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  clearSiteCache,
  updateStoreSettings,
  type HomeHeroLocaleContent,
  type HomeBenefitItem,
  type StoreSettingsData,
  type WeekDay,
  type WidgetChannelKey,
} from '@/app/actions/settings-store'
import type { SectionProps } from './settings-types'
import { getWeekDays } from './settings-types'

export function ContactsSection({ data, setData, t }: SectionProps) {
  const c = data.contact
  const setContact = (patch: Partial<StoreSettingsData['contact']>) =>
    setData((d) => ({ ...d, contact: { ...d.contact, ...patch } }))

  const phones = c.phones.length ? c.phones : ['']

  const updatePhone = (i: number, value: string) =>
    setContact({ phones: phones.map((p, idx) => (idx === i ? value : p)) })
  const addPhone = () => {
    if (phones.length >= 3) return
    setContact({ phones: [...phones, ''] })
  }
  const removePhone = (i: number) =>
    setContact({ phones: phones.filter((_, idx) => idx !== i) })

  const updateDay = (day: WeekDay, patch: Partial<StoreSettingsData['contact']['workingHours'][WeekDay]>) =>
    setContact({
      workingHours: { ...c.workingHours, [day]: { ...c.workingHours[day], ...patch } },
    })
  const WEEK_DAYS = getWeekDays(t)

  return (
    <div className="flex max-w-xl flex-col gap-8">
      {/* Phones */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Phone className="size-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">{t.phonesTitle}</h2>
        </div>
        <p className="text-sm text-muted-foreground">{t.phonesDesc}</p>
        {phones.map((phone, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              type="tel"
              value={phone}
              placeholder="+380 00 000 00 00"
              onChange={(e) => updatePhone(i, e.target.value)}
            />
            {phones.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removePhone(i)}
                aria-label={t.removePhoneAria}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        ))}
        {phones.length < 3 && (
          <Button type="button" variant="outline" size="sm" className="w-fit gap-2" onClick={addPhone}>
            <Plus className="size-4" /> {t.addPhoneButton}
          </Button>
        )}
      </div>

      {/* Address */}
      <div className="flex flex-col gap-2 border-t border-border pt-6">
        <div className="flex items-center gap-2">
          <MapPin className="size-4 text-muted-foreground" />
          <Label htmlFor="c-address" className="text-base font-semibold">
            {t.addressTitle}
            <span className="ml-2 text-xs font-normal text-muted-foreground">{t.addressOptional}</span>
          </Label>
        </div>
        <Textarea
          id="c-address"
          rows={2}
          value={c.address}
          placeholder={t.addressPlaceholder}
          onChange={(e) => setContact({ address: e.target.value })}
        />
      </div>

      {/* Working hours */}
      <div className="flex flex-col gap-3 border-t border-border pt-6">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">{t.hoursTitle}</h2>
        </div>
        <div className="flex flex-col gap-2">
          {WEEK_DAYS.map(({ key, label }) => {
            const day = c.workingHours[key]
            return (
              <div key={key} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
                <span className="w-28 text-sm font-medium text-foreground">{label}</span>
                {day.closed ? (
                  <span className="flex-1 text-sm text-muted-foreground">{t.dayOff}</span>
                ) : (
                  <div className="flex flex-1 items-center gap-2">
                    <Input
                      type="time"
                      value={day.open}
                      className="w-32"
                      onChange={(e) => updateDay(key, { open: e.target.value })}
                    />
                    <span className="text-muted-foreground">—</span>
                    <Input
                      type="time"
                      value={day.close}
                      className="w-32"
                      onChange={(e) => updateDay(key, { close: e.target.value })}
                    />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Switch checked={day.closed} onCheckedChange={(v) => updateDay(key, { closed: v })} />
                  <span className="text-xs text-muted-foreground">{t.dayOff}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
