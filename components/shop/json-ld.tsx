/**
 * Renders a JSON-LD structured-data script for search engines.
 * Server component — the payload is serialized once at render time.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      // SECURITY: this embeds admin-approved but customer-submitted text
      // (review body/author name on product pages, etc.) inside a <script>
      // tag. JSON.stringify does not escape "<", so a review containing the
      // literal sequence "</script>" would close the tag early and let
      // whatever follows run as real HTML/script (stored XSS) for every
      // visitor of that page. Escaping "<" as \u003c (invisible to JSON
      // parsers, since \u003c decodes back to "<") neutralizes that without
      // changing the structured data itself.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  )
}
