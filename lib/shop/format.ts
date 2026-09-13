// Pure formatting helpers usable from both server and client components.
const CURRENCY_SYMBOLS: Record<string, string> = {
  UAH: '₴',
  USD: '$',
  EUR: '€',
}

function numberLocale(locale?: string): string {
  return locale === 'ru' || locale === 'ru-RU' ? 'ru-RU' : 'uk-UA'
}

export function formatPrice(value: number, currency = 'UAH', locale: string = 'uk'): string {
  const rounded = Math.round(value)
  const withSpaces = rounded.toLocaleString(numberLocale(locale)).replace(/\u00a0/g, ' ')
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency ?? '₴'
  return `${withSpaces} ${symbol}`
}
