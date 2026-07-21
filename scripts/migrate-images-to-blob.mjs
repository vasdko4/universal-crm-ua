/**
 * One-off migration: download every external (images.prom.ua) product image,
 * upload it to Vercel Blob and rewrite the URLs in `products.images` and
 * `order_items.image`. Idempotent: skips URLs already on blob storage.
 *
 * Run: node --env-file=.env.development.local scripts/migrate-images-to-blob.mjs
 */
import pg from 'pg'
import { put } from '@vercel/blob'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

const EXTERNAL = /^https?:\/\//
const isBlob = (u) => /\.blob\.vercel-storage\.com\//.test(u)

/** url -> new blob url (cache so the same image is only uploaded once) */
const migrated = new Map()
let uploaded = 0
let failed = 0

async function migrateUrl(url) {
  if (!url || !EXTERNAL.test(url) || isBlob(url)) return url
  if (migrated.has(url)) return migrated.get(url)
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(20_000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PowerFoxBot/1.0)' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 100) throw new Error('empty body')
    const ct = res.headers.get('content-type') || 'image/jpeg'
    const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg'
    const name = url.split('/').pop()?.split('?')[0]?.replace(/[^\w.-]/g, '') || 'img'
    const blob = await put(`products/${name.replace(/\.\w+$/, '')}.${ext}`, buf, {
      access: 'public',
      contentType: ct,
      addRandomSuffix: true,
    })
    migrated.set(url, blob.url)
    uploaded++
    return blob.url
  } catch (e) {
    failed++
    console.log('FAIL:', url.slice(0, 90), '->', e.message)
    migrated.set(url, url) // keep original on failure
    return url
  }
}

// 1) Products.images (jsonb array of urls)
const { rows: products } = await pool.query(
  `SELECT id, images FROM products WHERE images::text LIKE '%http%'`,
)
console.log('Products with external images:', products.length)

let done = 0
for (const p of products) {
  const imgs = Array.isArray(p.images) ? p.images : []
  const next = []
  for (const u of imgs) next.push(await migrateUrl(u))
  if (JSON.stringify(next) !== JSON.stringify(imgs)) {
    await pool.query(`UPDATE products SET images = $1::jsonb WHERE id = $2`, [
      JSON.stringify(next),
      p.id,
    ])
  }
  done++
  if (done % 25 === 0) console.log(`...products ${done}/${products.length} (uploaded ${uploaded}, failed ${failed})`)
}

// 2) order_items.image (single url)
const { rows: items } = await pool.query(
  `SELECT id, image FROM order_items WHERE image LIKE 'http%'`,
)
console.log('Order items with external images:', items.length)
for (const it of items) {
  const next = await migrateUrl(it.image)
  if (next !== it.image) {
    await pool.query(`UPDATE order_items SET image = $1 WHERE id = $2`, [next, it.id])
  }
}

console.log(`DONE. uploaded=${uploaded} failed=${failed} unique=${migrated.size}`)
await pool.end()
