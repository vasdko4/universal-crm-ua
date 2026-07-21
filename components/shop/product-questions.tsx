'use client'

import { useState } from 'react'
import { MessageCircleQuestion } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { submitQuestion } from '@/app/actions/shop'

type Question = {
  id: number
  authorName: string
  question: string
  answer: string | null
  createdAt: Date | string | null
}

export function ProductQuestions({ productId, questions }: { productId: number; questions: Question[] }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const res = await submitQuestion({ productId, question, authorName: name })
    setBusy(false)
    if (res.success) {
      toast.success('Вопрос отправлен! Мы ответим после проверки')
      setQuestion('')
      setName('')
      setOpen(false)
    } else {
      toast.error(res.error ?? 'Ошибка')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-foreground">Вопросы ({questions.length})</h3>
        <Button variant="outline" onClick={() => setOpen((v) => !v)}>
          {open ? 'Отмена' : 'Задать вопрос'}
        </Button>
      </div>

      {open && (
        <form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-card p-5">
          <div className="space-y-2">
            <Label htmlFor="q-name">Имя</Label>
            <Input id="q-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ваше имя" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="q-body">Вопрос *</Label>
            <Textarea id="q-body" value={question} onChange={(e) => setQuestion(e.target.value)} required rows={3} />
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? 'Отправка...' : 'Отправить вопрос'}
          </Button>
        </form>
      )}

      {questions.length === 0 ? (
        <p className="text-muted-foreground">Вопросов пока нет. Задайте первым!</p>
      ) : (
        <div className="space-y-4">
          {questions.map((q) => (
            <div key={q.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start gap-2">
                <MessageCircleQuestion className="mt-0.5 size-5 shrink-0 text-primary" />
                <div>
                  <p className="font-medium text-foreground">{q.authorName}</p>
                  <p className="text-sm text-foreground">{q.question}</p>
                </div>
              </div>
              {q.answer && (
                <div className="mt-3 rounded-lg bg-muted p-3 text-sm">
                  <span className="font-medium text-foreground">Ответ:</span>{' '}
                  <span className="text-muted-foreground">{q.answer}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
