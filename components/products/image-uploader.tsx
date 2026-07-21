'use client'

import { useRef, useState, useCallback } from 'react'
import Image from 'next/image'
import { Upload, X, Loader2, ImageIcon, Star, ArrowLeft, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

async function uploadToBlob(file: File): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
  const data = (await res.json()) as { url?: string; error?: string }
  if (!res.ok || !data.url) throw new Error(data.error || 'Ошибка загрузки')
  return data.url
}

// Best-effort remove from Blob storage. Never blocks the UI on failure.
function deleteFromBlob(url: string) {
  if (!url.includes('.public.blob.vercel-storage.com')) return
  void fetch('/api/admin/upload', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  }).catch(() => {})
}

/* ------------------------------------------------------------------ */
/* Single image (main photo / variant photo)                          */
/* ------------------------------------------------------------------ */

export function ImageUploader({
  value,
  onChange,
  className,
  size = 'md',
}: {
  value: string | null | undefined
  onChange: (url: string | null) => void
  className?: string
  size?: 'sm' | 'md'
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0]
      if (!file) return
      setBusy(true)
      setError(null)
      try {
        const url = await uploadToBlob(file)
        if (value) deleteFromBlob(value)
        onChange(url)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка загрузки')
      } finally {
        setBusy(false)
      }
    },
    [onChange, value],
  )

  const box = size === 'sm' ? 'size-16' : 'size-28'

  return (
    <div className={cn('flex items-start gap-3', className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {value ? (
        <div className={cn('group relative overflow-hidden rounded-lg border border-border bg-muted', box)}>
          <Image src={value || '/placeholder.svg'} alt="Фото" fill sizes="112px" className="object-cover" />
          <button
            type="button"
            onClick={() => {
              deleteFromBlob(value)
              onChange(null)
            }}
            aria-label="Удалить фото"
            className="absolute right-1 top-1 rounded-md bg-background/80 p-1 text-destructive opacity-0 shadow-sm transition-opacity hover:bg-background group-hover:opacity-100"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className={cn(
            'flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50',
            box,
          )}
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : <ImageIcon className="size-5" />}
          <span className="text-[10px]">{busy ? 'Загрузка' : 'Фото'}</span>
        </button>
      )}
      <div className="flex flex-col gap-1">
        {value && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3" />}
            Заменить
          </button>
        )}
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Multiple images (product gallery)                                  */
/* ------------------------------------------------------------------ */

export function ImageGalleryUploader({
  value,
  onChange,
}: {
  value: string[]
  onChange: (urls: string[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const images = value ?? []

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return
      setBusy(true)
      setError(null)
      try {
        const uploaded: string[] = []
        for (const file of Array.from(files)) {
          uploaded.push(await uploadToBlob(file))
        }
        onChange([...images, ...uploaded])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка загрузки')
      } finally {
        setBusy(false)
        if (inputRef.current) inputRef.current.value = ''
      }
    },
    [images, onChange],
  )

  function removeAt(index: number) {
    const url = images[index]
    if (url) deleteFromBlob(url)
    onChange(images.filter((_, i) => i !== index))
  }

  function move(index: number, dir: -1 | 1) {
    const next = [...images]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div className="flex flex-wrap gap-3">
        {images.map((url, i) => (
          <div
            key={url}
            className="group relative size-24 overflow-hidden rounded-lg border border-border bg-muted"
          >
            <Image src={url || '/placeholder.svg'} alt={`Фото ${i + 1}`} fill sizes="96px" className="object-cover" />
            {i === 0 && (
              <span className="absolute left-1 top-1 inline-flex items-center gap-0.5 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                <Star className="size-2.5 fill-current" />
                Главное
              </span>
            )}
            <button
              type="button"
              onClick={() => removeAt(i)}
              aria-label="Удалить фото"
              className="absolute right-1 top-1 rounded-md bg-background/80 p-1 text-destructive opacity-0 shadow-sm transition-opacity hover:bg-background group-hover:opacity-100"
            >
              <X className="size-3.5" />
            </button>
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-background/70 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label="Переместить влево"
                className="p-1 text-foreground disabled:opacity-30"
              >
                <ArrowLeft className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === images.length - 1}
                aria-label="Переместить вправо"
                className="p-1 text-foreground disabled:opacity-30"
              >
                <ArrowRight className="size-3.5" />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex size-24 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
          <span className="text-[10px]">{busy ? 'Загрузка' : 'Добавить'}</span>
        </button>
      </div>
      {error && <span className="text-xs text-destructive">{error}</span>}
      {images.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Первое фото — главное в галерее. Наведите на фото, чтобы изменить порядок или удалить.
        </p>
      )}
    </div>
  )
}
