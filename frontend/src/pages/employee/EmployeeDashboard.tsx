import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { getUser } from '../../lib/auth'
import { formatDate, daysBetween, VACATION_STATUS_LABEL, VACATION_STATUS_COLOR } from '../../lib/utils'
import type { VacationBlock } from '../../lib/types'

const YEAR = new Date().getFullYear()

export default function EmployeeDashboard() {
  const user = getUser()!

  const { data: block } = useQuery<VacationBlock | null>({
    queryKey: ['my-block', YEAR],
    queryFn: () => api.get(`/vacation-blocks/my?year=${YEAR}`).then(r => r.data),
  })

  const available = user.vacation_days_norm - user.vacation_days_used
  const planned = block ? daysBetween(block.date_start, block.date_end) : 0

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Мой отпуск {YEAR}</h1>

      {/* Balance */}
      <div className="card p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Баланс дней</h2>
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Норма', value: user.vacation_days_norm, color: 'text-gray-900' },
            { label: 'Использовано', value: user.vacation_days_used, color: 'text-gray-600' },
            { label: 'Запланировано', value: planned, color: 'text-blue-600' },
            { label: 'Остаток', value: available - planned, color: available - planned < 0 ? 'text-red-600' : 'text-green-600' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Vacation block */}
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
              <div className="font-semibold">{planned}</div>
            </div>
            {block.wish_variant_used && (
              <div>
                <div className="text-xs text-gray-500">Вариант</div>
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
