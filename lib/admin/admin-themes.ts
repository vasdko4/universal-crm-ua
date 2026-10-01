/**
 * Admin panel color themes.
 *
 * Applied on the admin layout wrapper via [data-admin-theme="..."].
 * "teal" is the default (:root tokens) and its block re-states the defaults
 * explicitly so every theme is self-describing.
 */

export type AdminThemeId =
  | 'teal'
  | 'blue'
  | 'violet'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'slate'
  | 'midnight'

export type AdminThemePreset = {
  id: AdminThemeId
  name: string
  nameRu: string
  description: string
  descriptionRu: string
  /** Preview swatches shown on the selection card: primary action, sidebar, page surface. */
  swatches: { primary: string; sidebar: string; surface: string }
  /** Dark admin chrome — sets color-scheme: dark. */
  dark?: boolean
}

export const ADMIN_THEMES: AdminThemePreset[] = [
  {
    id: 'teal',
    name: 'Бірюзова',
    nameRu: 'Бирюзовая',
    description: 'Стандартна бірюзова тема адмін-панелі.',
    descriptionRu: 'Стандартная бирюзовая тема админ-панели.',
    swatches: {
      primary: 'oklch(0.48 0.11 190)',
      sidebar: 'oklch(0.235 0.015 260)',
      surface: 'oklch(0.985 0.002 90)',
    },
  },
  {
    id: 'blue',
    name: 'Синя',
    nameRu: 'Синяя',
    description: 'Спокійний синій акцент для кнопок та навігації.',
    descriptionRu: 'Спокойный синий акцент для кнопок и навигации.',
    swatches: {
      primary: 'oklch(0.55 0.16 250)',
      sidebar: 'oklch(0.22 0.03 260)',
      surface: 'oklch(0.98 0.004 250)',
    },
  },
  {
    id: 'violet',
    name: 'Фіолетова',
    nameRu: 'Фиолетовая',
    description: 'Яскравий фіолетовий акцент, сучасний вигляд.',
    descriptionRu: 'Яркий фиолетовый акцент, современный вид.',
    swatches: {
      primary: 'oklch(0.58 0.18 300)',
      sidebar: 'oklch(0.22 0.03 300)',
      surface: 'oklch(0.98 0.004 300)',
    },
  },
  {
    id: 'emerald',
    name: 'Смарагдова',
    nameRu: 'Изумрудная',
    description: 'Свіжий зелений акцент, спокійна робоча атмосфера.',
    descriptionRu: 'Свежий зелёный акцент, спокойная рабочая атмосфера.',
    swatches: {
      primary: 'oklch(0.55 0.15 160)',
      sidebar: 'oklch(0.2 0.03 160)',
      surface: 'oklch(0.985 0.004 150)',
    },
  },
  {
    id: 'amber',
    name: 'Бурштинова',
    nameRu: 'Янтарная',
    description: 'Теплий бурштиновий акцент.',
    descriptionRu: 'Тёплый янтарный акцент.',
    swatches: {
      primary: 'oklch(0.68 0.16 75)',
      sidebar: 'oklch(0.24 0.02 70)',
      surface: 'oklch(0.985 0.006 85)',
    },
  },
  {
    id: 'rose',
    name: 'Рожева',
    nameRu: 'Розовая',
    description: 'Мʼякий рожевий акцент.',
    descriptionRu: 'Мягкий розовый акцент.',
    swatches: {
      primary: 'oklch(0.58 0.19 10)',
      sidebar: 'oklch(0.24 0.03 350)',
      surface: 'oklch(0.985 0.004 20)',
    },
  },
  {
    id: 'slate',
    name: 'Графітова',
    nameRu: 'Графитовая',
    description: 'Стриманий графітово-сірий акцент, діловий стиль.',
    descriptionRu: 'Сдержанный графитово-серый акцент, деловой стиль.',
    swatches: {
      primary: 'oklch(0.35 0.02 260)',
      sidebar: 'oklch(0.2 0.01 260)',
      surface: 'oklch(0.98 0.002 260)',
    },
  },
  {
    id: 'midnight',
    name: 'Нічна',
    nameRu: 'Ночная',
    description: 'Повністю темна адмін-панель — зручно працювати ввечері.',
    descriptionRu: 'Полностью тёмная админ-панель — удобно работать вечером.',
    swatches: {
      primary: 'oklch(0.7 0.14 250)',
      sidebar: 'oklch(0.16 0.02 260)',
      surface: 'oklch(0.18 0.015 260)',
    },
    dark: true,
  },
]

export const ADMIN_THEME_IDS = ADMIN_THEMES.map((t) => t.id)

export function isAdminThemeId(v: string): v is AdminThemeId {
  return (ADMIN_THEME_IDS as string[]).includes(v)
}

/** Resolve an admin theme by id, falling back to "teal". */
export function getAdminTheme(id: string): AdminThemePreset {
  return ADMIN_THEMES.find((t) => t.id === id) ?? ADMIN_THEMES[0]
}
