'use client'

import { useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import {
  Store,
  Share2,
  Mail,
  BarChart3,
  ImageIcon,
  Loader2,
  Save,
  Palette,
  Check,
  Globe,
  Phone,
  Plus,
  Trash2,
  Clock,
  MapPin,
  MessageCircle,
  Power,
  Search,
  Bell,
  Send,
  Upload,
  X,
  KeyRound,
  Eye,
  EyeOff,
  LayoutTemplate,
} from 'lucide-react'
import { TEMPLATES } from '@/lib/shop/templates'
import { cn } from '@/lib/utils'
import { useAdminI18n } from '@/lib/i18n/admin/context'
import type { AdminDictionary } from '@/lib/i18n/admin/dictionaries'
import { useClientOrigin } from '@/lib/hooks/use-client-only'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  clearSiteCache,
  updateStoreSettings,
  type HomeHeroLocaleContent,
  type HomeBenefitItem,
  type StoreSettingsData,
  type WeekDay,
  type WidgetChannelKey,
} from '@/app/actions/settings-store'
import type { SectionProps } from './settings-types'

export function DesignSection({ data, setData, t }: SectionProps) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">{t.templateTitle}</h2>
          <p className="text-sm text-muted-foreground">{t.templateDesc}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TEMPLATES.map((tpl) => {
            const active = data.activeTemplate === tpl.id
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => setData((d) => ({ ...d, activeTemplate: tpl.id }))}
                aria-pressed={active}
                className={cn(
                  'group relative flex flex-col gap-3 overflow-hidden rounded-xl border-2 p-3 text-left transition-colors',
                  active ? 'border-primary' : 'border-border hover:border-primary/40',
                )}
              >
                {active && (
                  <span className="absolute right-2 top-2 z-10 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-4" />
                  </span>
                )}
                {tpl.premium && (
                  <span className="absolute left-2 top-2 z-10 rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-background">
                    {t.premiumBadge}
                  </span>
                )}
                {/* Mini storefront preview */}
                <div
                  className="flex flex-col gap-2 rounded-lg p-3"
                  style={{ backgroundColor: tpl.swatches.bg, borderRadius: tpl.radius }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="h-2 w-14 rounded-full"
                      style={{ backgroundColor: tpl.swatches.primary }}
                    />
                    <span
                      className="h-2 w-6 rounded-full"
                      style={{ backgroundColor: tpl.swatches.accent }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[0, 1].map((i) => (
                      <div
                        key={i}
                        className="flex flex-col gap-1.5 p-2"
                        style={{
                          backgroundColor: tpl.swatches.card,
                          borderRadius: `calc(${tpl.radius} * 0.6)`,
                        }}
                      >
                        <span
                          className="h-6 w-full"
                          style={{
                            backgroundColor: tpl.swatches.accent,
                            borderRadius: `calc(${tpl.radius} * 0.4)`,
                          }}
                        />
                        <span
                          className="h-1.5 w-3/4 rounded-full"
                          style={{ backgroundColor: tpl.swatches.primary, opacity: 0.7 }}
                        />
                        <span
                          className="h-4 w-full"
                          style={{
                            backgroundColor: tpl.swatches.primary,
                            borderRadius: `calc(${tpl.radius} * 0.4)`,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{tpl.name}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">{tpl.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex max-w-xl flex-col gap-3 border-t border-border pt-6">
        <div className="flex items-center gap-2">
          <Globe className="size-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">{t.defaultLangTitle}</h2>
        </div>
        <p className="text-sm text-muted-foreground">{t.defaultLangDesc}</p>
        <Select
          value={data.defaultLocale}
          onValueChange={(v) => setData((d) => ({ ...d, defaultLocale: v }))}
        >
          <SelectTrigger className="max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="uk">Українська</SelectItem>
            <SelectItem value="ru">Русский</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

function ImageField({
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
