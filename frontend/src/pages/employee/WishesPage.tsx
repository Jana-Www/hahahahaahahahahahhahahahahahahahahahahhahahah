import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { daysBetween } from '../../lib/utils'
import type { WishRequest, SeasonPeriod, User } from '../../lib/types'

const YEAR = new Date().getFullYear()

interface WishVariant {
  start: string
  end: string
  comment: string
}

function countDays(start: string, end: string): number {
  if (!start || !end) return 0
  const a = new Date(start), b = new Date(end)
  if (b < a) return 0
  return daysBetween(start, end)
}

function seasonWarning(start: string, end: string, periods: SeasonPeriod[]): string | null {
  if (!start || !end) return null
  const s = new Date(start), e = new Date(end)
  for (const p of periods) {
    const ps = new Date(p.date_start), pe = new Date(p.date_end)
    if (ps <= e && pe >= s && p.status === 'HIGH') {
      return 'Выбранный период попадает в высокий сезон — отпуск может быть ограничен'
    }
  }
  return null
}

export default function WishesPage() {
  const qc = useQueryClient()

  const { data: wish } = useQuery<WishRequest>({
    queryKey: ['my-wishes', YEAR],
    queryFn: () => api.get(`/wishes/my?year=${YEAR}`).then(r => r.data),
  })

  const { data: periods = [] } = useQuery<SeasonPeriod[]>({
    queryKey: ['season-periods', YEAR],
    queryFn: () => api.get(`/season-periods?year=${YEAR}`).then(r => r.data),
  })

  // Fetch fresh user profile so balance is always up-to-date
  const { data: user } = useQuery<User>({
    queryKey: ['me'],
    queryFn: () => api.get('/users/me').then(r => r.data),
    staleTime: 60_000,
  })

  const [variants, setVariants] = useState<WishVariant[]>([
    { start: '', end: '', comment: '' },
    { start: '', end: '', comment: '' },
    { start: '', end: '', comment: '' },
  ])

  useEffect(() => {
    if (!wish) return
    setVariants([
      { start: wish.v1_start ?? '', end: wish.v1_end ?? '', comment: wish.v1_comment ?? '' },
      { start: wish.v2_start ?? '', end: wish.v2_end ?? '', comment: wish.v2_comment ?? '' },
      { start: wish.v3_start ?? '', end: wish.v3_end ?? '', comment: wish.v3_comment ?? '' },
    ])
  }, [wish])

  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: (body: object) => api.put(`/wishes/my?year=${YEAR}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-wishes', YEAR] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
    onError: (e: any) => setError(e.response?.data?.detail ?? 'Ошибка сохранения'),
  })

  const handleSave = () => {
    setError('')
    const [v1, v2, v3] = variants
    mutation.mutate({
      v1_start: v1.start || null, v1_end: v1.end || null, v1_comment: v1.comment || null,
      v2_start: v2.start || null, v2_end: v2.end || null, v2_comment: v2.comment || null,
      v3_start: v3.start || null, v3_end: v3.end || null, v3_comment: v3.comment || null,
    })
  }

  const updateVariant = (i: number, field: keyof WishVariant, val: string) => {
    setVariants(prev => prev.map((v, idx) => idx === i ? { ...v, [field]: val } : v))
  }

  const isLocked = wish?.is_locked ?? false
  const available = user ? user.vacation_days_norm - user.vacation_days_used : null

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Пожелания по отпуску {YEAR}</h1>
        {isLocked && (
          <span className="badge bg-yellow-100 text-yellow-800">Заблокировано</span>
        )}
      </div>

      {/* Balance banner */}
      {available !== null && (
        <div className="card p-4 mb-6 flex items-center gap-4">
          <div className="text-center min-w-[56px]">
            <div className="text-2xl font-bold text-gray-900">{user!.vacation_days_norm}</div>
            <div className="text-xs text-gray-500">Норма</div>
          </div>
          <div className="text-gray-300 text-xl">—</div>
          <div className="text-center min-w-[56px]">
            <div className="text-2xl font-bold text-gray-500">{user!.vacation_days_used}</div>
            <div className="text-xs text-gray-500">Использовано</div>
          </div>
          <div className="text-gray-300 text-xl">=</div>
          <div className="text-center min-w-[56px]">
            <div className={`text-2xl font-bold ${available < 14 ? 'text-red-600' : 'text-green-600'}`}>
              {available}
            </div>
            <div className="text-xs text-gray-500">Доступно</div>
          </div>
          <div className="ml-auto text-xs text-gray-400">
            Каждый вариант должен укладываться в {available} дн.
          </div>
        </div>
      )}

      {isLocked && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 text-sm text-yellow-800">
          Пожелания заблокированы — генерация графика уже запущена. Для изменений обратитесь к менеджеру.
        </div>
      )}

      <div className="space-y-4">
        {variants.map((v, i) => {
          const warn = seasonWarning(v.start, v.end, periods)
          const days = countDays(v.start, v.end)
          const overLimit = available !== null && days > available
          return (
            <div key={i} className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="font-medium text-gray-700">
                    Вариант {i + 1} {i === 0 ? '(приоритетный)' : '(необязательный)'}
                  </span>
                </div>
                {days > 0 && (
                  <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${
                    overLimit
                      ? 'bg-red-100 text-red-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {days} дн.
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Дата начала</label>
                  <input
                    type="date"
                    className="input"
                    value={v.start}
                    onChange={e => updateVariant(i, 'start', e.target.value)}
                    disabled={isLocked}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Дата окончания</label>
                  <input
                    type="date"
                    className="input"
                    value={v.end}
                    onChange={e => updateVariant(i, 'end', e.target.value)}
                    disabled={isLocked}
                  />
                </div>
              </div>

              {overLimit && (
                <div className="bg-red-50 text-red-700 rounded px-3 py-2 text-xs mb-3">
                  Превышен лимит: {days} дн. при доступных {available} дн.
                </div>
              )}

              {warn && !overLimit && (
                <div className="bg-yellow-50 text-yellow-700 rounded px-3 py-2 text-xs mb-3">{warn}</div>
              )}

              <div>
                <label className="block text-xs text-gray-500 mb-1">Комментарий</label>
                <textarea
                  className="input resize-none"
                  rows={2}
                  maxLength={300}
                  value={v.comment}
                  onChange={e => updateVariant(i, 'comment', e.target.value)}
                  disabled={isLocked}
                  placeholder="Необязательно"
                />
              </div>
            </div>
          )
        })}
      </div>

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      {saved && <p className="text-sm text-green-600 mt-3">✓ Пожелания сохранены в базе данных</p>}

      {!isLocked && (
        <button
          className="btn-primary mt-6"
          onClick={handleSave}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? 'Сохранение...' : 'Сохранить пожелания'}
        </button>
      )}
    </div>
  )
}
