/**
 * Escape a value for CSV: wrap in quotes and double any inner quotes.
 *
 * Neutralizes formula injection — a cell starting with `=`, `+`, `-`, `@`
 * (or tab/CR) executes as a formula when the CSV is opened in Excel /
 * LibreOffice, which can exfiltrate data from the machine of the admin who
 * opens the export. Prefixing with a single quote keeps the cell as plain
 * text while remaining readable.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '""'
  let s = String(value).replace(/"/g, '""')
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return `"${s}"`
}
