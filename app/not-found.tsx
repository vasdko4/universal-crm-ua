import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SearchX } from 'lucide-react'
import { getServerDictionary } from '@/lib/i18n/server'

export async function generateMetadata() {
  const { dict } = await getServerDictionary()
  return { title: dict.notFoundPage.title }
}

export default async function NotFound() {
  const { dict: t } = await getServerDictionary()
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-muted/30 px-4 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <SearchX className="size-7" aria-hidden="true" />
      </span>
      <p className="text-6xl font-bold tracking-tight text-muted-foreground/30">404</p>
      <h1 className="text-balance text-2xl font-semibold text-foreground">
        {t.notFoundPage.heading}
      </h1>
      <p className="max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
        {t.notFoundPage.description}
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <Button asChild>
          <Link href="/">{t.notFoundPage.homeButton}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/catalog">{t.notFoundPage.catalogButton}</Link>
        </Button>
      </div>
    </main>
  )
}
