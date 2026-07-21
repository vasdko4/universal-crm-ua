import Link from 'next/link'
import Image from 'next/image'
import { Clock, ArrowRight, Newspaper } from 'lucide-react'
import type { StorefrontArticleCard } from '@/lib/shop/articles'
import { localizedPath, type Locale } from '@/lib/i18n/config'

export function ArticleCard({
  article,
  minutesLabel,
  featured = false,
  locale = 'uk',
}: {
  article: StorefrontArticleCard
  minutesLabel: string
  featured?: boolean
  locale?: Locale
}) {
  const href = localizedPath(`/articles/${article.slug}`, locale)
  const date = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  const cover = (
    <>
      {article.coverImage ? (
        <Image
          src={article.coverImage || "/placeholder.svg"}
          alt={article.title}
          fill
          sizes={featured ? '(max-width: 768px) 100vw, 50vw' : '(max-width: 768px) 100vw, 33vw'}
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-muted">
          <Newspaper className="size-10 text-muted-foreground/40" />
        </div>
      )}
      {article.categoryName ? (
        <span className="absolute left-3 top-3 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
          {article.categoryName}
        </span>
      ) : null}
    </>
  )

  const meta = (
    <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
      <div className="flex items-center gap-3">
        {date ? <span>{date}</span> : null}
        <span className="flex items-center gap-1">
          <Clock className="size-3.5" /> {article.readingMinutes} {minutesLabel}
        </span>
      </div>
      <ArrowRight className="size-4 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
    </div>
  )

  if (featured) {
    // Horizontal hero card: image on the left, content on the right.
    return (
      <Link
        href={href}
        className="group grid overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary md:grid-cols-2"
      >
        <div className="relative aspect-[3/2] w-full overflow-hidden bg-muted md:aspect-auto md:min-h-64">
          {cover}
        </div>
        <div className="flex flex-col justify-center p-6 lg:p-8">
          <h3 className="text-xl font-bold text-card-foreground text-balance group-hover:text-primary lg:text-2xl">
            {article.title}
          </h3>
          {article.excerpt ? (
            <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground text-pretty">
              {article.excerpt}
            </p>
          ) : null}
          {meta}
        </div>
      </Link>
    )
  }

  return (
    <Link
      href={href}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary"
    >
      <div className="relative aspect-[3/2] w-full overflow-hidden bg-muted">{cover}</div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-base font-bold text-card-foreground text-balance group-hover:text-primary">
          {article.title}
        </h3>
        {article.excerpt ? (
          <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-muted-foreground text-pretty">
            {article.excerpt}
          </p>
        ) : (
          <div className="flex-1" />
        )}
        {meta}
      </div>
    </Link>
  )
}
