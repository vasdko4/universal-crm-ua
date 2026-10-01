'use server'

import { desc, eq, inArray, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db, pool } from '@/lib/db'
import { abandonedCarts, type AbandonedCart } from '@/lib/db/schema'
import { assertPermission, assertWritePermission } from '@/lib/session'
import { auditLog, fillAuditTemplate } from '@/lib/audit-log'
import { getAdminDictionary } from '@/lib/i18n/admin/dictionaries'
import { sendMail } from '@/lib/mailer'
import { getStoreSettingsInternal } from '@/lib/store-settings'
import { clientIpFromHeaders, isRateLimited } from '@/lib/api/rate-limit'
import { headers } from 'next/headers'

// Cart snapshots (name, item names) are visitor-supplied via the public,
// unauthenticated saveAbandonedCart action below — never trust them as safe
// HTML. Without escaping here, an attacker could plant a cart with a
// malicious item name / customer name, point customerEmail at a victim, and
// get an admin's later "send reminder" click to mail out attacker-controlled
// HTML from the store's own address (phishing/injection vector).
function esc(s: string) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
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
  if (await isRateLimited('abandoned-cart', clientIpFromHeaders(await headers()), 20, 60_000)) return { ok: false }

  const token = input.token?.trim()
  // Token must look like our client-generated id — reject junk early.
  if (!token || !/^[a-z0-9-]{16,64}$/i.test(token)) return { ok: false }
  if (!input.items?.length) return { ok: false }
  // Require at least one way to contact the visitor, otherwise the row is useless.
  const phone = input.phone?.trim().slice(0, 32) || null
  const email = input.email?.trim().slice(0, 255) || null
  const name = input.name?.trim().slice(0, 120) || null
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

  try {
    await pool.query(
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
  } catch (e) {
    console.error('[abandoned-cart] save failed:', (e as Error).message)
    return { ok: false }
  }

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
  const user = await assertWritePermission('abandoned_carts')
  const ac = getAdminDictionary(user.locale).abandonedCarts
  const [cart] = await db.select().from(abandonedCarts).where(eq(abandonedCarts.id, id)).limit(1)
  if (!cart) return { success: false, error: ac.errorNotFound }
  if (!cart.customerEmail) return { success: false, error: ac.errorNoEmail }

  const settings = await getStoreSettingsInternal()
  const siteUrl = (settings.seo?.siteUrl || '').replace(/\/$/, '')
  const items = (cart.items as AbandonedCartItem[]) ?? []
  const loc = settings.defaultLocale === 'ru' ? 'ru' : 'uk'
  const tag = loc === 'ru' ? 'ru-RU' : 'uk-UA'
  const copy = loc === 'ru'
    ? {
        hello: 'Здравствуйте',
        left: 'Вы оставили товары в корзине магазина',
        sum: 'Сумма',
        wait: 'Товары ждут вас — количество на складе ограничено.',
        back: 'Вернуться к покупкам',
        regards: 'С уважением',
        htmlTitle: 'Вы забыли товары в корзине',
        htmlWait: 'вас ждут',
        htmlCta: 'Вернуться в корзину',
        htmlStock: 'Количество товаров на складе ограничено.',
        subject: 'Вы забыли товары в корзине',
        qty: 'шт.',
      }
    : {
        hello: 'Вітаємо',
        left: 'Ви залишили товари в кошику магазину',
        sum: 'Сума',
        wait: 'Товари чекають на вас — кількість на складі обмежена.',
        back: 'Повернутися до покупок',
        regards: 'З повагою',
        htmlTitle: 'Ви забули товари в кошику',
        htmlWait: 'на вас чекають',
        htmlCta: 'Повернутися в кошик',
        htmlStock: 'Кількість товарів на складі обмежена.',
        subject: 'Ви забули товари в кошику',
        qty: 'шт.',
      }

  const fmtMoney = (v: number) => `${Number(v).toLocaleString(tag).replace(/\u00a0/g, ' ')} ₴`
  const lines = items
    .map((i) => `• ${i.name} — ${i.quantity} ${copy.qty} × ${fmtMoney(i.price)} = ${fmtMoney(i.price * i.quantity)}`)
    .join('\n')
  const total = fmtMoney(Number(cart.itemsTotal))

  const text = `${copy.hello}${cart.customerName ? `, ${cart.customerName}` : ''}!

${copy.left} «${settings.storeName}»:

${lines}

${copy.sum}: ${total}

${copy.wait}${siteUrl ? `\n${copy.back}: ${siteUrl}/cart` : ''}

${copy.regards}, ${settings.storeName}`

  // Branded like the order emails: header with logo, item rows with
  // thumbnails and line totals, CTA button, footer with contacts.
  const logoHtml = settings.logoUrl
    ? `<img src="${esc(settings.logoUrl)}" height="36" alt="${esc(settings.storeName)}" style="display:block;max-height:36px;width:auto" />`
    : `<span style="font-size:20px;font-weight:700;color:#1a1a1a;letter-spacing:-0.02em">${esc(settings.storeName)}</span>`
  const phone = settings.contact?.phones?.find(Boolean) ?? null
  const itemImg = (src: string | null): string => {
    if (!src) return ''
    return src.startsWith('http') ? src : siteUrl ? `${siteUrl}${src}` : ''
  }
  const rowsHtml = items
    .map((i) => {
      const img = itemImg(i.image)
      const thumb = img
        ? `<img src="${esc(img)}" width="64" height="64" alt="" style="display:block;width:64px;height:64px;object-fit:contain;border-radius:8px;background:#f4f4f2" />`
        : `<div style="width:64px;height:64px;border-radius:8px;background:#f4f4f2"></div>`
      return `<tr>
        <td style="padding:12px 0;border-bottom:1px solid #ececea;width:76px;vertical-align:top">${thumb}</td>
        <td style="padding:12px 12px;border-bottom:1px solid #ececea;vertical-align:top">
          <div style="font-weight:600">${esc(i.name)}</div>
          <div style="font-size:13px;color:#6b6b68;margin-top:4px">${i.quantity} ${copy.qty} × ${fmtMoney(i.price)}</div>
        </td>
        <td style="padding:12px 0;border-bottom:1px solid #ececea;text-align:right;vertical-align:top;white-space:nowrap;font-weight:600">${fmtMoney(i.price * i.quantity)}</td>
      </tr>`
    })
    .join('')

  const html = `<!DOCTYPE html>
<html lang="${loc}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(copy.subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f2">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${esc(copy.htmlTitle)} — ${esc(settings.storeName)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f2;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">
  <tr><td style="padding:24px 28px;border-bottom:1px solid #ececea">
    ${siteUrl ? `<a href="${esc(siteUrl)}" style="text-decoration:none">${logoHtml}</a>` : logoHtml}
  </td></tr>
  <tr><td style="padding:28px 28px 8px">
    <h1 style="margin:0 0 8px;font-size:22px;line-height:1.3;color:#1a1a1a">${esc(copy.htmlTitle)}</h1>
    <p style="margin:0;font-size:15px;line-height:1.6;color:#4a4a47">${esc(copy.hello)}${cart.customerName ? `, ${esc(cart.customerName)}` : ''}! ${loc === 'ru' ? 'В магазине' : 'У магазині'} «${esc(settings.storeName)}» ${esc(copy.htmlWait)}:</p>
  </td></tr>
  <tr><td style="padding:8px 28px 4px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px">
      ${rowsHtml}
    </table>
  </td></tr>
  <tr><td style="padding:12px 28px 24px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">
      <tr><td style="padding:10px 0 0;font-size:17px;font-weight:700;color:#1a1a1a;border-top:1px solid #ececea">${esc(copy.sum)}</td><td style="padding:10px 0 0;text-align:right;font-size:17px;font-weight:700;color:#1a1a1a;border-top:1px solid #ececea">${esc(total)}</td></tr>
    </table>
    ${siteUrl ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:20px"><tr><td style="border-radius:8px;background:#1a1a1a"><a href="${esc(siteUrl)}/cart" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none">${esc(copy.htmlCta)}</a></td></tr></table>` : ''}
    <p style="font-size:13px;color:#9a9a97;margin-top:16px">${esc(copy.htmlStock)}</p>
  </td></tr>
  <tr><td style="padding:20px 28px;background:#fafaf8;border-top:1px solid #ececea">
    <p style="margin:0 0 4px;font-size:13px;color:#6b6b68">${esc(copy.regards)}, <strong style="color:#1a1a1a">${esc(settings.storeName)}</strong></p>
    ${phone ? `<p style="margin:0;font-size:13px;color:#6b6b68">Телефон: <a href="tel:${esc(phone.replace(/[^+\d]/g, ''))}" style="color:#6b6b68">${esc(phone)}</a></p>` : ''}
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`

  const result = await sendMail({
    to: cart.customerEmail,
    subject: `${copy.subject} — ${settings.storeName}`,
    text,
    html,
  })

  // The email did not actually go out (no SMTP configured) — keep the cart
  // in "open" so the admin can retry after configuring email.
  if (result.fallback) {
    return { success: false, error: ac.errorSmtp }
  }

  await db
    .update(abandonedCarts)
    .set({ status: 'reminded', remindedAt: new Date(), updatedAt: new Date() })
    .where(eq(abandonedCarts.id, id))

  void auditLog({
    userId: user.id, userName: user.name, userEmail: user.email,
    action: 'update', entity: 'abandoned_cart', entityId: id,
    details: fillAuditTemplate(getAdminDictionary(user.locale).auditLog.cartReminderSent, {
      email: cart.customerEmail,
    }),
  })

  revalidatePath('/admin/abandoned-carts')
  return { success: true }
}

/** Removes carts from the list (e.g. spam or handled by phone). */
export async function dismissAbandonedCarts(ids: number[]): Promise<{ success: boolean }> {
  const user = await assertWritePermission('abandoned_carts')
  if (!ids.length) return { success: false }
  await db
    .update(abandonedCarts)
    .set({ status: 'dismissed', updatedAt: new Date() })
    .where(inArray(abandonedCarts.id, ids))
  void auditLog({
    userId: user.id, userName: user.name, userEmail: user.email,
    action: 'delete', entity: 'abandoned_cart',
    details: fillAuditTemplate(getAdminDictionary(user.locale).auditLog.cartsHidden, {
      count: ids.length,
    }),
  })
  revalidatePath('/admin/abandoned-carts')
  return { success: true }
}
