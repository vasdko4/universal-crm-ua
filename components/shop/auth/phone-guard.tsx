import { headers } from 'next/headers'
import { getAuth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { PhoneRequiredDialog } from '@/components/shop/auth/phone-required-dialog'

// Server-side guard: customers who signed up via Google have no phone number
// yet. We require it once, right after the first sign-in. Staff accounts are
// never nagged by this dialog.
export async function PhoneGuard() {
  const auth = await getAuth()
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null

  try {
    const { rows } = await pool.query<{ role: string | null; phone: string | null }>(
      `SELECT role, phone FROM "user" WHERE id = $1 LIMIT 1`,
      [session.user.id],
    )
    const row = rows[0]
    if (!row) return null
    if (row.role !== 'customer') return null
    if (row.phone && row.phone.trim() !== '') return null
    return <PhoneRequiredDialog />
  } catch {
    return null
  }
}
