/**
 * True when the error is a Postgres unique-violation (SQLSTATE 23505),
 * unwrapping driver `cause` chains. Used to convert a lost insert race on a
 * unique index into a friendly result instead of an unhandled 500.
 */
export function isUniqueViolation(e: unknown): boolean {
  let cur: unknown = e
  for (let i = 0; i < 4 && cur && typeof cur === 'object'; i++) {
    if ('code' in cur && (cur as { code: unknown }).code === '23505') return true
    cur = 'cause' in cur ? (cur as { cause: unknown }).cause : undefined
  }
  return false
}
