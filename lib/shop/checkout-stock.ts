/**
 * Pure stock math used by checkout / fulfillment. Extracted so the
 * "don't go negative, flag oversold" rule is unit-testable without a DB.
 */
export type StockLine = {
  onHand: number
  requested: number
  name: string
  variantLabel?: string | null
}

export type StockApplyResult = {
  nextOnHand: number
  fulfilled: number
  oversold: boolean
}

export function applyStockLine(line: StockLine): StockApplyResult {
  const onHand = Math.max(0, Math.floor(line.onHand))
  const requested = Math.max(0, Math.floor(line.requested))
  if (requested <= onHand) {
    return { nextOnHand: onHand - requested, fulfilled: requested, oversold: false }
  }
  return { nextOnHand: 0, fulfilled: onHand, oversold: true }
}

export function checkoutStockError(line: StockLine): string | null {
  if (line.requested < 1) return 'invalid quantity'
  if (line.onHand < line.requested) {
    const label = line.variantLabel ? ` (${line.variantLabel})` : ''
    return `${line.name}${label}`
  }
  return null
}
