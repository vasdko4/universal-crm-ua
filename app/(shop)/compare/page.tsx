import type { Metadata } from 'next'
import { CompareGrid } from '@/components/shop/compare-grid'
import { getLocale, getDictionary } from '@/lib/i18n/server'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const dict = getDictionary(locale)
  return {
    title: dict.compare.title,
    robots: { index: false, follow: false },
  }
}

export default async function ComparePage() {
  const locale = await getLocale()
  const dict = getDictionary(locale)
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 md:py-12">
      <h1 className="mb-6 text-2xl font-bold text-foreground md:text-3xl">{dict.compare.title}</h1>
      <CompareGrid />
    </div>
  )
}
