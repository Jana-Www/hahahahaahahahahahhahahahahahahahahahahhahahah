import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { ConflictItem } from '../../lib/types'
import { formatDate } from '../../lib/utils'

const YEAR = new Date().getFullYear()

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  warning: 'bg-yellow-100 text-yellow-800',
}

const CODE_LABEL: Record<string, string> = {
  'C-01': 'Недостаточно сотрудников',
  'C-02': 'Нехватка ключевых',
  'C-03': 'Меньше 14 дней подряд',
  'C-04': 'Превышение нормы дней',
  'C-05': 'Отпуск в запрещённый период',
  'C-06': 'Покрытие на грани',
}

export default function ConflictsPage() {
  const { data: conflicts = [], isLoading, refetch } = useQuery<ConflictItem[]>({
    queryKey: ['conflicts', YEAR],
    queryFn: () => api.get(`/conflicts?year=${YEAR}`).then(r => r.data),
    refetchInterval: 15_000,
  })

  const critical = conflicts.filter(c => c.severity === 'critical')
  const warnings = conflicts.filter(c => c.severity !== 'critical')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Конфликты {YEAR}</h1>
        <button className="btn-secondary text-sm" onClick={() => refetch()}>Обновить</button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="card p-4">
          <div className="text-3xl font-bold text-red-600">{critical.length}</div>
          <div className="text-xs text-gray-500 mt-1">Критических</div>
        </div>
        <div className="card p-4">
          <div className="text-3xl font-bold text-yellow-600">{warnings.length}</div>
          <div className="text-xs text-gray-500 mt-1">Предупреждений</div>
        </div>
      </div>

      {isLoading && <div className="text-gray-400 text-sm">Загрузка...</div>}

      {!isLoading && !conflicts.length && (
        <div className="card p-12 text-center text-gray-400">
          <div className="text-4xl mb-2">✅</div>
          Конфликтов не обнаружено
        </div>
      )}

      <div className="space-y-3">
        {conflicts.map((c, i) => (
          <div key={i} className={`card p-4 border-l-4 ${c.severity === 'critical' ? 'border-red-500' : 'border-yellow-400'}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`badge ${SEVERITY_COLOR[c.severity] ?? 'bg-gray-100 text-gray-700'}`}>
                    {c.code}
                  </span>
                  <span className="text-xs text-gray-500">{CODE_LABEL[c.code] ?? c.code}</span>
                </div>
                <p className="text-sm text-gray-800">{c.description}</p>
                {c.ai_recommendation && (
                  <div className="mt-2 flex items-start gap-1.5 text-xs text-blue-800 bg-blue-50 rounded-lg px-3 py-2">
                    <span className="shrink-0 mt-0.5">🤖</span>
                    <span>{c.ai_recommendation}</span>
                  </div>
                )}
              </div>
              <div className="text-right text-xs text-gray-500 shrink-0">
                {c.employee_name && <div>{c.employee_name}</div>}
                {c.workshop_name && <div>{c.workshop_name}</div>}
                {c.date_start && <div>{formatDate(c.date_start)}</div>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
