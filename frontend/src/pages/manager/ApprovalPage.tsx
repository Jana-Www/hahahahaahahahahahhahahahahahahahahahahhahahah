import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { VacationBlock } from '../../lib/types'
import { formatDate, daysBetween, VACATION_STATUS_LABEL, VACATION_STATUS_COLOR } from '../../lib/utils'

const YEAR = new Date().getFullYear()

export default function ApprovalPage() {
  const qc = useQueryClient()
  const [editBlock, setEditBlock] = useState<VacationBlock | null>(null)
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')
  const [editComment, setEditComment] = useState('')
  const [filter, setFilter] = useState<string>('ALL')

  const { data: blocks = [], isLoading } = useQuery<VacationBlock[]>({
    queryKey: ['vacation-blocks', YEAR],
    queryFn: () => api.get(`/vacation-blocks?year=${YEAR}`).then(r => r.data),
    refetchInterval: 10_000,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) =>
      api.put(`/vacation-blocks/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vacation-blocks', YEAR] })
      setEditBlock(null)
    },
  })

  const approve = (b: VacationBlock) => {
    updateMutation.mutate({ id: b.id, body: { status: 'APPROVED' } })
  }

  const openEdit = (b: VacationBlock) => {
    setEditBlock(b)
    setEditStart(b.date_start)
    setEditEnd(b.date_end)
    setEditComment('')
  }

  const saveEdit = () => {
    if (!editBlock) return
    if (!editComment.trim()) {
      alert('Комментарий обязателен при изменении дат')
      return
    }
    updateMutation.mutate({
      id: editBlock.id,
      body: { date_start: editStart, date_end: editEnd, status: 'MODIFIED', manager_comment: editComment },
    })
  }

  const filtered = filter === 'ALL' ? blocks : blocks.filter(b => b.status === filter)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Согласование {YEAR}</h1>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {['ALL', 'DRAFT', 'PENDING', 'APPROVED', 'MODIFIED', 'CONFLICT'].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s === 'ALL' ? 'Все' : VACATION_STATUS_LABEL[s]}
            <span className="ml-1 opacity-60">
              ({s === 'ALL' ? blocks.length : blocks.filter(b => b.status === s).length})
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              {['Сотрудник', 'Цех/Смена', 'Начало', 'Конец', 'Дней', 'Вариант', 'Статус', 'AI-объяснение', 'Действия'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(b => (
              <tr key={b.id} className="hover:bg-gray-50">
                <td className="px-3 py-3 font-medium text-gray-900">{b.user?.full_name}</td>
                <td className="px-3 py-3 text-gray-500 text-xs">{b.user?.line_text ?? '—'}</td>
                <td className="px-3 py-3">{formatDate(b.date_start)}</td>
                <td className="px-3 py-3">{formatDate(b.date_end)}</td>
                <td className="px-3 py-3 text-center">{daysBetween(b.date_start, b.date_end)}</td>
                <td className="px-3 py-3 text-center">{b.wish_variant_used ? `#${b.wish_variant_used}` : '—'}</td>
                <td className="px-3 py-3">
                  <span className={`badge ${VACATION_STATUS_COLOR[b.status]}`}>
                    {VACATION_STATUS_LABEL[b.status]}
                  </span>
                </td>
                <td className="px-3 py-3 text-xs text-gray-500 max-w-xs truncate">
                  {b.ai_explanation ?? '—'}
                </td>
                <td className="px-3 py-3">
                  <div className="flex gap-2">
                    {b.status !== 'APPROVED' && b.status !== 'CONFLICT' && (
                      <button
                        className="btn-primary text-xs py-1 px-2"
                        onClick={() => approve(b)}
                        disabled={updateMutation.isPending}
                      >
                        Утвердить
                      </button>
                    )}
                    <button
                      className="btn-secondary text-xs py-1 px-2"
                      onClick={() => openEdit(b)}
                    >
                      Изменить
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && !isLoading && (
          <div className="py-12 text-center text-gray-400">Нет данных</div>
        )}
      </div>

      {/* Edit modal */}
      {editBlock && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="card p-6 w-full max-w-md">
            <h2 className="font-bold text-gray-900 mb-4">Изменить даты — {editBlock.user?.full_name}</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Начало</label>
                <input type="date" className="input" value={editStart} onChange={e => setEditStart(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Конец</label>
                <input type="date" className="input" value={editEnd} onChange={e => setEditEnd(e.target.value)} />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1">Комментарий (обязателен)</label>
              <textarea
                className="input resize-none"
                rows={3}
                value={editComment}
                onChange={e => setEditComment(e.target.value)}
                placeholder="Причина изменения..."
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button className="btn-secondary" onClick={() => setEditBlock(null)}>Отмена</button>
              <button className="btn-primary" onClick={saveEdit} disabled={updateMutation.isPending}>
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
