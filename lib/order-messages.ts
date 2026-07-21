import type { Order, OrderItem } from '@/lib/db/schema'

const STATUS_LABELS: Record<string, string> = {
  new: 'Новый',
  accepted: 'Принят',
  processing: 'В обработке',
  shipped: 'Отправлен',
  done: 'Выполнен',
  cancelled: 'Отменён',
}

function money(v: string | number, currency = 'UAH') {
  const n = typeof v === 'string' ? Number.parseFloat(v) : v
  const symbol = currency === 'UAH' ? 'грн' : currency
  return `${n.toLocaleString('uk-UA')} ${symbol}`
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export type OrderMessageKind = 'confirmation' | 'shipped' | 'status' | 'instruction'

// Store branding/context injected into every email so the template looks like
// a real storefront newsletter instead of a bare-bones transactional stub.
export type StoreEmailContext = {
  storeName?: string
  siteUrl?: string
  logoUrl?: string | null
  phone?: string | null
  supportEmail?: string | null
}

export function buildOrderMessage(
  kind: OrderMessageKind,
  order: Order,
  items: OrderItem[],
  store: StoreEmailContext = {},
): { subject: string; text: string; html: string } {
  const storeName = store.storeName || 'Наш магазин'
  const siteUrl = (store.siteUrl || '').replace(/\/$/, '')

  const heading =
    kind === 'confirmation'
      ? `Заказ №${order.orderNumber} оформлен`
      : kind === 'shipped'
        ? `Заказ №${order.orderNumber} отправлен`
        : kind === 'instruction'
          ? `Инструкция по заказу №${order.orderNumber}`
          : `Обновление по заказу №${order.orderNumber}`

  const intro =
    kind === 'confirmation'
      ? 'Спасибо за ваш заказ! Мы уже приступили к его обработке.'
      : kind === 'shipped'
        ? 'Хорошие новости — ваш заказ передан в службу доставки.'
        : 'У вашего заказа изменился статус.'

  // Carrier metadata: label + public tracking page for the TTN.
  const CARRIERS: Record<string, { label: string; trackUrl: (ttn: string) => string }> = {
    nova_poshta: {
      label: 'Нова Пошта',
      trackUrl: (ttn) => `https://novaposhta.ua/tracking/?cargo_number=${encodeURIComponent(ttn)}`,
    },
    ukrposhta: {
      label: 'Укрпошта',
      trackUrl: (ttn) => `https://track.ukrposhta.ua/tracking_UA.html?barcode=${encodeURIComponent(ttn)}`,
    },
  }
  const carrier = order.deliveryMethod ? CARRIERS[order.deliveryMethod] : undefined
  const trackingUrl =
    order.trackingNumber && carrier ? carrier.trackUrl(order.trackingNumber) : ''

  const trackingLine = order.trackingNumber
    ? `Перевозчик: ${carrier?.label ?? 'служба доставки'}\nНомер накладной (ТТН): ${order.trackingNumber}${order.deliveryStatus ? ` — ${order.deliveryStatus}` : ''}${trackingUrl ? `\nОтследить посылку: ${trackingUrl}` : ''}`
    : ''

  const deliveryLine =
    order.deliveryCity || order.deliveryBranch || carrier
      ? `Доставка: ${[carrier?.label, order.deliveryCity, order.deliveryBranch].filter(Boolean).join(', ')}`
      : ''

  // Bank-requisite orders keep the payment details in the note
  // (prefixed with "Реквизиты для оплаты:") — surface them in the email.
  const requisitesText =
    kind === 'confirmation' && order.note?.startsWith('Реквизиты для оплаты:') ? order.note : ''

  /* ---------------------------------- text ---------------------------------- */

  const itemLines = items
    .map(
      (i) =>
        `• ${i.name}${i.variantLabel ? ` (${i.variantLabel})` : ''} — ${i.quantity} шт. × ${money(i.price, order.currency)}`,
    )
    .join('\n')

  const text = `Здравствуйте, ${order.customerName ?? 'уважаемый клиент'}!

${heading}. ${intro}

Состав заказа:
${itemLines}

Сумма товаров: ${money(order.itemsTotal, order.currency)}
Доставка: ${Number(order.deliveryCost) > 0 ? money(order.deliveryCost, order.currency) : 'по тарифам перевозчика'}
Итого: ${money(order.total, order.currency)}
Статус: ${STATUS_LABELS[order.status] ?? order.status}${deliveryLine ? `\n${deliveryLine}` : ''}${trackingLine ? `\n${trackingLine}` : ''}${requisitesText ? `\n\n${requisitesText}` : ''}

${siteUrl ? `Отследить заказ и историю покупок: ${siteUrl}/account/orders\n` : ''}
С уважением,
команда ${storeName}${store.phone ? `\nТелефон: ${store.phone}` : ''}${store.supportEmail ? `\nEmail: ${store.supportEmail}` : ''}

Вы получили это письмо, потому что оформили заказ в магазине ${storeName}.`

  /* ---------------------------------- html ---------------------------------- */

  // Blob-hosted and same-site images are served directly (email clients load
  // them fine). Only third-party hosts (e.g. images.prom.ua) that reject
  // email-client image proxies go through our /api/email-image proxy.
  const emailImg = (src: string): string => {
    if (!src) return src
    const abs = src.startsWith('http') ? src : siteUrl ? `${siteUrl}${src}` : ''
    if (!abs || !siteUrl) return abs
    if (/\.blob\.vercel-storage\.com\//.test(abs) || abs.startsWith(siteUrl)) return abs
    return `${siteUrl}/api/email-image?src=${encodeURIComponent(abs)}`
  }

  const rowsHtml = items
    .map((i) => {
      const img = i.image
        ? `<img src="${emailImg(i.image)}" width="64" height="64" alt="" style="display:block;width:64px;height:64px;object-fit:contain;border-radius:8px;background:#f4f4f2" />`
        : `<div style="width:64px;height:64px;border-radius:8px;background:#f4f4f2"></div>`
      const productUrl = siteUrl && i.productId ? `${siteUrl}/product/${i.productId}` : ''
      const nameHtml = productUrl
        ? `<a href="${productUrl}" style="color:#1a1a1a;text-decoration:none;font-weight:600">${esc(i.name)}</a>`
        : `<span style="font-weight:600">${esc(i.name)}</span>`
      return `<tr>
        <td style="padding:12px 0;border-bottom:1px solid #ececea;width:76px;vertical-align:top">${img}</td>
        <td style="padding:12px 12px;border-bottom:1px solid #ececea;vertical-align:top">
          ${nameHtml}
          ${i.variantLabel ? `<div style="font-size:13px;color:#6b6b68;margin-top:2px">${esc(i.variantLabel)}</div>` : ''}
          <div style="font-size:13px;color:#6b6b68;margin-top:4px">${i.quantity} шт. × ${money(i.price, order.currency)}</div>
        </td>
        <td style="padding:12px 0;border-bottom:1px solid #ececea;text-align:right;vertical-align:top;white-space:nowrap;font-weight:600">${money(i.total ?? Number(i.price) * i.quantity, order.currency)}</td>
      </tr>`
    })
    .join('')

  const logoHtml = store.logoUrl
    ? `<img src="${store.logoUrl}" height="36" alt="${esc(storeName)}" style="display:block;max-height:36px;width:auto" />`
    : `<span style="font-size:20px;font-weight:700;color:#1a1a1a;letter-spacing:-0.02em">${esc(storeName)}</span>`

  const trackingHtml = order.trackingNumber
    ? `<div style="margin-top:16px;padding:20px;background:#f0f7f1;border:2px solid #4a8a55;border-radius:12px;text-align:center">
        <div style="font-size:14px;color:#3d6b45;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">${esc(carrier?.label ?? 'Служба доставки')} — номер накладной</div>
        <div style="font-size:26px;font-weight:800;color:#1a1a1a;letter-spacing:0.06em;font-family:'Courier New',monospace">${esc(order.trackingNumber)}</div>
        ${order.deliveryStatus ? `<div style="font-size:14px;color:#3d6b45;margin-top:6px;font-weight:600">${esc(order.deliveryStatus)}</div>` : ''}
        ${trackingUrl ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:14px auto 0"><tr><td style="border-radius:8px;background:#4a8a55"><a href="${trackingUrl}" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none">Отследить посылку</a></td></tr></table>` : ''}
      </div>`
    : ''

  const requisitesHtml = requisitesText
    ? `<div style="margin-top:16px;padding:14px 16px;background:#fdf8ee;border:1px solid #ecdcbc;border-radius:10px">
        <div style="font-size:13px;color:#8a6d2f;font-weight:600;margin-bottom:6px">Оплата по реквизитам</div>
        <div style="font-size:14px;color:#1a1a1a;white-space:pre-line;line-height:1.6">${esc(requisitesText.replace('Реквизиты для оплаты:\n', ''))}</div>
      </div>`
    : ''

  const html = `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(heading)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f2">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f2;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">
  <tr><td style="padding:24px 28px;border-bottom:1px solid #ececea">
    ${siteUrl ? `<a href="${siteUrl}" style="text-decoration:none">${logoHtml}</a>` : logoHtml}
  </td></tr>
  <tr><td style="padding:28px 28px 8px">
    <h1 style="margin:0 0 8px;font-size:22px;line-height:1.3;color:#1a1a1a">${esc(heading)}</h1>
    <p style="margin:0;font-size:15px;line-height:1.6;color:#4a4a47">Здравствуйте, ${esc(order.customerName ?? 'уважаемый клиент')}! ${esc(intro)}</p>
    ${trackingHtml}
    ${requisitesHtml}
  </td></tr>
  <tr><td style="padding:20px 28px 4px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px">
      ${rowsHtml}
    </table>
  </td></tr>
  <tr><td style="padding:12px 28px 24px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#4a4a47">
      <tr><td style="padding:4px 0">Сумма товаров</td><td style="padding:4px 0;text-align:right">${money(order.itemsTotal, order.currency)}</td></tr>
      <tr><td style="padding:4px 0">Доставка</td><td style="padding:4px 0;text-align:right">${Number(order.deliveryCost) > 0 ? money(order.deliveryCost, order.currency) : 'по тарифам перевозчика'}</td></tr>
      <tr><td style="padding:10px 0 0;font-size:17px;font-weight:700;color:#1a1a1a;border-top:1px solid #ececea">Итого</td><td style="padding:10px 0 0;text-align:right;font-size:17px;font-weight:700;color:#1a1a1a;border-top:1px solid #ececea">${money(order.total, order.currency)}</td></tr>
    </table>
    <div style="margin-top:14px;font-size:13px;color:#6b6b68">
      Статус заказа: <strong style="color:#1a1a1a">${STATUS_LABELS[order.status] ?? order.status}</strong>
      ${deliveryLine ? `<br/>${esc(deliveryLine)}` : ''}
    </div>
    ${siteUrl ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:20px"><tr><td style="border-radius:8px;background:#1a1a1a"><a href="${siteUrl}/account/orders" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none">Мои заказы</a></td></tr></table>` : ''}
  </td></tr>
  <tr><td style="padding:20px 28px;background:#fafaf8;border-top:1px solid #ececea">
    <p style="margin:0 0 4px;font-size:13px;color:#6b6b68">С уважением, команда <strong style="color:#1a1a1a">${esc(storeName)}</strong></p>
    ${store.phone ? `<p style="margin:0 0 2px;font-size:13px;color:#6b6b68">Телефон: <a href="tel:${store.phone.replace(/[^+\d]/g, '')}" style="color:#6b6b68">${esc(store.phone)}</a></p>` : ''}
    ${store.supportEmail ? `<p style="margin:0 0 2px;font-size:13px;color:#6b6b68">Email: <a href="mailto:${store.supportEmail}" style="color:#6b6b68">${esc(store.supportEmail)}</a></p>` : ''}
    ${siteUrl ? `<p style="margin:0 0 8px;font-size:13px;color:#6b6b68"><a href="${siteUrl}" style="color:#6b6b68">${esc(siteUrl.replace(/^https?:\/\//, ''))}</a></p>` : ''}
    <p style="margin:8px 0 0;font-size:12px;color:#9a9a97">Вы получили это письмо, потому что оформили заказ №${esc(String(order.orderNumber))} в магазине ${esc(storeName)}. Это сервисное уведомление о вашем заказе.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`

  return { subject: `${heading} — ${storeName}`, text, html }
}
