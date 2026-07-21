import { pool } from '@/lib/db'
import { getAdminUserWithPermission } from '@/lib/session'

export const dynamic = 'force-dynamic'

// Escape a value for CSV: wrap in quotes and double any inner quotes.
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '""'
  const s = String(value).replace(/"/g, '""')
  return `"${s}"`
}

export async function GET() {
  const user = await getAdminUserWithPermission('products')
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { rows } = await pool.query(`
    SELECT
      p.id,
      p.name_uk,
      p.name_ru,
      p.sku,
      p.price,
      p.old_price,
      p.cost_price,
      p.currency,
      p.quantity,
      p.stock_status,
      p.is_visible,
      p.is_in_stock,
      p.is_popular,
      p.views_count,
      p.image,
      p.images,
      p.description_uk,
      p.description_ru,
      p.created_at,
      COALESCE(
        (SELECT string_agg(c.name_ru, ' | ' ORDER BY c.id)
         FROM product_category pc
         JOIN categories c ON c.id = pc.category_id
         WHERE pc.product_id = p.id),
        ''
      ) AS categories,
      COALESCE(
        (SELECT string_agg(ch.name || ': ' || ch.value, '; ' ORDER BY ch.sort_order)
         FROM product_characteristics ch
         WHERE ch.product_id = p.id),
        ''
      ) AS characteristics
    FROM products p
    WHERE p.deleted_at IS NULL
    ORDER BY p.id
  `)

  const header = [
    'ID',
    'Название (укр)',
    'Название (рус)',
    'Артикул',
    'Цена',
    'Старая цена',
    'Цена закупки',
    'Валюта',
    'Остаток',
    'Статус наличия',
    'Видим',
    'В наличии',
    'Популярный',
    'Просмотры',
    'Категории',
    'Характеристики',
    'Главное фото',
    'Все фото',
    'Описание (укр)',
    'Описание (рус)',
    'Создан',
  ]

  const lines = [header.map(csvCell).join(';')]
  for (const r of rows) {
    let images = ''
    try {
      const arr = typeof r.images === 'string' ? JSON.parse(r.images) : r.images
      images = Array.isArray(arr) ? arr.join(' | ') : ''
    } catch {
      images = ''
    }
    lines.push(
      [
        r.id,
        r.name_uk,
        r.name_ru,
        r.sku,
        r.price,
        r.old_price,
        r.cost_price,
        r.currency,
        r.quantity,
        r.stock_status,
        r.is_visible ? 'да' : 'нет',
        r.is_in_stock ? 'да' : 'нет',
        r.is_popular ? 'да' : 'нет',
        r.views_count,
        r.categories,
        r.characteristics,
        r.image,
        images,
        r.description_uk,
        r.description_ru,
        r.created_at ? new Date(r.created_at).toISOString().slice(0, 10) : '',
      ]
        .map(csvCell)
        .join(';'),
    )
  }

  // BOM so Excel opens the file with correct Cyrillic encoding.
  const csv = '\uFEFF' + lines.join('\r\n')
  const date = new Date().toISOString().slice(0, 10)

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="products-export-${date}.csv"`,
    },
  })
}
