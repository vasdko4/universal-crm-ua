import { requireAdmin } from '@/lib/session'
import { getStaffTwoFactorState } from '@/app/actions/staff-2fa'
import { StaffTwoFactorCard } from '@/components/staff-2fa-card'
import { getAdminDictionary } from '@/lib/i18n/admin/dictionaries'

export const dynamic = 'force-dynamic'

export default async function AdminSecurityPage() {
  const user = await requireAdmin()
  const t = getAdminDictionary(user.locale).twoFactor
  const twoFa = await getStaffTwoFactorState().catch(() => ({ enabled: false, pending: false }))

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 p-4 md:p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t.pageTitle}</h1>
        <p className="text-sm text-muted-foreground">{t.pageSubtitle}</p>
      </header>
      <StaffTwoFactorCard enabled={twoFa.enabled} />
    </div>
  )
}
