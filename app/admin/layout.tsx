import type React from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/session'
import { getStoreSettingsInternal } from '@/lib/store-settings'
import { AdminSidebar } from '@/components/admin-sidebar'
import { AdminHeader } from '@/components/admin-header'
import { permissionForPath, hasPermission, NAV_SECTIONS } from '@/lib/permissions'
import { AdminLocaleProvider } from '@/lib/i18n/admin/context'

export const dynamic = 'force-dynamic'

// First admin section the user is allowed to open (their "home" in the admin).
function firstAllowedPath(permissions: string[]): string | null {
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      if (hasPermission(permissions, item.permission)) return item.href
    }
  }
  return null
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin()

  // Enforce per-tab access. The admin entry point (/admin) silently forwards
  // to the first allowed section; deep links to forbidden pages show the
  // explicit "access denied" page.
  const pathname = (await headers()).get('x-pathname') ?? '/'
  if (!pathname.startsWith('/admin/access-denied')) {
    const required = permissionForPath(pathname)
    if (required && !hasPermission(user.permissions, required)) {
      if (pathname === '/admin' || pathname === '/admin/') {
        const fallback = firstAllowedPath(user.permissions)
        redirect(fallback ?? '/')
      }
      redirect('/admin/access-denied?key=' + required)
    }
  }

  const settings = await getStoreSettingsInternal().catch(() => null)

  return (
    <AdminLocaleProvider locale={user.locale}>
      <div className="flex min-h-screen bg-muted/30">
        <AdminSidebar
          user={{ name: user.name, email: user.email, role: user.role, permissions: user.permissions }}
          storeName={settings?.storeName ?? 'Админ-центр'}
          logoUrl={settings?.logoUrl ?? null}
        />
        <main className="flex min-w-0 flex-1 flex-col">
          <AdminHeader />
          <div className="flex-1">{children}</div>
        </main>
      </div>
    </AdminLocaleProvider>
  )
}
