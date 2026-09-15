/**
 * Creates a CI/local e2e admin after schema+seed. Credentials come from
 * E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD — never from seed.sql or the README.
 *
 * Usage (after db-setup --seed):
 *   E2E_ADMIN_EMAIL=e2e-admin@gmail.com E2E_ADMIN_PASSWORD='…' node scripts/e2e-bootstrap.mjs
 */
import { Pool } from 'pg'
import { randomBytes } from 'node:crypto'
import { hashPassword } from 'better-auth/crypto'

function trimQueryJunk(url) {
  let end = url.length
  while (end > 0 && (url[end - 1] === '?' || url[end - 1] === '&')) end -= 1
  return url.slice(0, end)
}

const email = (process.env.E2E_ADMIN_EMAIL || '').trim().toLowerCase()
const password = process.env.E2E_ADMIN_PASSWORD || ''
const name = process.env.E2E_ADMIN_NAME || 'E2E Admin'

if (!email || !email.includes('@')) {
  console.error('✗ E2E_ADMIN_EMAIL must be a real-looking address (e.g. e2e-admin@gmail.com).')
  process.exit(1)
}
if (password.length < 8) {
  console.error('✗ E2E_ADMIN_PASSWORD must be set and at least 8 characters.')
  process.exit(1)
}

const rawConnectionString = process.env.DATABASE_URL
if (!rawConnectionString) {
  console.error('✗ DATABASE_URL is not set.')
  process.exit(1)
}

const requiresSsl =
  /[?&]sslmode=(require|verify-ca|verify-full)/.test(rawConnectionString) ||
  /\b(neon\.tech|supabase\.co|amazonaws\.com|render\.com|azure\.com|cockroachlabs\.cloud)\b/.test(
    rawConnectionString,
  )

const connectionString = trimQueryJunk(
  rawConnectionString
    .replace(/([?&])sslmode=[^&]*/gi, '$1')
    .replace(/([?&])channel_binding=[^&]*/gi, '$1')
    .replace(/\?&/g, '?')
    .replace(/&&+/g, '&'),
)

const pool = new Pool({
  connectionString,
  ssl: requiresSsl ? { rejectUnauthorized: false } : false, // nosemgrep: javascript.lang.security.audit.ssl-verify-disabled.bypass-tls-verification
})

function newId() {
  return randomBytes(16).toString('base64url')
}

async function main() {
  const hashed = await hashPassword(password)
  const existing = await pool.query('SELECT id, role FROM "user" WHERE lower(email) = $1 LIMIT 1', [
    email,
  ])

  if (existing.rows[0]) {
    const userId = existing.rows[0].id
    await pool.query(
      `UPDATE "user" SET name = $1, role = 'admin', is_active = true, "emailVerified" = true, "updatedAt" = NOW() WHERE id = $2`,
      [name, userId],
    )
    const acc = await pool.query(
      `SELECT id FROM account WHERE "userId" = $1 AND "providerId" = 'credential' LIMIT 1`,
      [userId],
    )
    if (acc.rows[0]) {
      await pool.query(`UPDATE account SET password = $1, "updatedAt" = NOW() WHERE id = $2`, [
        hashed,
        acc.rows[0].id,
      ])
    } else {
      await pool.query(
        `INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
         VALUES ($1, $2, 'credential', $2, $3, NOW(), NOW())`,
        [newId(), userId, hashed],
      )
    }
    console.log(`✓ E2E admin updated (${email}).`)
    return
  }

  const userId = newId()
  await pool.query(
    `INSERT INTO "user" (id, name, email, "emailVerified", image, role, is_active, locale, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, true, NULL, 'admin', true, 'uk', NOW(), NOW())`,
    [userId, name, email],
  )
  await pool.query(
    `INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
     VALUES ($1, $2, 'credential', $2, $3, NOW(), NOW())`,
    [newId(), userId, hashed],
  )
  console.log(`✓ E2E admin created (${email}).`)
}

main()
  .catch((e) => {
    console.error('✗ Failed:', e.message)
    process.exitCode = 1
  })
  .finally(() => pool.end())
