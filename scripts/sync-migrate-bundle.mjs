/**
 * Embeds db/migrate.sql into the JS bundle as lib/db/migrate-bundle.ts.
 *
 * Next.js file tracing only ships imported files, so the raw .sql file is not
 * available at runtime (e.g. on Vercel). The admin "Check DB version" button
 * (app/admin/updates) applies migrations from this generated module instead.
 *
 * Source of truth stays db/migrate.sql — re-run this script after editing it:
 *   node scripts/sync-migrate-bundle.mjs   (or: pnpm db:sync-migrate)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sql = readFileSync(join(root, 'db', 'migrate.sql'), 'utf8')

const escaped = sql.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')

const out = `// GENERATED FILE — do not edit by hand.
// Source: db/migrate.sql
// Regenerate with: node scripts/sync-migrate-bundle.mjs (pnpm db:sync-migrate)
export const MIGRATE_SQL: string = \`${escaped}\`;
`

writeFileSync(join(root, 'lib', 'db', 'migrate-bundle.ts'), out)
console.log('wrote lib/db/migrate-bundle.ts')
