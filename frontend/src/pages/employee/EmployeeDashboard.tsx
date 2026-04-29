import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { getUser } from '../../lib/auth'
import { formatDate, daysBetween, VACATION_STATUS_LABEL, VACATION_STATUS_COLOR } from '../../lib/utils'
import type { User, VacationBlock, WishRequest } from '../../lib/types'

const YEAR = new Date().getFullYear()

function variantDays(start?: string | null, end?: string | null): number {
  if (!start || !end) return 0
  const a = new Date(start), b = new Date(end)
  if (b < a) return 0
  return daysBetween(start, end)
}

/** Первый заполненный вариант по приоритету v1 → v2 → v3 */
function plannedDaysFromWishes(w: WishRequest | undefined): number {
  if (!w) return 0
  const d1 = variantDays(w.v1_start, w.v1_end)
  if (d1 > 0) return d1
  const d2 = variantDays(w.v2_start, w.v2_end)
  if (d2 > 0) return d2
  return variantDays(w.v3_start, w.v3_end)
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

  const norm        = user.vacation_days_norm
  const used        = user.vacation_days_used          // уже отгулянные дни (прошедший отпуск)
  /** Дни по утверждённому графику — только в карточке «Назначенный отпуск», не в верхнем балансе */
  const plannedBlock = block ? daysBetween(block.date_start, block.date_end) : 0
  /** Баланс «Запланировано»: только то, что сотрудник указал в «Мои пожелания» (вариант 1 → 2 → 3) */
  const planned      = plannedDaysFromWishes(wish)
  const remainder    = Math.max(0, norm - used - planned)

  const plannedLabel =
    planned > 0
      ? 'Запланировано по приоритетному варианту из раздела «Мои пожелания»'
      : null

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
        {plannedLabel && (
          <p className="mt-3 text-xs text-gray-500 text-center">{plannedLabel}</p>
        )}
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

      {/* ── Назначенный отпуск ────────────────────────────────── */}
      {block ? (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Назначенный отпуск</h2>
            <span className={`badge ${VACATION_STATUS_COLOR[block.status]}`}>
              {VACATION_STATUS_LABEL[block.status]}
            </span>
          </div>

          <div className="flex gap-8 mb-4">
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
            {block.wish_variant_used && (
              <div>
                <div className="text-xs text-gray-500">По варианту</div>
                <div className="font-semibold">#{block.wish_variant_used}</div>
              </div>
            )}
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
      ) : (
        <div className="card p-8 text-center text-gray-400">
          <div className="text-4xl mb-2">🗓️</div>
          <div>График отпусков ещё не сформирован</div>
        </div>
      )}
    </div>
  )
}
