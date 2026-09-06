import { NextResponse } from 'next/server'
import { getCatalogProducts } from '@/lib/shop/queries'
import { localeFromRequest } from '@/lib/i18n/request-locale'
import { sanitizeSearch } from '@/lib/api/helpers'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = sanitizeSearch(searchParams.get('q') ?? '').trim().slice(0, 100)

  if (q.length < 2) {
    return NextResponse.json({ items: [], total: 0 })
  }

  const locale = localeFromRequest(request)
  const { items, total } = await getCatalogProducts({ search: q, perPage: 6, locale })

  return NextResponse.json({
    items: items.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      price: p.price,
      oldPrice: p.oldPrice,
      currency: p.currency,
      image: p.image,
      inStock: p.inStock,
    })),
    total,
    locale,
  })
}
