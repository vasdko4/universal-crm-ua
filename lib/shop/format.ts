// Pure formatting helpers usable from both server and client components.
const CURRENCY_SYMBOLS: Record<string, string> = {
  UAH: '\u20b4',
  USD: '$',
  EUR: '\u20ac',
}

export function formatPrice(value: number, currency = 'UAH'): string {
  const rounded = Math.round(value)
  const withSpaces = rounded.toLocaleString('uk-UA').replace(/\u00a0/g, ' ')
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency ?? '\u20b4'
  return `${withSpaces} ${symbol}`
}
