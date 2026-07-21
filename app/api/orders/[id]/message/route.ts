import { NextResponse, type NextRequest } from 'next/server'
import { sendMail } from '@/lib/mailer'
import { getOrder } from '@/app/actions/orders'
import { getStoreSettingsInternal } from '@/lib/store-settings'
import { buildOrderMessage, type OrderMessageKind } from '@/lib/order-messages'
import { getAdminUserWithPermission } from '@/lib/session'
import { db } from '@/lib/db'
import { orderHistory } from '@/lib/db/schema'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Was gated only on "is some admin-center user", not on the 'orders'
  // permission — like every other order mutation in app/actions/orders.ts.
  // That let a staff account with e.g. only the 'articles'/'pages' role
  // trigger arbitrary order emails/messenger links for any order.
  const me = await getAdminUserWithPermission('orders')
  if (!me) return NextResponse.json({ error: 'Не авторизован' }, { status: 403 })

  const { id } = await params
  const orderId = Number.parseInt(id, 10)
  const body = await req.json().catch(() => ({}))
  const channel: string = body.channel ?? 'email'
  const kind: OrderMessageKind = body.kind ?? 'confirmation'

  const data = await getOrder(orderId)
  if (!data) return NextResponse.json({ error: 'Заказ не найден' }, { status: 404 })

  const { order, items } = data
  const storeSettings = await getStoreSettingsInternal()
  const msg = buildOrderMessage(kind, order, items, {
    storeName: storeSettings.storeName,
    siteUrl: (storeSettings.seo?.siteUrl || '').replace(/\/$/, ''),
    logoUrl: storeSettings.logoUrl,
    phone: storeSettings.contact?.phones?.find(Boolean) ?? null,
    supportEmail: (storeSettings.emailSettings?.fromEmail as string) || null,
  })

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
    return NextResponse.json(
      { error: `Ошибка отправки: ${(err as Error).message}` },
      { status: 500 },
    )
  }
}
