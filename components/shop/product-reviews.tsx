'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { submitReview } from '@/app/actions/shop'
import { useI18n } from '@/lib/i18n/client'
import { cn } from '@/lib/utils'

type Review = {
  id: number
  authorName: string
  rating: number
  body: string
  pros: string | null
  cons: string | null
  adminReply: string | null
  createdAt: Date | string | null
}

function Stars({ value, size = 'size-4' }: { value: number; size?: string }) {
  return (
    <div className="flex">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(size, n <= value ? 'fill-warning text-warning' : 'text-muted-foreground')}
        />
      ))}
    </div>
  )
}

export function ProductReviews({ productId, reviews }: { productId: number; reviews: Review[] }) {
  const { dict } = useI18n()
  const tp = dict.product
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(5)
  const [name, setName] = useState('')
  const [body, setBody] = useState('')
  const [pros, setPros] = useState('')
  const [cons, setCons] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const res = await submitReview({ productId, rating, body, pros, cons, authorName: name })
    setBusy(false)
    if (res.success) {
      toast.success(tp.reviewSent)
      setBody('')
      setPros('')
      setCons('')
      setName('')
      setRating(5)
      setOpen(false)
    } else {
      toast.error(res.error ?? tp.error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-foreground">{tp.reviews} ({reviews.length})</h3>
        <Button variant="outline" onClick={() => setOpen((v) => !v)}>
          {open ? tp.cancel : tp.writeReview}
        </Button>
      </div>

      {open && (
        <form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-card p-5">
          <div className="space-y-2">
            <Label>{tp.rating}</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n}/5`}>
                  <Star className={cn('size-7', n <= rating ? 'fill-warning text-warning' : 'text-muted-foreground')} />
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rev-name">{tp.yourName}</Label>
            <Input id="rev-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={tp.yourNamePlaceholder} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rev-pros">{tp.pros}</Label>
              <Input id="rev-pros" value={pros} onChange={(e) => setPros(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rev-cons">{tp.cons}</Label>
              <Input id="rev-cons" value={cons} onChange={(e) => setCons(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rev-body">{tp.comment} *</Label>
            <Textarea id="rev-body" value={body} onChange={(e) => setBody(e.target.value)} required rows={4} />
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? tp.sending : tp.submitReview}
          </Button>
        </form>
      )}

      {reviews.length === 0 ? (
        <p className="text-muted-foreground">{tp.noReviewsYet}</p>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">{r.authorName}</span>
                <Stars value={r.rating} />
              </div>
              <p className="mt-2 text-sm leading-relaxed text-foreground">{r.body}</p>
              {r.pros && <p className="mt-2 text-sm text-success">+ {r.pros}</p>}
              {r.cons && <p className="text-sm text-destructive">− {r.cons}</p>}
              {r.adminReply && (
                <div className="mt-3 rounded-lg bg-muted p-3 text-sm">
                  <span className="font-medium text-foreground">{tp.storeReply}</span>{' '}
                  <span className="text-muted-foreground">{r.adminReply}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
