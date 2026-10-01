import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { migrationSqlHash, splitSqlStatements } from '@/lib/db/migrate-runner'
import { MIGRATE_SQL } from '@/lib/db/migrate-bundle'

describe('splitSqlStatements', () => {
  it('splits ordinary statements and ignores empty ones', () => {
    expect(splitSqlStatements(';; SELECT 1; SELECT 2;;')).toEqual(['SELECT 1', 'SELECT 2'])
  })

  it('keeps semicolons inside strings and comments', () => {
    const sql = [
      "INSERT INTO t (a) VALUES ('a;b');",
      '-- a comment; with semicolon',
      '/* a block; comment */',
      'SELECT 1;',
    ].join('\n')
    const statements = splitSqlStatements(sql)
    expect(statements).toHaveLength(2)
    expect(statements[0]).toContain("'a;b'")
  })

  it('keeps dollar-quoted blocks intact', () => {
    const sql = "DO $migration$ BEGIN RAISE NOTICE 'done; ok'; END $migration$;\nSELECT 1;"
    const statements = splitSqlStatements(sql)
    expect(statements).toHaveLength(2)
    expect(statements[0]).toContain("RAISE NOTICE 'done; ok'")
  })
})

describe('migration bundle', () => {
  it('matches the migration source exactly', () => {
    const source = readFileSync(join(process.cwd(), 'db', 'migrate.sql'), 'utf8').replace(/\r\n/g, '\n')
    expect(MIGRATE_SQL).toBe(source)
  })

  it('contains a substantial migration set and hashes deterministically', () => {
    expect(splitSqlStatements(MIGRATE_SQL).length).toBeGreaterThan(50)
    expect(migrationSqlHash()).toMatch(/^[0-9a-f]{64}$/)
    expect(migrationSqlHash()).toBe(migrationSqlHash())
  })
})
