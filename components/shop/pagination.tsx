'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function Pagination({ page, total, perPage }: { page: number; total: number; perPage: number }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const pages = Math.ceil(total / perPage)
  if (pages <= 1) return null

  function goTo(p: number) {
    const next = new URLSearchParams(params.toString())
    next.set('page', String(p))
    router.push(`${pathname}?${next.toString()}`)
  }

  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === pages || Math.abs(p - page) <= 1,
  )

  return (
    <div className="flex items-center justify-center gap-1">
      <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => goTo(page - 1)} aria-label="Назад">
        <ChevronLeft className="size-4" />
      </Button>
      {nums.map((p, idx) => {
        const prev = nums[idx - 1]
        const gap = prev && p - prev > 1
        return (
          <span key={p} className="flex items-center gap-1">
            {gap && <span className="px-1 text-muted-foreground">…</span>}
            <Button
              variant={p === page ? 'default' : 'outline'}
              size="icon"
              onClick={() => goTo(p)}
              aria-label={`Страница ${p}`}
            >
              {p}
            </Button>
          </span>
        )
      })}
      <Button variant="outline" size="icon" disabled={page >= pages} onClick={() => goTo(page + 1)} aria-label="Вперёд">
        <ChevronRight className="size-4" />
      </Button>
    </div>
  )
}
