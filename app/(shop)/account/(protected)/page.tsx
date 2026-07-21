import { getShopUser } from '@/lib/session'
import { pool } from '@/lib/db'
import { ProfileForm } from '@/components/shop/profile-form'

export default async function AccountProfilePage() {
  const user = await getShopUser()
  if (!user) return null

  // Google-authenticated users cannot change their email: it is the identity
  // link to their Google account (enforced server-side in shop-auth actions).
  const { rows } = await pool.query(
    `SELECT 1 FROM account WHERE "userId"=$1 AND "providerId"='google' LIMIT 1`,
    [user.id],
  )
  const isGoogleAccount = rows.length > 0

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-card-foreground">Личные данные</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Эти данные используются при оформлении заказов.
        </p>
        <div className="mt-5">
          <ProfileForm
            initialName={user.name}
            initialPhone={user.phone ?? ''}
            email={user.email}
            emailLocked={isGoogleAccount}
          />
        </div>
      </div>
    </div>
  )
}
