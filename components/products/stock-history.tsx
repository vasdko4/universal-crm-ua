import { getStockMovements } from '@/app/actions/products'
import { getAdminDictionary } from '@/lib/i18n/admin/dictionaries'
import type { Locale } from '@/lib/i18n/config'

const REASON_UK: Record<string, string> = {
  sale: 'Продаж',
  cancel: 'Скасування',
  adjust: 'Коригування',
  bulk: 'Масова зміна',
  import: 'Імпорт',
  restore: 'Відновлення',
}

const REASON_RU: Record<string, string> = {
  sale: 'Продажа',
  cancel: 'Отмена',
  adjust: 'Корректировка',
  bulk: 'Массовое изменение',
  import: 'Импорт',
  restore: 'Восстановление',
}

export async function StockHistory({ productId, locale }: { productId: number; locale: Locale }) {
  const rows = await getStockMovements(productId, 40)
  const t = getAdminDictionary(locale).products
  const reasons = locale === 'uk' ? REASON_UK : REASON_RU

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold text-foreground">{t.stockHistory}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">—</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-1 pr-3">Δ</th>
                <th className="py-1 pr-3">{locale === 'uk' ? 'Після' : 'После'}</th>
                <th className="py-1 pr-3">{locale === 'uk' ? 'Причина' : 'Причина'}</th>
                <th className="py-1 pr-3">{locale === 'uk' ? 'Хто' : 'Кто'}</th>
                <th className="py-1">{locale === 'uk' ? 'Коли' : 'Когда'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className={`py-1.5 pr-3 font-medium ${r.delta < 0 ? 'text-destructive' : 'text-success'}`}>
                    {r.delta > 0 ? `+${r.delta}` : r.delta}
                  </td>
                  <td className="py-1.5 pr-3">{r.quantity_after ?? '—'}</td>
                  <td className="py-1.5 pr-3">{reasons[r.reason] ?? r.reason}</td>
                  <td className="py-1.5 pr-3 text-muted-foreground">{r.actor ?? '—'}</td>
                  <td className="py-1.5 text-muted-foreground">
                    {new Date(r.created_at).toLocaleString(locale === 'uk' ? 'uk-UA' : 'ru-RU', {
                      timeZone: 'Europe/Kyiv',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
