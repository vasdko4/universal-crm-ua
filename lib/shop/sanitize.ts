import sanitizeHtml from 'sanitize-html'

/**
 * Options for admin-authored rich text (legal pages, articles, product
 * descriptions) rendered with `dangerouslySetInnerHTML`.
 *
 * `sanitize-html` is called at each sink (not only via a wrapper) so CodeQL
 * models it as a sanitizer. Uses the pure-JS library rather than
 * `isomorphic-dompurify` / jsdom, which Next cannot `require()` on Vercel.
 */
export const RICH_TEXT_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h1', 'h2', 'h3', 'h4', 'span', 'img']),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    a: ['href', 'name', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height'],
    '*': ['class'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
}

export function sanitizeContent(html: string): string {
  return sanitizeHtml(html, RICH_TEXT_SANITIZE_OPTIONS)
}

/**
 * Strip user-submitted review/question text down to plain text (3.4.109,
 * #7). No tags survive — `allowedTags: []` — and entities are decoded a
 * single pass by the parser, so `&lt;script&gt;` stays inert text instead
 * of becoming a tag on a later render. The stored value is rendered as
 * plain React text downstream, never as HTML.
 *
 * This is the ONE shared implementation for the server-action delegates
 * (app/actions/shop.ts submitReview/submitQuestion, app/actions/feedback.ts
 * createReview/createQuestion). The v1 routes keep their own LOCAL copy of
 * the same function on purpose — a test asserts `allowedTags: []` in the
 * route source — so do not refactor the routes to import this.
 */
export function stripToPlainText(raw: string): string {
  return sanitizeHtml(raw, { allowedTags: [], allowedAttributes: {} }).trim()
}

/** Strict 1..5 integer rating (3.4.109, #7). NaN, floats and out-of-range
 * values are rejected — never clamped: Math.max(1, NaN) is NaN, which used
 * to reach the integer column and 500 the insert. */
export function parseStrictRating(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5 ? v : null
}

/** Trim + cap a free-text field (3.4.109, #7); empty, blank or non-string
 * input is null. */
export function safeTextField(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t ? t.slice(0, max) : null
}
