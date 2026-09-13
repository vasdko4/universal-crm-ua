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
  parts.push(`${uk ? 'Сума' : 'Сумма'}: ${opts.amount} ${uk ? 'грн' : 'грн'}`)
  return parts.join('\n')
}
