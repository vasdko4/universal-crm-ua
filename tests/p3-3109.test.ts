import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, afterEach } from 'vitest'

import { parseStrictRating, safeTextField } from '@/lib/shop/sanitize'
import { toSafePrice } from '@/lib/prom-import/scraper'
import { getBackupDataKey } from '@/lib/secrets'
import { buildConnectionString } from '@/lib/db/config'
import { looksLikeEmail } from '@/lib/text'
import { isSupportedGatewayCurrency } from '@/lib/payments/clients'

const root = resolve(import.meta.dirname, '..')
const source = (file: string) => readFileSync(resolve(root, file), 'utf8')

const savedEnv: Record<string, string | undefined> = {}
function setEnv(key: string, value: string | undefined) {
  if (!(key in savedEnv)) savedEnv[key] = process.env[key]
  if (value === undefined) delete process.env[key]
  else process.env[key] = value
}
afterEach(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  for (const key of Object.keys(savedEnv)) delete savedEnv[key]
})

// P3 #7 / shop.ts: strict rating — NaN used to slip through Math.min/max
// clamping (Math.max(1, NaN) is NaN) and 500 the integer-column insert.
describe('parseStrictRating', () => {
  it('accepts integers 1..5', () => {
    expect(parseStrictRating(1)).toBe(1)
    expect(parseStrictRating(5)).toBe(5)
  })
  it('rejects NaN, floats, out-of-range and non-numbers', () => {
    expect(parseStrictRating(Number.NaN)).toBeNull()
    expect(parseStrictRating(0)).toBeNull()
    expect(parseStrictRating(6)).toBeNull()
    expect(parseStrictRating(4.5)).toBeNull()
    expect(parseStrictRating('5')).toBeNull()
    expect(parseStrictRating(undefined)).toBeNull()
  })
})

describe('safeTextField', () => {
  it('trims and caps', () => {
    expect(safeTextField('  Ivan  ', 120)).toBe('Ivan')
    expect(safeTextField('abcdef', 3)).toBe('abc')
  })
  it('returns null for blank / non-string input', () => {
    expect(safeTextField('   ', 10)).toBeNull()
    expect(safeTextField(undefined, 10)).toBeNull()
    expect(safeTextField(42, 10)).toBeNull()
  })
})

// P3 scraper toSafePrice: untrusted Prom payload numbers.
describe('toSafePrice', () => {
  it('passes sane prices through', () => {
    expect(toSafePrice(1299)).toBe(1299)
    expect(toSafePrice(0)).toBe(0)
    expect(toSafePrice('12.50')).toBe(12.5)
  })
  it('nulls NaN, Infinity, negatives, huge and junk values', () => {
    expect(toSafePrice(Number.NaN)).toBeNull()
    expect(toSafePrice(Infinity)).toBeNull()
    expect(toSafePrice(-5)).toBeNull()
    expect(toSafePrice(100_000_000)).toBeNull()
    expect(toSafePrice('abc')).toBeNull()
    expect(toSafePrice(null)).toBeNull()
    expect(toSafePrice(undefined)).toBeNull()
  })
})

// P3 secrets.ts getBackupDataKey (backup-encryption design §3).
describe('getBackupDataKey', () => {
  it('throws a clear error naming the env var when unset', () => {
    setEnv('BACKUP_ENCRYPTION_KEY', undefined)
    expect(() => getBackupDataKey()).toThrow('BACKUP_ENCRYPTION_KEY')
  })
  it('throws on malformed keys', () => {
    setEnv('BACKUP_ENCRYPTION_KEY', 'too-short')
    expect(() => getBackupDataKey()).toThrow('BACKUP_ENCRYPTION_KEY')
    setEnv('BACKUP_ENCRYPTION_KEY', randomBytes(16).toString('base64'))
    expect(() => getBackupDataKey()).toThrow('32')
  })
  it('returns the 32-byte key and resolves rotation keys by keyId', () => {
    const current = randomBytes(32).toString('base64')
    const rotated = randomBytes(32).toString('base64')
    setEnv('BACKUP_ENCRYPTION_KEY', current)
    setEnv('BACKUP_ENCRYPTION_KEY_2026-12', rotated)
    const { key, keyId } = getBackupDataKey()
    expect(key).toEqual(Buffer.from(current, 'base64'))
    expect(keyId).toBe('current')
    expect(getBackupDataKey('2026-12').key).toEqual(Buffer.from(rotated, 'base64'))
    expect(getBackupDataKey('2026-12').keyId).toBe('2026-12')
  })
  it('rejects a hostile keyId (no env-name injection)', () => {
    expect(() => getBackupDataKey('../../etc/passwd')).toThrow('Invalid backup key id')
  })
})

// P3 db/config.ts host/port validation.
describe('buildConnectionString', () => {
  const base = { host: 'db.local', port: '5432', database: 'shop', user: 'app', password: 'secret' }
  it('builds a normal URL and keeps the empty-port default', () => {
    expect(buildConnectionString(base)).toBe('postgresql://app:secret@db.local:5432/shop')
    expect(buildConnectionString({ ...base, port: '' })).toContain(':5432/')
    expect(buildConnectionString({ ...base, ssl: true })).toContain('?sslmode=require')
  })
  it('rejects URL-injecting hosts, ports and names', () => {
    expect(() => buildConnectionString({ ...base, host: 'x/y?z=1' })).toThrow('хост')
    expect(() => buildConnectionString({ ...base, host: 'db.local@evil' })).toThrow('хост')
    expect(() => buildConnectionString({ ...base, port: '5432/evil' })).toThrow('порт')
    expect(() => buildConnectionString({ ...base, port: '99999' })).toThrow('порт')
    expect(() => buildConnectionString({ ...base, database: 'a/b' })).toThrow('базы данных')
    expect(() => buildConnectionString({ ...base, user: '' })).toThrow('пользователя')
  })
})

// P3 mailto: looksLikeEmail must reject URI/HTML metacharacters.
describe('looksLikeEmail', () => {
  it('accepts ordinary addresses', () => {
    expect(looksLikeEmail('ivan@example.com')).toBe(true)
  })
  it('rejects mailto query injection and attribute breakouts', () => {
    expect(looksLikeEmail('a@b.com?subject=x')).toBe(false)
    expect(looksLikeEmail('a@b.com&body=x')).toBe(false)
    expect(looksLikeEmail('a"b@c.d')).toBe(false)
    expect(looksLikeEmail("a'b@c.d")).toBe(false)
    expect(looksLikeEmail('a<b@c.d')).toBe(false)
    expect(looksLikeEmail('a@b.com#x')).toBe(false)
  })
})

// P3 WayForPay currency assertion.
describe('isSupportedGatewayCurrency', () => {
  it('accepts only UAH/USD/EUR', () => {
    expect(isSupportedGatewayCurrency('UAH')).toBe(true)
    expect(isSupportedGatewayCurrency('USD')).toBe(true)
    expect(isSupportedGatewayCurrency('EUR')).toBe(true)
    expect(isSupportedGatewayCurrency('RUB')).toBe(false)
    expect(isSupportedGatewayCurrency('xxx')).toBe(false)
    expect(isSupportedGatewayCurrency(undefined)).toBe(false)
  })
})

// P3 leftovers, source-level guards (same pattern as tests/api-csrf-3109):
// no relaxUnknown anywhere a caller can pass it, no raw error passthrough
// in the cron 500s, CSRF wired into the state-changing routes.
describe('P3 source guards', () => {
  it('no relaxUnknown call sites remain', () => {
    for (const f of [
      'app/api/track/route.ts',
      'app/api/health/route.ts',
      'app/api/v1/products/[slug]/reviews/route.ts',
      'app/api/v1/orders/lookup/route.ts',
      'app/api/v1/orders/[number]/route.ts',
      'app/api/v1/orders/[number]/payment/route.ts',
    ]) {
      expect(source(f)).not.toContain('relaxUnknown: true')
    }
  })
  it('cron 500s return a generic error', () => {
    for (const f of [
      'app/api/cron/analytics-retention/route.ts',
      'app/api/cron/anomaly-alert/route.ts',
      'app/api/cron/db-backup/route.ts',
      'app/api/cron/delivery-sync/route.ts',
      'app/api/cron/expire-pending/route.ts',
      'app/api/cron/notification-retry/route.ts',
      'app/api/cron/prom-sync/route.ts',
    ]) {
      const s = source(f)
      expect(s).toContain("error: 'Внутрішня помилка'")
      expect(s).not.toContain('error: (e as Error).message')
      expect(s).not.toContain('error: err.message')
    }
  })
  it('csrfCheck is wired into the state-changing routes', () => {
    for (const f of [
      'app/api/admin/upload/route.ts',
      'app/api/articles/route.ts',
      'app/api/articles/[id]/route.ts',
      'app/api/pages/route.ts',
      'app/api/pages/[id]/route.ts',
      'app/api/orders/route.ts',
      'app/api/reviews/route.ts',
      'app/api/reviews/[id]/route.ts',
      'app/api/questions/route.ts',
      'app/api/questions/[id]/route.ts',
      'app/api/v1/orders/route.ts',
      'app/api/v1/orders/one-click/route.ts',
    ]) {
      expect(source(f)).toContain('csrfCheck(')
    }
  })
  it('every target="_blank" carries rel="noopener noreferrer"', () => {
    for (const f of [
      'app/(shop)/account/(protected)/orders/[id]/page.tsx',
      'components/orders/order-detail.tsx',
      'components/payments/payments-manager.tsx',
      'components/settings/google-auth-tab.tsx',
      'components/settings/prom-tab.tsx',
      'components/shop/site-footer.tsx',
      'components/statistics/stats-dashboard.tsx',
      'components/updates/updates-panel.tsx',
    ]) {
      const blanks = (source(f).match(/target="_blank"/g) ?? []).length
      const rels = (source(f).match(/rel="noopener noreferrer"/g) ?? []).length
      expect(rels).toBeGreaterThanOrEqual(blanks)
      expect(blanks).toBeGreaterThan(0)
    }
  })
  it('the dead email-domains allowlist is gone', () => {
    expect(source('lib/shop/email-domains.ts')).not.toContain('ALLOWED_EMAIL_DOMAINS')
  })
})
