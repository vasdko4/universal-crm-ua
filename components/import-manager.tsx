"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Upload, FileSpreadsheet, FileCode, CheckCircle2, XCircle, Loader2, Link2, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { runImport, type ImportRow } from "@/app/actions/import"
import { startPromImport, continuePromImport } from "@/app/actions/prom-import"
import { useAdminI18n } from "@/lib/i18n/admin/context"
import type { AdminDictionary } from "@/lib/i18n/admin/dictionaries"

type ImportTask = {
  id: number
  fileName: string
  sourceType: string
  status: string | null
  totalItems: number | null
  successItems: number | null
  failedItems: number | null
  errorLog: string | null
  createdAt: Date | null
}

function tpl(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
    template,
  )
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

function parseCSV(text: string): ImportRow[] {
  // Strip a UTF-8 BOM (our own export prepends one for Excel's benefit).
  const clean = text.replace(/^\uFEFF/, "")
  const lines = clean.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []

  // Simple CSV parser with quoted field support. Delimiter is auto-detected
  // (our export uses ";" — the Cyrillic-locale Excel default; a plain
  // supplier feed typically uses ",") by checking which one appears more
  // often, outside quotes, in the header line.
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
  const delimiter = countUnquoted(lines[0], ";") > countUnquoted(lines[0], ",") ? ";" : ","

  function splitLine(line: string): string[] {
    const result: string[] = []
    let current = ""
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (ch === delimiter && !inQuotes) {
        result.push(current)
        current = ""
      } else {
        current += ch
      }
    }
    result.push(current)
    return result.map((s) => s.trim())
  }

  const rawHeaders = splitLine(lines[0]).map((h) => h.toLowerCase())
  const headers = rawHeaders.map((h) => CSV_HEADER_ALIASES[h] ?? h)
  return lines.slice(1).map((line) => {
    const values = splitLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => {
      row[h] = values[i] ?? ""
    })
    return row as ImportRow
  })
}

function parseXML(text: string): ImportRow[] {
  const doc = new DOMParser().parseFromString(text, "application/xml")
  if (doc.querySelector("parsererror")) return []
  const items = Array.from(doc.querySelectorAll("product, item, offer"))
  return items.map((item) => {
    const get = (tag: string) => item.querySelector(tag)?.textContent?.trim() ?? ""
    return {
      name_uk: get("name_uk") || get("name"),
      name_ru: get("name_ru") || get("name"),
      sku: get("sku") || get("vendorCode"),
      price: get("price"),
      old_price: get("old_price") || get("oldprice"),
      quantity: get("quantity") || get("stock_quantity"),
      description_uk: get("description_uk"),
      description_ru: get("description_ru") || get("description"),
      unit: get("unit"),
    }
  })
}

function statusConfig(
  t: AdminDictionary,
): Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> {
  return {
    completed: { label: t.import.statusCompleted, variant: "default" },
    processing: { label: t.import.statusProcessing, variant: "secondary" },
    failed: { label: t.import.statusFailed, variant: "destructive" },
    pending: { label: t.import.statusPending, variant: "outline" },
  }
}

/**
 * Import an entire Prom.ua shop by URL: scrapes every product (photos,
 * descriptions, categories, characteristics) straight from the public
 * storefront pages, no API key needed. Runs as small polled batches
 * (continuePromImport) instead of one long request, so it can't hit a
 * serverless function timeout on large catalogs and survives the admin
 * navigating away — an unfinished job just shows a "Продолжить" button.
 */
function PromImportCard({ resumableTasks }: { resumableTasks: { id: number; fileName: string; totalItems: number | null; processedItems: number | null }[] }) {
  const { dict: t } = useAdminI18n()
  const router = useRouter()
  const [url, setUrl] = useState("")
  const [taskId, setTaskId] = useState<number | null>(null)
  const [progress, setProgress] = useState<{ processed: number; total: number } | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cancelledRef = useRef(false)

  async function runLoop(id: number) {
    cancelledRef.current = false
    setRunning(true)
    setTaskId(id)
    try {
      let done = false
      while (!done && !cancelledRef.current) {
        const res = await continuePromImport(id)
        if (!res.success) {
          toast.error(res.error || t.import.errorGeneric)
          break
        }
        done = res.done
        setProgress({ processed: res.processed, total: res.total })
      }
      if (done && !cancelledRef.current) {
        toast.success(t.import.promCompleteToast)
        router.refresh()
      }
    } finally {
      setRunning(false)
    }
  }

  async function handleStart() {
    setError(null)
    if (!url.trim()) return
    setRunning(true)
    try {
      const res = await startPromImport(url.trim())
      if (!res.success) {
        setError(res.error)
        setRunning(false)
        return
      }
      setProgress({ processed: 0, total: res.total })
      toast.message(
        res.capped
          ? tpl(t.import.promFoundCappedTemplate, { shopTotal: res.shopTotal, total: res.total })
          : tpl(t.import.promFoundTemplate, { total: res.total }),
      )
      await runLoop(res.taskId)
    } catch {
      setError(t.import.errorStart)
      setRunning(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t.import.promCardTitle}</CardTitle>
        <CardDescription>{t.import.promCardDescription}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t.import.promUrlPlaceholder}
            disabled={running}
            className="max-w-md"
          />
          <Button onClick={handleStart} disabled={running || !url.trim()}>
            {running ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
            {t.import.promStartButton}
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {progress && (
          <div className="flex flex-col gap-1.5">
            <div className="h-2 w-full max-w-md overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress.total > 0 ? Math.min(100, (progress.processed / progress.total) * 100) : 0}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {tpl(t.import.promProcessedOfTotalTemplate, { processed: progress.processed, total: progress.total })}
              {running ? t.import.promImportingSuffix : taskId ? t.import.promDoneSuffix : ""}
            </p>
          </div>
        )}
        {resumableTasks.length > 0 && !running && (
          <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <p className="text-xs font-medium text-muted-foreground">{t.import.promUnfinishedTitle}</p>
            {resumableTasks.map((tk) => (
              <div key={tk.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{tk.fileName}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {tk.processedItems ?? 0}/{tk.totalItems ?? 0}
                  </span>
                  <Button size="sm" variant="outline" onClick={() => runLoop(tk.id)}>
                    <Play className="size-3.5" />
                    {t.import.promContinueButton}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function ImportManager({
  tasks,
  resumablePromTasks = [],
}: {
  tasks: ImportTask[]
  resumablePromTasks?: { id: number; fileName: string; totalItems: number | null; processedItems: number | null }[]
}) {
  const { dict: t } = useAdminI18n()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<{ fileName: string; type: "csv" | "xml"; rows: ImportRow[] } | null>(null)
  const [isPending, startTransition] = useTransition()
  const STATUS = statusConfig(t)

  async function handleFile(file: File) {
    const text = await file.text()
    const isXml = file.name.toLowerCase().endsWith(".xml")
    const rows = isXml ? parseXML(text) : parseCSV(text)
    if (rows.length === 0) {
      toast.error(t.import.errorParsingFile)
      return
    }
    setPreview({ fileName: file.name, type: isXml ? "xml" : "csv", rows })
  }

  function handleImport() {
    if (!preview) return
    startTransition(async () => {
      const res = await runImport(preview.fileName, preview.type, preview.rows)
      if (res.success) {
        toast.success(tpl(t.import.importedResultTemplate, { imported: res.imported ?? 0, failed: res.failed ?? 0 }))
        setPreview(null)
        if (fileRef.current) fileRef.current.value = ""
        router.refresh()
      } else {
        toast.error(res.error || t.import.errorGeneric)
      }
    })
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t.import.pageTitle}</h1>
        <p className="text-sm text-muted-foreground">{t.import.pageSubtitle}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.import.uploadCardTitle}</CardTitle>
          <CardDescription>{t.import.uploadCardDescription}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xml"
              className="sr-only"
              id="import-file"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
              }}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" />
              {t.import.chooseFileButton}
            </Button>
            {preview && (
              <div className="flex items-center gap-2 text-sm">
                {preview.type === "csv" ? (
                  <FileSpreadsheet className="size-4 text-muted-foreground" />
                ) : (
                  <FileCode className="size-4 text-muted-foreground" />
                )}
                <span className="font-medium">{preview.fileName}</span>
                <Badge variant="secondary">{tpl(t.import.rowsBadgeTemplate, { n: preview.rows.length })}</Badge>
              </div>
            )}
          </div>

          {preview && (
            <>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.import.colName}</TableHead>
                      <TableHead>{t.import.colSku}</TableHead>
                      <TableHead className="text-right">{t.import.colPrice}</TableHead>
                      <TableHead className="text-right">{t.import.colQty}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.rows.slice(0, 5).map((row, i) => (
                      <TableRow key={i}>
                        <TableCell>{row.name_ru || row.name_uk || "—"}</TableCell>
                        <TableCell>{row.sku || "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.price || "0"}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.quantity || "0"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {preview.rows.length > 5 && (
                <p className="text-xs text-muted-foreground">
                  {tpl(t.import.showingFirstTemplate, { shown: 5, total: preview.rows.length })}
                </p>
              )}
              <div className="flex gap-2">
                <Button onClick={handleImport} disabled={isPending}>
                  {isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  {tpl(t.import.importButtonTemplate, { n: preview.rows.length })}
                </Button>
                <Button
                  variant="ghost"
                  disabled={isPending}
                  onClick={() => {
                    setPreview(null)
                    if (fileRef.current) fileRef.current.value = ""
                  }}
                >
                  {t.common.cancel}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <PromImportCard resumableTasks={resumablePromTasks} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.import.historyCardTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.import.tableFile}</TableHead>
                <TableHead>{t.import.tableType}</TableHead>
                <TableHead>{t.import.tableStatus}</TableHead>
                <TableHead className="text-right">{t.import.tableTotal}</TableHead>
                <TableHead className="text-right">{t.import.tableSuccess}</TableHead>
                <TableHead className="text-right">{t.import.tableFailed}</TableHead>
                <TableHead>{t.import.tableDate}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    {t.import.noImportsYet}
                  </TableCell>
                </TableRow>
              ) : (
                tasks.map((tk) => {
                  const st = STATUS[tk.status ?? "pending"] ?? STATUS.pending
                  return (
                    <TableRow key={tk.id}>
                      <TableCell className="font-medium">{tk.fileName}</TableCell>
                      <TableCell className="uppercase text-muted-foreground">{tk.sourceType}</TableCell>
                      <TableCell>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{tk.totalItems ?? 0}</TableCell>
                      <TableCell className="text-right tabular-nums text-green-600 dark:text-green-500">
                        {tk.successItems ?? 0}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {(tk.failedItems ?? 0) > 0 ? (
                          <span className="inline-flex items-center gap-1 text-destructive">
                            <XCircle className="size-3.5" />
                            {tk.failedItems}
                          </span>
                        ) : (
                          0
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {tk.createdAt ? new Date(tk.createdAt).toLocaleString("ru-RU", { timeZone: "Europe/Kyiv" }) : "—"}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
