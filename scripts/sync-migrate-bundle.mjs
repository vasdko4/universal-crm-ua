/**
 * Embeds db/migrate.sql into the application bundle for runtime migrations.
 * Run this after changing db/migrate.sql so deployments don't depend on a
 * separately packaged SQL file.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sql = readFileSync(join(root, 'db', 'migrate.sql'), 'utf8').replace(/\r\n/g, '\n')

const out = `// GENERATED FILE — do not edit by hand.
// Source: db/migrate.sql
// Regenerate with: pnpm db:sync-migrate
export const MIGRATE_SQL: string = ${JSON.stringify(sql)};
`

writeFileSync(join(root, 'lib', 'db', 'migrate-bundle.ts'), out)
console.log('wrote lib/db/migrate-bundle.ts')
