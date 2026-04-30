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
    <div className="text-slate-100">
      <div className="mb-6">
        <div className="text-center mb-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#2f3438] border border-[#4a5258] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#cbd5df] mb-2">
            <span>Manager view</span>
            <span>•</span>
            <span>{YEAR}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight bg-gradient-to-r from-[#5db3be] via-[#e09a18] to-[#d64a35] bg-clip-text text-transparent drop-shadow-sm">
            Дашборд {YEAR}
          </h1>
        </div>
        <div className="flex items-center justify-center sm:justify-end gap-2 flex-wrap">
          <button
            className="btn-primary"
            onClick={() => generate.mutate()}
            disabled={isRunning || generate.isPending}
          >
            {isRunning ? '⏳ Генерация...' : '⚡ Сгенерировать график'}
          </button>
          <button
            type="button"
            className="btn-secondary border-[#9f3e37] text-[#f6b5ac] hover:bg-[#4a2a2a]"
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
          job.status === 'RUNNING' ? 'bg-[#254d5a] text-[#b9eaf6]' :
          job.status === 'DONE' ? 'bg-[#335543] text-[#cbf4da]' :
          job.status === 'CANCELLED' ? 'bg-[#5c4a2f] text-[#ffe3b0]' :
          'bg-[#5b3136] text-[#ffd2d6]'
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
              { label: 'Всего сотрудников', value: stats.total_employees, color: 'text-[#d7f2f7]', bg: 'bg-[#4fa5b3]', labelColor: 'text-[#ddf6fa]' },
              { label: 'Без пожеланий', value: stats.without_wishes, color: 'text-[#f9e9bb]', bg: 'bg-[#4a4f55]', labelColor: 'text-[#ccd3da]' },
              { label: 'Изменено менеджером', value: stats.modified, color: 'text-[#ffe6b5]', bg: 'bg-[#d89013]', labelColor: 'text-[#fff3db]' },
              { label: 'Утверждено', value: stats.approved, color: 'text-[#d4f7da]', bg: 'bg-[#6e9f2f]', labelColor: 'text-[#e9ffd9]' },
              { label: 'Конфликты', value: stats.conflict, color: 'text-[#ffd8cd]', bg: 'bg-[#d54a34]', labelColor: 'text-[#ffe5dc]' },
              { label: 'Черновики (AI)', value: stats.draft, color: 'text-[#e9f6ff]', bg: 'bg-[#3f7280]', labelColor: 'text-[#d7edf6]' },
            ].map(s => (
              <div key={s.label} className={`card p-4 border-0 ${s.bg}`}>
                <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
                <div className={`text-xs mt-1 ${s.labelColor}`}>{s.label}</div>
              </div>
            ))}
          </div>

          <div className="card p-5 bg-gradient-to-br from-[#2f3438] via-[#3a4449] to-[#31373c] border-[#4a545b]">
            <div className="text-xs uppercase tracking-wide text-[#c3ced8] font-semibold mb-2">Vacation vibe</div>
            <div className="text-4xl mb-3">🏝️</div>
            <div className="text-sm font-semibold text-[#f2f7fb] mb-2">График в балансе</div>
            <p className="text-xs text-[#d5dde4] leading-relaxed mb-3">
              Чем меньше конфликтов и больше утверждённых отпусков, тем спокойнее сезон и команда.
            </p>
            <div className="text-xs text-[#aab5bf]">☀️ Планируем заранее • 🤝 Согласуем прозрачно</div>
          </div>
        </div>
      )}

      <div className="relative overflow-hidden rounded-2xl border border-[#4f5861] bg-gradient-to-r from-[#32383d] via-[#2f4f59] to-[#2f3b45] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-[#9fd6e3] font-semibold">Sea mode</div>
            <div className="text-sm font-medium text-[#e5f2f6]">Море спокойствия для планирования отпусков</div>
          </div>
          <div className="text-2xl sm:text-3xl">🌊</div>
        </div>
        <div className="mt-3 text-[#8ec5d4] text-lg leading-none select-none" aria-hidden>
          ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~
        </div>
      </div>
    </div>
  )
}
