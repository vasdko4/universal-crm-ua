import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getSetupDictionary } from '@/lib/i18n/setup'

const root = resolve(import.meta.dirname, '..')
// Structural tests compare source text with LF literals; normalize so the
// file also passes on a Windows CRLF checkout.
const source = (file: string) => readFileSync(resolve(root, file), 'utf8').replace(/\r\n/g, '\n')

describe('setup TOCTOU single-flight lock (audit P2, 3.4.96)', () => {
  it('acquires the advisory lock before the isSetupNeeded check', () => {
    const src = source('app/actions/setup.ts')
    expect(src).toMatch(
      /import \{[^}]*tryAdvisoryLock[^}]*\} from '@\/lib\/db\/advisory-lock'/,
    )
    const runSetupAt = src.indexOf('export async function runSetup')
    const lockCallAt = src.indexOf('tryAdvisoryLock(SETUP_LOCK_NS, SETUP_LOCK_KEY)')
    expect(lockCallAt).toBeGreaterThan(runSetupAt)
    // The token check still comes first: an unauthorized request never
    // takes the lock.
    const tokenAt = src.indexOf('authorizeSetupToken(input.setupToken)')
    expect(tokenAt).toBeGreaterThan(runSetupAt)
    expect(tokenAt).toBeLessThan(lockCallAt)
    // The "no users" check runs only after the lock is held.
    const checkAt = src.indexOf('await isSetupNeeded()')
    expect(checkAt).toBeGreaterThan(lockCallAt)
  })

  it('re-checks isSetupNeeded under the lock', () => {
    const src = source('app/actions/setup.ts')
    const lockCallAt = src.indexOf('tryAdvisoryLock(SETUP_LOCK_NS, SETUP_LOCK_KEY)')
    const checkAt = src.indexOf('await isSetupNeeded()')
    const releaseAt = src.indexOf('await lock.release()')
    expect(checkAt).toBeGreaterThan(lockCallAt)
    expect(checkAt).toBeLessThan(releaseAt)
    // The already-configured guard is the check's answer, also under lock.
    const guardAt = src.indexOf('t.errors.alreadyConfigured')
    expect(guardAt).toBeGreaterThan(checkAt)
    expect(guardAt).toBeLessThan(releaseAt)
  })

  it('releases the lock in finally', () => {
    const src = source('app/actions/setup.ts')
    expect(src).toMatch(/} finally \{\s*\n\s*await lock\.release\(\)\s*\n\s*\}/)
  })

  it('a held lock returns a setup-in-progress error instead of running setup', () => {
    const src = source('app/actions/setup.ts')
    const heldAt = src.indexOf('if (!lock) {')
    expect(heldAt).toBeGreaterThan(-1)
    expect(src.slice(heldAt, heldAt + 200)).toContain('t.errors.setupInProgress')
    // No seeding happens on the held-lock path: SYSTEM_SQL is only reached
    // after the lock is held.
    const seedAt = src.indexOf('await pool.query(SYSTEM_SQL)')
    expect(seedAt).toBeGreaterThan(heldAt)
  })

  it('a lock-acquire failure returns an error instead of throwing', () => {
    const src = source('app/actions/setup.ts')
    const runSetupAt = src.indexOf('export async function runSetup')
    const lockCallAt = src.indexOf('lock = await tryAdvisoryLock')
    expect(lockCallAt).toBeGreaterThan(runSetupAt)
    // The lock call is wrapped in try/catch ...
    const tryAt = src.lastIndexOf('try {', lockCallAt)
    expect(tryAt).toBeGreaterThan(runSetupAt)
    const catchAt = src.indexOf('} catch (e) {', lockCallAt)
    const heldAt = src.indexOf('if (!lock) {', lockCallAt)
    expect(catchAt).toBeGreaterThan(-1)
    expect(catchAt).toBeLessThan(heldAt)
    // ... and the catch returns { success: false } instead of throwing.
    expect(src.slice(catchAt, heldAt)).toContain('success: false as const')
  })

  it('revokeSetupToken is still called on the success path (3.4.95, complementary)', () => {
    const src = source('app/actions/setup.ts')
    const revokeAt = src.indexOf('revokeSetupToken()')
    const successAt = src.indexOf('return { success: true as const }')
    expect(revokeAt).toBeGreaterThan(-1)
    expect(revokeAt).toBeLessThan(successAt)
    // The revoke sits after the admin was created, inside the locked flow.
    const seedAt = src.indexOf('await pool.query(SYSTEM_SQL)')
    expect(revokeAt).toBeGreaterThan(seedAt)
  })

  it('setup lock key is distinct from the cron-run lock keys', () => {
    const src = source('app/actions/setup.ts')
    expect(src).toMatch(/const SETUP_LOCK_NS = 20261111/)
    expect(src).toMatch(/const SETUP_LOCK_KEY = 'setup'/)
    // The lock call uses the setup key, never a 'cron-run:<id>' key.
    // (The file's comment legitimately mentions 'cron-run:<id>' to explain
    // why the keys cannot collide — the assertion below is scoped to the
    // tryAdvisoryLock call, not the whole file.)
    expect(src).toContain('tryAdvisoryLock(SETUP_LOCK_NS, SETUP_LOCK_KEY)')
    expect(src).not.toMatch(/tryAdvisoryLock\([^)]*cron-run:/)
  })

  it('setupInProgress message exists in uk and ru', () => {
    expect(getSetupDictionary('uk').errors.setupInProgress).toMatch(/виконується/)
    expect(getSetupDictionary('ru').errors.setupInProgress).toMatch(/выполняется/)
  })
})
