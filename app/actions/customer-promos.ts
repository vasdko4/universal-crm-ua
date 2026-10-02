'use server'

import { pool } from '@/lib/db'
import { getShopUser } from '@/lib/session'

export type CustomerPromo = {
  id: number
  name: string
  code: string
  discountType: 'percentage' | 'fixed'
  discountValue: number
  minOrderAmount: number | null
  endsAt: string | null
  /** Remaining uses across the whole store (null = unlimited). */
  usesLeft: number | null
  /** Whether this user already used the code in one of their orders. */
  usedByMe: boolean
}

// Active promo codes currently available to the signed-in customer, plus a
// flag for codes they already used (matched via their own orders — by account
// id OR by phone, so guest orders placed before registration count too,
// mirroring the orderOwnership rule in app/actions/shop.ts).
export async function getMyPromocodes(): Promise<CustomerPromo[]> {
  const user = await getShopUser()
  if (!user) return []

  const phoneDigits = (user.phone ?? '').replace(/\D/g, '')
  const { rows } = await pool.query(
    `SELECT
       p.id, p.name, p.promo_code, p.discount_type, p.discount_value,
       p.min_order_amount, p.ends_at, p.usage_limit, p.used_count,
       EXISTS (
         SELECT 1 FROM orders o
         WHERE (
           o.user_id = $1
           OR (
             $2 <> ''
             AND right(regexp_replace(coalesce(o.customer_phone, ''), '[^0-9]', '', 'g'), 9) = right($2, 9)
           )
         )
         AND o.promo_code IS NOT NULL
         AND LOWER(o.promo_code) = LOWER(p.promo_code)
         AND o.status NOT IN ('cancelled')
       ) AS used_by_me
     FROM promotions p
     WHERE p.type = 'promocode'
       AND p.is_active = TRUE
       AND p.promo_code IS NOT NULL AND p.promo_code <> ''
       AND p.starts_at <= NOW()
       AND (p.ends_at IS NULL OR p.ends_at > NOW())
       AND (p.usage_limit IS NULL OR p.used_count < p.usage_limit)
     ORDER BY p.ends_at ASC NULLS LAST, p.created_at DESC`,
    [user.id, phoneDigits],
  )

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.promo_code,
    discountType: r.discount_type === 'fixed' ? 'fixed' : 'percentage',
    discountValue: Number(r.discount_value),
    minOrderAmount: r.min_order_amount != null ? Number(r.min_order_amount) : null,
    endsAt: r.ends_at ? new Date(r.ends_at).toISOString() : null,
    usesLeft: r.usage_limit != null ? Math.max(0, r.usage_limit - r.used_count) : null,
    usedByMe: Boolean(r.used_by_me),
  }))
}
