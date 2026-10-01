import { describe, it, expect } from 'vitest'
import { splitSqlStatements, migrationSqlHash } from '@/lib/db/migrate-runner'
import { MIGRATE_SQL } from '@/lib/db/migrate-bundle'

describe('splitSqlStatements', () => {
  it('splits simple statements', () => {
    const parts = splitSqlStatements('SELECT 1; SELECT 2;')
    expect(parts).toEqual(['SELECT 1', 'SELECT 2'])
  })

  it('ignores semicolons inside strings and comments', () => {
    const sql = [
      "INSERT INTO t (a) VALUES ('a;b');",
      '-- comment with ; semicolon',
      '/* block; comment */',
      'SELECT 1;',
    ].join('\n')
    const parts = splitSqlStatements(sql)
    expect(parts).toHaveLength(2)
    expect(parts[0]).toContain("'a;b'")
  })

  it('keeps dollar-quoted blocks (DO $$ ... $$) intact', () => {
    const sql = "DO $$ BEGIN RAISE NOTICE 'done; ok'; END $$;\nSELECT 1;"
    const parts = splitSqlStatements(sql)
    expect(parts).toHaveLength(2)
    expect(parts[0]).toContain("RAISE NOTICE 'done; ok'")
  })

  it('skips empty statements', () => {
    expect(splitSqlStatements(';; SELECT 1;;')).toEqual(['SELECT 1'])
  })
})

describe('migrate bundle', () => {
  it('embeds the full migrate.sql with recent migrations', () => {
    expect(MIGRATE_SQL).toContain('admin_theme')
    expect(MIGRATE_SQL).toContain('modal_ads')
    expect(MIGRATE_SQL).toContain('IF NOT EXISTS')
  })

  it('splits into a sane number of statements', () => {
    const parts = splitSqlStatements(MIGRATE_SQL)
    expect(parts.length).toBeGreaterThan(50)
    // Every statement is non-trivial SQL.
    for (const p of parts) expect(p.length).toBeGreaterThan(10)
  })

  it('produces a stable 64-char hex hash', () => {
    const h = migrationSqlHash()
    expect(h).toMatch(/^[0-9a-f]{64}$/)
    expect(migrationSqlHash()).toBe(h)
  })
})
