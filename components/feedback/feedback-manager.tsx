'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  setReviewStatus,
  replyToReview,
  deleteReview,
  answerQuestion,
  deleteQuestion,
} from '@/app/actions/feedback'
import type { ProductReview, ProductQuestion } from '@/lib/db/schema'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Star,
  Check,
  X,
  Trash2,
  MessageSquare,
  MessageCircleQuestion,
  ThumbsUp,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Reply,
  Clock,
} from 'lucide-react'
import { useAdminI18n } from '@/lib/i18n/admin/context'
import type { AdminDictionary } from '@/lib/i18n/admin/dictionaries'

type ReviewItem = ProductReview & { productName: string | null }
type QuestionItem = ProductQuestion & { productName: string | null }

type ListData<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

type ReviewsStats = { total: number; pending: number; approved: number; rejected: number }
type QuestionsStats = { total: number; pending: number; answered: number }

function tpl(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
    template,
  )
}

export function FeedbackManager({
  reviews,
  questions,
  reviewsStats,
  questionsStats,
}: {
  reviews: ListData<ReviewItem>
  questions: ListData<QuestionItem>
  reviewsStats: ReviewsStats
  questionsStats: QuestionsStats
}) {
  const { dict: t } = useAdminI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const tab = searchParams.get('tab') === 'questions' ? 'questions' : 'reviews'
  const status = searchParams.get('status') ?? 'all'

  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({})
  const [answerDrafts, setAnswerDrafts] = useState<Record<number, string>>({})
  const [deleteReviewId, setDeleteReviewId] = useState<number | null>(null)
  const [deleteQuestionId, setDeleteQuestionId] = useState<number | null>(null)

  function pushParams(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(next).forEach(([k, v]) => {
      if (v && v !== 'all') params.set(k, v)
      else params.delete(k)
    })
    startTransition(() => router.push(`/admin/reviews?${params.toString()}`))
  }

  function changeTab(v: string) {
    pushParams({ tab: v === 'reviews' ? undefined : v, status: undefined, page: undefined })
  }

  function refresh() {
    router.refresh()
  }

  /* Reviews handlers */
  function moderate(id: number, s: 'approved' | 'rejected' | 'pending') {
    startTransition(async () => {
      await setReviewStatus(id, s)
      toast.success(
        s === 'approved' ? t.feedback.toastReviewApproved : s === 'rejected' ? t.feedback.toastReviewRejected : t.feedback.toastReviewPending,
      )
      refresh()
    })
  }
  function sendReply(id: number) {
    const text = replyDrafts[id]?.trim()
    if (!text) return
    startTransition(async () => {
      await replyToReview(id, text)
      toast.success(t.feedback.toastReplySaved)
      setReplyDrafts((d) => ({ ...d, [id]: '' }))
      refresh()
    })
  }
  function confirmDeleteReview() {
    if (deleteReviewId == null) return
    const id = deleteReviewId
    setDeleteReviewId(null)
    startTransition(async () => {
      await deleteReview(id)
      toast.success(t.feedback.toastReviewDeleted)
      refresh()
    })
  }

  /* Questions handlers */
  function sendAnswer(id: number) {
    const text = answerDrafts[id]?.trim()
    if (!text) {
      toast.error(t.feedback.toastEnterAnswer)
      return
    }
    startTransition(async () => {
      const res = await answerQuestion(id, text)
      if (res.success) {
        toast.success(t.feedback.toastAnswerPublished)
        setAnswerDrafts((d) => ({ ...d, [id]: '' }))
        refresh()
      } else {
        toast.error(res.error ?? t.feedback.toastGenericError)
      }
    })
  }
  function confirmDeleteQuestion() {
    if (deleteQuestionId == null) return
    const id = deleteQuestionId
    setDeleteQuestionId(null)
    startTransition(async () => {
      await deleteQuestion(id)
      toast.success(t.feedback.toastQuestionDeleted)
      refresh()
    })
  }

  const list = tab === 'reviews' ? reviews : questions

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t.feedback.pageTitle}</h1>
        <p className="text-sm text-muted-foreground">{t.feedback.pageSubtitle}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label={t.feedback.statReviews} value={reviewsStats.total} icon={MessageSquare} />
        <StatCard label={t.feedback.statPending} value={reviewsStats.pending} icon={Clock} accent="warning" />
        <StatCard label={t.feedback.statQuestions} value={questionsStats.total} icon={MessageCircleQuestion} />
        <StatCard label={t.feedback.statUnanswered} value={questionsStats.pending} icon={Clock} accent="warning" />
      </div>

      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList>
          <TabsTrigger value="reviews">
            <MessageSquare className="size-4" /> {t.feedback.tabReviews}
          </TabsTrigger>
          <TabsTrigger value="questions">
            <MessageCircleQuestion className="size-4" /> {t.feedback.tabQuestions}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Status filters */}
      {tab === 'reviews' ? (
        <div className="flex flex-wrap gap-2">
          <FilterChip active={status === 'all'} onClick={() => pushParams({ status: undefined, page: undefined })}>
            {tpl(t.feedback.filterAllTemplate, { n: reviewsStats.total })}
          </FilterChip>
          <FilterChip active={status === 'pending'} onClick={() => pushParams({ status: 'pending', page: undefined })}>
            {tpl(t.feedback.filterPendingReviewsTemplate, { n: reviewsStats.pending })}
          </FilterChip>
          <FilterChip active={status === 'approved'} onClick={() => pushParams({ status: 'approved', page: undefined })}>
            {tpl(t.feedback.filterApprovedTemplate, { n: reviewsStats.approved })}
          </FilterChip>
          <FilterChip active={status === 'rejected'} onClick={() => pushParams({ status: 'rejected', page: undefined })}>
            {tpl(t.feedback.filterRejectedTemplate, { n: reviewsStats.rejected })}
          </FilterChip>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <FilterChip active={status === 'all'} onClick={() => pushParams({ status: undefined, page: undefined })}>
            {tpl(t.feedback.filterAllTemplate, { n: questionsStats.total })}
          </FilterChip>
          <FilterChip active={status === 'pending'} onClick={() => pushParams({ status: 'pending', page: undefined })}>
            {tpl(t.feedback.filterUnansweredTemplate, { n: questionsStats.pending })}
          </FilterChip>
          <FilterChip active={status === 'answered'} onClick={() => pushParams({ status: 'answered', page: undefined })}>
            {tpl(t.feedback.filterAnsweredTemplate, { n: questionsStats.answered })}
          </FilterChip>
        </div>
      )}

      {/* Content */}
      {tab === 'reviews' ? (
        <div className="flex flex-col gap-4">
          {reviews.items.length === 0 && <EmptyState label={t.feedback.noReviews} />}
          {reviews.items.map((r) => (
            <div key={r.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{r.authorName}</span>
                    {r.isVerifiedPurchase && (
                      <Badge className="border-success/30 bg-success/15 text-success">
                        <BadgeCheck className="size-3" /> {t.feedback.verifiedPurchase}
                      </Badge>
                    )}
                    <StatusBadge status={r.status} t={t} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Stars value={r.rating} t={t} />
                    <span className="text-xs text-muted-foreground">
                      {t.feedback.aboutProductPrefix} {r.productName ?? `#${r.productId}`}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {r.status !== 'approved' && (
                    <Button size="sm" variant="outline" onClick={() => moderate(r.id, 'approved')} disabled={isPending}>
                      <Check className="size-4" /> {t.feedback.approveButton}
                    </Button>
                  )}
                  {r.status !== 'rejected' && (
                    <Button size="sm" variant="outline" onClick={() => moderate(r.id, 'rejected')} disabled={isPending}>
                      <X className="size-4" /> {t.feedback.rejectButton}
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => setDeleteReviewId(r.id)} aria-label={t.feedback.deleteAria}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              {r.title && <p className="mt-3 font-medium text-foreground">{r.title}</p>}
              <p className="mt-1 text-sm text-foreground/90">{r.body}</p>
              <div className="mt-2 flex flex-wrap gap-4 text-sm">
                {r.pros && (
                  <p className="text-success">
                    <span className="font-medium">+ </span>
                    {r.pros}
                  </p>
                )}
                {r.cons && (
                  <p className="text-destructive">
                    <span className="font-medium">− </span>
                    {r.cons}
                  </p>
                )}
              </div>
              <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <ThumbsUp className="size-3.5" /> {r.helpfulCount} {t.feedback.helpfulSuffix}
              </div>

              {r.adminReply ? (
                <div className="mt-3 rounded-md border-l-2 border-primary bg-muted/50 p-3">
                  <p className="text-xs font-medium text-primary">{t.feedback.storeReplyLabel}</p>
                  <p className="mt-1 text-sm text-foreground/90">{r.adminReply}</p>
                </div>
              ) : (
                <div className="mt-3 flex gap-2">
                  <Textarea
                    value={replyDrafts[r.id] ?? ''}
                    onChange={(e) => setReplyDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                    placeholder={t.feedback.replyPlaceholder}
                    rows={1}
                    className="min-h-9"
                  />
                  <Button size="sm" variant="outline" onClick={() => sendReply(r.id)} disabled={isPending}>
                    <Reply className="size-4" /> {t.feedback.replyButton}
                  </Button>
                </div>
              )}
            </div>
          ))}
          <Pagination data={reviews} isPending={isPending} onPage={(p) => pushParams({ page: String(p) })} t={t} />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {questions.items.length === 0 && <EmptyState label={t.feedback.noQuestions} />}
          {questions.items.map((q) => (
            <div key={q.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{q.authorName}</span>
                    <StatusBadge status={q.status} t={t} />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {t.feedback.aboutProductPrefix} {q.productName ?? `#${q.productId}`}
                  </span>
                </div>
                <Button size="icon" variant="ghost" onClick={() => setDeleteQuestionId(q.id)} aria-label={t.feedback.deleteAria}>
                  <Trash2 className="size-4" />
                </Button>
              </div>

              <p className="mt-3 text-sm text-foreground/90">
                <MessageCircleQuestion className="mr-1 inline size-4 text-muted-foreground" />
                {q.question}
              </p>

              {q.answer ? (
                <div className="mt-3 rounded-md border-l-2 border-primary bg-muted/50 p-3">
                  <p className="text-xs font-medium text-primary">{t.feedback.storeReplyLabel}</p>
                  <p className="mt-1 text-sm text-foreground/90">{q.answer}</p>
                </div>
              ) : (
                <div className="mt-3 flex gap-2">
                  <Textarea
                    value={answerDrafts[q.id] ?? ''}
                    onChange={(e) => setAnswerDrafts((d) => ({ ...d, [q.id]: e.target.value }))}
                    placeholder={t.feedback.answerPlaceholder}
                    rows={1}
                    className="min-h-9"
                  />
                  <Button size="sm" onClick={() => sendAnswer(q.id)} disabled={isPending}>
                    <Reply className="size-4" /> {t.feedback.answerButton}
                  </Button>
                </div>
              )}
            </div>
          ))}
          <Pagination data={questions} isPending={isPending} onPage={(p) => pushParams({ page: String(p) })} t={t} />
        </div>
      )}

      <AlertDialog open={deleteReviewId != null} onOpenChange={(o) => !o && setDeleteReviewId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.feedback.deleteReviewTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.feedback.deleteReviewDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteReview}>{t.common.delete}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteQuestionId != null} onOpenChange={(o) => !o && setDeleteQuestionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.feedback.deleteQuestionTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.feedback.deleteQuestionDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteQuestion}>{t.common.delete}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string
  value: number
  icon: React.ElementType
  accent?: 'warning'
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
      <div
        className={
          accent === 'warning'
            ? 'flex size-9 items-center justify-center rounded-md bg-warning/15 text-warning'
            : 'flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary'
        }
      >
        <Icon className="size-4.5" />
      </div>
      <div>
        <p className="text-xl font-semibold leading-none text-foreground">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={
        active
          ? 'rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground'
          : 'rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground'
      }
    >
      {children}
    </button>
  )
}

function Stars({ value, t }: { value: number; t: AdminDictionary }) {
  return (
    <div className="flex" aria-label={tpl(t.feedback.ratingAriaTemplate, { value })}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={i < value ? 'size-4 fill-warning text-warning' : 'size-4 text-muted-foreground/30'}
        />
      ))}
    </div>
  )
}

function StatusBadge({ status, t }: { status: string; t: AdminDictionary }) {
  if (status === 'approved') return <Badge className="border-success/30 bg-success/15 text-success">{t.feedback.statusApproved}</Badge>
  if (status === 'rejected') return <Badge variant="destructive">{t.feedback.statusRejected}</Badge>
  if (status === 'answered') return <Badge className="border-success/30 bg-success/15 text-success">{t.feedback.statusAnswered}</Badge>
  return <Badge className="border-warning/30 bg-warning/15 text-warning">{t.feedback.statusPending}</Badge>
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
      <MessageSquare className="mb-3 size-10 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

function Pagination({
  data,
  isPending,
  onPage,
  t,
}: {
  data: { page: number; totalPages: number }
  isPending: boolean
  onPage: (p: number) => void
  t: AdminDictionary
}) {
  if (data.totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
        {tpl(t.feedback.pageOfTemplate, { page: data.page, total: data.totalPages })}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={data.page <= 1 || isPending} onClick={() => onPage(data.page - 1)}>
          <ChevronLeft className="size-4" /> {t.feedback.backButton}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={data.page >= data.totalPages || isPending}
          onClick={() => onPage(data.page + 1)}
        >
          {t.feedback.forwardButton} <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
