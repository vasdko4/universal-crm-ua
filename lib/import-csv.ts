/**
 * CSV parsing for the admin product import.
 *
 * Extracted from components/import-manager.tsx so it can be unit-tested
 * without pulling in React. The parser respects quoted fields, which may
 * span multiple physical lines (product descriptions are HTML with real
 * newlines), contain escaped quotes ("") or the delimiter itself.
 */

export type ImportRow = {
  name_uk?: string
  name_ru?: string
  sku?: string
  price?: string
  old_price?: string
  quantity?: string
  description_uk?: string
  description_ru?: string
  unit?: string
}

// Header aliases: accepts either the plain English keys documented in the UI
// (a raw supplier feed) OR the human-readable Russian labels our own
// "Экспорт" button produces (app/api/admin/products/export/route.ts) — so
// export → edit in Excel → re-import round-trips instead of silently
// failing every row with "нет названия".
const CSV_HEADER_ALIASES: Record<string, keyof ImportRow> = {
  name_ru: "name_ru",
  "название (рус)": "name_ru",
  name_uk: "name_uk",
  "название (укр)": "name_uk",
  sku: "sku",
  "артикул": "sku",
  price: "price",
  "цена": "price",
  old_price: "old_price",
  "старая цена": "old_price",
  quantity: "quantity",
  "остаток": "quantity",
  description_ru: "description_ru",
  "описание (рус)": "description_ru",
  description_uk: "description_uk",
  "описание (укр)": "description_uk",
  unit: "unit",
}

export function parseCSV(text: string): ImportRow[] {
  // Strip a UTF-8 BOM (our own export prepends one for Excel's benefit).
  const clean = text.replace(/^\uFEFF/, "")

  // Delimiter is auto-detected (our export uses ";" — the Cyrillic-locale
  // Excel default; a plain supplier feed typically uses ",") by checking
  // which one appears more often, outside quotes, in the header line.
  function countUnquoted(line: string, delimiter: string): number {
    let count = 0
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') inQuotes = !inQuotes
      else if (ch === delimiter && !inQuotes) count++
    }
    return count
  }
  const headerLine = clean.split(/\r?\n/, 1)[0] ?? ""
  const delimiter = countUnquoted(headerLine, ";") > countUnquoted(headerLine, ",") ? ";" : ","

  // Single-pass parse: a newline only ends a record when we are not inside
  // a quoted field. Splitting into lines first shredded every multiline
  // description into dozens of phantom rows (22036 rows from a 255-row
  // export), which would have created thousands of duplicate products.
  const records: string[][] = []
  let record: string[] = []
  let field = ""
  let inQuotes = false
  function pushField() {
    record.push(field)
    field = ""
  }
  function pushRecord() {
    pushField()
    if (record.length > 1 || record[0].trim() !== "") records.push(record)
    record = []
  }
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === delimiter) {
      pushField()
    } else if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && clean[i + 1] === "\n") i++
      pushRecord()
    } else {
      field += ch
    }
  }
  pushRecord()
  if (records.length < 2) return []

  const rawHeaders = records[0].map((h) => h.trim().toLowerCase())
  const headers = rawHeaders.map((h) => CSV_HEADER_ALIASES[h] ?? h)
  return records.slice(1).map((values) => {
    const row: Record<string, string> = {}
    headers.forEach((h, i) => {
      row[h] = (values[i] ?? "").trim()
    })
    return row as ImportRow
  })
}
