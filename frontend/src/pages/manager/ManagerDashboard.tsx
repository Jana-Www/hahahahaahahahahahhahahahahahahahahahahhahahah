import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { DashboardStats, GenerationJob } from '../../lib/types'

const YEAR = new Date().getFullYear()

export default function ManagerDashboard() {
  const qc = useQueryClient()

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ['dashboard', YEAR],
    queryFn: () => api.get(`/dashboard?year=${YEAR}`).then(r => r.data),
    refetchInterval: 10_000,
  })

  const { data: job } = useQuery<GenerationJob | null>({
    queryKey: ['schedule-status', YEAR],
    queryFn: () => api.get(`/schedule/status?year=${YEAR}`).then(r => r.data).catch(() => null),
    refetchInterval: (q) => q.state.data?.status === 'RUNNING' ? 3000 : 10_000,
  })

  const generate = useMutation({
    mutationFn: () => api.post(`/schedule/generate?year=${YEAR}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule-status', YEAR] })
      qc.invalidateQueries({ queryKey: ['dashboard', YEAR] })
    },
  })

  const cancel = useMutation({
    mutationFn: () => api.post(`/schedule/cancel?year=${YEAR}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule-status', YEAR] })
      qc.invalidateQueries({ queryKey: ['dashboard', YEAR] })
    },
  })

  const isRunning = job?.status === 'RUNNING'
  const canCancel = !!job && ['RUNNING', 'DONE', 'FAILED', 'CANCELLED'].includes(job.status)

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Дашборд {YEAR}</h1>
        <div className="flex items-center gap-2">
          <button
            className="btn-primary"
            onClick={() => generate.mutate()}
            disabled={isRunning || generate.isPending}
          >
            {isRunning ? '⏳ Генерация...' : '⚡ Сгенерировать график'}
          </button>
          <button
            type="button"
            className="btn-secondary border-red-200 text-red-700 hover:bg-red-50"
            onClick={() => cancel.mutate()}
            disabled={!canCancel || cancel.isPending || generate.isPending}
            title={
              !job
                ? 'Сначала запустите генерацию'
                : 'Остановить генерацию или удалить сгенерированный черновик (утверждённые отпуска не затрагиваются)'
            }
          >
            Отменить генерацию
          </button>
        </div>
      </div>

      {/* Generation status */}
      {job && (
        <div className={`rounded-lg p-4 mb-6 text-sm ${
          job.status === 'RUNNING' ? 'bg-blue-50 text-blue-800' :
          job.status === 'DONE' ? 'bg-green-50 text-green-800' :
          job.status === 'CANCELLED' ? 'bg-amber-50 text-amber-900' :
          'bg-red-50 text-red-800'
        }`}>
          {job.status === 'RUNNING' && '⏳ Оптимизатор работает — подождите...'}
          {job.status === 'DONE' && '✅ График успешно сгенерирован'}
          {job.status === 'CANCELLED' && '⚠️ Генерация отменена или черновик графика удалён'}
          {job.status === 'FAILED' && `❌ Ошибка генерации: ${job.error_message}`}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Всего сотрудников', value: stats.total_employees, color: 'text-gray-900' },
            { label: 'Утверждено', value: stats.approved, color: 'text-green-600' },
            { label: 'На рассмотрении', value: stats.pending, color: 'text-yellow-600' },
            { label: 'Черновики (AI)', value: stats.draft, color: 'text-blue-600' },
            { label: 'Конфликты', value: stats.conflict, color: 'text-red-600' },
            { label: 'Изменено менеджером', value: stats.modified, color: 'text-orange-600' },
            { label: 'Без пожеланий', value: stats.without_wishes, color: 'text-gray-400' },
          ].map(s => (
            <div key={s.label} className="card p-4">
              <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
