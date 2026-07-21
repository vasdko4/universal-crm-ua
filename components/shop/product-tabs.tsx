'use client'

import { sanitizeContent } from '@/lib/shop/sanitize'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ProductReviews } from '@/components/shop/product-reviews'
import { ProductQuestions } from '@/components/shop/product-questions'

type Characteristic = { name: string; value: string }
type Review = React.ComponentProps<typeof ProductReviews>['reviews'][number]
type Question = React.ComponentProps<typeof ProductQuestions>['questions'][number]

export function ProductTabs({
  productId,
  description,
  characteristics,
  reviews,
  questions,
}: {
  productId: number
  description: string | null
  characteristics: Characteristic[]
  reviews: Review[]
  questions: Question[]
}) {
  return (
    <Tabs defaultValue="description" className="w-full">
      <TabsList className="flex w-full flex-wrap justify-start">
        <TabsTrigger value="description">Описание</TabsTrigger>
        {characteristics.length > 0 && <TabsTrigger value="specs">Характеристики</TabsTrigger>}
        <TabsTrigger value="reviews">Отзывы ({reviews.length})</TabsTrigger>
        <TabsTrigger value="questions">Вопросы ({questions.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="description" className="pt-6">
        {description ? (
          <div
            className="prose prose-sm max-w-none text-sm leading-relaxed text-foreground [&_a]:text-primary [&_a]:underline [&_li]:my-1 [&_p]:my-3 [&_strong]:font-semibold [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: sanitizeContent(description) }}
          />
        ) : (
          <p className="text-muted-foreground">Описание отсутствует.</p>
        )}
      </TabsContent>

      {characteristics.length > 0 && (
        <TabsContent value="specs" className="pt-6">
          <dl className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {characteristics.map((c, i) => (
              <div key={i} className="flex gap-4 px-4 py-3 odd:bg-muted/40">
                <dt className="w-1/2 text-sm text-muted-foreground">{c.name}</dt>
                <dd className="w-1/2 text-sm font-medium text-foreground">{c.value}</dd>
              </div>
            ))}
          </dl>
        </TabsContent>
      )}

      <TabsContent value="reviews" className="pt-6">
        <ProductReviews productId={productId} reviews={reviews} />
      </TabsContent>

      <TabsContent value="questions" className="pt-6">
        <ProductQuestions productId={productId} questions={questions} />
      </TabsContent>
    </Tabs>
  )
}
