import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { VacationBlock, SeasonPeriod, Workshop } from '../../lib/types'
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

  // Group blocks by workshop > shift > user
  const blocksByUser = new Map<string, VacationBlock>()
  blocks.forEach(b => blocksByUser.set(b.user_id, b))

  const CELL_W = 2 // px per day
  const totalW = YEAR_DAYS * CELL_W

  const seasonBg: Record<string, string> = { HIGH: 'rgba(239,68,68,0.08)', LOW: 'rgba(34,197,94,0.08)', NEUTRAL: 'transparent' }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Диаграмма Ганта {YEAR}</h1>

      {/* Legend */}
      <div className="flex gap-4 mb-4 text-xs">
        {Object.entries(VACATION_STATUS_LABEL).map(([k, v]) => (
          <span key={k} className={`badge ${VACATION_STATUS_COLOR[k]}`}>{v}</span>
        ))}
        <span className="text-gray-400">| Фон: </span>
        <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-700">Высокий сезон</span>
        <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">Низкий сезон</span>
      </div>

      <div className="card overflow-auto">
        <div style={{ minWidth: totalW + 200 }}>
          {/* Month ruler */}
          <div className="flex border-b border-gray-200 bg-gray-50">
            <div className="w-48 shrink-0 px-3 py-2 text-xs font-medium text-gray-500">Сотрудник</div>
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
                  className="absolute text-xs text-gray-400 border-l border-gray-200 pl-1"
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
              <div className="flex bg-gray-100 border-b border-gray-200">
                <div className="w-48 shrink-0 px-3 py-1.5 text-xs font-semibold text-gray-700">{ws.name}</div>
                <div className="flex-1" style={{ height: 28 }} />
              </div>

              {ws.shifts.map(shift => {
                const shiftBlocks = blocks.filter(b => b.user?.shift_id === shift.id)
                if (!shiftBlocks.length) return null
                return (
                  <div key={shift.id}>
                    <div className="flex bg-gray-50 border-b border-gray-100">
                      <div className="w-48 shrink-0 px-3 py-1 text-xs text-gray-500 italic">{shift.name}</div>
                      <div className="flex-1" style={{ height: 24 }} />
                    </div>
                    {shiftBlocks.map(b => (
                      <div key={b.id} className="flex border-b border-gray-100 hover:bg-gray-50">
                        <div className="w-48 shrink-0 px-3 py-2 text-xs text-gray-700 truncate">
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
                              b.status === 'APPROVED' ? 'bg-green-400 text-white' :
                              b.status === 'PENDING' ? 'bg-yellow-400 text-white' :
                              b.status === 'MODIFIED' ? 'bg-orange-400 text-white' :
                              b.status === 'CONFLICT' ? 'bg-red-500 text-white' :
                              'bg-gray-300 text-gray-700'
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

          {!blocks.length && (
            <div className="py-12 text-center text-gray-400">
              График ещё не сгенерирован
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
