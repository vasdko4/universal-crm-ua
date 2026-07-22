// Scrapes a Prom.ua seller's storefront (all products, photos, descriptions,
// categories, characteristics) directly from the public HTML — Prom.ua's
// Next-like frontend embeds the full page data as `window.ApolloCacheState`,
// so no login/API key is needed. Ported from the one-off
// scripts/prom-scrape-v2.mjs + prom-import-v2.mjs used to seed this store's
// own demo catalog from https://prom.ua/c4207182-powerfox.html, generalized
// to work for any Prom.ua shop URL.
//
// Two query shapes matter:
//  - CompanyListingQuery on the shop's catalog page (`?page=N`): gives a
//    paginated list of ProductItem summaries (id, urlText, price, image...)
//    and the shop's total product count.
//  - ProductCardPageQuery on an individual product page: gives the full
//    description, image gallery, breadcrumb category path and attributes
//    (characteristics) — the listing summary doesn't include these.

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

export type PromListItem = { id: number; urlText: string }

// One sibling of a size/color choice group, e.g. the "XL" or "Blue" listing
// of the same shirt — each is a *separate* Prom.ua product id, not an
// attribute on the page we fetched.
export type PromVariationItem = {
  promId: number
  inStock: boolean
  attributes: { name: string; value: string }[]
}

export type PromProduct = {
  promId: number
  nameUk: string
  nameRu: string
  descriptionUk: string
  descriptionRu: string
  price: number | null
  oldPrice: number | null
  sku: string
  inStock: boolean
  images: string[]
  breadcrumbsUk: { alias: string; caption: string }[]
  breadcrumbsRu: { alias: string; caption: string }[]
  attributesUk: { group: string; name: string; value: string }[]
  // Sibling size/color choices for this product (from ProductVariationQuery),
  // excluding this product itself. Empty when the product has no variants.
  variationItems: PromVariationItem[]
}

/** Fetch a URL as a signed-out browser would, following redirects, with retries. */
async function fetchHtml(url: string, lang = 'uk,ru;q=0.9'): Promise<{ html: string; finalUrl: string } | null> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': USER_AGENT, 'accept-language': lang },
        redirect: 'follow',
      })
      if (res.ok) return { html: await res.text(), finalUrl: res.url }
      if (res.status === 404) return null
    } catch {
      // fall through to retry
    }
    await new Promise((r) => setTimeout(r, 1200 * attempt))
  }
  return null
}

/** Extracts the `window.ApolloCacheState = {...}` object embedded in a Prom.ua page. */
function extractApolloState(html: string): Record<string, unknown> | null {
  const i = html.indexOf('window.ApolloCacheState')
  if (i === -1) return null
  const start = html.indexOf('{', i)
  if (start === -1) return null
  let depth = 0
  let inStr = false
  let esc = false
  for (let j = start; j < html.length; j++) {
    const c = html[j]
    if (inStr) {
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') inStr = true
    else if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, j + 1))
        } catch {
          return null
        }
      }
    }
  }
  return null
}

function fastCache(state: Record<string, unknown>): Record<string, any> {
  return (state as any)._FAST_CACHE ?? state
}

/** Reads one page of a shop's catalog listing (CompanyListingQuery). */
export async function fetchListingPage(
  url: string,
): Promise<{ items: PromListItem[]; total: number; finalUrl: string } | null> {
  const fetched = await fetchHtml(url)
  if (!fetched) return null
  const state = extractApolloState(fetched.html)
  if (!state) return null
  const fc = fastCache(state)
  const key = Object.keys(fc).find((k) => k.startsWith('CompanyListingQuery'))
  if (!key) return null
  const page = fc[key]?.result?.listing?.page
  const rawProducts: any[] = page?.products ?? []
  const items: PromListItem[] = rawProducts
    .map((p) => p?.product)
    .filter((p) => p && typeof p.id === 'number' && typeof p.urlText === 'string')
    .map((p) => ({ id: p.id, urlText: p.urlText }))
  return { items, total: Number(page?.total ?? items.length), finalUrl: fetched.finalUrl }
}

/** Builds the next page URL for a shop catalog page (Prom.ua uses `?page=N`, 1-based). */
export function withPage(url: string, page: number): string {
  const u = new URL(url)
  u.searchParams.set('page', String(page))
  return u.toString()
}

function getProductCard(state: Record<string, unknown>) {
  const fc = fastCache(state)
  const key = Object.keys(fc).find((k) => k.startsWith('ProductCardPageQuery'))
  return key ? fc[key]?.result?.product : null
}

// Reads the size/color siblings from `window.ApolloCacheState`'s
// ProductVariationQuery, embedded on every product page that has a choice
// (e.g. clothing sizes). Each sibling is its own Prom.ua product id with its
// own `presence.isAvailable` — the base ProductCardPageQuery only reflects
// stock for the *one* size/color that happened to be fetched, which is why
// products with a choice looked "out of stock" when just one variant was.
function getVariationItems(state: Record<string, unknown>): PromVariationItem[] {
  const fc = fastCache(state)
  const key = Object.keys(fc).find((k) => k.startsWith('ProductVariationQuery'))
  const items: any[] = key ? fc[key]?.result?.variationItems ?? [] : []
  return items
    .map((it) => {
      const product = it?.productItem?.product
      if (!product || typeof product.id !== 'number') return null
      const attributes = (it.attributes || [])
        .filter((a: any) => a?.name)
        .map((a: any) => ({
          name: a.name as string,
          value: (a.values || []).map((v: any) => v.value).join(', '),
        }))
      return {
        promId: product.id as number,
        inStock: product.presence?.isAvailable !== false,
        attributes,
      }
    })
    .filter((v): v is PromVariationItem => v !== null)
}

function parseProductCard(p: any) {
  if (!p) return null
  const images: string[] = (p.images || []).filter((im: unknown) => typeof im === 'string' && im)
  const breadcrumbs = (p.breadCrumbs?.items || [])
    .filter((b: any) => b.type === 'categoryListing')
    .map((b: any) => ({ alias: b.params?.alias || '', caption: b.caption || '' }))
  const attributes = (p.attributes || []).map((a: any) => ({
    group: a.group || 'Основні',
    name: a.name,
    value: (a.values || []).map((v: any) => v.value).join(', '),
  }))
  const price = p.hasDiscount ? (p.discountedPrice ?? p.price) : (p.price ?? p.priceOriginal)
  const oldPrice = p.hasDiscount && p.priceOriginal && p.priceOriginal !== price ? p.priceOriginal : null
  return {
    promId: p.id as number,
    name: (p.name || '') as string,
    description: (p.descriptionFull || p.descriptionPlain || '') as string,
    price: price != null ? Number(price) : null,
    oldPrice: oldPrice != null ? Number(oldPrice) : null,
    sku: (p.sku || '') as string,
    inStock: p.presence?.isAvailable !== false,
    images,
    breadcrumbs,
    attributes,
  }
}

/** Product path as used on listing pages, e.g. `/ua/p3064633501-slug.html`. */
export function productPath(item: PromListItem): string {
  return `/ua/p${item.id}-${item.urlText}.html`
}

/**
 * Fetches one product's full detail (uk + ru) by its listing item. Returns
 * null if the uk page couldn't be loaded/parsed (ru falls back to uk).
 */
export async function fetchProduct(origin: string, item: PromListItem): Promise<PromProduct | null> {
  const urlUk = `${origin}${productPath(item)}`
  const fetchedUk = await fetchHtml(urlUk)
  const stateUk = fetchedUk ? extractApolloState(fetchedUk.html) : null
  const pUk = stateUk ? parseProductCard(getProductCard(stateUk)) : null
  if (!pUk) return null
  const variationItems = stateUk ? getVariationItems(stateUk).filter((v) => v.promId !== pUk.promId) : []

  const urlRu = `${origin}${productPath(item).replace(/^\/ua/, '')}`
  const fetchedRu = await fetchHtml(urlRu, 'ru,uk;q=0.8')
  const pRu = fetchedRu ? parseProductCard(getProductCard(extractApolloState(fetchedRu.html) ?? {})) : null

  return {
    promId: pUk.promId,
    nameUk: pUk.name,
    nameRu: pRu?.name || pUk.name,
    descriptionUk: pUk.description,
    descriptionRu: pRu?.description || pUk.description,
    price: pUk.price,
    oldPrice: pUk.oldPrice,
    sku: pUk.sku,
    inStock: pUk.inStock,
    images: pUk.images,
    breadcrumbsUk: pUk.breadcrumbs,
    breadcrumbsRu: pRu?.breadcrumbs || pUk.breadcrumbs,
    attributesUk: pUk.attributes,
    variationItems,
  }
}

/** Ukrainian-aware slugify, matching scripts/prom-import-v2.mjs so re-imports stay consistent. */
export function slugify(s: string): string {
  const map: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh', з: 'z',
    и: 'y', і: 'i', ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p',
    р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh',
    щ: 'shch', ь: '', ю: 'iu', я: 'ia', ы: 'y', э: 'e', ё: 'e', ъ: '',
  }
  return s
    .toLowerCase()
    .split('')
    .map((c) => map[c] ?? c)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200)
}
