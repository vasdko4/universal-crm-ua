import Link from 'next/link'
import { requireAdmin } from '@/lib/session'
import { ALL_PERMISSIONS } from '@/lib/permissions'
import { Button } from '@/components/ui/button'
import { Lock } from 'lucide-react'
import { getAdminDictionary } from '@/lib/i18n/admin/dictionaries'

export const metadata = {
  title: 'Доступ запрещён / Доступ заборонено',
}

export default async function AccessDeniedPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>
}) {
  const user = await requireAdmin()
  const t = getAdminDictionary(user.locale).accessDenied
  const { key } = await searchParams
  const section = ALL_PERMISSIONS.find((p) => p.key === key)

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <Lock className="size-7" aria-hidden="true" />
      </span>
      <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {t.errorLabel}
      </p>
      <h1 className="text-balance text-2xl font-semibold text-foreground">{t.title}</h1>
      <p className="max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
        {section ? t.reasonWithSection.replace('{section}', section.label) : t.reasonGeneric}{' '}
        {t.contactHint}
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <Button asChild>
          <Link href="/admin">{t.goToAdmin}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">{t.goToSite}</Link>
        </Button>
      </div>
    </div>
  )
}
