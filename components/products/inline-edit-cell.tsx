'use client'

import { useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type SaveResult = { success: boolean; error?: string }

/**
 * Parse a localized price input: strips spaces, accepts a comma as the
 * decimal separator. Returns NaN when the input isn't a number.
 */
export function parsePriceInput(raw: string): number {
  return Number(raw.replace(/\s/g, '').replace(',', '.'))
}

/** Parse a stock quantity input: integer, truncates any decimal part. */
export function parseStockInput(raw: string): number {
  return Math.trunc(Number(raw.replace(/\s/g, '').replace(',', '.')))
}

type Props = {
  /** Value shown when not editing. */
  display: React.ReactNode
  /** Raw value loaded into the input when editing starts. */
  initial: string
  /** Accessible label + hover hint for the cell button. */
  label: string
  hint: string
  /** Parse + persist. Return validation errors as { success: false, error }. */
  onSave: (raw: string) => Promise<SaveResult>
  successMessage: string
  errorMessage: string
  /** Called after a successful save so the parent can refresh server data. */
  onSaved?: () => void
  className?: string
}

/**
 * Click-to-edit table cell: renders `display` as a button, swaps to a numeric
 * input on click. Enter/blur commits, Escape cancels. Used for price and
 * stock in the admin products table.
 */
export function InlineEditCell({
  display,
  initial,
  label,
  hint,
  onSave,
  successMessage,
  errorMessage,
  onSaved,
  className,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(initial)
  const [saving, setSaving] = useState(false)
  const committedRef = useRef(false)

  function start() {
    committedRef.current = false
    setDraft(initial)
    setEditing(true)
  }

  function cancel() {
    committedRef.current = true // suppress the blur-commit
    setEditing(false)
  }

  async function commit() {
    if (committedRef.current) return
    committedRef.current = true
    const raw = draft.trim()
    if (raw === initial.trim()) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      const result = await onSave(raw)
      if (result.success) {
        toast.success(successMessage)
        onSaved?.()
      } else {
        toast.error(result.error ?? errorMessage)
      }
    } catch {
      toast.error(errorMessage)
    } finally {
      setSaving(false)
      setEditing(false)
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={start}
        title={hint}
        aria-label={label}
        className={cn(
          'rounded px-1 -mx-1 underline decoration-dotted decoration-muted-foreground/50 underline-offset-4 transition-colors hover:bg-muted hover:decoration-solid',
          className,
        )}
      >
        {display}
      </button>
    )
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        autoFocus
        value={draft}
        inputMode="decimal"
        disabled={saving}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void commit()
          else if (e.key === 'Escape') cancel()
        }}
        onBlur={() => void commit()}
        aria-label={label}
        className="w-24 rounded-md border border-primary bg-background px-2 py-1 text-right text-sm tabular-nums outline-none"
      />
      {saving && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />}
    </span>
  )
}
