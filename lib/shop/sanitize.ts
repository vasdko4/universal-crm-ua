import sanitizeHtml from 'sanitize-html'

/**
 * Sanitizes admin-authored rich text (legal pages, articles, product
 * descriptions) before rendering with `dangerouslySetInnerHTML`.
 *
 * Uses `sanitize-html` (pure JS, no DOM) rather than `isomorphic-dompurify`
 * (which pulls in `jsdom`): jsdom's transitive dependency chain
 * (`html-encoding-sniffer` -> `@exodus/bytes`) ships an ESM-only module that
 * Next's bundler cannot `require()` at runtime, which 500'd every page that
 * called `DOMPurify.sanitize()` in production on Vercel even though
 * `next build` succeeded locally and in CI.
 */
export function sanitizeContent(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h1', 'h2', 'h3', 'h4', 'span', 'img']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height'],
      '*': ['class'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  })
}
