import Link from 'next/link'
import { Phone, Mail, MapPin, Clock } from 'lucide-react'
import { FooterSection } from '@/components/shop/footer-section'
import type { HeaderCategory } from '@/components/shop/site-header'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { ContactData } from '@/app/actions/settings-store'
import { localizedPath, type Locale } from '@/lib/i18n/config'

type Social = { instagram?: string; telegram?: string; viber?: string; tiktok?: string }
export type FooterLegalLink = { slug: string; title: string }

// Brand glyphs (lucide has no brand icons in this version). currentColor lets
// them inherit the link color on hover.
function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}
function TelegramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M21.94 4.6 18.6 20.34c-.25 1.1-.9 1.38-1.83.86l-5.05-3.72-2.44 2.35c-.27.27-.5.5-1 .5l.36-5.13 9.35-8.45c.4-.36-.09-.56-.63-.2L5.13 13.1l-4.98-1.56c-1.08-.34-1.1-1.08.23-1.6L20.54 2.9c.9-.34 1.69.2 1.4 1.7Z" />
    </svg>
  )
}
function ViberIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M11.4 2C9 2.05 6.3 2.55 4.77 3.86 3.64 4.86 3 6.6 2.86 8.35c-.15 1.75-.2 5.02.65 7.6.5 1.5 1.32 2.6 2.5 3.06v2.65c0 .58.7.86 1.1.44l1.9-2c.7.1 1.42.15 2.14.15 2.4-.05 5.1-.55 6.63-1.86 1.13-1 1.77-2.74 1.92-4.5.15-1.74.2-5.01-.65-7.59-.6-1.8-1.72-3-3.28-3.4C15.14 2.15 13.3 1.96 11.4 2Zm.3 2.9c1.55 0 2.8 1.24 2.8 2.78a.5.5 0 0 1-1 0c0-1-.8-1.78-1.8-1.78a.5.5 0 0 1 0-1Zm-3.1.86c.28-.05.55.1.7.36l.8 1.55c.15.3.08.66-.17.88l-.5.42c-.12.1-.15.28-.06.42.35.62 1.05 1.32 1.67 1.67.14.09.32.06.42-.06l.42-.5c.22-.25.58-.32.88-.17l1.55.8c.3.15.44.5.32.82-.35.94-1.35 1.5-2.32 1.28-2.28-.52-4.06-2.3-4.58-4.58-.2-.9.28-1.83 1.13-2.23a.9.9 0 0 1 .34-.06Zm3.1 1.14c.83 0 1.5.67 1.5 1.5a.5.5 0 0 1-1 0c0-.28-.22-.5-.5-.5a.5.5 0 0 1 0-1Z" />
    </svg>
  )
}
function TikTokIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M16.6 5.82c-.9-.6-1.5-1.55-1.7-2.62A3.9 3.9 0 0 1 14.83 2h-3.1v13.05c0 1.4-1.14 2.53-2.54 2.53a2.53 2.53 0 0 1 0-5.06c.27 0 .53.04.77.12v-3.16a5.68 5.68 0 0 0-.77-.05A5.7 5.7 0 1 0 15 15.05V8.5a7.03 7.03 0 0 0 4.1 1.32V6.72c-.9 0-1.76-.32-2.5-.9Z" />
    </svg>
  )
}

const DAY_LABELS: Record<string, string> = {
  mon: 'Пн',
  tue: 'Вт',
  wed: 'Ср',
  thu: 'Чт',
  fri: 'Пт',
  sat: 'Сб',
  sun: 'Нд',
}

// Groups consecutive days with identical hours into ranges, e.g. "Пн–Пт 9:00–18:00".
function formatWorkingHours(wh: ContactData['workingHours']): { label: string; value: string }[] {
  const order = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
  const rows: { label: string; value: string }[] = []
  let start: number | null = null
  const valueAt = (i: number) => {
    const d = wh[order[i]]
    return d.closed ? 'Выходной' : `${d.open}–${d.close}`
  }
  for (let i = 0; i <= order.length; i++) {
    const cur = i < order.length ? valueAt(i) : null
    const prev = start !== null ? valueAt(start) : null
    if (start !== null && cur !== prev) {
      const end = i - 1
      const label = start === end ? DAY_LABELS[order[start]] : `${DAY_LABELS[order[start]]}–${DAY_LABELS[order[end]]}`
      rows.push({ label, value: prev as string })
      start = i < order.length ? i : null
    } else if (start === null && i < order.length) {
      start = i
    }
  }
  return rows
}

export function SiteFooter({
  storeName,
  phones = [],
  address,
  workingHours,
  email,
  categories,
  social,
  dict,
  legalLinks = [],
  locale = 'uk',
}: {
  storeName: string
  phones?: string[]
  address?: string | null
  workingHours?: ContactData['workingHours']
  email: string | null
  categories: HeaderCategory[]
  social: Social
  dict: Dictionary
  legalLinks?: FooterLegalLink[]
  locale?: Locale
}) {
  const lp = (p: string) => localizedPath(p, locale)
  const activePhones = phones.filter((p) => p && p.trim())
  const hoursRows = workingHours ? formatWorkingHours(workingHours) : []
  const topCategories = categories.filter((c) => !c.parentId).slice(0, 6)
  const socialLinks = [
    { key: 'instagram', label: 'Instagram', url: social.instagram, Icon: InstagramIcon },
    { key: 'telegram', label: 'Telegram', url: social.telegram, Icon: TelegramIcon },
    { key: 'viber', label: 'Viber', url: social.viber, Icon: ViberIcon },
    { key: 'tiktok', label: 'TikTok', url: social.tiktok, Icon: TikTokIcon },
  ].filter((s) => s.url)

  return (
    <footer className="mt-16 border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-10 lg:grid lg:grid-cols-4 lg:gap-8 lg:py-12 lg:px-8">
        {/* Brand — always visible */}
        <div className="space-y-3 pb-2 lg:pb-0">
          <h3 className="text-lg font-bold text-foreground">{storeName}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {dict.footer.about}
          </p>
          {socialLinks.length > 0 && (
            <div className="flex gap-2 pt-1 lg:hidden">
              {socialLinks.map((s) => (
                <a
                  key={s.key}
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={s.label}
                  title={s.label}
                  className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
                >
                  <s.Icon className="size-4" aria-hidden="true" />
                </a>
              ))}
            </div>
          )}
        </div>

        <FooterSection title={dict.nav.categories}>
          <ul className="space-y-2.5">
            {topCategories.map((c) => (
              <li key={c.id}>
                <Link href={lp(`/category/${c.id}`)} className="text-sm text-muted-foreground hover:text-primary">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </FooterSection>

        <FooterSection title={dict.footer.forCustomers}>
          <ul className="space-y-2.5">
            <li>
              <Link href={lp('/catalog')} className="text-sm text-muted-foreground hover:text-primary">
                {dict.nav.allProducts}
              </Link>
            </li>
            <li>
              <Link href={lp('/articles')} className="text-sm text-muted-foreground hover:text-primary">
                {dict.nav.articles}
              </Link>
            </li>
            <li>
              <Link href={lp('/account')} className="text-sm text-muted-foreground hover:text-primary">
                {dict.footer.account}
              </Link>
            </li>
            <li>
              <Link href={lp('/account/orders')} className="text-sm text-muted-foreground hover:text-primary">
                {dict.footer.myOrders}
              </Link>
            </li>
            {legalLinks.map((l) => (
              <li key={l.slug}>
                <Link href={lp(`/p/${l.slug}`)} className="text-sm text-muted-foreground hover:text-primary">
                  {l.title}
                </Link>
              </li>
            ))}
          </ul>
        </FooterSection>

        <FooterSection title={dict.footer.contacts}>
          <ul className="space-y-2.5">
            {activePhones.map((phone) => (
              <li key={phone}>
                <a
                  href={`tel:${phone.replace(/\s/g, '')}`}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
                >
                  <Phone className="size-4 shrink-0" /> {phone}
                </a>
              </li>
            ))}
            {email && (
              <li>
                <a href={`mailto:${email}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
                  <Mail className="size-4 shrink-0" /> {email}
                </a>
              </li>
            )}
            <li className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="size-4 shrink-0 translate-y-0.5" /> {address?.trim() || dict.footer.country}
            </li>
          </ul>
          {hoursRows.length > 0 && (
            <div className="pt-3">
              <p className="mb-1.5 flex items-center gap-2 text-sm font-medium text-foreground">
                <Clock className="size-4 shrink-0" /> {dict.footer.workingHours}
              </p>
              <ul className="space-y-1">
                {hoursRows.map((r) => (
                  <li key={r.label} className="flex justify-between gap-3 text-xs text-muted-foreground">
                    <span>{r.label}</span>
                    <span>{r.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {socialLinks.length > 0 && (
            <div className="hidden gap-2 pt-3 lg:flex">
              {socialLinks.map((s) => (
                <a
                  key={s.key}
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={s.label}
                  title={s.label}
                  className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
                >
                  <s.Icon className="size-4" aria-hidden="true" />
                </a>
              ))}
            </div>
          )}
        </FooterSection>
      </div>
      <div className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} {storeName}. {dict.footer.rights}
      </div>
    </footer>
  )
}
