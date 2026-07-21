'use server'

import { desc, eq, inArray, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db, pool } from '@/lib/db'
import { abandonedCarts, type AbandonedCart } from '@/lib/db/schema'
import { assertPermission } from '@/lib/session'
import { auditLog } from '@/lib/audit-log'
import { sendMail } from '@/lib/mailer'
import { getStoreSettingsInternal } from '@/lib/store-settings'

// Cart snapshots (name, item names) are visitor-supplied via the public,
// unauthenticated saveAbandonedCart action below — never trust them as safe
// HTML. Without escaping here, an attacker could plant a cart with a
// malicious item name / customer name, point customerEmail at a victim, and
// get an admin's later "send reminder" click to mail out attacker-controlled
// HTML from the store's own address (phishing/injection vector).
function esc(s: string) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export type AbandonedCartItem = {
  productId: number
  name: string
  price: number
  quantity: number
  image: string | null
}

/**
 * Public (storefront) action: upserts an abandoned-cart snapshot keyed by a
 * client-generated token. Called from the checkout form once the visitor has
 * entered contact info. Rate of writes is naturally limited by the debounce
 * on the client. No auth — but nothing sensitive is exposed: it only stores
 * what the visitor themselves typed.
 */
export async function saveAbandonedCart(input: {
  token: string
  name?: string
  phone?: string
  email?: string
  items: AbandonedCartItem[]
}): Promise<{ ok: boolean }> {
  const token = input.token?.trim()
  // Token must look like our client-generated id — reject junk early.
  if (!token || !/^[a-z0-9-]{16,64}$/i.test(token)) return { ok: false }
  if (!input.items?.length) return { ok: false }
  // Require at least one way to contact the visitor, otherwise the row is useless.
  const phone = input.phone?.trim() || null
  const email = input.email?.trim() || null
  const name = input.name?.trim() || null
  if (!phone && !email) return { ok: false }

  const items = input.items.slice(0, 50).map((i) => ({
    productId: Number(i.productId),
    name: String(i.name).slice(0, 255),
    price: Number(i.price) || 0,
    quantity: Math.max(1, Math.floor(Number(i.quantity) || 1)),
    image: i.image ? String(i.image).slice(0, 500) : null,
  }))
  const itemsTotal = items.reduce((s, i) => s + i.price * i.quantity, 0)
  const itemsCount = items.reduce((s, i) => s + i.quantity, 0)

  await pool
    .query(
      `INSERT INTO abandoned_carts (token, customer_name, customer_phone, customer_email, items, items_total, items_count, status, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, 'open', NOW())
       ON CONFLICT (token) DO UPDATE SET
         customer_name = EXCLUDED.customer_name,
         customer_phone = EXCLUDED.customer_phone,
         customer_email = EXCLUDED.customer_email,
         items = EXCLUDED.items,
         items_total = EXCLUDED.items_total,
         items_count = EXCLUDED.items_count,
         -- A cart that was already recovered/dismissed but is filled again re-opens.
         status = CASE WHEN abandoned_carts.status IN ('recovered','dismissed') THEN 'open' ELSE abandoned_carts.status END,
         updated_at = NOW()`,
      [token, name, phone, email, JSON.stringify(items), itemsTotal.toFixed(2), itemsCount],
    )
    .catch(() => {})

  return { ok: true }
}

/* ---------------------------------- Admin ---------------------------------- */

export type AbandonedCartsStats = {
  open: number
  reminded: number
  recovered: number
  potentialRevenue: number
}

export async function getAbandonedCarts(): Promise<{
  carts: AbandonedCart[]
  stats: AbandonedCartsStats
}> {
  await assertPermission('abandoned_carts')
  // Only carts idle for 30+ minutes count as abandoned; fresher ones are
  // probably still being checked out right now.
  const carts = await db
    .select()
    .from(abandonedCarts)
    .where(
      sql`(${abandonedCarts.status} = 'open' AND ${abandonedCarts.updatedAt} < NOW() - INTERVAL '30 minutes')
          OR ${abandonedCarts.status} IN ('reminded', 'recovered')`,
    )
    .orderBy(desc(abandonedCarts.updatedAt))
    .limit(300)

  const stats: AbandonedCartsStats = { open: 0, reminded: 0, recovered: 0, potentialRevenue: 0 }
  for (const c of carts) {
    if (c.status === 'open') {
      stats.open++
      stats.potentialRevenue += Number(c.itemsTotal)
    } else if (c.status === 'reminded') {
      stats.reminded++
      stats.potentialRevenue += Number(c.itemsTotal)
    } else if (c.status === 'recovered') {
      stats.recovered++
    }
  }
  return { carts, stats }
}

/** Sends a reminder email to the visitor who abandoned the cart. */
export async function sendCartReminder(id: number): Promise<{ success: boolean; error?: string }> {
  const user = await assertPermission('abandoned_carts')
  const [cart] = await db.select().from(abandonedCarts).where(eq(abandonedCarts.id, id)).limit(1)
  if (!cart) return { success: false, error: 'Корзина не найдена' }
  if (!cart.customerEmail) return { success: false, error: 'У покупателя нет email — свяжитесь по телефону' }

  const settings = await getStoreSettingsInternal()
  const siteUrl = (settings.seo?.siteUrl || '').replace(/\/$/, '')
  const items = (cart.items as AbandonedCartItem[]) ?? []
  const lines = items.map((i) => `• ${i.name} — ${i.quantity} шт.`).join('\n')
  const total = Number(cart.itemsTotal).toLocaleString('uk-UA')

  const text = `Здравствуйте${cart.customerName ? `, ${cart.customerName}` : ''}!

Вы оставили товары в корзине магазина «${settings.storeName}»:

${lines}

Сумма: ${total} ₴

Товары ждут вас — количество на складе ограничено.${siteUrl ? `\nВернуться к покупкам: ${siteUrl}/cart` : ''}

С уважением, ${settings.storeName}`

  const html = `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
  <h2 style="margin:0 0 8px">Вы забыли товары в корзине</h2>
  <p>Здравствуйте${cart.customerName ? `, ${esc(cart.customerName)}` : ''}!</p>
  <p>В магазине «${esc(settings.storeName)}» вас ждут:</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    ${items
      .map(
        (i) => `<tr style="border-bottom:1px solid #e2e8f0">
      <td style="padding:8px 0">${esc(i.name)}</td>
      <td style="padding:8px 0;text-align:right;white-space:nowrap">${i.quantity} шт.</td>
    </tr>`,
      )
      .join('')}
  </table>
  <p style="font-size:18px">Сумма: <strong>${total} ₴</strong></p>
  ${siteUrl ? `<p><a href="${siteUrl}/cart" style="display:inline-block;background:#1e293b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none">Вернуться в корзину</a></p>` : ''}
  <p style="color:#64748b;font-size:13px;margin-top:16px">Количество товаров на складе ограничено.</p>
</div>`

  const result = await sendMail({
    to: cart.customerEmail,
    subject: `Вы забыли товары в корзине — ${settings.storeName}`,
    text,
    html,
  })

  // The email did not actually go out (no SMTP configured) — keep the cart
  // in "open" so the admin can retry after configuring email.
  if (result.fallback) {
    return { success: false, error: 'SMTP не настроен — письмо не ушло, настройте Email в настройках' }
  }

  await db
    .update(abandonedCarts)
    .set({ status: 'reminded', remindedAt: new Date(), updatedAt: new Date() })
    .where(eq(abandonedCarts.id, id))

  void auditLog({
    userId: user.id, userName: user.name, userEmail: user.email,
    action: 'update', entity: 'abandoned_cart', entityId: id,
    details: `Отправлено напоминание на ${cart.customerEmail}`,
  })

  revalidatePath('/admin/abandoned-carts')
  return { success: true }
}

/** Removes carts from the list (e.g. spam or handled by phone). */
export async function dismissAbandonedCarts(ids: number[]): Promise<{ success: boolean }> {
  const user = await assertPermission('abandoned_carts')
  if (!ids.length) return { success: false }
  await db
    .update(abandonedCarts)
    .set({ status: 'dismissed', updatedAt: new Date() })
    .where(inArray(abandonedCarts.id, ids))
  void auditLog({
    userId: user.id, userName: user.name, userEmail: user.email,
    action: 'delete', entity: 'abandoned_cart',
    details: `Скрыто корзин: ${ids.length}`,
  })
  revalidatePath('/admin/abandoned-carts')
  return { success: true }
}
