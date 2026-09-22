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

export function formatRequisitesPreview(
  cfg: PublicRequisites,
  opts: { amount: number; locale: 'uk' | 'ru'; orderNumber?: string },
): string {
  const uk = opts.locale !== 'ru'
  const parts: string[] = []
  if (cfg.recipientName) parts.push(`${uk ? 'Отримувач' : 'Получатель'}: ${cfg.recipientName}`)
  if (cfg.edrpou) parts.push(`${uk ? 'ЄДРПОУ/ІПН' : 'ЕГРПОУ/ИНН'}: ${cfg.edrpou}`)
  if (cfg.iban) parts.push(`IBAN: ${cfg.iban}`)
  if (cfg.cardNumber) parts.push(`${uk ? 'Картка' : 'Карта'}: ${cfg.cardNumber}`)
  if (cfg.cardHolder) parts.push(`${uk ? 'Отримувач картки' : 'Получатель карты'}: ${cfg.cardHolder}`)
  if (opts.orderNumber) {
    parts.push(
      `${uk ? 'Призначення платежу' : 'Назначение платежа'}: ${uk ? 'оплата замовлення' : 'оплата заказа'} №${opts.orderNumber}`,
    )
  }
  parts.push(`${uk ? 'Сума' : 'Сумма'}: ${opts.amount} ₴`)
  return parts.join('\n')
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
