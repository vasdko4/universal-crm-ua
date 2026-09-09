'use client'

import { useState, useTransition } from 'react'
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
  Phone,
  MessageCircle,
  Power,
  Search,
  Bell,
  KeyRound,
  LayoutTemplate,
} from 'lucide-react'
import { useAdminI18n } from '@/lib/i18n/admin/context'
import type { AdminDictionary } from '@/lib/i18n/admin/dictionaries'
import { Button } from '@/components/ui/button'
import {
  updateStoreSettings,
  type StoreSettingsData,
} from '@/app/actions/settings-store'

import { SystemSection } from './system-tab'
import { GeneralSection } from './general-tab'
import { HomepageSection } from './homepage-tab'
import { SeoSection } from './seo-tab'
import { DesignSection } from './design-tab'
import { BrandingSection } from './branding-tab'
import { ContactsSection } from './contacts-tab'
import { WidgetSection } from './widget-tab'
import { SocialSection } from './social-tab'
import { EmailSection } from './email-tab'
import { NotificationsSection } from './notifications-tab'
import { AdsSection } from './ads-tab'
import { GoogleAuthSection } from './google-auth-tab'

type Section =
  | 'general'
  | 'homepage'
  | 'seo'
  | 'design'
  | 'branding'
  | 'contacts'
  | 'widget'
  | 'social'
  | 'email'
  | 'notifications'
  | 'ads'
  | 'googleAuth'
  | 'system'

function getSections(t: AdminDictionary['settings']): { key: Section; label: string; icon: typeof Store }[] {
  return [
    { key: 'general', label: t.navGeneral, icon: Store },
    { key: 'homepage', label: t.navHomepage, icon: LayoutTemplate },
    { key: 'seo', label: t.navSeo, icon: Search },
    { key: 'design', label: t.navDesign, icon: Palette },
    { key: 'branding', label: t.navBranding, icon: ImageIcon },
    { key: 'contacts', label: t.navContacts, icon: Phone },
    { key: 'widget', label: t.navWidget, icon: MessageCircle },
    { key: 'social', label: t.navSocial, icon: Share2 },
    { key: 'email', label: t.navEmail, icon: Mail },
    { key: 'notifications', label: t.navNotifications, icon: Bell },
    { key: 'ads', label: t.navAds, icon: BarChart3 },
    { key: 'googleAuth', label: t.navGoogleAuth, icon: KeyRound },
    { key: 'system', label: t.navSystem, icon: Power },
  ]
}

function getWeekDays(t: AdminDictionary['settings']): { key: WeekDay; label: string }[] {
  return [
    { key: 'mon', label: t.weekMon },
    { key: 'tue', label: t.weekTue },
    { key: 'wed', label: t.weekWed },
    { key: 'thu', label: t.weekThu },
    { key: 'fri', label: t.weekFri },
    { key: 'sat', label: t.weekSat },
    { key: 'sun', label: t.weekSun },
  ]
}

export function SettingsManager({ initial }: { initial: StoreSettingsData }) {
  const { dict } = useAdminI18n()
  const t = dict.settings
  const [data, setData] = useState<StoreSettingsData>(initial)
  const [section, setSection] = useState<Section>('general')
  const [pending, startTransition] = useTransition()
  const SECTIONS = getSections(t)

  function save() {
    startTransition(async () => {
      const res = await updateStoreSettings(data)
      if (res.success) toast.success(t.toastSettingsSaved)
      else toast.error(t.toastSettingsSaveError)
    })
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8">
      {/*
        Decoy username/password pair. Chrome/Firefox/password managers pattern-match
        "a text field followed by a password field" as a login form and silently
        autofill it with the admin's own saved site credentials — which is exactly
        what happened to the Google OAuth Client ID/Secret and SMTP login/password
        fields below, despite them having autoComplete="off". Giving the browser a
        decoy pair to latch onto first stops it from touching the real fields.
      */}
      <div
        style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}
        aria-hidden="true"
      >
        <input type="text" name="username" autoComplete="username" tabIndex={-1} readOnly />
        <input type="password" name="password" autoComplete="current-password" tabIndex={-1} readOnly />
      </div>

      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t.pageTitle}</h1>
          <p className="text-sm text-muted-foreground">{t.pageSubtitle}</p>
        </div>
        <Button onClick={save} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {t.saveButton}
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="flex flex-row flex-wrap gap-1 lg:flex-col">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                section === s.key
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <s.icon className="size-4" />
              {s.label}
            </button>
          ))}
        </nav>

        <div className="rounded-xl border border-border bg-card p-6">
          {section === 'general' && <GeneralSection data={data} setData={setData} t={t} />}
          {section === 'homepage' && <HomepageSection data={data} setData={setData} t={t} />}
          {section === 'seo' && <SeoSection data={data} setData={setData} t={t} />}
          {section === 'design' && <DesignSection data={data} setData={setData} t={t} />}
          {section === 'branding' && <BrandingSection data={data} setData={setData} t={t} />}
          {section === 'contacts' && <ContactsSection data={data} setData={setData} t={t} />}
          {section === 'widget' && <WidgetSection data={data} setData={setData} t={t} />}
          {section === 'social' && <SocialSection data={data} setData={setData} t={t} />}
          {section === 'email' && <EmailSection data={data} setData={setData} t={t} />}
          {section === 'notifications' && <NotificationsSection data={data} setData={setData} t={t} />}
          {section === 'ads' && <AdsSection data={data} setData={setData} t={t} />}
          {section === 'googleAuth' && <GoogleAuthSection data={data} setData={setData} t={t} />}
          {section === 'system' && <SystemSection t={t} />}
        </div>
      </div>
    </div>
  )
}
