'use client'

import { useState, type ReactNode } from 'react'
import { AdminSidebar, type SidebarUser } from '@/components/admin-sidebar'
import { AdminHeader } from '@/components/admin-header'

// Client shell for the admin area: holds the mobile navigation drawer state.
// On desktop the sidebar is a permanent rail; on mobile it is hidden and
// opens as a slide-over from the header's menu button, with full section
// and item labels (the icon-only rail is unreadable on touch, where title
// tooltips don't exist).
export function AdminShell({
  user,
  storeName,
  logoUrl,
  adminTheme,
  children,
}: {
  user: SidebarUser
  storeName: string
  logoUrl: string | null
  adminTheme: string
  children: ReactNode
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-muted/30" data-admin-theme={adminTheme}>
      <AdminSidebar
        user={user}
        storeName={storeName}
        logoUrl={logoUrl}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />
      <main className="flex min-w-0 flex-1 flex-col">
        <AdminHeader onMenuClick={() => setMobileNavOpen(true)} />
        <div className="flex-1">{children}</div>
      </main>
    </div>
  )
}
