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
