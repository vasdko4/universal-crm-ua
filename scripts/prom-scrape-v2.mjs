// Scrape all PowerFox products from Prom.ua (UK + RU), including
// breadcrumb category paths and product attributes (characteristics).
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

function extractApolloState(html) {
  const i = html.indexOf('window.ApolloCacheState')
  if (i === -1) return null
  const start = html.indexOf('{', i)
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

function getProduct(state) {
  const fc = state?._FAST_CACHE || state || {}
  const key = Object.keys(fc).find((k) => k.startsWith('ProductCardPageQuery'))
  return key ? fc[key]?.result?.product : null
}

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

function parseProduct(p) {
  if (!p) return null
  const images = (p.images || []).filter((im) => typeof im === 'string' && im)
  const breadcrumbs = (p.breadCrumbs?.items || [])
    .filter((b) => b.type === 'categoryListing')
    .map((b) => ({ alias: b.params?.alias || '', caption: b.caption || '' }))
  const attributes = (p.attributes || []).map((a) => ({
    group: a.group || 'Основні',
    name: a.name,
    value: (a.values || []).map((v) => v.value).join(', '),
  }))
  const price = p.hasDiscount ? (p.discountedPrice ?? p.price) : (p.price ?? p.priceOriginal)
  const oldPrice = p.hasDiscount && p.priceOriginal && p.priceOriginal !== price ? p.priceOriginal : null
  return {
    promId: p.id,
    name: p.name || '',
    description: p.descriptionFull || p.descriptionPlain || '',
    price,
    oldPrice,
    sku: p.sku || '',
    inStock: p.presence?.isAvailable !== false,
    images,
    breadcrumbs,
    attributes,
  }
}

let count = 0
const results = []
for (const link of links) {
  const urlUk = `https://prom.ua${link}`
  count++
  if (done.has(urlUk) && done.get(urlUk).nameUk && done.get(urlUk).nameRu) {
    results.push(done.get(urlUk))
    console.log(`[${count}/${links.length}] cached: ${link}`)
    continue
  }
  const htmlUk = await fetchHtml(urlUk)
  const pUk = htmlUk ? parseProduct(getProduct(extractApolloState(htmlUk))) : null
  if (!pUk) {
    console.log(`[${count}/${links.length}] FAILED UK: ${link}`)
    continue
  }
  // RU version: same path without /ua prefix
  const urlRu = `https://prom.ua${link.replace(/^\/ua/, '')}`
  const htmlRu = await fetchHtml(urlRu, 'ru,uk;q=0.8')
  const pRu = htmlRu ? parseProduct(getProduct(extractApolloState(htmlRu))) : null

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
    breadcrumbsRu: pRu?.breadcrumbs || pUk.breadcrumbs,
    attributesUk: pUk.attributes,
  })
  fs.writeFileSync(OUT, JSON.stringify(results, null, 1))
  console.log(`[${count}/${links.length}] ok: ${pUk.name.slice(0, 60)} | bc:${pUk.breadcrumbs.length} attrs:${pUk.attributes.length}`)
  await new Promise((r) => setTimeout(r, 400))
}
fs.writeFileSync(OUT, JSON.stringify(results, null, 1))
console.log(`DONE: ${results.length}/${links.length} products saved to ${OUT}`)
