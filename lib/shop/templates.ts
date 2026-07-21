export type TemplateId =
  | 'classic'
  | 'warm'
  | 'dark-tech'
  | 'elegant'
  | 'marketplace'
  | 'boutique'
  | 'nordic'
  | 'berry'
  | 'ocean'
  | 'forest'
  | 'mint'

/**
 * Home page hero layout used by the template.
 *  - standard: side-by-side hero with photo (classic look)
 *  - marketplace: compact promo banner + dense category tiles (Prom-style)
 *  - boutique: full-width editorial hero with overlaid text
 *  - minimal: typographic hero without a photo, oversized heading
 */
export type TemplateLayout = 'standard' | 'marketplace' | 'boutique' | 'minimal'

export type TemplatePreset = {
  id: TemplateId
  name: string
  description: string
  /** Preview swatches (CSS colors) shown on the selection card. */
  swatches: { bg: string; card: string; primary: string; accent: string }
  radius: string
  /** Which storefront layout the template uses (not just colors). */
  layout: TemplateLayout
  /** Premium templates get a badge in the admin selector. */
  premium?: boolean
}

export const TEMPLATES: TemplatePreset[] = [
  {
    id: 'classic',
    name: 'Класичний',
    description: 'Світлий, бірюзовий акцент, помірні скруглення. Універсальний вигляд.',
    swatches: {
      bg: 'oklch(0.985 0.002 90)',
      card: 'oklch(1 0 0)',
      primary: 'oklch(0.48 0.11 190)',
      accent: 'oklch(0.94 0.02 190)',
    },
    radius: '0.5rem',
    layout: 'standard',
  },
  {
    id: 'warm',
    name: 'Теплий',
    description: 'Тепла палітра, помаранчевий акцент, крупні скруглення. М’який стиль.',
    swatches: {
      bg: 'oklch(0.99 0.012 85)',
      card: 'oklch(1 0.004 85)',
      primary: 'oklch(0.66 0.16 45)',
      accent: 'oklch(0.93 0.045 60)',
    },
    radius: '1rem',
    layout: 'standard',
  },
  {
    id: 'dark-tech',
    name: 'Dark Tech',
    description: 'Темна тема, синій акцент, гострі кути. Технологічний вигляд.',
    swatches: {
      bg: 'oklch(0.19 0.02 260)',
      card: 'oklch(0.24 0.025 260)',
      primary: 'oklch(0.62 0.18 250)',
      accent: 'oklch(0.34 0.05 250)',
    },
    radius: '0.25rem',
    layout: 'standard',
  },
  {
    id: 'elegant',
    name: 'Елегантний',
    description: 'Монохром із золотим акцентом, тонкі лінії. Преміальний вигляд.',
    swatches: {
      bg: 'oklch(0.975 0.003 80)',
      card: 'oklch(0.995 0.002 80)',
      primary: 'oklch(0.55 0.09 80)',
      accent: 'oklch(0.93 0.025 85)',
    },
    radius: '0.125rem',
    layout: 'standard',
  },
  {
    id: 'marketplace',
    name: 'Маркетплейс',
    description:
      'Щільна вітрина у стилі Prom: компактний промо-банер, плитки категорій та багато товарів на екрані.',
    swatches: {
      bg: 'oklch(0.97 0.005 250)',
      card: 'oklch(1 0 0)',
      primary: 'oklch(0.55 0.2 262)',
      accent: 'oklch(0.72 0.19 40)',
    },
    radius: '0.5rem',
    layout: 'marketplace',
    premium: true,
  },
  {
    id: 'boutique',
    name: 'Бутік',
    description:
      'Повноекранний editorial-банер, глибокий зелений із кремовим. Для магазинів моди та декору.',
    swatches: {
      bg: 'oklch(0.97 0.008 90)',
      card: 'oklch(0.99 0.005 90)',
      primary: 'oklch(0.38 0.06 155)',
      accent: 'oklch(0.85 0.06 85)',
    },
    radius: '0.75rem',
    layout: 'boutique',
    premium: true,
  },
  {
    id: 'nordic',
    name: 'Мінімал',
    description:
      'Чорно-білий мінімалізм із великою типографікою без банера. Максимум уваги на товари.',
    swatches: {
      bg: 'oklch(0.99 0 0)',
      card: 'oklch(1 0 0)',
      primary: 'oklch(0.2 0 0)',
      accent: 'oklch(0.93 0 0)',
    },
    radius: '0rem',
    layout: 'minimal',
    premium: true,
  },
  {
    id: 'berry',
    name: 'Ягідний',
    description:
      'Насичений ягідно-рожевий акцент на світлому тлі, м’які скруглення. Сучасний, дружній вигляд для гаджетів і аксесуарів.',
    swatches: {
      bg: 'oklch(0.98 0.006 350)',
      card: 'oklch(1 0.003 350)',
      primary: 'oklch(0.5 0.19 350)',
      accent: 'oklch(0.92 0.04 350)',
    },
    radius: '0.85rem',
    layout: 'standard',
  },
  {
    id: 'ocean',
    name: 'Океан',
    description:
      'Глибокий синьо-бірюзовий акцент, щільна вітрина у стилі маркетплейсу. Свіжий і технологічний вигляд.',
    swatches: {
      bg: 'oklch(0.97 0.01 220)',
      card: 'oklch(1 0.004 220)',
      primary: 'oklch(0.52 0.15 220)',
      accent: 'oklch(0.85 0.08 200)',
    },
    radius: '0.5rem',
    layout: 'marketplace',
    premium: true,
  },
  {
    id: 'forest',
    name: 'Ліс',
    description:
      'Темна смарагдово-зелена тема з повноекранним editorial-банером. Преміальний вигляд для еко- та lifestyle-брендів.',
    swatches: {
      bg: 'oklch(0.16 0.02 150)',
      card: 'oklch(0.22 0.025 150)',
      primary: 'oklch(0.6 0.14 150)',
      accent: 'oklch(0.3 0.04 150)',
    },
    radius: '0.4rem',
    layout: 'boutique',
    premium: true,
  },
  {
    id: 'mint',
    name: 'Мʼята',
    description:
      'Свіжий м’ятний фон з коралловим акцентом, велика типографіка без банера. Яскравий, молодіжний мінімалізм.',
    swatches: {
      bg: 'oklch(0.985 0.01 165)',
      card: 'oklch(1 0.005 165)',
      primary: 'oklch(0.72 0.13 165)',
      accent: 'oklch(0.78 0.14 30)',
    },
    radius: '1.25rem',
    layout: 'minimal',
  },
]

export const TEMPLATE_IDS = TEMPLATES.map((t) => t.id)

export function isTemplateId(v: string): v is TemplateId {
  return (TEMPLATE_IDS as string[]).includes(v)
}

/** Resolve a template preset by id, falling back to "classic". */
export function getTemplate(id: string): TemplatePreset {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0]
}
