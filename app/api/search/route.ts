import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getCatalogProducts } from '@/lib/shop/queries'
import { LOCALE_COOKIE } from '@/lib/i18n/config'
import type { Locale } from '@/lib/i18n/config'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') ?? '').trim().slice(0, 100)

  if (q.length < 2) {
    return NextResponse.json({ items: [], total: 0 })
  }

  const cookieStore = await cookies()
  const localeCookie = cookieStore.get(LOCALE_COOKIE)?.value
  const locale: Locale = localeCookie === 'ru' ? 'ru' : 'uk'

  const { items, total } = await getCatalogProducts({ search: q, perPage: 6, locale })

  return NextResponse.json({
    items: items.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      oldPrice: p.oldPrice,
      currency: p.currency,
      image: p.image,
      inStock: p.inStock,
    })),
    total,
  })
}
