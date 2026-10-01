'use client'

import { useEffect, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { resolveVisibleColumns, toggleColumn } from '@/lib/admin/column-visibility'

/**
 * Persisted column visibility for admin tables (localStorage-backed).
 * @param storageKey localStorage key, e.g. 'admin:cols:products'
 * @param allColumns every known column id in display order
 */
export function useColumnVisibility(storageKey: string, allColumns: string[]) {
  const [visible, setVisible] = useState<string[]>(allColumns)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey)
      setVisible(
        resolveVisibleColumns(raw ? (JSON.parse(raw) as string[]) : null, allColumns),
      )
    } catch {
      setVisible([...allColumns])
    }
    // `allColumns` is a module-level constant at call sites.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  function toggle(id: string) {
    setVisible((prev) => {
      const next = toggleColumn(prev, allColumns, id)
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        // Non-persistent fallback: state still updates for this session.
      }
      return next
    })
  }

  return { visible, toggle }
}

/** Dropdown panel with per-column checkboxes. */
export function ColumnToggle({
  columns,
  visible,
  onToggle,
  label,
}: {
  columns: { id: string; label: string }[]
  visible: string[]
  onToggle: (id: string) => void
  label: string
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="bg-card" aria-label={label}>
          <SlidersHorizontal className="size-4" />
          <span className="hidden lg:inline">{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((c) => (
          <label
            key={c.id}
            className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
          >
            <Checkbox
              checked={visible.includes(c.id)}
              onCheckedChange={() => onToggle(c.id)}
              aria-label={c.label}
            />
            <span>{c.label}</span>
          </label>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
