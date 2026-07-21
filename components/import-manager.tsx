"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Upload, FileSpreadsheet, FileCode, CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { runImport, type ImportRow } from "@/app/actions/import"

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

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  completed: { label: "Завершён", variant: "default" },
  processing: { label: "Обработка", variant: "secondary" },
  failed: { label: "Ошибка", variant: "destructive" },
  pending: { label: "Ожидание", variant: "outline" },
}

export function ImportManager({ tasks }: { tasks: ImportTask[] }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<{ fileName: string; type: "csv" | "xml"; rows: ImportRow[] } | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleFile(file: File) {
    const text = await file.text()
    const isXml = file.name.toLowerCase().endsWith(".xml")
    const rows = isXml ? parseXML(text) : parseCSV(text)
    if (rows.length === 0) {
      toast.error("Не удалось распознать товары в файле. Проверьте формат.")
      return
    }
    setPreview({ fileName: file.name, type: isXml ? "xml" : "csv", rows })
  }

  function handleImport() {
    if (!preview) return
    startTransition(async () => {
      const res = await runImport(preview.fileName, preview.type, preview.rows)
      if (res.success) {
        toast.success(`Импортировано: ${res.imported}, ошибок: ${res.failed}`)
        setPreview(null)
        if (fileRef.current) fileRef.current.value = ""
        router.refresh()
      } else {
        toast.error(res.error || "Ошибка импорта")
      }
    })
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Импорт товаров</h1>
        <p className="text-sm text-muted-foreground">
          Загрузите CSV или XML файл с товарами. Поддерживаются колонки: name_ru, name_uk, sku, price, old_price, quantity, description_ru, description_uk, unit
          — либо те же данные с русскими заголовками из кнопки «Экспорт» на странице товаров (Название (рус), Артикул, Цена, Остаток и т.д.). Разделитель (&quot;,&quot; или &quot;;&quot;) определяется автоматически.
          Товары с указанным артикулом (sku), который уже есть в каталоге, будут обновлены (цена/остаток/название/описание), а не задублированы — товары без артикула всегда создаются заново.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Загрузка файла</CardTitle>
          <CardDescription>CSV с заголовками или XML с элементами product / item / offer</CardDescription>
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
              Выбрать файл
            </Button>
            {preview && (
              <div className="flex items-center gap-2 text-sm">
                {preview.type === "csv" ? (
                  <FileSpreadsheet className="size-4 text-muted-foreground" />
                ) : (
                  <FileCode className="size-4 text-muted-foreground" />
                )}
                <span className="font-medium">{preview.fileName}</span>
                <Badge variant="secondary">{preview.rows.length} товаров</Badge>
              </div>
            )}
          </div>

          {preview && (
            <>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Название (RU)</TableHead>
                      <TableHead>Артикул</TableHead>
                      <TableHead className="text-right">Цена</TableHead>
                      <TableHead className="text-right">Кол-во</TableHead>
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
                <p className="text-xs text-muted-foreground">{`Показаны первые 5 из ${preview.rows.length} строк`}</p>
              )}
              <div className="flex gap-2">
                <Button onClick={handleImport} disabled={isPending}>
                  {isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  Импортировать {preview.rows.length} товаров
                </Button>
                <Button
                  variant="ghost"
                  disabled={isPending}
                  onClick={() => {
                    setPreview(null)
                    if (fileRef.current) fileRef.current.value = ""
                  }}
                >
                  Отмена
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">История импорта</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Файл</TableHead>
                <TableHead>Тип</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Всего</TableHead>
                <TableHead className="text-right">Успешно</TableHead>
                <TableHead className="text-right">Ошибок</TableHead>
                <TableHead>Дата</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    Импортов ещё не было
                  </TableCell>
                </TableRow>
              ) : (
                tasks.map((t) => {
                  const st = statusConfig[t.status ?? "pending"] ?? statusConfig.pending
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.fileName}</TableCell>
                      <TableCell className="uppercase text-muted-foreground">{t.sourceType}</TableCell>
                      <TableCell>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{t.totalItems ?? 0}</TableCell>
                      <TableCell className="text-right tabular-nums text-green-600 dark:text-green-500">
                        {t.successItems ?? 0}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {(t.failedItems ?? 0) > 0 ? (
                          <span className="inline-flex items-center gap-1 text-destructive">
                            <XCircle className="size-3.5" />
                            {t.failedItems}
                          </span>
                        ) : (
                          0
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {t.createdAt ? new Date(t.createdAt).toLocaleString("ru-RU") : "—"}
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
