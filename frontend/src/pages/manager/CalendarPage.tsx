import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../../lib/api'
import type { SeasonPeriod, CoverageRule, Workshop } from '../../lib/types'
import { SEASON_LABEL, SEASON_COLOR } from '../../lib/utils'

const YEAR = new Date().getFullYear()

export default function CalendarPage() {
  const qc = useQueryClient()

  const { data: periods = [] } = useQuery<SeasonPeriod[]>({
    queryKey: ['season-periods', YEAR],
    queryFn: () => api.get(`/season-periods?year=${YEAR}`).then(r => r.data),
  })

  const { data: workshops = [] } = useQuery<Workshop[]>({
    queryKey: ['workshops'],
    queryFn: () => api.get('/workshops').then(r => r.data),
  })

  const { data: rules = [] } = useQuery<CoverageRule[]>({
    queryKey: ['coverage-rules'],
    queryFn: () => api.get('/coverage-rules').then(r => r.data),
  })

  const [newPeriod, setNewPeriod] = useState({ date_start: '', date_end: '', status: 'HIGH' })

  const createPeriod = useMutation({
    mutationFn: () => api.post('/season-periods', { ...newPeriod, year: YEAR }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['season-periods', YEAR] })
      setNewPeriod({ date_start: '', date_end: '', status: 'HIGH' })
    },
  })

  const deletePeriod = useMutation({
    mutationFn: (id: string) => api.delete(`/season-periods/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['season-periods', YEAR] }),
  })

  const [newRule, setNewRule] = useState({ workshop_id: '', period_status: 'NEUTRAL', min_total: 5, min_key: 1, max_on_vacation: '' })

  const createRule = useMutation({
    mutationFn: () => api.post('/coverage-rules', {
      ...newRule,
      min_total: +newRule.min_total,
      min_key: +newRule.min_key,
      max_on_vacation: newRule.max_on_vacation ? +newRule.max_on_vacation : null,
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coverage-rules'] }),
  })

  const deleteRule = useMutation({
    mutationFn: (id: string) => api.delete(`/coverage-rules/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coverage-rules'] }),
  })

  const wsMap = Object.fromEntries(workshops.map(w => [w.id, w.name]))

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Производственный календарь {YEAR}</h1>

      {/* Season periods */}
      <div className="card p-5 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Периоды сезонности</h2>
        <div className="grid grid-cols-4 gap-2 mb-4">
          <input type="date" className="input" value={newPeriod.date_start} onChange={e => setNewPeriod(p => ({ ...p, date_start: e.target.value }))} />
          <input type="date" className="input" value={newPeriod.date_end} onChange={e => setNewPeriod(p => ({ ...p, date_end: e.target.value }))} />
          <select className="input" value={newPeriod.status} onChange={e => setNewPeriod(p => ({ ...p, status: e.target.value }))}>
            <option value="HIGH">Высокий сезон</option>
            <option value="LOW">Низкий сезон</option>
            <option value="NEUTRAL">Нейтральный</option>
          </select>
          <button className="btn-primary" onClick={() => createPeriod.mutate()} disabled={!newPeriod.date_start || !newPeriod.date_end}>
            Добавить
          </button>
        </div>
        <div className="space-y-2">
          {periods.map(p => (
            <div key={p.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
              <span className={`badge ${SEASON_COLOR[p.status]}`}>{SEASON_LABEL[p.status]}</span>
              <span className="text-sm">{p.date_start} — {p.date_end}</span>
              <button className="ml-auto text-xs text-red-500 hover:text-red-700" onClick={() => deletePeriod.mutate(p.id)}>Удалить</button>
            </div>
          ))}
          {!periods.length && <p className="text-sm text-gray-400">Нет периодов</p>}
        </div>
      </div>

      {/* Coverage rules */}
      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Нормы покрытия</h2>
        <div className="grid grid-cols-5 gap-2 mb-4">
          <select className="input" value={newRule.workshop_id} onChange={e => setNewRule(p => ({ ...p, workshop_id: e.target.value }))}>
            <option value="">— цех —</option>
            {workshops.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <select className="input" value={newRule.period_status} onChange={e => setNewRule(p => ({ ...p, period_status: e.target.value }))}>
            <option value="HIGH">HIGH</option>
            <option value="LOW">LOW</option>
            <option value="NEUTRAL">NEUTRAL</option>
          </select>
          <input type="number" className="input" placeholder="Min всего" min={0} value={newRule.min_total} onChange={e => setNewRule(p => ({ ...p, min_total: +e.target.value }))} />
          <input type="number" className="input" placeholder="Min KEY" min={0} value={newRule.min_key} onChange={e => setNewRule(p => ({ ...p, min_key: +e.target.value }))} />
          <input type="number" className="input" placeholder="Макс. отп." min={0} value={newRule.max_on_vacation} onChange={e => setNewRule(p => ({ ...p, max_on_vacation: e.target.value }))} />
        </div>
        <button className="btn-primary mb-4" onClick={() => createRule.mutate()} disabled={!newRule.workshop_id}>Добавить норму</button>

        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-200">
            <th className="pb-2">Цех</th>
            <th className="pb-2">Сезон</th>
            <th className="pb-2">Min сотр.</th>
            <th className="pb-2">Min KEY</th>
            <th className="pb-2">Макс. отп.</th>
            <th />
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {rules.map(r => (
              <tr key={r.id}>
                <td className="py-2">{wsMap[r.workshop_id] ?? '—'}</td>
                <td className="py-2"><span className={`badge ${SEASON_COLOR[r.period_status]}`}>{r.period_status}</span></td>
                <td className="py-2">{r.min_total}</td>
                <td className="py-2">{r.min_key}</td>
                <td className="py-2">{r.max_on_vacation ?? '—'}</td>
                <td className="py-2">
                  <button className="text-xs text-red-500 hover:text-red-700" onClick={() => deleteRule.mutate(r.id)}>Удалить</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
