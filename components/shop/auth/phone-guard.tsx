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

  // Keep JSX construction out of the try/catch — only the DB lookup can
  // throw, and errors from rendering <PhoneRequiredDialog /> itself would
  // never be caught here anyway (React renders components asynchronously).
  let shouldShowDialog = false
  try {
    const { rows } = await pool.query<{ role: string | null; phone: string | null }>(
      `SELECT role, phone FROM "user" WHERE id = $1 LIMIT 1`,
      [session.user.id],
    )
    const row = rows[0]
    shouldShowDialog = Boolean(row && row.role === 'customer' && !row.phone?.trim())
  } catch {
    shouldShowDialog = false
  }

  return shouldShowDialog ? <PhoneRequiredDialog /> : null
}
