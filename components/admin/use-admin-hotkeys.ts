'use client'

import { useEffect } from 'react'
import { resolveAdminHotkey } from '@/lib/admin/hotkeys'

/**
 * Global keyboard shortcuts for admin list pages:
 * `/` focuses search, `n` opens the "new item" page, `Escape` triggers the
 * page's escape handler (close drawer/modal, clear selection, ...).
 * Input fields are never hijacked — see lib/admin/hotkeys.ts.
 */
export function useAdminHotkeys(options: {
  onFocusSearch?: () => void
  onNew?: () => void
  onEscape?: () => void
}) {
  const { onFocusSearch, onNew, onEscape } = options

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const hotkey = resolveAdminHotkey(e, e.target)
      if (!hotkey) return
      if (hotkey === 'focus-search' && onFocusSearch) {
        e.preventDefault()
        onFocusSearch()
      } else if (hotkey === 'new-item' && onNew) {
        e.preventDefault()
        onNew()
      } else if (hotkey === 'escape' && onEscape) {
        onEscape()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onFocusSearch, onNew, onEscape])
}
