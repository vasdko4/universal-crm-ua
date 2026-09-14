'use client'

import type { Locale } from '@/lib/i18n/config'
import type { SetupDictionary } from '@/lib/i18n/setup'

export function SetupLangSwitch({
  locale,
  t,
  onChange,
}: {
  locale: Locale
  t: SetupDictionary
  onChange: (locale: Locale) => void
}) {
  return (
    <div className="mb-3 flex justify-end" role="group" aria-label="Language">
      <div className="inline-flex rounded-lg border border-border p-0.5 text-xs font-medium">
        <button
          type="button"
          onClick={() => onChange('uk')}
          className={
            'rounded-md px-2.5 py-1 transition-colors ' +
            (locale === 'uk' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')
          }
        >
          {t.langUk}
        </button>
        <button
          type="button"
          onClick={() => onChange('ru')}
          className={
            'rounded-md px-2.5 py-1 transition-colors ' +
            (locale === 'ru' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')
          }
        >
          {t.langRu}
        </button>
      </div>
    </div>
  )
}
