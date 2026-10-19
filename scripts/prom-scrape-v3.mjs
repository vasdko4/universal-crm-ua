// Scrape products from the Prom.ua custom-domain storefront (powerfox.shop).
//
// Why v3: prom-scrape-v2.mjs fetched https://prom.ua/ua/<path> and relied on
// window.ApolloCacheState. That no longer works — the new /product/<slug> URLs
// 404 on prom.ua and carry no Apollo state. This version reads powerfox.shop
// directly:
//   UK: https://powerfox.shop/product/<slug>
//   RU: https://powerfox.shop/ru/product/<slug>
// Data sources per page: JSON-LD (Product + BreadcrumbList), the description
// tabpanel HTML, and the React Flight "product" object (id/price/oldPrice/inStock).
// Product characteristics are NOT server-rendered on the new storefront, so
// attributesUk is always [] (the importer treats it as optional).
//
// prom-links.txt: one path per line, format /ua/product/<slug>
// Output schema matches prom-scrape-v2.mjs so prom-import-v2.mjs works unchanged.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

const links = fs
  .readFileSync(path.join(__dirname, 'prom-links.txt'), 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter(Boolean)

const OUT = path.join(__dirname, 'prom-products-v2.json')
const existing = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : []
const done = new Map(existing.map((p) => [p.urlUk, p]))

async function fetchHtml(url, lang = 'uk,ru;q=0.9') {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': lang } })
      if (res.ok) return await res.text()
      if (res.status === 404) return null
    } catch {}
    await new Promise((r) => setTimeout(r, 1500 * attempt))
  }
  return null
}

// The RSC payload escapes quotes/angle brackets; normalize before regex parsing.
function cleanHtml(html) {
  return html
    .replace(/\\u003c/gi, '<')
    .replace(/\\u003e/gi, '>')
    .replace(/\\u0026/gi, '&')
    .replace(/\\"/g, '"')
}

function extractLd(html) {
  const out = {}
  const re = /<script type="application\/ld\+json">(.*?)<\/script>/gs
  let m
  while ((m = re.exec(html))) {
    try {
      const data = JSON.parse(m[1])
      for (const d of Array.isArray(data) ? data : [data]) {
        if (d['@type'] === 'Product') out.product = d
        else if (d['@type'] === 'BreadcrumbList') out.bc = d
      }
    } catch {}
  }
  return out
}

function extractPayload(html) {
  const m = html.match(
    /"product":\{"id":(\d+),.*?"price":(\d+),"oldPrice":(null|\d+),"currency":"([A-Z]+)".*?"inStock":(true|false),"stockStatus":"([^"]*)"/
  )
  if (!m) return null
  return {
    id: m[1],
    price: Number(m[2]),
    oldPrice: m[3] === 'null' ? null : Number(m[3]),
    currency: m[4],
    inStock: m[5] === 'true',
    stockStatus: m[6],
  }
}

function extractDescription(html, ldProduct) {
  const m = html.match(/content-description"[^>]*><div class="prose[^>]*>([\s\S]*?)<\/div><\/div>/)
  if (m && textLength(m[1].trim()) > 50) return m[1].trim()
  return ldProduct?.description || ''
}

// Visible-text length without regex tag-stripping: single pass, skipping
// everything between < and >. This is only a length heuristic, NOT a
// sanitizer — product HTML is sanitized at render time by
// lib/shop/sanitize.ts (sanitize-html), so a regex-based strip here would
// be both misleading and flagged as incomplete sanitization.
function textLength(html) {
  let len = 0
  let inTag = false
  for (const ch of html) {
    if (ch === '<') inTag = true
    else if (ch === '>') inTag = false
    else if (!inTag) len++
  }
  return len
}

function extractBreadcrumbs(ldBc) {
  const items = ldBc?.itemListElement || []
  // drop "Головна"/"Каталог" and the product itself -> category path only
  return items.slice(2, -1).map((b) => {
    const url = b.item || ''
    const cm = url.match(/\/category\/([a-z0-9\-_]+)/i)
    return { alias: cm ? cm[1] : '', caption: b.name || '' }
  })
}

function parsePage(html) {
  if (!html) return null
  // NOTE: JSON-LD must be parsed from the RAW html — cleanHtml() would corrupt
  // legitimate \" escapes inside it and break JSON.parse.
  const { product, bc } = extractLd(html)
  if (!product) return null
  const clean = cleanHtml(html)
  const payload = extractPayload(clean)
  const images = (product.image || []).filter((u) => typeof u === 'string' && u)
  const price = Number(product.offers?.price ?? payload?.price ?? 0)
  let oldPrice = payload?.oldPrice ?? null
  if (oldPrice && oldPrice === price) oldPrice = null
  const inStock =
    typeof product.offers?.availability === 'string'
      ? product.offers.availability.includes('InStock')
      : (payload?.inStock ?? true)
  return {
    promId: payload?.id || null,
    name: product.name || '',
    description: extractDescription(clean, product),
    price,
    oldPrice,
    sku: product.sku || '',
    inStock,
    images,
    breadcrumbs: extractBreadcrumbs(bc),
  }
}

let count = 0
const results = []
for (const link of links) {
  const slug = link.replace(/^\/ua\/product\//, '').replace(/^\//, '')
  const urlUk = `https://powerfox.shop/product/${slug}`
  count++
  if (done.has(urlUk) && done.get(urlUk).nameUk && done.get(urlUk).nameRu) {
    results.push(done.get(urlUk))
    console.log(`[${count}/${links.length}] cached: ${slug.slice(0, 50)}`)
    continue
  }
  const pUk = parsePage(await fetchHtml(urlUk))
  if (!pUk) {
    console.log(`[${count}/${links.length}] FAILED UK: ${slug.slice(0, 50)}`)
    continue
  }
  const urlRu = `https://powerfox.shop/ru/product/${slug}`
  const pRu = parsePage(await fetchHtml(urlRu, 'ru,uk;q=0.8'))

  results.push({
    urlUk,
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
    breadcrumbsRu: pRu?.breadcrumbs?.length ? pRu.breadcrumbs : pUk.breadcrumbs,
    attributesUk: [],
  })
  fs.writeFileSync(OUT, JSON.stringify(results, null, 1))
  console.log(
    `[${count}/${links.length}] ok: ${pUk.name.slice(0, 55)} | ${pUk.price} UAH` +
      (pUk.oldPrice ? ` (was ${pUk.oldPrice})` : '') +
      ` | img:${pUk.images.length} bc:${pUk.breadcrumbs.length}`
  )
  await new Promise((r) => setTimeout(r, 500))
}
fs.writeFileSync(OUT, JSON.stringify(results, null, 1))
console.log(`DONE: ${results.length}/${links.length} products saved to ${OUT}`)
