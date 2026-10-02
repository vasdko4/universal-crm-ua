import { pool } from '@/lib/db'
import type { Order, OrderItem } from '@/lib/db/schema'
import { sendMail } from '@/lib/mailer'
import { reportError } from '@/lib/server-errors'
import { buildOrderMessage } from '@/lib/order-messages'
import { getStoreSettingsInternal } from '@/lib/store-settings'
import { getProductSlugMap } from '@/lib/shop/queries'
import { noteLooksLikeRequisites, splitOrderNote } from '@/lib/payments/public-requisites'
import { looksLikeEmail } from '@/lib/text'

function money(v: string | number, currency = 'UAH', locale: string = 'uk') {
  const n = typeof v === 'string' ? Number.parseFloat(v) : v
  const tag = locale === 'ru' || locale === 'ru-RU' ? 'ru-RU' : 'uk-UA'
  const symbol = currency === 'UAH' ? '₴' : currency
  return `${n.toLocaleString(tag).replace(/\u00a0/g, ' ')} ${symbol}`
}

/**
 * Sends a Telegram message via the Bot API. Returns false when Telegram is
 * unreachable or misconfigured — callers treat notifications as best-effort.
 */
export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      void reportError('telegram.send', new Error('Telegram API request failed'), {
        context: { status: res.status },
      })
      return false
    }
    return true
  } catch (e) {
    void reportError('telegram.send', e)
    return false
  }
}

/**
 * Sends a photo with an HTML caption via the Telegram Bot API. Falls back to
 * a plain text message when the photo can't be delivered (bad URL, size, etc).
 */
export async function sendTelegramPhoto(
  botToken: string,
  chatId: string,
  photoUrl: string,
  caption: string,
): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        photo: photoUrl,
        caption,
        parse_mode: 'HTML',
      }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      void reportError('telegram.photo', new Error('Telegram API request failed'), {
        context: { status: res.status },
      })
      return false
    }
    return true
  } catch (e) {
    void reportError('telegram.photo', e)
    return false
  }
}

const PAYMENT_LABELS: Record<string, string> = {
  cod: 'Наложенный платеж',
  requisites: 'Оплата по реквизитам',
  online: 'Онлайн-оплата',
  cash: 'Наличные',
}

const CARRIER_LABELS: Record<string, string> = {
  nova_poshta: 'Нова Пошта',
  ukrposhta: 'Укрпошта',
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * URL sanitizer for href/src attributes. Only http(s) and same-origin
 * relative URLs pass through — anything else (javascript:, data:, …)
 * becomes an empty string so a hostile value can't break out of the attribute.
 */
function safeUrl(raw: string): string {
  const v = raw.trim()
  if (/^https?:\/\//i.test(v)) return v
  if (v.startsWith('/')) return v
  return ''
}

/** Plain-text version for the admin alert email. */
function buildAdminOrderText(order: Order, items: OrderItem[], siteUrl: string): string {
  const lines = items
    .map((i) => `• ${i.name}${i.variantLabel ? ` (${i.variantLabel})` : ''} — ${i.quantity} шт. × ${money(i.price, order.currency, 'uk')}`)
    .join('\n')
  const delivery = [
    order.deliveryMethod ? CARRIER_LABELS[order.deliveryMethod] : null,
    order.deliveryCity,
    order.deliveryBranch,
    order.deliveryAddress,
  ]
    .filter(Boolean)
    .join(', ')
  const paid = order.paymentStatus === 'paid' ? 'Оплачен' : 'Не оплачен'
  const link = siteUrl ? `\n\n${siteUrl}/admin/orders/${order.id}` : ''
  const comment = splitOrderNote(order.note).comment
  return `Новый заказ №${order.orderNumber}

Покупатель: ${order.customerName ?? '—'}
Телефон: ${order.customerPhone ?? '—'}${order.customerEmail ? `\nEmail: ${order.customerEmail}` : ''}

Товары:
${lines}

Итого: ${money(order.total, order.currency, 'uk')}
Оплата: ${PAYMENT_LABELS[order.paymentMethod ?? ''] ?? order.paymentMethod ?? '—'} (${paid})${delivery ? `\nДоставка: ${delivery}` : ''}${comment ? `\nКомментарий: ${comment}` : ''}${link}`
}

/**
 * Rich HTML template for Telegram: clickable product links, payment method +
 * paid/unpaid badge, delivery and a direct link to the order in the admin.
 */
export function buildAdminOrderHtml(
  order: Order,
  items: OrderItem[],
  siteUrl: string,
  productSlugs: Record<number, string> = {},
): string {
  const itemImg = (src: string | null | undefined): string => {
    if (!src) return ''
    const v = src.startsWith('http') ? src : siteUrl ? `${siteUrl}${src}` : ''
    return safeUrl(v)
  }
  const rowsHtml = items
    .map((i) => {
      const img = itemImg(i.image)
      const thumb = img
        ? `<img src="${escHtml(img)}" width="56" height="56" alt="" style="display:block;width:56px;height:56px;object-fit:contain;border-radius:8px;background:#f4f4f2" />`
        : `<div style="width:56px;height:56px;border-radius:8px;background:#f4f4f2"></div>`
      const name = `${i.name}${i.variantLabel ? ` (${i.variantLabel})` : ''}`
      const productUrl =
        siteUrl && i.productId
          ? safeUrl(`${siteUrl}/product/${productSlugs[i.productId] ?? i.productId}`)
          : ''
      const nameHtml = productUrl
        ? `<a href="${escHtml(productUrl)}" style="color:#1a1a1a;text-decoration:none;font-weight:600">${escHtml(name)}</a>`
        : `<span style="font-weight:600">${escHtml(name)}</span>`
      return `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #ececea;width:68px;vertical-align:top">${thumb}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #ececea;vertical-align:top">
          ${nameHtml}
          <div style="font-size:13px;color:#6b6b68;margin-top:4px">${i.quantity} шт. × ${money(i.price, order.currency, 'uk')}</div>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #ececea;text-align:right;vertical-align:top;white-space:nowrap;font-weight:600">${money(i.total ?? Number(i.price) * i.quantity, order.currency, 'uk')}</td>
      </tr>`
    })
    .join('')
  const delivery = [
    order.deliveryMethod ? CARRIER_LABELS[order.deliveryMethod] : null,
    order.deliveryCity,
    order.deliveryBranch,
    order.deliveryAddress,
  ]
    .filter(Boolean)
    .join(', ')
  const payLabel = PAYMENT_LABELS[order.paymentMethod ?? ''] ?? order.paymentMethod ?? '—'
  const paid = order.paymentStatus === 'paid'
  const paidBadge = paid ? '✅ Оплачен' : '⏳ Не оплачен'
  const comment = splitOrderNote(order.note).comment
  const adminUrl = siteUrl ? safeUrl(`${siteUrl}/admin/orders/${order.id}`) : ''
  // tel: digits (and a leading +) only; render a link only when it looks dialable.
  const telDigits = (order.customerPhone ?? '').replace(/[^+\d]/g, '')
  const telHref = /^\+?\d+$/.test(telDigits) ? `tel:${telDigits}` : ''
  // mailto: only for plausible emails, otherwise plain text.
  const mailHref =
    order.customerEmail && looksLikeEmail(order.customerEmail)
      ? `mailto:${order.customerEmail}`
      : ''

  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Новый заказ №${escHtml(String(order.orderNumber))}</title></head>
<body style="margin:0;padding:0;background:#f4f4f2">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">Новый заказ №${escHtml(String(order.orderNumber))} — ${money(order.total, order.currency, 'uk')}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f2;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">
  <tr><td style="padding:24px 28px;border-bottom:1px solid #ececea">
    <div style="font-size:20px;font-weight:800;color:#1a1a1a">🛒 Новый заказ №${escHtml(String(order.orderNumber))}</div>
    <div style="font-size:13px;color:#6b6b68;margin-top:4px">${escHtml(new Date().toLocaleString('ru-RU'))}</div>
  </td></tr>
  <tr><td style="padding:20px 28px 4px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#4a4a47">
      <tr><td style="padding:3px 0;color:#6b6b68">Покупатель</td><td style="padding:3px 0;text-align:right;font-weight:600;color:#1a1a1a">${escHtml(order.customerName ?? '—')}</td></tr>
      <tr><td style="padding:3px 0;color:#6b6b68">Телефон</td><td style="padding:3px 0;text-align:right">${telHref ? `<a href="${escHtml(telHref)}" style="color:#1a1a1a;text-decoration:none;font-weight:600">${escHtml(order.customerPhone ?? '—')}</a>` : escHtml(order.customerPhone ?? '—')}</td></tr>
      ${order.customerEmail ? `<tr><td style="padding:3px 0;color:#6b6b68">Email</td><td style="padding:3px 0;text-align:right">${mailHref ? `<a href="${escHtml(mailHref)}" style="color:#1a1a1a">${escHtml(order.customerEmail)}</a>` : escHtml(order.customerEmail)}</td></tr>` : ''}
      <tr><td style="padding:3px 0;color:#6b6b68">Оплата</td><td style="padding:3px 0;text-align:right">${escHtml(payLabel)} — ${paidBadge}</td></tr>
      ${delivery ? `<tr><td style="padding:3px 0;color:#6b6b68">Доставка</td><td style="padding:3px 0;text-align:right">${escHtml(delivery)}</td></tr>` : ''}
      ${comment ? `<tr><td style="padding:3px 0;color:#6b6b68">Комментарий</td><td style="padding:3px 0;text-align:right">${escHtml(comment)}</td></tr>` : ''}
    </table>
  </td></tr>
  <tr><td style="padding:12px 28px 4px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px">
      ${rowsHtml}
    </table>
  </td></tr>
  <tr><td style="padding:12px 28px 24px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">
      <tr><td style="padding:10px 0 0;font-size:17px;font-weight:700;color:#1a1a1a;border-top:1px solid #ececea">Итого</td><td style="padding:10px 0 0;text-align:right;font-size:17px;font-weight:700;color:#1a1a1a;border-top:1px solid #ececea">${money(order.total, order.currency, 'uk')}</td></tr>
    </table>
    ${adminUrl ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:20px"><tr><td style="border-radius:8px;background:#1a1a1a"><a href="${escHtml(adminUrl)}" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none">Открыть заказ в админке</a></td></tr></table>` : ''}
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

export function buildAdminOrderTelegramHtml(
  order: Order,
  items: OrderItem[],
  siteUrl: string,
  productSlugs: Record<number, string> = {},
): string {
  const lines = items
    .map((i) => {
      const name = escHtml(`${i.name}${i.variantLabel ? ` (${i.variantLabel})` : ''}`)
      const label =
        siteUrl && i.productId
          ? `<a href="${siteUrl}/product/${productSlugs[i.productId] ?? i.productId}">${name}</a>`
          : `<b>${name}</b>`
      return `▪️ ${label}\n      ${i.quantity} шт. × ${money(i.price, order.currency, 'uk')}`
    })
    .join('\n')
  const delivery = [
    order.deliveryMethod ? CARRIER_LABELS[order.deliveryMethod] : null,
    order.deliveryCity,
    order.deliveryBranch,
    order.deliveryAddress,
  ]
    .filter(Boolean)
    .join(', ')
  const payLabel = PAYMENT_LABELS[order.paymentMethod ?? ''] ?? order.paymentMethod ?? '—'
  const paidBadge = order.paymentStatus === 'paid' ? '✅ Оплачен' : '⏳ Не оплачен'

  const parts = [
    `🛒 <b>Новый заказ №${order.orderNumber}</b>`,
    '',
    `👤 <b>${escHtml(order.customerName ?? '—')}</b>`,
    `📞 ${escHtml(order.customerPhone ?? '—')}`,
  ]
  if (order.customerEmail) parts.push(`✉️ ${escHtml(order.customerEmail)}`)
  parts.push('', `📦 <b>Товары (${items.length}):</b>`, lines, '')
  parts.push(`💰 <b>Итого: ${money(order.total, order.currency, 'uk')}</b>`)
  parts.push(`💳 ${escHtml(payLabel)} — ${paidBadge}`)
  if (delivery) parts.push(`🚚 ${escHtml(delivery)}`)
  const comment = splitOrderNote(order.note).comment
  if (comment) parts.push(`💬 ${escHtml(comment)}`)
  if (siteUrl) parts.push('', `🔗 <a href="${siteUrl}/admin/orders/${order.id}">Открыть заказ в админке</a>`)
  return parts.join('\n')
}

/**
 * Fire-and-forget notifications for a newly placed order: confirmation email
 * to the customer, alert email + Telegram message to the admin. Every channel
 * is best-effort — a notification failure must never break checkout.
 */
export async function notifyNewOrder(orderId: number): Promise<void> {
  try {
    const [orderRes, itemsRes, settings] = await Promise.all([
      pool.query(
        `SELECT id, order_number, customer_name, customer_phone, customer_email,
                delivery_method, delivery_city, delivery_branch, delivery_address,
                delivery_cost, delivery_status, tracking_number, payment_method,
                payment_status, items_total, total, currency, status, note
           FROM orders WHERE id = $1`,
        [orderId],
      ),
      pool.query(
        `SELECT id, order_id, product_id, name, sku, image, price, quantity, total, variant_label
           FROM order_items WHERE order_id = $1`,
        [orderId],
      ),
      getStoreSettingsInternal(),
    ])
    const order = orderRes.rows[0] as Order | undefined
    if (!order) return
    // pg returns snake_case — normalize the fields the templates rely on.
    const o = normalizeOrder(orderRes.rows[0])
    const items = itemsRes.rows.map(normalizeItem)
    const productSlugs = await getProductSlugMap(items.map((i) => i.productId))
    const n = settings.notifications

    // Prefer the SEO site URL; fall back to the deployment URL so product
    // links and photos in Telegram keep working even when SEO isn't filled in.
    const envUrl = process.env.NEXT_PUBLIC_SITE_URL
      ? String(process.env.NEXT_PUBLIC_SITE_URL)
      : process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : ''
    const siteUrl = (settings.seo?.siteUrl || envUrl).replace(/\/$/, '')

    const jobs: Promise<unknown>[] = []

    // Branding context so customer emails look like the storefront.
    const storeCtx = {
      storeName: settings.storeName,
      siteUrl,
      logoUrl: settings.logoUrl,
      phone: settings.contact?.phones?.find(Boolean) ?? null,
      supportEmail: (settings.emailSettings?.fromEmail as string) || null,
      locale: settings.defaultLocale === 'ru' ? 'ru' as const : 'uk' as const,
    }

    // 1) Customer confirmation email.
    // Bank-requisite orders always try to mail the payment details when SMTP
    // is on and we have an address (typed at checkout or from the account),
    // even if generic customer emails are disabled in notifications.
    const smtpReady = Boolean(settings.emailSettings?.enabled && settings.emailSettings?.smtpHost && settings.emailSettings?.smtpUser)
    const isRequisites = o.paymentMethod === 'requisites' || noteLooksLikeRequisites(o.note)
    const shouldEmailCustomer =
      Boolean(o.customerEmail) && (n.customerEmailEnabled || (isRequisites && smtpReady))
    if (shouldEmailCustomer && o.customerEmail) {
      const msg = buildOrderMessage('confirmation', o, items, storeCtx, productSlugs)
      jobs.push(
        sendMail({ to: o.customerEmail, subject: msg.subject, text: msg.text, html: msg.html }).catch(
          (e) => {
            void reportError('notify.customer-email', e)
          },
        ),
      )
    }

    // 2) Admin alert email (text + rich HTML).
    const adminTo = n.adminEmail || settings.emailSettings.smtpUser
    if (n.adminEmailEnabled && adminTo) {
      const text = buildAdminOrderText(o, items, siteUrl)
      const html = buildAdminOrderHtml(o, items, siteUrl, productSlugs)
      jobs.push(
        sendMail({
          to: adminTo,
          subject: `Новый заказ №${o.orderNumber} — ${money(o.total, o.currency, 'uk')}`,
          text,
          html,
        }).catch((e) => {
          void reportError('notify.admin-email', e, { context: { orderId } })
        }),
      )
    }

    // 3) Telegram alert: photo of the first product with a rich caption.
    // Telegram caps captions at 1024 chars — longer orders fall back to text.
    if (n.telegramEnabled && n.telegramBotToken && n.telegramChatId) {
      const html = buildAdminOrderTelegramHtml(o, items, siteUrl, productSlugs)
      const photo = items.find((i) => i.image)?.image
      const photoUrl = photo
        ? photo.startsWith('http')
          ? photo
          : siteUrl
            ? `${siteUrl}${photo}`
            : null
        : null
      const { telegramBotToken: token, telegramChatId: chat } = n
      jobs.push(
        (async () => {
          if (photoUrl && html.length <= 1024) {
            const ok = await sendTelegramPhoto(token, chat, photoUrl, html)
            if (ok) return
          }
          await sendTelegramMessage(token, chat, html)
        })(),
      )
    }

    await Promise.allSettled(jobs)
  } catch (e) {
    void reportError('notify.new-order', e)
  }
}

/* pg snake_case rows -> camelCase shape expected by the message builders. */
function normalizeOrder(r: Record<string, unknown>): Order {
  return {
    ...r,
    orderNumber: r.order_number,
    customerName: r.customer_name,
    customerPhone: r.customer_phone,
    customerEmail: r.customer_email,
    deliveryMethod: r.delivery_method,
    deliveryCity: r.delivery_city,
    deliveryBranch: r.delivery_branch,
    deliveryAddress: r.delivery_address,
    deliveryCost: r.delivery_cost,
    deliveryStatus: r.delivery_status,
    trackingNumber: r.tracking_number,
    paymentMethod: r.payment_method,
    paymentStatus: r.payment_status,
    itemsTotal: r.items_total,
  } as Order
}

function normalizeItem(r: Record<string, unknown>): OrderItem {
  return { ...r, variantLabel: r.variant_label, productId: r.product_id } as OrderItem
}

/** Email the customer when a TTN appears (admin entered it or NP sync). */
export async function notifyShippedOrder(orderId: number): Promise<void> {
  try {
    const [orderRes, itemsRes, settings] = await Promise.all([
      pool.query(
        `SELECT id, order_number, customer_name, customer_phone, customer_email,
                delivery_method, delivery_city, delivery_branch, delivery_address,
                delivery_cost, delivery_status, tracking_number, payment_method,
                payment_status, items_total, total, currency, status, note
           FROM orders WHERE id = $1`,
        [orderId],
      ),
      pool.query(
        `SELECT id, order_id, product_id, name, sku, image, price, quantity, total, variant_label
           FROM order_items WHERE order_id = $1`,
        [orderId],
      ),
      getStoreSettingsInternal(),
    ])
    if (!orderRes.rows[0]) return
    const o = normalizeOrder(orderRes.rows[0])
    if (!o.customerEmail || !o.trackingNumber) return
    const items = itemsRes.rows.map(normalizeItem)
    const productSlugs = await getProductSlugMap(items.map((i) => i.productId))
    const envUrl = process.env.NEXT_PUBLIC_SITE_URL
      ? String(process.env.NEXT_PUBLIC_SITE_URL)
      : process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : ''
    const siteUrl = (settings.seo?.siteUrl || envUrl).replace(/\/$/, '')
    const storeCtx = {
      storeName: settings.storeName,
      siteUrl,
      logoUrl: settings.logoUrl,
      phone: settings.contact?.phones?.find(Boolean) ?? null,
      supportEmail: (settings.emailSettings?.fromEmail as string) || null,
      locale: settings.defaultLocale === 'ru' ? 'ru' as const : 'uk' as const,
    }
    const msg = buildOrderMessage('shipped', o, items, storeCtx, productSlugs)
    await sendMail({ to: o.customerEmail, subject: msg.subject, text: msg.text, html: msg.html })
  } catch (e) {
    void reportError('notify.shipped-order', e)
  }
}
