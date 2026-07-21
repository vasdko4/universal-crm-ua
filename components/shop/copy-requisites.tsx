'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function CopyRequisites({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="space-y-3">
      <pre className="whitespace-pre-wrap rounded-lg bg-muted p-4 text-sm text-foreground">
        {text}
      </pre>
      <Button variant="outline" size="sm" onClick={copy}>
        {copied ? (
          <>
            <Check className="size-4" /> Скопировано
          </>
        ) : (
          <>
            <Copy className="size-4" /> Копировать реквизиты
          </>
        )}
      </Button>
    </div>
  )
}
