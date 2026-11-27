import { NextResponse, type NextRequest } from 'next/server'
import { sendMail } from '@/lib/mailer'
import { getOrder } from '@/app/actions/orders'
import { getStoreSettingsInternal } from '@/lib/store-settings'
import {
  buildOrderMessage,
  isValidOrderMessageChannel,
  isValidOrderMessageKind,
} from '@/lib/order-messages'
import { csrfCheck } from '@/lib/api/csrf'
import { isRateLimited } from '@/lib/api/rate-limit'
import { getAdminUserWithWritePermission } from '@/lib/session'
import { db } from '@/lib/db'
import { orderHistory } from '@/lib/db/schema'
import { getProductSlugMap } from '@/lib/shop/queries'
import { readJson, parsePositiveInt } from '@/lib/api/helpers'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // CSRF first (audit #5): a cross-site POST from an attacker's page runs
  // with the admin's cookies — refuse a foreign Origin before any auth or
  // DB work. No-Origin requests (non-browser clients) are allowed by the
  // helper.
  const csrf = csrfCheck(req)
  if (csrf) return csrf

  // Was gated only on "is some admin-center user", not on the 'orders'
  // permission — like every other order mutation in app/actions/orders.ts.
  // That let a staff account with e.g. only the 'articles'/'pages' role
  // trigger arbitrary order emails/messenger links for any order.
  const me = await getAdminUserWithWritePermission('orders')
  if (!me) return NextResponse.json({ error: 'Не авторизован' }, { status: 403 })

  const { id } = await params
  const orderId = parsePositiveInt(id)
  if (orderId == null) return NextResponse.json({ error: 'Некорректный id' }, { status: 400 })
  const body = (await readJson<{ channel?: string; kind?: string }>(req)) ?? {}
  // Audit #10: kind/channel arrive unchecked — an unknown kind used to fall
  // through to the 'status' template and an unknown channel to
  // `links[channel] ?? null` while still logging the send as prepared.
  const channel = body.channel ?? 'email'
  const kind = body.kind ?? 'confirmation'
  if (!isValidOrderMessageChannel(channel)) {
    return NextResponse.json({ error: 'Невідомий канал повідомлення' }, { status: 400 })
  }
  if (!isValidOrderMessageKind(kind)) {
    return NextResponse.json({ error: 'Невідомий тип повідомлення' }, { status: 400 })
  }
  // Audit #10: 5/hour per admin+order — manual order emails are a spam
  // vector (and a gateway for harassing a customer) if an admin account
  // is shared or compromised.
  if (await isRateLimited('order-message', `${me.id}:${orderId}`, 5, 3_600_000)) {
    return NextResponse.json({ error: 'Забагато спроб. Спробуйте пізніше.' }, { status: 429 })
  }

  const data = await getOrder(orderId)
  if (!data) return NextResponse.json({ error: 'Заказ не найден' }, { status: 404 })

  const { order, items } = data
  const [storeSettings, productSlugs] = await Promise.all([
    getStoreSettingsInternal(),
    getProductSlugMap(items.map((i) => i.productId)),
  ])
  const msg = buildOrderMessage(
    kind,
    order,
    items,
    {
      storeName: storeSettings.storeName,
      siteUrl: (storeSettings.seo?.siteUrl || '').replace(/\/$/, ''),
      logoUrl: storeSettings.logoUrl,
      phone: storeSettings.contact?.phones?.find(Boolean) ?? null,
      supportEmail: (storeSettings.emailSettings?.fromEmail as string) || null,
    },
    productSlugs,
  )

  // Messenger channels: return a deep link the client can open.
  if (channel !== 'email') {
    const phone = (order.customerPhone ?? '').replace(/[^0-9]/g, '')
    const encoded = encodeURIComponent(msg.text)
    const links: Record<string, string> = {
      viber: `viber://chat?number=%2B${phone}`,
      telegram: `https://t.me/+${phone}`,
      whatsapp: `https://wa.me/${phone}?text=${encoded}`,
      sms: `sms:+${phone}?body=${encoded}`,
    }
    await db.insert(orderHistory).values({
      orderId,
      type: 'message',
      message: `Сообщение (${channel}) подготовлено для отправки`,
      actor: me.name,
    })
    return NextResponse.json({ success: true, link: links[channel] ?? null, text: msg.text })
  }

  // Email channel.
  if (!order.customerEmail) {
    return NextResponse.json({ error: 'У заказа нет email покупателя' }, { status: 400 })
  }

  const settings = storeSettings
  const email = (settings.emailSettings ?? {}) as Record<string, string | boolean>

  if (!email.enabled || !email.smtpHost || !email.smtpUser) {
    return NextResponse.json(
      { error: 'Email не настроен. Откройте Настройки → Почта и подключите отправку.' },
      { status: 400 },
    )
  }

  try {
    // Single mail path (lib/mailer) so anti-spam headers and DMARC-aligned
    // From address apply to manual admin sends too.
    await sendMail({
      to: order.customerEmail,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
    })
    await db.insert(orderHistory).values({
      orderId,
      type: 'message',
      message: `Письмо «${msg.subject}» отправлено на ${order.customerEmail}`,
      actor: me.name,
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    // SMTP internals (host, auth, message text) stay server-side — the
    // admin UI gets only a generic failure.
    console.error('[orders] message send failed:', err)
    return NextResponse.json({ error: 'Не вдалося надіслати лист' }, { status: 500 })
  }
}
