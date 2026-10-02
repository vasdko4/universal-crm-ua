export type PublicRequisites = {
  recipientName?: string
  edrpou?: string
  iban?: string
  cardNumber?: string
  cardHolder?: string
}

/** Safe subset of the requisites payment config — never includes extra keys. */
export function publicRequisitesFromConfig(
  cfg: Record<string, unknown> | null | undefined,
): PublicRequisites | null {
  if (!cfg) return null
  const str = (key: string) => {
    const v = cfg[key]
    return typeof v === 'string' && v.trim() ? v.trim() : ''
  }
  const out: PublicRequisites = {}
  const recipientName = str('recipientName')
  const edrpou = str('edrpou')
  const iban = str('iban')
  const cardNumber = str('cardNumber')
  const cardHolder = str('cardHolder')
  if (recipientName) out.recipientName = recipientName
  if (edrpou) out.edrpou = edrpou
  if (iban) out.iban = iban
  if (cardNumber) out.cardNumber = cardNumber
  if (cardHolder) out.cardHolder = cardHolder
  return Object.keys(out).length > 0 ? out : null
}

/**
 * Requisites labels for the customer-facing block, per locale. Single source
 * of truth for both `formatRequisitesPreview` (write time) and
 * `localizeRequisitesBody` (display time).
 */
export const REQUISITES_LABELS = {
  uk: {
    recipient: 'Отримувач',
    edrpou: 'ЄДРПОУ/ІПН',
    card: 'Картка',
    cardHolder: 'Отримувач картки',
    purpose: 'Призначення платежу',
    amount: 'Сума',
    payForOrder: 'оплата замовлення',
  },
  ru: {
    recipient: 'Получатель',
    edrpou: 'ЕГРПОУ/ИНН',
    card: 'Карта',
    cardHolder: 'Получатель карты',
    purpose: 'Назначение платежа',
    amount: 'Сумма',
    payForOrder: 'оплата заказа',
  },
} as const

export function formatRequisitesPreview(
  cfg: PublicRequisites,
  opts: { amount: number; locale: 'uk' | 'ru'; orderNumber?: string },
): string {
  const labels = REQUISITES_LABELS[opts.locale]
  const parts: string[] = []
  if (cfg.recipientName) parts.push(`${labels.recipient}: ${cfg.recipientName}`)
  if (cfg.edrpou) parts.push(`${labels.edrpou}: ${cfg.edrpou}`)
  if (cfg.iban) parts.push(`IBAN: ${cfg.iban}`)
  if (cfg.cardNumber) parts.push(`${labels.card}: ${cfg.cardNumber}`)
  if (cfg.cardHolder) parts.push(`${labels.cardHolder}: ${cfg.cardHolder}`)
  if (opts.orderNumber) {
    parts.push(`${labels.purpose}: ${labels.payForOrder} №${opts.orderNumber}`)
  }
  parts.push(`${labels.amount}: ${opts.amount} ₴`)
  return parts.join('\n')
}

type RequisitesLabelKey = keyof (typeof REQUISITES_LABELS)['uk']

/** Every known label spelling (uk + ru) → its canonical key. */
const KNOWN_REQUISITES_LABELS = new Map<string, RequisitesLabelKey>()
for (const loc of ['uk', 'ru'] as const) {
  for (const [key, label] of Object.entries(REQUISITES_LABELS[loc])) {
    if (key === 'payForOrder') continue
    KNOWN_REQUISITES_LABELS.set(label, key as RequisitesLabelKey)
  }
}

/**
 * Re-render a persisted requisites block's labels in the viewer's locale.
 *
 * The block is frozen into `order.note` at checkout in the checkout locale,
 * so a shopper who later switches language (or an order placed in `ru`)
 * would otherwise see Russian labels under a Ukrainian UI. Values
 * (names, IBAN, amounts) are never touched — only the known label prefixes.
 * Unknown lines pass through unchanged.
 */
export function localizeRequisitesBody(body: string, locale: 'uk' | 'ru'): string {
  const labels = REQUISITES_LABELS[locale]
  return body
    .split('\n')
    .map((line) => {
      const idx = line.indexOf(':')
      if (idx === -1) return line
      const key = KNOWN_REQUISITES_LABELS.get(line.slice(0, idx).trim())
      if (!key) return line
      let value = line.slice(idx + 1)
      if (key === 'purpose') {
        value = value.replace(/оплата замовлення|оплата заказа/, labels.payForOrder)
      }
      return `${labels[key]}:${value}`
    })
    .join('\n')
}

export const REQUISITES_NOTE_PREFIX_UK = 'Реквізити для оплати'
export const REQUISITES_NOTE_PREFIX_RU = 'Реквизиты для оплаты'

export function formatRequisitesNote(requisites: string, locale: 'uk' | 'ru'): string {
  const prefix = locale === 'ru' ? REQUISITES_NOTE_PREFIX_RU : REQUISITES_NOTE_PREFIX_UK
  return `${prefix}:\n${requisites}`
}

/** Keep bank details and the shopper's checkout comment in the same column. */
export function composeCheckoutNote(
  requisitesNote: string | undefined,
  customerNote: string | null | undefined,
): string | null {
  const parts = [requisitesNote?.trim(), customerNote?.trim()].filter(Boolean)
  return parts.length > 0 ? parts.join('\n\n') : null
}

export function noteLooksLikeRequisites(note: string | null | undefined): boolean {
  return Boolean(
    note?.startsWith(`${REQUISITES_NOTE_PREFIX_UK}:`) ||
      note?.startsWith(`${REQUISITES_NOTE_PREFIX_RU}:`),
  )
}

/**
 * Split a persisted order.note into the bank-requisites block (if any) and
 * the remaining customer/admin comment. Requisites are always the leading
 * prefixed paragraph; a blank line separates them from the shopper's note.
 */
export function splitOrderNote(note: string | null | undefined): {
  requisites: string | null
  comment: string | null
} {
  if (!note?.trim()) return { requisites: null, comment: null }
  if (!noteLooksLikeRequisites(note)) return { requisites: null, comment: note.trim() }
  const sep = note.indexOf('\n\n')
  if (sep === -1) return { requisites: note.trim(), comment: null }
  const requisites = note.slice(0, sep).trim()
  const comment = note.slice(sep + 2).trim()
  return { requisites: requisites || null, comment: comment || null }
}

/** Body of the requisites block without the locale prefix — for copy/email. */
export function requisitesBody(note: string | null | undefined): string {
  const { requisites } = splitOrderNote(note)
  if (!requisites) return ''
  return requisites
    .replace(new RegExp(`^${REQUISITES_NOTE_PREFIX_UK}:\\n`), '')
    .replace(new RegExp(`^${REQUISITES_NOTE_PREFIX_RU}:\\n`), '')
}
