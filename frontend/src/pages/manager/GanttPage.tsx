import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { VacationBlock, SeasonPeriod, VacationStatus, Workshop } from '../../lib/types'
import { VACATION_STATUS_COLOR, VACATION_STATUS_LABEL } from '../../lib/utils'

const YEAR = new Date().getFullYear()
const YEAR_START = new Date(YEAR, 0, 1)
const YEAR_DAYS = 365

function dayOffset(dateStr: string): number {
  const d = new Date(dateStr)
  return Math.round((d.getTime() - YEAR_START.getTime()) / 86400000)
}

const MONTH_LABELS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']

function monthOffset(m: number): number {
  return Math.round((new Date(YEAR, m, 1).getTime() - YEAR_START.getTime()) / 86400000)
}

export default function GanttPage() {
  const [statusFilter, setStatusFilter] = useState<'ALL' | VacationStatus>('ALL')
  const [workshopFilter, setWorkshopFilter] = useState<'ALL' | string>('ALL')
  const [onlyIssues, setOnlyIssues] = useState(false)

  const { data: blocks = [] } = useQuery<VacationBlock[]>({
    queryKey: ['vacation-blocks', YEAR],
    queryFn: () => api.get(`/vacation-blocks?year=${YEAR}`).then(r => r.data),
    refetchInterval: 15_000,
  })

  const { data: workshops = [] } = useQuery<Workshop[]>({
    queryKey: ['workshops'],
    queryFn: () => api.get('/workshops').then(r => r.data),
  })

  const { data: periods = [] } = useQuery<SeasonPeriod[]>({
    queryKey: ['season-periods', YEAR],
    queryFn: () => api.get(`/season-periods?year=${YEAR}`).then(r => r.data),
  })

  const CELL_W = 2 // px per day
  const totalW = YEAR_DAYS * CELL_W

  const seasonBg: Record<string, string> = { HIGH: 'rgba(213,74,52,0.18)', LOW: 'rgba(110,159,47,0.18)', NEUTRAL: 'transparent' }

  const workshopByShiftId = useMemo(() => {
    const m = new Map<string, string>()
    workshops.forEach((ws) => ws.shifts.forEach((s) => m.set(s.id, ws.id)))
    return m
  }, [workshops])

  const filteredBlocks = useMemo(() => {
    return blocks.filter((b) => {
      if (statusFilter !== 'ALL' && b.status !== statusFilter) return false
      if (onlyIssues && !['CONFLICT', 'MODIFIED'].includes(b.status)) return false
      if (workshopFilter !== 'ALL') {
        const wsId = b.user?.shift_id ? workshopByShiftId.get(b.user.shift_id) : undefined
        if (wsId !== workshopFilter) return false
      }
      return true
    })
  }, [blocks, statusFilter, onlyIssues, workshopFilter, workshopByShiftId])

  const shownEmployees = filteredBlocks.length
  const conflictCount = filteredBlocks.filter((b) => b.status === 'CONFLICT').length

  return (
    <div className="text-slate-100">
      <div className="text-center mb-4">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#2f3438] border border-[#4a5258] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#cbd5df] mb-2">
          <span>Manager view</span>
          <span>•</span>
          <span>{YEAR}</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight bg-gradient-to-r from-[#5db3be] via-[#e09a18] to-[#d64a35] bg-clip-text text-transparent drop-shadow-sm">
          Диаграмма Ганта {YEAR}
        </h1>
      </div>

      {/* Filters and quick summary */}
      <div className="card p-3 mb-4 flex flex-wrap items-center gap-3 bg-[#2f3438] border-[#4a545b]">
        <div className="text-xs text-[#b9c4ce]">Показано сотрудников: <span className="font-semibold text-[#e7f0f7]">{shownEmployees}</span></div>
        <div className="text-xs text-[#b9c4ce]">Конфликтов: <span className="font-semibold text-[#ffb4a7]">{conflictCount}</span></div>

        <select
          className="input py-1.5 text-xs max-w-[180px] bg-[#3a4147] border-[#57626b] text-[#e9f1f8]"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'ALL' | VacationStatus)}
        >
          <option value="ALL">Все статусы</option>
          {Object.entries(VACATION_STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <select
          className="input py-1.5 text-xs max-w-[220px] bg-[#3a4147] border-[#57626b] text-[#e9f1f8]"
          value={workshopFilter}
          onChange={(e) => setWorkshopFilter(e.target.value)}
        >
          <option value="ALL">Все цеха</option>
          {workshops.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>

        <label className="inline-flex items-center gap-2 text-xs text-[#c3ced8]">
          <input
            type="checkbox"
            checked={onlyIssues}
            onChange={(e) => setOnlyIssues(e.target.checked)}
          />
          Только проблемные (конфликты + изменённые)
        </label>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-4 text-xs items-center flex-wrap">
        {Object.entries(VACATION_STATUS_LABEL).map(([k, v]) => (
          <span key={k} className={`badge ${VACATION_STATUS_COLOR[k]}`}>{v}</span>
        ))}
        <span className="text-[#9fabb6]">| Фон:</span>
        <span className="px-2 py-0.5 rounded text-xs bg-[#5b3136] text-[#ffd2d6]">Высокий сезон</span>
        <span className="px-2 py-0.5 rounded text-xs bg-[#335543] text-[#cbf4da]">Низкий сезон</span>
      </div>

      <div className="card overflow-auto bg-[#2f3438] border-[#4a545b]">
        <div style={{ minWidth: totalW + 200 }}>
          {/* Month ruler */}
          <div className="flex border-b border-[#4f5962] bg-[#3a4248]">
            <div className="w-48 shrink-0 px-3 py-2 text-xs font-medium text-[#c8d2dc]">Сотрудник</div>
            <div className="relative flex-1" style={{ height: 28 }}>
              {/* Season backgrounds on ruler */}
              {periods.map(p => (
                <div
                  key={p.id}
                  className="absolute top-0 bottom-0"
                  style={{
                    left: dayOffset(p.date_start) * CELL_W,
                    width: (dayOffset(p.date_end) - dayOffset(p.date_start) + 1) * CELL_W,
                    background: seasonBg[p.status],
                  }}
                />
              ))}
              {MONTH_LABELS.map((m, i) => (
                <div
                  key={i}
                  className="absolute text-xs text-[#a8b3be] border-l border-[#4f5962] pl-1"
                  style={{ left: monthOffset(i) * CELL_W, top: 6 }}
                >
                  {m}
                </div>
              ))}
            </div>
          </div>

          {/* Rows */}
          {workshops.map(ws => (
            <div key={ws.id}>
              {/* Workshop header */}
              <div className="flex bg-[#3f484e] border-b border-[#4f5962]">
                <div className="w-48 shrink-0 px-3 py-1.5 text-xs font-semibold text-[#e3ebf2]">{ws.name}</div>
                <div className="flex-1" style={{ height: 28 }} />
              </div>

              {ws.shifts.map(shift => {
                const shiftBlocks = filteredBlocks.filter(b => b.user?.shift_id === shift.id)
                if (!shiftBlocks.length) return null
                return (
                  <div key={shift.id}>
                    <div className="flex bg-[#353d43] border-b border-[#464f57]">
                      <div className="w-48 shrink-0 px-3 py-1 text-xs text-[#b8c3ce] italic">{shift.name}</div>
                      <div className="flex-1" style={{ height: 24 }} />
                    </div>
                    {shiftBlocks.map(b => (
                      <div key={b.id} className="flex border-b border-[#434c54] hover:bg-[#374047]">
                        <div className="w-48 shrink-0 px-3 py-2 text-xs text-[#d8e1ea] truncate">
                          {b.user?.full_name}
                        </div>
                        <div className="relative flex-1" style={{ height: 36 }}>
                          {/* Season backgrounds */}
                          {periods.map(p => (
                            <div
                              key={p.id}
                              className="absolute top-0 bottom-0 opacity-40"
                              style={{
                                left: dayOffset(p.date_start) * CELL_W,
                                width: (dayOffset(p.date_end) - dayOffset(p.date_start) + 1) * CELL_W,
                                background: seasonBg[p.status],
                              }}
                            />
                          ))}
                          {/* Vacation block */}
                          <div
                            className={`absolute top-2 bottom-2 rounded text-xs flex items-center px-1 overflow-hidden font-medium ${
                              b.status === 'APPROVED' ? 'bg-[#6e9f2f] text-[#e9ffd9]' :
                              b.status === 'PENDING' ? 'bg-[#d89013] text-[#fff3db]' :
                              b.status === 'MODIFIED' ? 'bg-[#e09a18] text-[#fff3db]' :
                              b.status === 'CONFLICT' ? 'bg-[#d54a34] text-[#ffe5dc]' :
                              'bg-[#4fa5b3] text-[#ddf6fa]'
                            }`}
                            style={{
                              left: dayOffset(b.date_start) * CELL_W,
                              width: Math.max((dayOffset(b.date_end) - dayOffset(b.date_start) + 1) * CELL_W, 4),
                            }}
                            title={`${b.user?.full_name} | ${b.date_start} — ${b.date_end} | ${VACATION_STATUS_LABEL[b.status]}`}
                          >
                            {(dayOffset(b.date_end) - dayOffset(b.date_start) + 1) * CELL_W > 30
                              ? `${(dayOffset(b.date_end) - dayOffset(b.date_start) + 1)}д`
                              : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          ))}

          {!filteredBlocks.length && (
            <div className="py-12 text-center text-[#a9b5c1]">
              Нет данных по выбранным фильтрам
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
