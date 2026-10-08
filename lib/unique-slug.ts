import { slugify } from '@/lib/slug'

/**
 * Generate a unique slug, appending -1, -2... on collision.
 * `exists` checks whether a slug is taken by another record.
 */
export async function ensureUniqueSlug(
  desired: string,
  fallback: string,
  exists: (slug: string) => Promise<number | null>,
  excludeId?: number,
): Promise<string> {
  const base = slugify(desired) || fallback
  let slug = base
  let i = 1
  while (true) {
    const existingId = await exists(slug)
    if (existingId === null || existingId === excludeId) return slug
    slug = `${base}-${i++}`
  }
}

/** Shared title-required validation for articles and pages. */
export function validateTitle(input: { title?: string | null }): string | null {
  if (!input.title?.trim()) return 'Заголовок обязателен'
  return null
}
