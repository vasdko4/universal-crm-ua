'use client'

import { useMemo, useState } from 'react'
import type { Category } from '@/lib/db/schema'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ChevronRight, X } from 'lucide-react'
import { useAdminI18n } from '@/lib/i18n/admin/context'
import { pickLocalized } from '@/lib/i18n/config'

/**
 * Cascading category picker: the admin drills down level by level
 * (root -> child -> ... -> leaf). A product has exactly ONE category path:
 * each pick immediately replaces the previous selection with the picked
 * category plus all of its ancestors, so the product stays visible when
 * shoppers browse parent categories.
 */
export function CategoryCascader({
  categories,
  value,
  onChange,
}: {
  categories: Category[]
  /** All linked category ids (leaf + ancestors) — a single path. */
  value: number[]
  onChange: (ids: number[]) => void
}) {
  const { locale } = useAdminI18n()
  const catName = (c: Category) => pickLocalized(locale, c.nameUk, c.nameRu)

  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const childrenOf = useMemo(() => {
    const map = new Map<number | null, Category[]>()
    for (const c of categories) {
      const key = c.parentId && byId.has(c.parentId) ? c.parentId : null
      const list = map.get(key) ?? []
      list.push(c)
      map.set(key, list)
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
          pickLocalized(locale, a.nameUk, a.nameRu).localeCompare(pickLocalized(locale, b.nameUk, b.nameRu)),
      )
    }
    return map
  }, [categories, byId, locale])

  function ancestorsOf(id: number): number[] {
    const out: number[] = []
    let cur = byId.get(id)
    while (cur?.parentId && byId.has(cur.parentId)) {
      out.push(cur.parentId)
      cur = byId.get(cur.parentId)
    }
    return out
  }

  // Derive the current path (root -> leaf) from the stored ids: the leaf is
  // a selected id none of whose selected children is also selected.
  const derivedPath = useMemo(() => {
    const set = new Set(value)
    const leaf = value.find((id) => {
      const kids = childrenOf.get(id) ?? []
      return !kids.some((k) => set.has(k.id))
    })
    if (leaf == null) return []
    return [...ancestorsOf(leaf).reverse(), leaf]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, childrenOf])

  // Local override while the admin is re-picking a branch mid-path.
  const [draftPath, setDraftPath] = useState<number[] | null>(null)
  const path = draftPath ?? derivedPath

  function commit(newPath: number[]) {
    const leaf = newPath[newPath.length - 1]
    if (leaf == null) {
      onChange([])
      setDraftPath(null)
      return
    }
    onChange([...ancestorsOf(leaf), leaf])
    // If the picked category still has children, keep the draft so the next
    // (empty) select stays visible for drilling deeper.
    const kids = childrenOf.get(leaf) ?? []
    setDraftPath(kids.length > 0 ? newPath : null)
  }

  function handlePick(level: number, idStr: string) {
    commit([...path.slice(0, level), Number(idStr)])
  }

  function clearAll() {
    onChange([])
    setDraftPath(null)
  }

  // Build the chain of selects: root level + one more for each pick that has children.
  const levels: { options: Category[]; selected: number | null }[] = []
  let parent: number | null = null
  for (let i = 0; ; i++) {
    const options = childrenOf.get(parent) ?? []
    if (options.length === 0) break
    const selected = path[i] ?? null
    levels.push({ options, selected })
    if (selected == null) break
    parent = selected
  }

  const pathLabel = path.map((p) => { const c = byId.get(p); return c ? catName(c) : '?' }).join(' → ')

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Выберите главную категорию, затем дочернюю — до самой конечной.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {levels.map((level, i) => (
          <div key={i} className="flex items-center gap-2">
            {i > 0 && <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
            <Select
              value={level.selected != null ? String(level.selected) : ''}
              onValueChange={(v) => handlePick(i, v)}
            >
              <SelectTrigger className="w-full min-w-44 sm:w-auto">
                <SelectValue placeholder={i === 0 ? 'Главная категория' : 'Подкатегория'} />
              </SelectTrigger>
              <SelectContent>
                {level.options.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {catName(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
      {path.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Label className="text-muted-foreground">Категория товара:</Label>
          <span className="flex items-center gap-1.5 rounded-full border bg-muted/50 py-1 pl-3 pr-1 text-sm">
            {pathLabel}
            <button
              type="button"
              onClick={clearAll}
              aria-label="Убрать категорию"
              className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </span>
        </div>
      )}
    </div>
  )
}
