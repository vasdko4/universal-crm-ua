// Visual themes for the storefront modal-ad popup.
// 'classic' is the default and keeps backwards compatibility with older rows.

export const MODAL_AD_THEMES = [
  'classic',
  'gradient',
  'split',
  'minimal',
  'dark',
  'ticket',
] as const

export type ModalAdTheme = (typeof MODAL_AD_THEMES)[number]

export const MODAL_AD_THEME_DEFAULT: ModalAdTheme = 'classic'

export function normalizeModalAdTheme(value: unknown): ModalAdTheme {
  return typeof value === 'string' &&
    (MODAL_AD_THEMES as readonly string[]).includes(value)
    ? (value as ModalAdTheme)
    : MODAL_AD_THEME_DEFAULT
}
