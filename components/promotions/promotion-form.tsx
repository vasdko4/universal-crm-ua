'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createPromotion, generatePromoCode, type PromotionInput } from '@/app/actions/promotions'
import {
  ArrowLeft,
  Ticket,
  Tag,
  RefreshCw,
  Package,
  Layers,
  Globe,
  ListChecks,
  CalendarDays,
  BarChart3,
  Check,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAdminI18n } from '@/lib/i18n/admin/context'

type Option = { id: number; name: string | null }

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100'
const labelClass = 'mb-1.5 block text-sm font-medium text-slate-700'
const cardClass = 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm'
const cardTitleClass = 'mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function PromotionForm({ groups, products }: { groups: Option[]; products: Option[] }) {
  const { dict: t } = useAdminI18n()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [type, setType] = useState<'promocode' | 'discount'>('promocode')
  const [name, setName] = useState('')
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage')
  const [discountValue, setDiscountValue] = useState('')
  const [promoCode, setPromoCode] = useState('')

  const [targetType, setTargetType] = useState<'all' | 'groups' | 'products'>('all')
  const [groupIds, setGroupIds] = useState<number[]>([])
  const [productIds, setProductIds] = useState<number[]>([])

  const [limitUsage, setLimitUsage] = useState(false)
  const [usageLimit, setUsageLimit] = useState('')
  const [limitMinOrder, setLimitMinOrder] = useState(false)
  const [minOrderAmount, setMinOrderAmount] = useState('')
  const [noStacking, setNoStacking] = useState(false)
  const [excludeWholesale, setExcludeWholesale] = useState(false)

  const [startsAt, setStartsAt] = useState(todayStr())
  const [hasEnd, setHasEnd] = useState(false)
  const [endsAt, setEndsAt] = useState('')

  function toggleId(list: number[], id: number, setter: (v: number[]) => void) {
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])
  }

  async function handleGenerate() {
    const code = await generatePromoCode()
    setPromoCode(code)
  }

  const summary = useMemo(() => {
    const rows: { label: string; value: string; done: boolean }[] = []
    rows.push({
      label: t.promotions.summaryTypeLabel,
      value: type === 'promocode' ? t.promotions.summaryTypePromo : t.promotions.summaryTypeDiscount,
      done: true,
    })
    rows.push({ label: t.promotions.summaryNameLabel, value: name || '—', done: !!name.trim() })
    rows.push({
      label: t.promotions.summaryDiscountLabel,
      value: discountValue
        ? discountType === 'percentage'
          ? `${discountValue}%`
          : `${discountValue} ₴`
        : '—',
      done: Number(discountValue) > 0,
    })
    if (type === 'promocode') {
      rows.push({ label: t.promotions.summaryPromoCodeLabel, value: promoCode || '—', done: !!promoCode.trim() })
    }
    rows.push({
      label: t.promotions.summaryScopeLabel,
      value:
        targetType === 'all'
          ? t.promotions.targetAll
          : targetType === 'groups'
            ? `${t.promotions.summaryGroupsPrefix} (${groupIds.length})`
            : `${t.promotions.summaryProductsPrefix} (${productIds.length})`,
      done: targetType === 'all' || (targetType === 'groups' ? groupIds.length > 0 : productIds.length > 0),
    })
    const limits: string[] = []
    if (limitUsage && usageLimit) limits.push(`${t.promotions.summaryLimitUsagePrefix} ${usageLimit}`)
    if (limitMinOrder && minOrderAmount) limits.push(`${t.promotions.summaryLimitMinOrderPrefix} ${minOrderAmount} ₴`)
    if (noStacking) limits.push(t.promotions.summaryNoStacking)
    if (excludeWholesale) limits.push(t.promotions.summaryExcludeWholesale)
    rows.push({
      label: t.promotions.summaryLimitsLabel,
      value: limits.length ? limits.join(', ') : t.promotions.summaryNone,
      done: true,
    })
    rows.push({
      label: t.promotions.summaryDatesLabel,
      value:
        hasEnd && endsAt
          ? `${startsAt} → ${endsAt}`
          : t.promotions.summaryFromNoEnd.replace('{date}', startsAt),
      done: true,
    })
    return rows
  }, [
    t, type, name, discountType, discountValue, promoCode, targetType, groupIds, productIds,
    limitUsage, usageLimit, limitMinOrder, minOrderAmount, noStacking, excludeWholesale,
    startsAt, hasEnd, endsAt,
  ])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload: PromotionInput = {
      type,
      name,
      discountType,
      discountValue: Number(discountValue),
      promoCode: type === 'promocode' ? promoCode : null,
      targetType,
      targetGroupIds: groupIds,
      targetProductIds: productIds,
      usageLimit: limitUsage && usageLimit ? Number(usageLimit) : null,
      minOrderAmount: limitMinOrder && minOrderAmount ? Number(minOrderAmount) : null,
      noStacking,
      excludeWholesale,
      startsAt,
      endsAt: hasEnd && endsAt ? endsAt : null,
      isActive: true,
    }
    startTransition(async () => {
      const res = await createPromotion(payload)
      if (res.success) {
        toast.success(t.promotions.toastCreated)
        router.push('/admin/promotions')
        router.refresh()
      } else {
        toast.error(res.error ?? t.promotions.toastCreateError)
      }
    })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-6 py-4">
        <Link
          href="/admin/promotions"
          className="flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
          aria-label={t.promotions.backAria}
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-slate-900">{t.promotions.formTitleNew}</h1>
          <p className="text-sm text-slate-500">{t.promotions.formSubtitle}</p>
        </div>
        <button
          form="promo-form"
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 disabled:opacity-60"
        >
          {isPending ? t.promotions.saveButtonSaving : t.promotions.saveButtonDefault}
        </button>
      </header>

      <form
        id="promo-form"
        onSubmit={handleSubmit}
        className="mx-auto grid max-w-6xl gap-6 px-6 py-6 lg:grid-cols-[1fr_340px]"
      >
        {/* Левая колонка */}
        <div className="flex flex-col gap-6">
          {/* Основная информация */}
          <section className={cardClass}>
            <h2 className={cardTitleClass}>
              <Tag className="size-4 text-violet-600" />
              {t.promotions.sectionMainInfo}
            </h2>

            <div className="mb-4 grid grid-cols-2 gap-3">
              <TypeCard
                active={type === 'promocode'}
                icon={<Ticket className="size-5" />}
                title={t.promotions.typePromoTitle}
                desc={t.promotions.typePromoDesc}
                onClick={() => setType('promocode')}
              />
              <TypeCard
                active={type === 'discount'}
                icon={<Tag className="size-5" />}
                title={t.promotions.typeDiscountTitle}
                desc={t.promotions.typeDiscountDesc}
                onClick={() => setType('discount')}
              />
            </div>

            <div className="mb-4">
              <label className={labelClass} htmlFor="promo-name">
                {t.promotions.nameLabel}
              </label>
              <input
                id="promo-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.promotions.namePlaceholder}
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{t.promotions.discountTypeLabel}</label>
                <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                  <button
                    type="button"
                    onClick={() => setDiscountType('percentage')}
                    className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                      discountType === 'percentage' ? 'bg-violet-600 text-white' : 'text-slate-600'
                    }`}
                  >
                    {t.promotions.discountTypePercent}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('fixed')}
                    className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                      discountType === 'fixed' ? 'bg-violet-600 text-white' : 'text-slate-600'
                    }`}
                  >
                    {t.promotions.discountTypeFixed}
                  </button>
                </div>
              </div>
              <div>
                <label className={labelClass} htmlFor="promo-value">
                  {t.promotions.discountValueLabel}
                </label>
                <input
                  id="promo-value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder={discountType === 'percentage' ? '15' : '300'}
                  className={inputClass}
                />
              </div>
            </div>

            {type === 'promocode' && (
              <div className="mt-4">
                <label className={labelClass} htmlFor="promo-code">
                  {t.promotions.promoCodeLabel}
                </label>
                <div className="flex gap-2">
                  <input
                    id="promo-code"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    placeholder="SPRING15"
                    className={`${inputClass} font-mono uppercase`}
                  />
                  <button
                    type="button"
                    onClick={handleGenerate}
                    className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-100"
                  >
                    <RefreshCw className="size-4" />
                    {t.promotions.generateButton}
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Область действия */}
          <section className={cardClass}>
            <h2 className={cardTitleClass}>
              <Globe className="size-4 text-violet-600" />
              {t.promotions.sectionScope}
            </h2>
            <div className="grid gap-2">
              <RadioRow
                active={targetType === 'all'}
                icon={<Globe className="size-4" />}
                title={t.promotions.scopeAllTitle}
                desc={t.promotions.scopeAllDesc}
                onClick={() => setTargetType('all')}
              />
              <RadioRow
                active={targetType === 'groups'}
                icon={<Layers className="size-4" />}
                title={t.promotions.scopeGroupsTitle}
                desc={t.promotions.scopeGroupsDesc}
                onClick={() => setTargetType('groups')}
              />
              <RadioRow
                active={targetType === 'products'}
                icon={<Package className="size-4" />}
                title={t.promotions.scopeProductsTitle}
                desc={t.promotions.scopeProductsDesc}
                onClick={() => setTargetType('products')}
              />
            </div>

            {targetType === 'groups' && (
              <ChipSelect
                options={groups}
                selected={groupIds}
                onToggle={(id) => toggleId(groupIds, id, setGroupIds)}
                empty={t.promotions.noGroups}
              />
            )}
            {targetType === 'products' && (
              <ChipSelect
                options={products}
                selected={productIds}
                onToggle={(id) => toggleId(productIds, id, setProductIds)}
                empty={t.promotions.noProducts}
              />
            )}
          </section>

          {/* Ограничения */}
          <section className={cardClass}>
            <h2 className={cardTitleClass}>
              <ListChecks className="size-4 text-violet-600" />
              {t.promotions.sectionLimits}
            </h2>
            <div className="grid gap-3">
              <CheckRow
                checked={limitUsage}
                onChange={setLimitUsage}
                title={t.promotions.limitUsageTitle}
              >
                {limitUsage && (
                  <input
                    type="number"
                    min="1"
                    value={usageLimit}
                    onChange={(e) => setUsageLimit(e.target.value)}
                    placeholder={t.promotions.limitUsagePlaceholder}
                    className={`${inputClass} mt-2`}
                  />
                )}
              </CheckRow>
              <CheckRow
                checked={limitMinOrder}
                onChange={setLimitMinOrder}
                title={t.promotions.limitMinOrderTitle}
              >
                {limitMinOrder && (
                  <input
                    type="number"
                    min="0"
                    value={minOrderAmount}
                    onChange={(e) => setMinOrderAmount(e.target.value)}
                    placeholder={t.promotions.limitMinOrderPlaceholder}
                    className={`${inputClass} mt-2`}
                  />
                )}
              </CheckRow>
              <CheckRow
                checked={noStacking}
                onChange={setNoStacking}
                title={t.promotions.noStackingTitle}
              />
              <CheckRow
                checked={excludeWholesale}
                onChange={setExcludeWholesale}
                title={t.promotions.excludeWholesaleTitle}
              />
            </div>
          </section>

          {/* Сроки действия */}
          <section className={cardClass}>
            <h2 className={cardTitleClass}>
              <CalendarDays className="size-4 text-violet-600" />
              {t.promotions.sectionDates}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} htmlFor="promo-start">
                  {t.promotions.startDateLabel}
                </label>
                <input
                  id="promo-start"
                  type="date"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="promo-end">
                  {t.promotions.endDateLabel}
                </label>
                <input
                  id="promo-end"
                  type="date"
                  value={endsAt}
                  disabled={!hasEnd}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className={`${inputClass} disabled:cursor-not-allowed disabled:bg-slate-100`}
                />
              </div>
            </div>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={hasEnd}
                onChange={(e) => setHasEnd(e.target.checked)}
                className="size-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
              />
              {t.promotions.setEndDateLabel}
            </label>
          </section>
        </div>

        {/* Правая колонка */}
        <aside className="flex flex-col gap-6 lg:sticky lg:top-6 lg:self-start">
          <section className={cardClass}>
            <h2 className={cardTitleClass}>
              <ListChecks className="size-4 text-violet-600" />
              {t.promotions.sectionSummary}
            </h2>
            <ul className="grid gap-2.5">
              {summary.map((row) => (
                <li key={row.label} className="flex items-start gap-2 text-sm">
                  <span
                    className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full ${
                      row.done ? 'bg-violet-600 text-white' : 'bg-slate-200 text-slate-400'
                    }`}
                  >
                    {row.done && <Check className="size-3" />}
                  </span>
                  <span className="flex-1 text-slate-500">{row.label}</span>
                  <span className="max-w-[55%] truncate text-right font-medium text-slate-900">
                    {row.value}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className={cardClass}>
            <h2 className={cardTitleClass}>
              <BarChart3 className="size-4 text-violet-600" />
              {t.promotions.sectionUsageStats}
            </h2>
            <div className="grid grid-cols-1 gap-3">
              <StatBox label={t.promotions.statAppliedCount} value="0" />
              <StatBox label={t.promotions.statOrdersTotal} value="0 ₴" />
              <StatBox label={t.promotions.statDiscountTotal} value="0 ₴" />
            </div>
            <p className="mt-3 text-xs text-slate-400">{t.promotions.statsHint}</p>
          </section>
        </aside>
      </form>
    </div>
  )
}

function TypeCard({
  active,
  icon,
  title,
  desc,
  onClick,
}: {
  active: boolean
  icon: React.ReactNode
  title: string
  desc: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
        active ? 'border-violet-600 bg-violet-50' : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <span className={active ? 'text-violet-600' : 'text-slate-400'}>{icon}</span>
      <span>
        <span className="block text-sm font-semibold text-slate-900">{title}</span>
        <span className="block text-xs text-slate-500">{desc}</span>
      </span>
    </button>
  )
}

function RadioRow({
  active,
  icon,
  title,
  desc,
  onClick,
}: {
  active: boolean
  icon: React.ReactNode
  title: string
  desc: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
        active ? 'border-violet-600 bg-violet-50' : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <span
        className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${
          active ? 'border-violet-600' : 'border-slate-300'
        }`}
      >
        {active && <span className="size-2.5 rounded-full bg-violet-600" />}
      </span>
      <span className={active ? 'text-violet-600' : 'text-slate-400'}>{icon}</span>
      <span className="flex-1">
        <span className="block text-sm font-medium text-slate-900">{title}</span>
        <span className="block text-xs text-slate-500">{desc}</span>
      </span>
    </button>
  )
}

function CheckRow({
  checked,
  onChange,
  title,
  children,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  title: string
  children?: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="size-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
        />
        {title}
      </label>
      {children}
    </div>
  )
}

function ChipSelect({
  options,
  selected,
  onToggle,
  empty,
}: {
  options: Option[]
  selected: number[]
  onToggle: (id: number) => void
  empty: string
}) {
  if (!options.length) {
    return <p className="mt-3 text-sm text-slate-400">{empty}</p>
  }
  return (
    <div className="mt-3 flex max-h-52 flex-wrap gap-2 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50 p-3">
      {options.map((o) => {
        const active = selected.includes(o.id)
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onToggle(o.id)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              active
                ? 'bg-violet-600 text-white'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-violet-300'
            }`}
          >
            {o.name || `#${o.id}`}
          </button>
        )
      })}
    </div>
  )
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  )
}
