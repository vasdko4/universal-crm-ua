'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { ImageIcon, Loader2, Upload, X } from 'lucide-react'
import type { AdminDictionary } from '@/lib/i18n/admin/dictionaries'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function ImageField({
  label,
  hint,
  value,
  onChange,
  size = 96,
  t,
}: {
  label: string
  hint: string
  value: string | null
  onChange: (v: string) => void
  size?: number
  t: AdminDictionary['settings']
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !data.url) throw new Error(data.error || t.imageUploadError)
      onChange(data.url)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.imageUploadError)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files)}
      />
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          aria-label={value ? `${t.imageReplaceAria}: ${label}` : `${t.imageUploadAria}: ${label}`}
          className="group relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-border bg-muted transition-colors hover:border-primary disabled:opacity-60"
          style={{ width: size, height: size }}
        >
          {value ? (
            <Image
              src={value || '/placeholder.svg'}
              alt={label}
              width={size}
              height={size}
              className="h-full w-full object-contain"
              unoptimized
            />
          ) : uploading ? (
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          ) : (
            <ImageIcon className="size-6 text-muted-foreground transition-colors group-hover:text-primary" />
          )}
          {value && (
            <span className="absolute inset-0 flex items-center justify-center bg-background/70 opacity-0 transition-opacity group-hover:opacity-100">
              {uploading ? (
                <Loader2 className="size-5 animate-spin text-foreground" />
              ) : (
                <Upload className="size-5 text-foreground" />
              )}
            </span>
          )}
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
              {value ? t.imageReplace : t.imageChooseFile}
            </Button>
            {value && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => onChange('')}
              >
                <X className="size-3.5" />
                {t.imageDelete}
              </Button>
            )}
          </div>
          <Input
            value={value ?? ''}
            placeholder={t.imageUrlPlaceholder}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
