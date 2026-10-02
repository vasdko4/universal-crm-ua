import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(__dirname, '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

describe('stock_status locale migration', () => {
  it('migrate.sql translates legacy Russian values to Ukrainian', () => {
    const sql = read('db/migrate.sql')
    expect(sql).toContain("SET stock_status = 'В наявності' WHERE stock_status = 'В наличии'")
    expect(sql).toContain("SET stock_status = 'Немає в наявності' WHERE stock_status = 'Нет в наличии'")
    expect(sql).toContain("ALTER TABLE products ALTER COLUMN stock_status SET DEFAULT 'В наявності'")
  })

  it('no Russian stock_status literals remain in product code', () => {
    // Excluded: admin dictionaries (ru locale section is intentionally Russian)
    // and the CSV export header row (entirely Russian by design).
    for (const f of [
      'lib/db/schema.ts',
      'app/actions/import.ts',
      'app/actions/products.ts',
      'app/actions/prom-import.ts',
      'db/schema.sql',
    ]) {
      const src = read(f)
      expect(src, f).not.toContain("'В наличии'")
      expect(src, f).not.toContain("'Нет в наличии'")
    }
  })

  it('schema default is Ukrainian', () => {
    expect(read('lib/db/schema.ts')).toContain("default('В наявності')")
  })
})
