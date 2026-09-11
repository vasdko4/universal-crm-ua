'use client'

import { useMemo, useState } from 'react'
import { Check, Copy, Landmark } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n/client'
import { cn } from '@/lib/utils'

function parseLines(text: string): { label: string; value: string }[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf(':')
      if (idx <= 0) return { label: '', value: line }
      return { label: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() }
    })
}

export function CopyRequisites({ text, className }: { text: string; className?: string }) {
  const { dict } = useI18n()
  const t = dict.checkout
  const [copied, setCopied] = useState<string | null>(null)
  const rows = useMemo(() => parseLines(text), [text])

  function copy(value: string, key: string) {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(key)
      setTimeout(() => setCopied((prev) => (prev === key ? null : prev)), 2000)
    })
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border-2 border-primary/40 bg-primary/[0.06] shadow-[0_0_0_4px_rgba(15,118,110,0.06)]',
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-primary/20 bg-primary/10 px-4 py-3">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Landmark className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{t.requisitesTitle}</p>
          <p className="text-xs text-muted-foreground">{t.requisitesHint}</p>
        </div>
      </div>

      <dl className="divide-y divide-primary/15">
        {rows.map((row, i) => {
          const key = `${row.label}-${i}`
          const isAmount = /сума|сумма|amount/i.test(row.label)
          const isIban = /iban|карт/i.test(row.label)
          return (
            <div key={key} className="flex items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                {row.label ? (
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {row.label}
                  </dt>
                ) : null}
                <dd
                  className={cn(
                    'mt-0.5 break-all text-sm font-semibold text-foreground',
                    isIban && 'font-mono tracking-wide',
                    isAmount && 'text-base text-primary',
                  )}
                >
                  {row.value}
                </dd>
              </div>
              <button
                type="button"
                onClick={() => copy(row.value, key)}
                className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground"
                aria-label={t.copyRequisites}
              >
                {copied === key ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
              </button>
            </div>
          )
        })}
      </dl>

      <div className="border-t border-primary/20 px-4 py-3">
        <Button variant="default" size="sm" className="w-full" onClick={() => copy(text, 'all')}>
          {copied === 'all' ? (
            <>
              <Check className="size-4" /> {t.requisitesCopied}
            </>
          ) : (
            <>
              <Copy className="size-4" /> {t.copyRequisites}
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
