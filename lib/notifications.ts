import { pool } from '@/lib/db'
import type { Order, OrderItem } from '@/lib/db/schema'
import { sendMail } from '@/lib/mailer'
import { reportError } from '@/lib/server-errors'
import { buildOrderMessage, type StoreEmailContext } from '@/lib/order-messages'
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
  cod: 'Накладений платіж',
  requisites: 'Оплата за реквізитами',
  online: 'Онлайн-оплата',
  cash: 'Готівка',
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
  const paid = order.paymentStatus === 'paid' ? 'Оплачено' : 'Не оплачено'
  const link = siteUrl ? `\n\n${siteUrl}/admin/orders/${order.id}` : ''
  const comment = splitOrderNote(order.note).comment
  return `Нове замовлення №${order.orderNumber}

Покупець: ${order.customerName ?? '—'}
Телефон: ${order.customerPhone ?? '—'}${order.customerEmail ? `\nEmail: ${order.customerEmail}` : ''}

Товари:
${lines}

Разом: ${money(order.total, order.currency, 'uk')}
Оплата: ${PAYMENT_LABELS[order.paymentMethod ?? ''] ?? order.paymentMethod ?? '—'} (${paid})${delivery ? `\nДоставка: ${delivery}` : ''}${comment ? `\nКоментар: ${comment}` : ''}${link}`
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
  const paidBadge = paid ? '✅ Оплачено' : '⏳ Не оплачено'
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
<html lang="uk">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Нове замовлення №${escHtml(String(order.orderNumber))}</title></head>
<body style="margin:0;padding:0;background:#f4f4f2">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">Нове замовлення №${escHtml(String(order.orderNumber))} — ${money(order.total, order.currency, 'uk')}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f2;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">
  <tr><td style="padding:24px 28px;border-bottom:1px solid #ececea">
    <div style="font-size:20px;font-weight:800;color:#1a1a1a">🛒 Нове замовлення №${escHtml(String(order.orderNumber))}</div>
    <div style="font-size:13px;color:#6b6b68;margin-top:4px">${escHtml(new Date().toLocaleString('uk-UA'))}</div>
  </td></tr>
  <tr><td style="padding:20px 28px 4px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#4a4a47">
      <tr><td style="padding:3px 0;color:#6b6b68">Покупець</td><td style="padding:3px 0;text-align:right;font-weight:600;color:#1a1a1a">${escHtml(order.customerName ?? '—')}</td></tr>
      <tr><td style="padding:3px 0;color:#6b6b68">Телефон</td><td style="padding:3px 0;text-align:right">${telHref ? `<a href="${escHtml(telHref)}" style="color:#1a1a1a;text-decoration:none;font-weight:600">${escHtml(order.customerPhone ?? '—')}</a>` : escHtml(order.customerPhone ?? '—')}</td></tr>
      ${order.customerEmail ? `<tr><td style="padding:3px 0;color:#6b6b68">Email</td><td style="padding:3px 0;text-align:right">${mailHref ? `<a href="${escHtml(mailHref)}" style="color:#1a1a1a">${escHtml(order.customerEmail)}</a>` : escHtml(order.customerEmail)}</td></tr>` : ''}
      <tr><td style="padding:3px 0;color:#6b6b68">Оплата</td><td style="padding:3px 0;text-align:right">${escHtml(payLabel)} — ${paidBadge}</td></tr>
      ${delivery ? `<tr><td style="padding:3px 0;color:#6b6b68">Доставка</td><td style="padding:3px 0;text-align:right">${escHtml(delivery)}</td></tr>` : ''}
      ${comment ? `<tr><td style="padding:3px 0;color:#6b6b68">Коментар</td><td style="padding:3px 0;text-align:right">${escHtml(comment)}</td></tr>` : ''}
    </table>
  </td></tr>
  <tr><td style="padding:12px 28px 4px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px">
      ${rowsHtml}
    </table>
  </td></tr>
  <tr><td style="padding:12px 28px 24px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">
      <tr><td style="padding:10px 0 0;font-size:17px;font-weight:700;color:#1a1a1a;border-top:1px solid #ececea">Разом</td><td style="padding:10px 0 0;text-align:right;font-size:17px;font-weight:700;color:#1a1a1a;border-top:1px solid #ececea">${money(order.total, order.currency, 'uk')}</td></tr>
    </table>
    ${adminUrl ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:20px"><tr><td style="border-radius:8px;background:#1a1a1a"><a href="${escHtml(adminUrl)}" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none">Відкрити замовлення в адмінці</a></td></tr></table>` : ''}
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
          ? `<a href="${escHtml(`${siteUrl}/product/${productSlugs[i.productId] ?? i.productId}`)}">${name}</a>`
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
  const paidBadge = order.paymentStatus === 'paid' ? '✅ Оплачено' : '⏳ Не оплачено'

  const parts = [
    `🛒 <b>Нове замовлення №${order.orderNumber}</b>`,
    '',
    `👤 <b>${escHtml(order.customerName ?? '—')}</b>`,
    `📞 ${escHtml(order.customerPhone ?? '—')}`,
  ]
  if (order.customerEmail) parts.push(`✉️ ${escHtml(order.customerEmail)}`)
  parts.push('', `📦 <b>Товари (${items.length}):</b>`, lines, '')
  parts.push(`💰 <b>Разом: ${money(order.total, order.currency, 'uk')}</b>`)
  parts.push(`💳 ${escHtml(payLabel)} — ${paidBadge}`)
  if (delivery) parts.push(`🚚 ${escHtml(delivery)}`)
  const comment = splitOrderNote(order.note).comment
  if (comment) parts.push(`💬 ${escHtml(comment)}`)
  if (siteUrl) parts.push('', `🔗 <a href="${escHtml(`${siteUrl}/admin/orders/${order.id}`)}">Відкрити замовлення в адмінці</a>`)
  return parts.join('\n')
}

export type NotificationKind = 'new-order' | 'shipped'
export type NotificationChannel = 'customer-email' | 'admin-email' | 'telegram'

const MAX_OUTBOX_ATTEMPTS = 5
const MAX_BACKOFF_MINUTES = 360

/** Retry delay for a failed send: 2^attempts minutes, capped at 6h. Pure. */
export function nextAttemptDelayMs(attempts: number): number {
  const minutes = Math.min(2 ** Math.max(1, attempts), MAX_BACKOFF_MINUTES)
  return minutes * 60_000
}

/**
 * Queue a failed send for the retry worker. Deduped by the partial unique
 * index on (kind, channel, order_id) WHERE status = 'pending'. Never throws:
 * the outbox must not break the notifying call (e.g. the table is missing on
 * an install whose migration has not run yet).
 */
async function enqueueNotification(
  kind: NotificationKind,
  channel: NotificationChannel,
  orderId: number,
): Promise<void> {
  await pool
    .query(
      `INSERT INTO notification_outbox (kind, channel, order_id, status)
       VALUES ($1, $2, $3, 'pending')
       ON CONFLICT (kind, channel, order_id) WHERE status = 'pending' DO NOTHING`,
      [kind, channel, orderId],
    )
    .catch(() => {})
}

type OrderNotificationContext = {
  o: Order
  items: OrderItem[]
  settings: Awaited<ReturnType<typeof getStoreSettingsInternal>>
  siteUrl: string
  storeCtx: StoreEmailContext
  productSlugs: Record<number, string>
}

/** Shared order/items/settings load for the notify functions and the retry worker. */
async function loadOrderNotificationContext(orderId: number): Promise<OrderNotificationContext | null> {
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
  if (!orderRes.rows[0]) return null
  // pg returns snake_case — normalize the fields the templates rely on.
  const o = normalizeOrder(orderRes.rows[0])
  const items = itemsRes.rows.map(normalizeItem)
  const productSlugs = await getProductSlugMap(items.map((i) => i.productId))
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL
    ? String(process.env.NEXT_PUBLIC_SITE_URL)
    : process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : ''
  const siteUrl = (settings.seo?.siteUrl || envUrl).replace(/\/$/, '')
  const storeCtx: StoreEmailContext = {
    storeName: settings.storeName,
    siteUrl,
    logoUrl: settings.logoUrl,
    phone: settings.contact?.phones?.find(Boolean) ?? null,
    supportEmail: (settings.emailSettings?.fromEmail as string) || null,
    locale: settings.defaultLocale === 'ru' ? ('ru' as const) : ('uk' as const),
  }
  return { o, items, settings, siteUrl, storeCtx, productSlugs }
}

/**
 * One channel of the new-order notification. Returns true when sent OR when
 * there is nothing to send (channel disabled, no address, SMTP not
 * configured) — false only on a real send failure, which the caller enqueues.
 */
async function sendNewOrderCustomerEmail(ctx: OrderNotificationContext): Promise<boolean> {
  const { o, items, settings, storeCtx, productSlugs } = ctx
  const n = settings.notifications
  const smtpReady = Boolean(
    settings.emailSettings?.enabled && settings.emailSettings?.smtpHost && settings.emailSettings?.smtpUser,
  )
  const isRequisites = o.paymentMethod === 'requisites' || noteLooksLikeRequisites(o.note)
  if (!o.customerEmail) return true
  if (!(n.customerEmailEnabled || (isRequisites && smtpReady))) return true
  const msg = buildOrderMessage('confirmation', o, items, storeCtx, productSlugs)
  try {
    const r = await sendMail({ to: o.customerEmail, subject: msg.subject, text: msg.text, html: msg.html })
    return r.sent || r.fallback
  } catch (e) {
    void reportError('notify.customer-email', e)
    return false
  }
}

async function sendNewOrderAdminEmail(ctx: OrderNotificationContext): Promise<boolean> {
  const { o, items, settings, siteUrl, productSlugs } = ctx
  const n = settings.notifications
  const adminTo = n.adminEmail || settings.emailSettings.smtpUser
  if (!n.adminEmailEnabled || !adminTo) return true
  const text = buildAdminOrderText(o, items, siteUrl)
  const html = buildAdminOrderHtml(o, items, siteUrl, productSlugs)
  try {
    const r = await sendMail({
      to: adminTo,
      subject: `Нове замовлення №${o.orderNumber} — ${money(o.total, o.currency, 'uk')}`,
      text,
      html,
    })
    return r.sent || r.fallback
  } catch (e) {
    void reportError('notify.admin-email', e, { context: { orderId: o.id } })
    return false
  }
}

async function sendNewOrderTelegram(ctx: OrderNotificationContext): Promise<boolean> {
  const { o, items, settings, siteUrl, productSlugs } = ctx
  const n = settings.notifications
  if (!n.telegramEnabled || !n.telegramBotToken || !n.telegramChatId) return true
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
  if (photoUrl && html.length <= 1024) {
    if (await sendTelegramPhoto(token, chat, photoUrl, html)) return true
  }
  return sendTelegramMessage(token, chat, html)
}

async function sendShippedOrderEmail(ctx: OrderNotificationContext): Promise<boolean> {
  const { o, items, storeCtx, productSlugs } = ctx
  if (!o.customerEmail || !o.trackingNumber) return true
  const msg = buildOrderMessage('shipped', o, items, storeCtx, productSlugs)
  try {
    const r = await sendMail({ to: o.customerEmail, subject: msg.subject, text: msg.text, html: msg.html })
    return r.sent || r.fallback
  } catch (e) {
    void reportError('notify.shipped-order', e)
    return false
  }
}

/**
 * Fire-and-forget notifications for a newly placed order: confirmation email
 * to the customer, alert email + Telegram message to the admin. Every channel
 * is best-effort — a notification failure must never break checkout. A failed
 * channel is queued in notification_outbox for the retry worker.
 */
export async function notifyNewOrder(orderId: number): Promise<void> {
  try {
    const ctx = await loadOrderNotificationContext(orderId)
    if (!ctx) return
    const [customer, admin, telegram] = await Promise.all([
      sendNewOrderCustomerEmail(ctx),
      sendNewOrderAdminEmail(ctx),
      sendNewOrderTelegram(ctx),
    ])
    await Promise.allSettled([
      customer ? Promise.resolve() : enqueueNotification('new-order', 'customer-email', orderId),
      admin ? Promise.resolve() : enqueueNotification('new-order', 'admin-email', orderId),
      telegram ? Promise.resolve() : enqueueNotification('new-order', 'telegram', orderId),
    ])
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
    const ctx = await loadOrderNotificationContext(orderId)
    if (!ctx) return
    if (!(await sendShippedOrderEmail(ctx))) {
      await enqueueNotification('shipped', 'customer-email', orderId)
    }
  } catch (e) {
    void reportError('notify.shipped-order', e)
  }
}

async function sendOutboxRow(
  kind: NotificationKind,
  channel: NotificationChannel,
  orderId: number,
): Promise<boolean> {
  const ctx = await loadOrderNotificationContext(orderId)
  if (!ctx) return true // the order is gone — nothing left to send
  if (kind === 'shipped') return sendShippedOrderEmail(ctx)
  if (channel === 'customer-email') return sendNewOrderCustomerEmail(ctx)
  if (channel === 'admin-email') return sendNewOrderAdminEmail(ctx)
  return sendNewOrderTelegram(ctx)
}

/**
 * Retry worker for notification_outbox (cron job 'notification-retry').
 * Claims due rows atomically so two workers never send the same row twice,
 * re-sends the single failed channel, and backs off exponentially
 * (2/4/8/16 min, then dead after 5 attempts).
 */
export async function processNotificationOutbox(
  limit = 25,
): Promise<{ processed: number; sent: number; failed: number }> {
  const { rows } = await pool.query<{
    id: number
    kind: string
    channel: string
    order_id: number
    attempts: number
  }>(
    `SELECT id, kind, channel, order_id, attempts FROM notification_outbox
      WHERE status = 'pending' AND next_attempt_at <= NOW()
      ORDER BY next_attempt_at ASC LIMIT $1`,
    [limit],
  )
  let sent = 0
  let failed = 0
  for (const row of rows) {
    const claimed = await pool.query(
      `UPDATE notification_outbox SET status = 'sending', updated_at = NOW()
        WHERE id = $1 AND status = 'pending' RETURNING id`,
      [row.id],
    )
    if (!claimed.rowCount) continue
    let ok = false
    try {
      ok = await sendOutboxRow(row.kind as NotificationKind, row.channel as NotificationChannel, row.order_id)
    } catch (e) {
      void reportError('notify.outbox-send', e, { context: { orderId: row.order_id } })
    }
    if (ok) {
      await pool.query(`UPDATE notification_outbox SET status = 'sent', updated_at = NOW() WHERE id = $1`, [row.id])
      sent++
    } else {
      failed++
      const attempts = row.attempts + 1
      if (attempts >= MAX_OUTBOX_ATTEMPTS) {
        await pool.query(
          `UPDATE notification_outbox SET status = 'dead', attempts = $2, last_error = 'max attempts reached', updated_at = NOW() WHERE id = $1`,
          [row.id, attempts],
        )
      } else {
        const delayMin = nextAttemptDelayMs(attempts) / 60_000
        await pool.query(
          `UPDATE notification_outbox SET status = 'pending', attempts = $2, next_attempt_at = NOW() + ($3 || ' minutes')::interval, updated_at = NOW() WHERE id = $1`,
          [row.id, attempts, String(delayMin)],
        )
      }
    }
  }
  return { processed: rows.length, sent, failed }
}
