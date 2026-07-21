import type { Metadata } from 'next'
import Link from 'next/link'
import DOMPurify from 'isomorphic-dompurify'
import { notFound } from 'next/navigation'
import { getPageBySlug } from '@/lib/shop/pages'
import { getServerDictionary } from '@/lib/i18n/server'
import { localizedPath } from '@/lib/i18n/config'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const { locale } = await getServerDictionary()
  const page = await getPageBySlug(slug, locale)
  if (!page) return { title: 'Not found', robots: { index: false } }
  const path = `/p/${slug}`
  return {
    title: page.title,
    alternates: {
      canonical: localizedPath(path, locale),
      languages: { uk: path, ru: localizedPath(path, 'ru'), 'x-default': path },
    },
  }
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { locale, dict } = await getServerDictionary()
  const page = await getPageBySlug(slug, locale)
  if (!page) notFound()

  const lp = (p: string) => localizedPath(p, locale)

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 lg:px-8">
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link href={lp('/')} className="hover:text-primary">
          {dict.common.home}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{page.title}</span>
      </nav>
      <article className="rounded-2xl border border-border bg-card p-6 lg:p-10">
        <h1 className="mb-6 text-3xl font-bold tracking-tight text-foreground text-balance">{page.title}</h1>
        <div
          className="prose prose-neutral max-w-none text-pretty leading-relaxed text-foreground [&_a]:text-primary [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:my-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(page.content || '') }}
        />
      </article>
    </div>
  )
}
