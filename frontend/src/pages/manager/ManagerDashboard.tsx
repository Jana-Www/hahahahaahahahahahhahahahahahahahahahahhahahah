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
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
          <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {[
              { label: 'Всего сотрудников', value: stats.total_employees, color: 'text-gray-900' },
              { label: 'Без пожеланий', value: stats.without_wishes, color: 'text-gray-400' },
              { label: 'Изменено менеджером', value: stats.modified, color: 'text-orange-600' },
              { label: 'Утверждено', value: stats.approved, color: 'text-green-600' },
              { label: 'Конфликты', value: stats.conflict, color: 'text-red-600' },
              { label: 'Черновики (AI)', value: stats.draft, color: 'text-blue-600' },
            ].map(s => (
              <div key={s.label} className="card p-4">
                <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="card p-5 bg-gradient-to-br from-sky-50 via-cyan-50 to-emerald-50 border-sky-100">
            <div className="text-xs uppercase tracking-wide text-sky-700 font-semibold mb-2">Vacation vibe</div>
            <div className="text-4xl mb-3">🏝️</div>
            <div className="text-sm font-semibold text-slate-800 mb-2">График в балансе</div>
            <p className="text-xs text-slate-600 leading-relaxed mb-3">
              Чем меньше конфликтов и больше утверждённых отпусков, тем спокойнее сезон и команда.
            </p>
            <div className="text-xs text-slate-500">☀️ Планируем заранее • 🤝 Согласуем прозрачно</div>
          </div>
        </div>
      )}

      <div className="relative overflow-hidden rounded-2xl border border-cyan-100 bg-gradient-to-r from-cyan-100 via-sky-100 to-blue-100 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-cyan-700 font-semibold">Sea mode</div>
            <div className="text-sm font-medium text-slate-700">Море спокойствия для планирования отпусков</div>
          </div>
          <div className="text-2xl sm:text-3xl">🌊</div>
        </div>
        <div className="mt-3 text-cyan-700/80 text-lg leading-none select-none" aria-hidden>
          ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~
        </div>
      </div>
    </div>
  )
}
