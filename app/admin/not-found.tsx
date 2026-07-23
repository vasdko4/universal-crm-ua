'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SearchX } from 'lucide-react'
import { useAdminI18n } from '@/lib/i18n/admin/context'

// Rendered inside the admin layout (with the sidebar) when notFound() is
// thrown in an admin route — e.g. an order or product that no longer exists.
export default function AdminNotFound() {
  const { dict } = useAdminI18n()
  const t = dict.notFound
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <SearchX className="size-7" aria-hidden="true" />
      </span>
      <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {t.errorLabel}
      </p>
      <h1 className="text-balance text-2xl font-semibold text-foreground">{t.title}</h1>
      <p className="max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
        {t.description}
      </p>
      <Button asChild className="mt-2">
        <Link href="/admin">{t.goToAdmin}</Link>
      </Button>
    </div>
  )
}
