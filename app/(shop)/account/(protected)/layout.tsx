import { getShopUser, getAdminUser } from '@/lib/session'
import { AccountNav } from '@/components/shop/account-nav'
import { SessionExpiredRedirect } from '@/components/shop/session-expired-redirect'
import { EmailVerifyBanner } from '@/components/shop/auth/email-verify-banner'
import { getLocale, getDictionary } from '@/lib/i18n/server'
import { localizedPath } from '@/lib/i18n/config'
import { fillTemplate } from '@/lib/i18n/dictionaries'

export const dynamic = 'force-dynamic'

function initials(name: string, email: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  if (parts[0]) return parts[0].slice(0, 2).toUpperCase()
  return email.slice(0, 2).toUpperCase()
}

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const dict = getDictionary(locale)
  const user = await getShopUser()
  if (!user) return <SessionExpiredRedirect to={localizedPath('/account/login', locale)} />

  const adminUser = await getAdminUser()
  const isAdmin = Boolean(adminUser && adminUser.permissions.length > 0)
  const firstName = user.name.trim().split(/\s+/)[0] || user.email.split('@')[0]

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <header className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-primary" />
        <div className="pointer-events-none absolute -right-10 -top-16 size-40 rounded-full bg-primary/10 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-base font-semibold text-primary-foreground shadow-sm sm:size-16 sm:text-lg">
            {initials(user.name, user.email)}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {fillTemplate(dict.account.greeting, { name: firstName })}
            </h1>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
      </header>
      <div className="mt-6 grid gap-6 lg:grid-cols-[220px_1fr]">
        <AccountNav isAdmin={isAdmin} />
        <div className="min-w-0">
          <EmailVerifyBanner />
          {children}
        </div>
      </div>
    </div>
  )
}
