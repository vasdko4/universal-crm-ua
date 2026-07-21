// Full re-import of PowerFox products from prom-products-v2.json:
// hierarchical categories (from breadcrumbs), characteristics (from attributes).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const products = JSON.parse(fs.readFileSync(path.join(__dirname, 'prom-products-v2.json'), 'utf8'))
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

function slugify(s) {
  const map = {
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

const client = await pool.connect()
try {
  await client.query('BEGIN')

  // Wipe previous imported data
  await client.query('DELETE FROM product_characteristics')
  await client.query('DELETE FROM product_category')
  await client.query('DELETE FROM product_variants')
  await client.query('DELETE FROM products')
  await client.query('DELETE FROM categories')

  // 1) Build hierarchical categories from breadcrumbs
  // key: full path joined by '>' -> { id }
  const catByPath = new Map()
  let sortOrder = 0
  async function ensureCategoryPath(bcUk, bcRu) {
    let parentId = null
    let pathKey = ''
    let lastId = null
    for (let i = 0; i < bcUk.length; i++) {
      const nameUk = bcUk[i].caption
      const nameRu = bcRu[i]?.caption || nameUk
      pathKey = pathKey ? `${pathKey}>${nameUk}` : nameUk
      if (catByPath.has(pathKey)) {
        lastId = catByPath.get(pathKey)
        parentId = lastId
        continue
      }
      const slug = slugify(bcUk[i].alias || nameUk) || `cat-${sortOrder}`
      const res = await client.query(
        `INSERT INTO categories (name_uk, name_ru, slug, parent_id, is_visible, sort_order)
         VALUES ($1, $2, $3, $4, true, $5) RETURNING id`,
        [nameUk, nameRu, slug, parentId, sortOrder++]
      )
      lastId = res.rows[0].id
      catByPath.set(pathKey, lastId)
      parentId = lastId
    }
    return lastId // deepest category id
  }

  // 2) Insert products
  let inserted = 0
  for (const p of products) {
    const leafCatId = p.breadcrumbsUk?.length
      ? await ensureCategoryPath(p.breadcrumbsUk, p.breadcrumbsRu || [])
      : null

    const res = await client.query(
      `INSERT INTO products
        (name_uk, name_ru, description_uk, description_ru, sku, price, old_price, currency,
         quantity, stock_status, image, images, is_visible, is_in_stock, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'UAH',$8,$9,$10,$11,true,$12,$13)
       RETURNING id`,
      [
        p.nameUk,
        p.nameRu,
        p.descriptionUk,
        p.descriptionRu,
        p.sku || null,
        p.price ?? 0,
        p.oldPrice,
        p.inStock ? 100 : 0,
        p.inStock ? 'В наличии' : 'Нет в наличии',
        p.images[0] || null,
        JSON.stringify(p.images),
        p.inStock,
        inserted,
      ]
    )
    const productId = res.rows[0].id

    // Link product to its leaf category AND all ancestors
    if (leafCatId) {
      const ancestors = []
      let cur = leafCatId
      while (cur) {
        ancestors.push(cur)
        const r = await client.query('SELECT parent_id FROM categories WHERE id = $1', [cur])
        cur = r.rows[0]?.parent_id || null
      }
      for (const catId of ancestors) {
        await client.query(
          'INSERT INTO product_category (product_id, category_id) VALUES ($1, $2)',
          [productId, catId]
        )
      }
    }

    // Characteristics
    let attrOrder = 0
    for (const a of p.attributesUk || []) {
      if (!a.name || !a.value) continue
      await client.query(
        `INSERT INTO product_characteristics (product_id, name, value, sort_order)
         VALUES ($1, $2, $3, $4)`,
        [productId, a.name, a.value, attrOrder++]
      )
    }

    inserted++
  }

  await client.query('COMMIT')
  console.log(`IMPORTED: ${inserted} products, ${catByPath.size} categories`)
} catch (e) {
  await client.query('ROLLBACK')
  console.error('FAILED:', e.message)
  process.exitCode = 1
} finally {
  client.release()
  await pool.end()
}
