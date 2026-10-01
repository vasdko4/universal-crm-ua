/**
 * Review summary derived from the approved-reviews list.
 *
 * The product page used to run a separate aggregate SQL query for the
 * count/average while rendering the cards from a different cached query. The
 * two cache entries could disagree (stale entry) — e.g. the header showing
 * "4.0 (3)" while the review list rendered empty. Deriving the summary from
 * the same array that renders the cards, the tab label, and the JSON-LD makes
 * a mismatch impossible by construction.
 */
export function summarizeReviews(reviews: Array<{ rating: number | string | null }>): {
  count: number
  avg: number
} {
  const count = reviews.length
  if (count === 0) return { count: 0, avg: 0 }
  const sum = reviews.reduce((acc, r) => acc + Number(r.rating ?? 0), 0)
  return { count, avg: sum / count }
}
