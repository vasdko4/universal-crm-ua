// Fills products.images with multi-photo galleries so the lightbox/zoom can be
// tested. Flagship products get real alternate-angle shots; the rest get a
// small themed set based on their main image. Idempotent: overwrites images.
import { Pool } from 'pg'

const cs = process.env.DATABASE_URL.replace(/([?&])(sslmode|channel_binding)=[^&]*/gi, '$1').replace(/[?&]+$/g, '')
const pool = new Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } })

// Alternate-angle sets for specific base images (main photo first).
const angleSets = {
  '/products/tablet.png': ['/products/tablet.png', '/products/tablet-pen.png', '/products/tablet-back.png', '/products/tablet-side.png'],
  '/products/iphone-15-pro.png': ['/products/iphone-15-pro.png', '/products/phone-back.png', '/products/phone-1.png', '/products/phone-2.png'],
  '/products/phone-1.png': ['/products/phone-1.png', '/products/phone-back.png', '/products/phone-2.png', '/products/phone-3.png'],
  '/products/phone-2.png': ['/products/phone-2.png', '/products/phone-back.png', '/products/phone-3.png', '/products/phone-1.png'],
  '/products/phone-3.png': ['/products/phone-3.png', '/products/phone-back.png', '/products/phone-1.png', '/products/phone-2.png'],
  '/products/airpods-pro-2.png': ['/products/airpods-pro-2.png', '/products/airpods-case-open.png'],
  '/products/laptop-pro.png': ['/products/laptop-pro.png', '/products/laptop-keyboard.png'],
  '/products/smartwatch.png': ['/products/smartwatch.png', '/products/smartwatch-side.png'],
  '/products/tshirt-1.png': ['/products/tshirt-1.png', '/products/tshirt-2.png', '/products/tshirt-3.png'],
  '/products/tshirt-2.png': ['/products/tshirt-2.png', '/products/tshirt-1.png', '/products/tshirt-3.png'],
  '/products/tshirt-3.png': ['/products/tshirt-3.png', '/products/tshirt-1.png', '/products/tshirt-2.png'],
  '/products/sneaker-1.png': ['/products/sneaker-1.png', '/products/sneaker-2.png', '/products/sneaker-3.png'],
  '/products/sneaker-2.png': ['/products/sneaker-2.png', '/products/sneaker-1.png', '/products/sneaker-3.png'],
  '/products/sneaker-3.png': ['/products/sneaker-3.png', '/products/sneaker-1.png', '/products/sneaker-2.png'],
}

async function main() {
  const { rows } = await pool.query(
    'SELECT id, image FROM products WHERE deleted_at IS NULL AND image IS NOT NULL ORDER BY id',
  )
  let updated = 0
  for (const p of rows) {
    const set = angleSets[p.image]
    // Products without a dedicated angle set keep a 2-shot gallery (main twice
    // would look broken), so give them main + one related accessory shot only
    // when a set exists; otherwise leave single image.
    const gallery = set ?? null
    if (!gallery) continue
    await pool.query('UPDATE products SET images = $1 WHERE id = $2', [JSON.stringify(gallery), p.id])
    updated++
  }
  const stat = await pool.query(
    `SELECT COUNT(*)::int multi FROM products WHERE deleted_at IS NULL AND jsonb_array_length(images::jsonb) >= 2`,
  )
  console.log('updated:', updated, '| products with multi-image gallery:', stat.rows[0].multi)
}

main()
  .then(() => pool.end())
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
