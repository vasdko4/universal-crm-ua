import { getShopUser, getAdminUser } from '@/lib/session'
import { AccountNav } from '@/components/shop/account-nav'
import { SessionExpiredRedirect } from '@/components/shop/session-expired-redirect'
import { getLocale, getDictionary } from '@/lib/i18n/server'

export const dynamic = 'force-dynamic'

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const dict = getDictionary(locale)
  // The /account area is guarded in proxy.ts (middleware), so unauthenticated
  // visitors are redirected before this layout renders. This only handles the
  // rare case of a present-but-invalid session cookie. We use a client-side
  // redirect instead of server redirect() to avoid aborting this Server
  // Component mid-render (which triggers React's dev profiler crash).
  const user = await getShopUser()
  if (!user) return <SessionExpiredRedirect to="/account/login" />

  // Show the admin center link only to users whose role has admin permissions.
  const adminUser = await getAdminUser()
  const isAdmin = Boolean(adminUser && adminUser.permissions.length > 0)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold text-balance sm:text-3xl">{dict.account.title}</h1>
      <p className="mt-1 text-muted-foreground">{user.email}</p>
      <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]">
        <AccountNav isAdmin={isAdmin} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  )
}
