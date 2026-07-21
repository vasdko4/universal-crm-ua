import {
  getReviews,
  getQuestions,
  getReviewsStats,
  getQuestionsStats,
} from '@/app/actions/feedback'
import { FeedbackManager } from '@/components/feedback/feedback-manager'
import { requirePermission } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; status?: string; page?: string }>
}) {
  await requirePermission('reviews')
  const sp = await searchParams
  const tab = sp.tab === 'questions' ? 'questions' : 'reviews'
  const page = Number(sp.page ?? '1') || 1

  const [reviews, questions, reviewsStats, questionsStats] = await Promise.all([
    getReviews(
      tab === 'reviews'
        ? { status: (sp.status as 'all' | 'pending' | 'approved' | 'rejected') ?? 'all', page }
        : { status: 'all', page: 1 }
    ),
    getQuestions(
      tab === 'questions'
        ? { status: (sp.status as 'all' | 'pending' | 'answered') ?? 'all', page }
        : { status: 'all', page: 1 }
    ),
    getReviewsStats(),
    getQuestionsStats(),
  ])

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
      <FeedbackManager
        reviews={reviews}
        questions={questions}
        reviewsStats={reviewsStats}
        questionsStats={questionsStats}
      />
    </div>
  )
}
