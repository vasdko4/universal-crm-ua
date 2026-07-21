'use client'

import { useState } from 'react'
import { Phone, Mail, X, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ContactWidget, WidgetChannelKey } from '@/app/actions/settings-store'

/* Brand glyphs (lucide has no brand icons). Kept minimal and monochrome. */
function ViberIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M11.4 0C9.5.1 5.4.4 3.1 2.5 1.4 4.2 1 6.5.9 9.4.9 12.3.8 17.7 6 19.2v2.3c0 .8.9 1.2 1.5.7l1.9-2c.5 0 1 .1 1.6.1 1.9-.1 6-.4 8.3-2.5 2.3-2.1 1.9-8.4 1.6-11.4-.2-1.7-1.7-4-3.2-4.7C15.8.5 13.3-.1 11.4 0Zm.3 1.8c1.6-.1 3.7.4 4.5.8 1 .5 2.2 2.3 2.4 3.6.2 2.5.6 8-1.1 9.6-1.8 1.6-5.4 1.9-7.1 2-.5 0-1 0-1.5-.1l-2.3 2.3v-2.6c-4.4-1.2-4.3-5.7-4.2-8.1.1-2.5.4-4.5 1.7-5.8 1.8-1.6 5.4-1.7 7-1.7Z" />
      <path d="M12 4.6c-.3 0-.3.5 0 .5 2.5 0 4.5 1.7 4.5 4.6 0 .3.5.3.5 0 0-3.1-2.2-5.1-5-5.1Zm.1 1.6c-.3 0-.3.5 0 .5 1.6.1 2.4 1 2.5 2.7 0 .3.5.3.5 0-.1-2-1.2-3.1-3-3.2Zm-2.6.2c-.3-.1-.6 0-.9.1l-.1.1c-.6.3-1.2 1-1 1.9.2.9.7 2 1.7 3.2.9 1.1 2 1.7 2.8 1.9.9.2 1.6-.4 1.9-1v-.1c.1-.3.2-.6.1-.9-.2-.5-1.4-1.1-1.7-1.1-.2 0-.4.1-.6.5-.1.2-.3.3-.5.2-.6-.2-1.2-.9-1.4-1.5 0-.2 0-.4.2-.5.3-.2.5-.4.4-.7-.1-.4-.6-1.6-1-1.9-.1-.1-.2-.2-.4-.2Zm3 .8c-.3 0-.3.5 0 .5.6 0 .9.4 1 .9 0 .3.5.3.5 0-.1-.8-.6-1.3-1.5-1.4Z" />
    </svg>
  )
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M23.1 3.8 19.6 20.3c-.3 1.2-1 1.5-2 .9l-5.5-4-2.7 2.6c-.3.3-.5.5-1.1.5l.4-5.6L18.8 5.6c.4-.4-.1-.6-.7-.2L5 13.4l-5.5-1.7c-1.2-.4-1.2-1.2.3-1.8L21.6 2c1-.4 1.9.2 1.5 1.8Z" />
    </svg>
  )
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 0a11.8 11.8 0 0 0-10 18.1L0 24l6-1.9A11.8 11.8 0 1 0 12 0Zm0 21.5c-1.8 0-3.6-.5-5.1-1.4l-.4-.2-3.5 1 1-3.5-.2-.4A9.5 9.5 0 1 1 12 21.5Zm5.4-7.1c-.3-.1-1.7-.9-2-1-.3-.1-.5-.1-.7.2s-.7 1-.9 1.1c-.2.2-.3.2-.6.1a7.7 7.7 0 0 1-3.8-3.3c-.3-.5.3-.5.8-1.5.1-.2 0-.4 0-.5s-.7-1.6-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.3 5.2 4.6 2 .8 2.7.9 3.6.8.6-.1 1.7-.7 2-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3Z" />
    </svg>
  )
}

const META: Record<
  WidgetChannelKey,
  { label: string; Icon: (p: { className?: string }) => React.ReactElement; className: string; href: (v: string) => string }
> = {
  phone: {
    label: 'Телефон',
    Icon: (p) => <Phone {...p} />,
    className: 'bg-emerald-600 hover:bg-emerald-700',
    href: (v) => `tel:${v.replace(/[^\d+]/g, '')}`,
  },
  whatsapp: {
    label: 'WhatsApp',
    Icon: WhatsAppIcon,
    className: 'bg-[#25D366] hover:bg-[#1eb855]',
    href: (v) => `https://wa.me/${v.replace(/[^\d]/g, '')}`,
  },
  telegram: {
    label: 'Telegram',
    Icon: TelegramIcon,
    className: 'bg-[#229ED9] hover:bg-[#1b86ba]',
    href: (v) =>
      v.startsWith('http') ? v : `https://t.me/${v.replace(/^@/, '').replace(/[^\w]/g, '')}`,
  },
  viber: {
    label: 'Viber',
    Icon: ViberIcon,
    className: 'bg-[#7360F2] hover:bg-[#5f4de0]',
    href: (v) => (v.startsWith('http') ? v : `viber://chat?number=${v.replace(/[^\d+]/g, '')}`),
  },
  email: {
    label: 'Email',
    Icon: (p) => <Mail {...p} />,
    className: 'bg-slate-600 hover:bg-slate-700',
    href: (v) => `mailto:${v}`,
  },
}

const ORDER: WidgetChannelKey[] = ['phone', 'whatsapp', 'telegram', 'viber', 'email']

export function ContactWidgetButton({ widget }: { widget: ContactWidget }) {
  const [open, setOpen] = useState(false)

  const channels = ORDER.map((key) => ({ key, ...widget.channels[key] })).filter(
    (c) => c.enabled && c.value.trim(),
  )

  if (!widget.enabled || channels.length === 0) return null

  return (
    <div className="fixed bottom-20 right-5 z-50 flex flex-col items-end gap-3 lg:bottom-5">
      {/* Channel list */}
      <div
        className={cn(
          'flex flex-col items-end gap-2 transition-all duration-200',
          open ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0',
        )}
      >
        {channels.map(({ key, value }, i) => {
          const meta = META[key]
          const external = key !== 'phone' && key !== 'email'
          return (
            <a
              key={key}
              href={meta.href(value)}
              target={external ? '_blank' : undefined}
              rel={external ? 'noreferrer' : undefined}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2"
              style={{ transitionDelay: open ? `${i * 30}ms` : '0ms' }}
            >
              <span className="rounded-md bg-foreground/90 px-2 py-1 text-xs font-medium text-background shadow-sm">
                {meta.label}
              </span>
              <span
                className={cn(
                  'flex size-11 items-center justify-center rounded-full text-white shadow-lg transition-colors',
                  meta.className,
                )}
              >
                <meta.Icon className="size-5" />
              </span>
            </a>
          )
        })}
      </div>

      {/* Main toggle button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? 'Закрыть контакты' : 'Связаться с магазином'}
        className={cn(
          'flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition-transform hover:scale-105 active:scale-95',
        )}
      >
        {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
      </button>
    </div>
  )
}
