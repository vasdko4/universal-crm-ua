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
      toast.success(s === 'approved' ? 'Отзыв одобрен' : s === 'rejected' ? 'Отзыв отклонён' : 'Возвращён на модерацию')
      refresh()
    })
  }
  function sendReply(id: number) {
    const text = replyDrafts[id]?.trim()
    if (!text) return
    startTransition(async () => {
      await replyToReview(id, text)
      toast.success('Ответ сохранён')
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
      toast.success('Отзыв удалён')
      refresh()
    })
  }

  /* Questions handlers */
  function sendAnswer(id: number) {
    const text = answerDrafts[id]?.trim()
    if (!text) {
      toast.error('Введите ответ')
      return
    }
    startTransition(async () => {
      const res = await answerQuestion(id, text)
      if (res.success) {
        toast.success('Ответ опубликован')
        setAnswerDrafts((d) => ({ ...d, [id]: '' }))
        refresh()
      } else {
        toast.error(res.error ?? 'Ошибка')
      }
    })
  }
  function confirmDeleteQuestion() {
    if (deleteQuestionId == null) return
    const id = deleteQuestionId
    setDeleteQuestionId(null)
    startTransition(async () => {
      await deleteQuestion(id)
      toast.success('Вопрос удалён')
      refresh()
    })
  }

  const list = tab === 'reviews' ? reviews : questions

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Отзывы и вопросы</h1>
        <p className="text-sm text-muted-foreground">Модерация обратной связи по товарам</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Отзывы" value={reviewsStats.total} icon={MessageSquare} />
        <StatCard label="На модерации" value={reviewsStats.pending} icon={Clock} accent="warning" />
        <StatCard label="Вопросы" value={questionsStats.total} icon={MessageCircleQuestion} />
        <StatCard label="Без ответа" value={questionsStats.pending} icon={Clock} accent="warning" />
      </div>

      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList>
          <TabsTrigger value="reviews">
            <MessageSquare className="size-4" /> Отзывы
          </TabsTrigger>
          <TabsTrigger value="questions">
            <MessageCircleQuestion className="size-4" /> Вопросы
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Status filters */}
      {tab === 'reviews' ? (
        <div className="flex flex-wrap gap-2">
          <FilterChip active={status === 'all'} onClick={() => pushParams({ status: undefined, page: undefined })}>
            Все ({reviewsStats.total})
          </FilterChip>
          <FilterChip active={status === 'pending'} onClick={() => pushParams({ status: 'pending', page: undefined })}>
            На модерации ({reviewsStats.pending})
          </FilterChip>
          <FilterChip active={status === 'approved'} onClick={() => pushParams({ status: 'approved', page: undefined })}>
            Одобренные ({reviewsStats.approved})
          </FilterChip>
          <FilterChip active={status === 'rejected'} onClick={() => pushParams({ status: 'rejected', page: undefined })}>
            Отклонённые ({reviewsStats.rejected})
          </FilterChip>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <FilterChip active={status === 'all'} onClick={() => pushParams({ status: undefined, page: undefined })}>
            Все ({questionsStats.total})
          </FilterChip>
          <FilterChip active={status === 'pending'} onClick={() => pushParams({ status: 'pending', page: undefined })}>
            Без ответа ({questionsStats.pending})
          </FilterChip>
          <FilterChip active={status === 'answered'} onClick={() => pushParams({ status: 'answered', page: undefined })}>
            Отвеченные ({questionsStats.answered})
          </FilterChip>
        </div>
      )}

      {/* Content */}
      {tab === 'reviews' ? (
        <div className="flex flex-col gap-4">
          {reviews.items.length === 0 && <EmptyState label="Отзывов нет" />}
          {reviews.items.map((r) => (
            <div key={r.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{r.authorName}</span>
                    {r.isVerifiedPurchase && (
                      <Badge className="border-success/30 bg-success/15 text-success">
                        <BadgeCheck className="size-3" /> Проверенная покупка
                      </Badge>
                    )}
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Stars value={r.rating} />
                    <span className="text-xs text-muted-foreground">
                      о товаре: {r.productName ?? `#${r.productId}`}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {r.status !== 'approved' && (
                    <Button size="sm" variant="outline" onClick={() => moderate(r.id, 'approved')} disabled={isPending}>
                      <Check className="size-4" /> Одобрить
                    </Button>
                  )}
                  {r.status !== 'rejected' && (
                    <Button size="sm" variant="outline" onClick={() => moderate(r.id, 'rejected')} disabled={isPending}>
                      <X className="size-4" /> Отклонить
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => setDeleteReviewId(r.id)} aria-label="Удалить">
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
                <ThumbsUp className="size-3.5" /> {r.helpfulCount} полезно
              </div>

              {r.adminReply ? (
                <div className="mt-3 rounded-md border-l-2 border-primary bg-muted/50 p-3">
                  <p className="text-xs font-medium text-primary">Ответ магазина</p>
                  <p className="mt-1 text-sm text-foreground/90">{r.adminReply}</p>
                </div>
              ) : (
                <div className="mt-3 flex gap-2">
                  <Textarea
                    value={replyDrafts[r.id] ?? ''}
                    onChange={(e) => setReplyDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                    placeholder="Ответить на отзыв..."
                    rows={1}
                    className="min-h-9"
                  />
                  <Button size="sm" variant="outline" onClick={() => sendReply(r.id)} disabled={isPending}>
                    <Reply className="size-4" /> Ответить
                  </Button>
                </div>
              )}
            </div>
          ))}
          <Pagination data={reviews} isPending={isPending} onPage={(p) => pushParams({ page: String(p) })} />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {questions.items.length === 0 && <EmptyState label="Вопросов нет" />}
          {questions.items.map((q) => (
            <div key={q.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{q.authorName}</span>
                    <StatusBadge status={q.status} />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    о товаре: {q.productName ?? `#${q.productId}`}
                  </span>
                </div>
                <Button size="icon" variant="ghost" onClick={() => setDeleteQuestionId(q.id)} aria-label="Удалить">
                  <Trash2 className="size-4" />
                </Button>
              </div>

              <p className="mt-3 text-sm text-foreground/90">
                <MessageCircleQuestion className="mr-1 inline size-4 text-muted-foreground" />
                {q.question}
              </p>

              {q.answer ? (
                <div className="mt-3 rounded-md border-l-2 border-primary bg-muted/50 p-3">
                  <p className="text-xs font-medium text-primary">Ответ магазина</p>
                  <p className="mt-1 text-sm text-foreground/90">{q.answer}</p>
                </div>
              ) : (
                <div className="mt-3 flex gap-2">
                  <Textarea
                    value={answerDrafts[q.id] ?? ''}
                    onChange={(e) => setAnswerDrafts((d) => ({ ...d, [q.id]: e.target.value }))}
                    placeholder="Написать ответ..."
                    rows={1}
                    className="min-h-9"
                  />
                  <Button size="sm" onClick={() => sendAnswer(q.id)} disabled={isPending}>
                    <Reply className="size-4" /> Ответить
                  </Button>
                </div>
              )}
            </div>
          ))}
          <Pagination data={questions} isPending={isPending} onPage={(p) => pushParams({ page: String(p) })} />
        </div>
      )}

      <AlertDialog open={deleteReviewId != null} onOpenChange={(o) => !o && setDeleteReviewId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить отзыв?</AlertDialogTitle>
            <AlertDialogDescription>Отзыв будет удалён безвозвратно.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteReview}>Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteQuestionId != null} onOpenChange={(o) => !o && setDeleteQuestionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить вопрос?</AlertDialogTitle>
            <AlertDialogDescription>Вопрос будет удалён безвозвратно.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteQuestion}>Удалить</AlertDialogAction>
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

function Stars({ value }: { value: number }) {
  return (
    <div className="flex" aria-label={`Оценка ${value} из 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={i < value ? 'size-4 fill-warning text-warning' : 'size-4 text-muted-foreground/30'}
        />
      ))}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'approved') return <Badge className="border-success/30 bg-success/15 text-success">Одобрен</Badge>
  if (status === 'rejected') return <Badge variant="destructive">Отклонён</Badge>
  if (status === 'answered') return <Badge className="border-success/30 bg-success/15 text-success">Отвечен</Badge>
  return <Badge className="border-warning/30 bg-warning/15 text-warning">На модерации</Badge>
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
}: {
  data: { page: number; totalPages: number }
  isPending: boolean
  onPage: (p: number) => void
}) {
  if (data.totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
        Страница {data.page} из {data.totalPages}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={data.page <= 1 || isPending} onClick={() => onPage(data.page - 1)}>
          <ChevronLeft className="size-4" /> Назад
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={data.page >= data.totalPages || isPending}
          onClick={() => onPage(data.page + 1)}
        >
          Вперёд <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
