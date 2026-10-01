'use client'

import { useEffect, useState } from 'react'
import { BookmarkPlus, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  addFilterPreset,
  loadFilterPresets,
  persistFilterPresets,
  removeFilterPreset,
  type FilterPreset,
} from '@/lib/admin/filter-presets'

export interface PresetStrings {
  title: string
  saveLabel: string
  namePlaceholder: string
  deleteAria: string
}

/**
 * Quick-apply filter preset bar: built-in presets (defined by the page) plus
 * user-saved presets persisted in localStorage. Generic over the filter
 * object shape used by the page.
 */
export function FilterPresetBar<F extends Record<string, unknown>>({
  storageKey,
  builtinPresets,
  currentFilters,
  onApply,
  strings,
}: {
  storageKey: string
  builtinPresets: { id: string; label: string; filters: F }[]
  currentFilters: F
  onApply: (filters: F) => void
  strings: PresetStrings
}) {
  const [custom, setCustom] = useState<FilterPreset<F>[]>([])
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')

  useEffect(() => {
    setCustom(loadFilterPresets<F>(window.localStorage, storageKey))
  }, [storageKey])

  function persist(next: FilterPreset<F>[]) {
    setCustom(next)
    persistFilterPresets(window.localStorage, storageKey, next)
  }

  function handleSave() {
    const next = addFilterPreset(custom, name, currentFilters)
    if (next === custom) return
    persist(next)
    setName('')
    setSaving(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">{strings.title}:</span>
      {builtinPresets.map((p) => (
        <Button
          key={p.id}
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => onApply(p.filters)}
        >
          {p.label}
        </Button>
      ))}
      {custom.map((p) => (
        <span
          key={p.id}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-dashed border-border bg-card pr-1 pl-2.5 text-xs"
        >
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => onApply(p.filters)}
          >
            {p.name}
          </button>
          <button
            type="button"
            aria-label={`${strings.deleteAria}: ${p.name}`}
            className="rounded p-0.5 text-muted-foreground hover:text-destructive"
            onClick={() => persist(removeFilterPreset(custom, p.id))}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      {saving ? (
        <span className="inline-flex items-center gap-1.5">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
              if (e.key === 'Escape') {
                setSaving(false)
                setName('')
              }
            }}
            placeholder={strings.namePlaceholder}
            className="h-7 w-44 text-xs"
            aria-label={strings.namePlaceholder}
          />
          <Button type="button" size="sm" variant="secondary" className="h-7" onClick={handleSave}>
            <Check className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7"
            onClick={() => {
              setSaving(false)
              setName('')
            }}
          >
            <X className="size-3.5" />
          </Button>
        </span>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-muted-foreground"
          onClick={() => setSaving(true)}
        >
          <BookmarkPlus className="size-3.5" />
          {strings.saveLabel}
        </Button>
      )}
    </div>
  )
}
