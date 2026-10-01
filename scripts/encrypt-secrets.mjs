#!/usr/bin/env node
/**
 * One-time migration: encrypt plaintext integration secrets already stored
 * in the database (AES-256-GCM, see lib/secrets.ts).
 *
 *   DATABASE_URL=... BETTER_AUTH_SECRET=... node scripts/encrypt-secrets.mjs
 *
 * - Idempotent: values already stored as `enc:v1:...` are skipped.
 * - Dry run first: pass --dry-run to only report what would change.
 *
 * Tables/columns covered:
 *   payment_gateways.config      -> token, merchantSecretKey, merchantPassword
 *   delivery_methods.config      -> apiKey
 *   store_settings.email_settings   -> smtpPassword, dkimPrivateKey
 *   store_settings.notifications    -> telegramBotToken
 *   store_settings.google_auth      -> clientSecret
 */
import { createCipheriv, hkdfSync, randomBytes } from 'node:crypto'
import { Client } from 'pg'

const PREFIX = 'enc:v1:'
const DRY_RUN = process.argv.includes('--dry-run')

function masterSecret() {
  const s = process.env.BETTER_AUTH_SECRET
  if (!s || s.length < 16) {
    console.error('BETTER_AUTH_SECRET must be set (min 16 chars) — same value as the app uses.')
    process.exit(1)
  }
  return s
}

function encryptSecret(plain) {
  if (!plain || plain.startsWith(PREFIX)) return plain
  const key = hkdfSync('sha256', masterSecret(), 'universal-crm-ua', 'integration-secrets-v1', 32)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return PREFIX + Buffer.concat([iv, ct, cipher.getAuthTag()]).toString('base64')
}

const isPlainSecret = (v) => typeof v === 'string' && v.length > 0 && !v.startsWith(PREFIX)

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  let changed = 0

  try {
    // --- payment_gateways.config ---
    const gwKeys = ['token', 'merchantSecretKey', 'merchantPassword']
    const gws = await client.query('SELECT code, config FROM payment_gateways')
    for (const row of gws.rows) {
      const config = { ...(row.config ?? {}) }
      let dirty = false
      for (const k of gwKeys) {
        if (isPlainSecret(config[k])) {
          config[k] = encryptSecret(config[k])
          dirty = true
        }
      }
      if (dirty) {
        changed++
        console.log(`payment_gateways.${row.code}: encrypting ${gwKeys.filter((k) => String(config[k]).startsWith(PREFIX)).join(', ')}`)
        if (!DRY_RUN) {
          await client.query('UPDATE payment_gateways SET config = $1::jsonb, updated_at = NOW() WHERE code = $2', [
            JSON.stringify(config),
            row.code,
          ])
        }
      }
    }

    // --- delivery_methods.config ---
    const dmKeys = ['apiKey']
    const dms = await client.query('SELECT code, config FROM delivery_methods')
    for (const row of dms.rows) {
      const config = { ...(row.config ?? {}) }
      let dirty = false
      for (const k of dmKeys) {
        if (isPlainSecret(config[k])) {
          config[k] = encryptSecret(config[k])
          dirty = true
        }
      }
      if (dirty) {
        changed++
        console.log(`delivery_methods.${row.code}: encrypting apiKey`)
        if (!DRY_RUN) {
          await client.query('UPDATE delivery_methods SET config = $1::jsonb, updated_at = NOW() WHERE code = $2', [
            JSON.stringify(config),
            row.code,
          ])
        }
      }
    }

    // --- store_settings nested JSONB ---
    const nested = [
      ['email_settings', ['smtpPassword', 'dkimPrivateKey']],
      ['notifications', ['telegramBotToken']],
      ['google_auth', ['clientSecret']],
    ]
    const settings = await client.query(
      'SELECT id, email_settings, notifications, google_auth FROM store_settings',
    )
    for (const row of settings.rows) {
      const sets = {}
      let dirty = false
      for (const [col, keys] of nested) {
        const obj = { ...(row[col] ?? {}) }
        let colDirty = false
        for (const k of keys) {
          if (isPlainSecret(obj[k])) {
            obj[k] = encryptSecret(obj[k])
            colDirty = true
          }
        }
        if (colDirty) {
          sets[col] = JSON.stringify(obj)
          dirty = true
          console.log(`store_settings#${row.id}.${col}: encrypting ${keys.filter((k) => String(obj[k]).startsWith(PREFIX)).join(', ')}`)
        }
      }
      if (dirty) {
        changed++
        if (!DRY_RUN) {
          const cols = Object.keys(sets)
          const setSql = cols.map((c, i) => `"${c}" = $${i + 2}::jsonb`).join(', ')
          await client.query(
            `UPDATE store_settings SET ${setSql}, updated_at = NOW() WHERE id = $1`,
            [row.id, ...cols.map((c) => sets[c])],
          )
        }
      }
    }
  } finally {
    await client.end()
  }

  console.log(DRY_RUN ? `\n[dry-run] ${changed} row(s) would be updated.` : `\nDone. ${changed} row(s) updated.`)
}

main().catch((e) => {
  console.error('Migration failed:', e.message)
  process.exit(1)
})
