/**
 * Admin list keyboard shortcuts (orders/products).
 *
 * `/` focuses the search field, `n` opens the "new item" page for the current
 * list, `Escape` closes the drawer/modal. The resolver is a pure function so
 * it can be unit-tested without a DOM; the React hook lives in
 * components/admin/use-admin-hotkeys.ts.
 *
 * Crucially, shortcuts are never hijacked while the user is typing: when the
 * event target is an input, textarea, select or a contentEditable element the
 * resolver returns null and the keystroke goes to the field untouched.
 */

export type AdminHotkey = 'focus-search' | 'new-item' | 'escape'

/** Minimal event shape the resolver needs (compatible with KeyboardEvent). */
export interface HotkeyEventLike {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
}

function isEditableTarget(target: unknown): boolean {
  if (!target || typeof target !== 'object') return false
  const el = target as { tagName?: unknown; isContentEditable?: unknown }
  if (el.isContentEditable === true) return true
  const tag = typeof el.tagName === 'string' ? el.tagName.toUpperCase() : ''
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

/**
 * Map a keydown to an admin hotkey, or null when the keystroke must be left
 * alone (modifier combos, typing inside a form field).
 */
export function resolveAdminHotkey(
  e: HotkeyEventLike,
  target: unknown,
): AdminHotkey | null {
  // Never steal browser/OS shortcuts or combos (e.g. Ctrl+F, Cmd+K).
  if (e.ctrlKey || e.metaKey || e.altKey) return null
  // Never interrupt typing.
  if (isEditableTarget(target)) return null
  switch (e.key) {
    case '/':
      return 'focus-search'
    case 'n':
    case 'N':
      return 'new-item'
    case 'Escape':
      return 'escape'
    default:
      return null
  }
}
