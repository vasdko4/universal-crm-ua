import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SearchX } from 'lucide-react'

// Rendered inside the admin layout (with the sidebar) when notFound() is
// thrown in an admin route — e.g. an order or product that no longer exists.
export default function AdminNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <SearchX className="size-7" aria-hidden="true" />
      </span>
      <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Ошибка 404
      </p>
      <h1 className="text-balance text-2xl font-semibold text-foreground">Запись не найдена</h1>
      <p className="max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
        Такой страницы или записи нет — возможно, она была удалена или ссылка устарела.
      </p>
      <Button asChild className="mt-2">
        <Link href="/admin">В админ-центр</Link>
      </Button>
    </div>
  )
}
