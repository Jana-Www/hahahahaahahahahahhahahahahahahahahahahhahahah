import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { getUser } from '../../lib/auth'
import { formatDate, daysBetween, VACATION_STATUS_LABEL, VACATION_STATUS_COLOR } from '../../lib/utils'
import type { User, VacationBlock, WishRequest } from '../../lib/types'

const YEAR = new Date().getFullYear()

type WishVariantRow = { variant: 1 | 2 | 3; start: string; end: string; days: number }

/** Все заполненные варианты (для таблицы «Запланированный отпуск») */
function filledWishVariants(w: WishRequest | undefined): WishVariantRow[] {
  if (!w) return []
  const add = (variant: 1 | 2 | 3, s?: string | null, e?: string | null): WishVariantRow | null => {
    if (!s || !e) return null
    const days = daysBetween(s, e)
    if (days <= 0) return null
    return { variant, start: s, end: e, days }
  }
  const rows = [
    add(1, w.v1_start, w.v1_end),
    add(2, w.v2_start, w.v2_end),
    add(3, w.v3_start, w.v3_end),
  ].filter(Boolean) as WishVariantRow[]
  return rows
}

/** Один источник правды для баланса «Запланировано»: приоритет v1 → v2 → v3 */
function priorityWishSelection(w: WishRequest | undefined): { start: string; end: string; days: number } | null {
  if (!w) return null
  const pick = (s?: string | null, e?: string | null) => {
    if (!s || !e) return null
    const days = daysBetween(s, e)
    if (days <= 0) return null
    return { start: s, end: e, days }
  }
  return pick(w.v1_start, w.v1_end) ?? pick(w.v2_start, w.v2_end) ?? pick(w.v3_start, w.v3_end)
}

export default function EmployeeDashboard() {
  const fallbackUser = getUser()!

  const { data: freshUser } = useQuery<User>({
    queryKey: ['me'],
    queryFn: () => api.get('/users/me').then(r => r.data),
    staleTime: 60_000,
  })

  const user = freshUser ?? fallbackUser

  const { data: block } = useQuery<VacationBlock | null>({
    queryKey: ['my-block', YEAR],
    queryFn: () => api.get(`/vacation-blocks/my?year=${YEAR}`).then(r => r.data),
  })

  const { data: wish } = useQuery<WishRequest>({
    queryKey: ['my-wishes', YEAR],
    queryFn: () => api.get(`/wishes/my?year=${YEAR}`).then(r => r.data),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

  const norm            = user.vacation_days_norm
  const used            = user.vacation_days_used
  const plannedBlock    = block ? daysBetween(block.date_start, block.date_end) : 0
  const wishRows        = filledWishVariants(wish)
  const wishSel         = priorityWishSelection(wish)
  const planned         = wishSel?.days ?? 0
  const remainder       = Math.max(0, norm - used - planned)

  const hasApprovedBlock = block?.status === 'APPROVED'

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Мой отпуск {YEAR}</h1>

      {/* ── Баланс дней ───────────────────────────────────────── */}
      <div className="card p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Баланс дней</h2>
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Норма',         value: norm,      color: 'text-gray-900' },
            { label: 'Использовано',  value: used,      color: 'text-gray-500' },
            { label: 'Запланировано', value: planned,   color: 'text-blue-600' },
            { label: 'Остаток',       value: remainder, color: remainder === 0 ? 'text-yellow-600' : 'text-green-600' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Прошедший отпуск ──────────────────────────────────── */}
      {used > 0 ? (
        <div className="card p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Прошедший отпуск</h2>
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <span className="text-lg font-bold text-gray-600">{used}</span>
            </div>
            <div>
              <div className="font-semibold text-gray-800">{used} дней уже использовано</div>
              <div className="text-xs text-gray-500 mt-0.5">
                Дни отпуска, взятые в предыдущих периодах и учтённые в балансе
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card p-5 mb-6 text-sm text-gray-400 text-center">
          Нет данных о прошедших отпусках
        </div>
      )}

      {/* ── Запланированный отпуск (до утверждения менеджером) ─── */}
      {!hasApprovedBlock && (
        <div className="card p-5 mb-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Запланированный отпуск</h2>
            {wishRows.length > 0 ? (
              <span className="text-xs font-medium text-gray-600 text-right max-w-[16rem] leading-snug">
                Статус: ожидание согласования менеджером
              </span>
            ) : block && block.status !== 'APPROVED' ? (
              <span className={`badge ${VACATION_STATUS_COLOR[block.status] ?? 'bg-gray-100 text-gray-700'}`}>
                {VACATION_STATUS_LABEL[block.status] ?? block.status}
              </span>
            ) : null}
          </div>

          {wishRows.length > 0 ? (
            <>
              <div className="overflow-x-auto mb-3">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                      <th className="pb-2 pr-4 font-medium">Вариант</th>
                      <th className="pb-2 pr-4 font-medium">Начало</th>
                      <th className="pb-2 pr-4 font-medium">Конец</th>
                      <th className="pb-2 font-medium">Дней</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wishRows.map(row => (
                      <tr key={row.variant} className="border-b border-gray-100 last:border-0">
                        <td className="py-2 pr-4 font-medium text-gray-800">
                          {row.variant}
                          {row.variant === 1 ? (
                            <span className="text-xs font-normal text-gray-500 ml-1">(приоритет)</span>
                          ) : null}
                        </td>
                        <td className="py-2 pr-4">{formatDate(row.start)}</td>
                        <td className="py-2 pr-4">{formatDate(row.end)}</td>
                        <td className="py-2 font-semibold">{row.days}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                В блоке «Баланс дней» выше строка «Запланировано» считается по приоритетному варианту&nbsp;1 (если он заполнен).
              </p>
            </>
          ) : block && block.status !== 'APPROVED' ? (
            <>
              <div className="flex gap-8 mb-4 flex-wrap">
                <div>
                  <div className="text-xs text-gray-500">Начало</div>
                  <div className="font-semibold">{formatDate(block.date_start)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Конец</div>
                  <div className="font-semibold">{formatDate(block.date_end)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Дней</div>
                  <div className="font-semibold">{plannedBlock}</div>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                После согласования менеджером отпуск будет показан в блоке «Назначенный отпуск».
              </p>
            </>
          ) : (
            <div className="text-sm text-gray-400 text-center py-2">
              Укажите желаемые даты в разделе «Мои пожелания» — они учтутся в балансе выше.
            </div>
          )}
        </div>
      )}

      {/* ── Назначенный отпуск (утверждён) ───────────────────── */}
      {hasApprovedBlock && block && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Назначенный отпуск</h2>
            <span className={`badge ${VACATION_STATUS_COLOR[block.status]}`}>
              {VACATION_STATUS_LABEL[block.status]}
            </span>
          </div>

          <div className="flex gap-8 mb-4 flex-wrap">
            <div>
              <div className="text-xs text-gray-500">Начало</div>
              <div className="font-semibold">{formatDate(block.date_start)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Конец</div>
              <div className="font-semibold">{formatDate(block.date_end)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Дней</div>
              <div className="font-semibold">{plannedBlock}</div>
            </div>
          </div>

          {block.ai_explanation && (
            <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-900">
              <div className="font-medium mb-1">Объяснение AI</div>
              {block.ai_explanation}
            </div>
          )}
          {block.manager_comment && (
            <div className="bg-yellow-50 rounded-lg p-4 text-sm text-yellow-900 mt-3">
              <div className="font-medium mb-1">Комментарий менеджера</div>
              {block.manager_comment}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
