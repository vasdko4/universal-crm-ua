import { sanitizeSearch } from '@/lib/api/helpers'

/**
 * Split a shopper query into AND-tokens.
 * One-character fragments are dropped when a longer token exists, so
 * "ролики 29" still matches, while a lone "24" remains searchable.
 */
export function searchTokens(raw: string): string[] {
  const cleaned = sanitizeSearch(raw).trim()
  if (!cleaned) return []
  const parts = cleaned.split(/\s+/).filter(Boolean)
  const long = parts.filter((t) => t.length >= 2)
  const chosen = long.length > 0 ? long : parts
  return chosen.slice(0, 5)
}

export type CharFilter = { name: string; value: string }

/** Facet keys we surface (Prom attributes). Matched case-insensitively. */
export const FACET_KEYS = [
  'розмір',
  'размер',
  'size',
  'напруга',
  'напряжение',
  'voltage',
  'бренд',
  'brand',
  'виробник',
  'производитель',
  'колір',
  'цвет',
  'color',
  'потужність',
  'мощность',
  'матеріал',
  'материал',
] as const

const FACET_LABEL_UK: Record<string, string> = {
  розмір: 'Розмір',
  размер: 'Розмір',
  size: 'Розмір',
  напруга: 'Напруга',
  напряжение: 'Напруга',
  voltage: 'Напруга',
  бренд: 'Бренд',
  brand: 'Бренд',
  виробник: 'Бренд',
  производитель: 'Бренд',
  колір: 'Колір',
  цвет: 'Колір',
  color: 'Колір',
  потужність: 'Потужність',
  мощность: 'Потужність',
  матеріал: 'Матеріал',
  материал: 'Матеріал',
}

const FACET_LABEL_RU: Record<string, string> = {
  розмір: 'Размер',
  размер: 'Размер',
  size: 'Размер',
  напруга: 'Напряжение',
  напряжение: 'Напряжение',
  voltage: 'Напряжение',
  бренд: 'Бренд',
  brand: 'Бренд',
  виробник: 'Бренд',
  производитель: 'Бренд',
  колір: 'Цвет',
  цвет: 'Цвет',
  color: 'Цвет',
  потужність: 'Мощность',
  мощность: 'Мощность',
  матеріал: 'Материал',
  материал: 'Материал',
}

export function facetLabel(name: string, locale: 'uk' | 'ru' = 'uk'): string {
  const key = name.trim().toLowerCase()
  const map = locale === 'ru' ? FACET_LABEL_RU : FACET_LABEL_UK
  return map[key] ?? name
}

export function isFacetKey(name: string): boolean {
  return FACET_KEYS.includes(name.trim().toLowerCase() as (typeof FACET_KEYS)[number])
}

/** URL form: `Розмір:29-33,34-37;Бренд:Bosch` (values comma-separated per name). */
export function parseCharFilters(raw: string | string[] | undefined | null): CharFilter[] {
  const chunks = Array.isArray(raw) ? raw : raw ? [raw] : []
  const out: CharFilter[] = []
  const seen = new Set<string>()
  for (const chunk of chunks) {
    const cleaned = sanitizeSearch(chunk).slice(0, 400)
    if (!cleaned) continue
    for (const group of cleaned.split(';')) {
      const idx = group.indexOf(':')
      if (idx <= 0) continue
      const name = group.slice(0, idx).trim()
      if (!name || !isFacetKey(name)) continue
      for (const value of group.slice(idx + 1).split(',')) {
        const v = value.trim()
        if (!v) continue
        const key = `${name.toLowerCase()}\0${v.toLowerCase()}`
        if (seen.has(key)) continue
        seen.add(key)
        out.push({ name, value: v })
        if (out.length >= 12) return out
      }
    }
  }
  return out
}

export function serializeCharFilters(filters: CharFilter[]): string {
  const byName = new Map<string, string[]>()
  for (const f of filters) {
    const list = byName.get(f.name) ?? []
    list.push(f.value)
    byName.set(f.name, list)
  }
  return [...byName.entries()].map(([name, values]) => `${name}:${values.join(',')}`).join(';')
}

export type CatalogFacetValue = { value: string; count: number }
export type CatalogFacet = { name: string; values: CatalogFacetValue[] }
