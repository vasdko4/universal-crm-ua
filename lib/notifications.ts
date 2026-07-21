import { pool } from '@/lib/db'
import type { Order, OrderItem } from '@/lib/db/schema'
import { sendMail } from '@/lib/mailer'
import { buildOrderMessage } from '@/lib/order-messages'
import { getStoreSettingsInternal } from '@/lib/store-settings'

function money(v: string | number, currency = 'UAH') {
  const n = typeof v === 'string' ? Number.parseFloat(v) : v
  const symbol = currency === 'UAH' ? '₴' : currency
  return `${n.toLocaleString('uk-UA')} ${symbol}`
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
      const body = await res.text().catch(() => '')
      console.log('[v0] Telegram send failed:', res.status, body.slice(0, 200))
      return false
    }
    return true
  } catch (e) {
    console.log('[v0] Telegram send error:', (e as Error).message)
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
      const body = await res.text().catch(() => '')
      console.log('[v0] Telegram photo failed:', res.status, body.slice(0, 200))
      return false
    }
    return true
  } catch (e) {
    console.log('[v0] Telegram photo error:', (e as Error).message)
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
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Plain-text version for the admin alert email. */
function buildAdminOrderText(order: Order, items: OrderItem[], siteUrl: string): string {
  const lines = items
    .map((i) => `• ${i.name}${i.variantLabel ? ` (${i.variantLabel})` : ''} — ${i.quantity} шт. × ${money(i.price, order.currency)}`)
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
  return `Новый заказ №${order.orderNumber}

Покупатель: ${order.customerName ?? '—'}
Телефон: ${order.customerPhone ?? '—'}${order.customerEmail ? `\nEmail: ${order.customerEmail}` : ''}

Товары:
${lines}

Итого: ${money(order.total, order.currency)}
Оплата: ${PAYMENT_LABELS[order.paymentMethod ?? ''] ?? order.paymentMethod ?? '—'} (${paid})${delivery ? `\nДоставка: ${delivery}` : ''}${order.note ? `\nКомментарий: ${order.note}` : ''}${link}`
}

/**
 * Rich HTML template for Telegram: clickable product links, payment method +
 * paid/unpaid badge, delivery and a direct link to the order in the admin.
 */
export function buildAdminOrderTelegramHtml(
  order: Order,
  items: OrderItem[],
  siteUrl: string,
): string {
  const lines = items
    .map((i) => {
      const name = escHtml(`${i.name}${i.variantLabel ? ` (${i.variantLabel})` : ''}`)
      const label =
        siteUrl && i.productId
          ? `<a href="${siteUrl}/product/${i.productId}">${name}</a>`
          : `<b>${name}</b>`
      return `▪️ ${label}\n      ${i.quantity} шт. × ${money(i.price, order.currency)}`
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
  parts.push(`💰 <b>Итого: ${money(order.total, order.currency)}</b>`)
  parts.push(`💳 ${escHtml(payLabel)} — ${paidBadge}`)
  if (delivery) parts.push(`🚚 ${escHtml(delivery)}`)
  if (order.note && !order.note.startsWith('Реквизиты для оплаты:'))
    parts.push(`💬 ${escHtml(order.note)}`)
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
      pool.query('SELECT * FROM orders WHERE id = $1', [orderId]),
      pool.query('SELECT * FROM order_items WHERE order_id = $1', [orderId]),
      getStoreSettingsInternal(),
    ])
    const order = orderRes.rows[0] as Order | undefined
    if (!order) return
    // pg returns snake_case — normalize the fields the templates rely on.
    const o = normalizeOrder(orderRes.rows[0])
    const items = itemsRes.rows.map(normalizeItem)
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
    }

    // 1) Customer confirmation email.
    if (n.customerEmailEnabled && o.customerEmail) {
      const msg = buildOrderMessage('confirmation', o, items, storeCtx)
      jobs.push(
        sendMail({ to: o.customerEmail, subject: msg.subject, text: msg.text, html: msg.html }).catch(
          (e) => console.log('[v0] customer email failed:', (e as Error).message),
        ),
      )
    }

    // 2) Admin alert email.
    const adminTo = n.adminEmail || settings.emailSettings.smtpUser
    if (n.adminEmailEnabled && adminTo) {
      const text = buildAdminOrderText(o, items, siteUrl)
      jobs.push(
        sendMail({
          to: adminTo,
          subject: `Новый заказ №${o.orderNumber} — ${money(o.total, o.currency)}`,
          text,
        }).catch((e) => console.log('[v0] admin email failed:', (e as Error).message)),
      )
    }

    // 3) Telegram alert: photo of the first product with a rich caption.
    // Telegram caps captions at 1024 chars — longer orders fall back to text.
    if (n.telegramEnabled && n.telegramBotToken && n.telegramChatId) {
      const html = buildAdminOrderTelegramHtml(o, items, siteUrl)
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
    console.log('[v0] notifyNewOrder failed:', (e as Error).message)
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
