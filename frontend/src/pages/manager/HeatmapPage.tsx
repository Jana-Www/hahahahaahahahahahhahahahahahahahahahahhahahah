import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { VacationBlock, Workshop, CoverageRule, SeasonPeriod } from '../../lib/types'

const YEAR = new Date().getFullYear()
const YEAR_START = new Date(YEAR, 0, 1)

function weekStart(weekNum: number): Date {
  const d = new Date(YEAR_START)
  d.setDate(d.getDate() + (weekNum - 1) * 7)
  return d
}

function coverageLevel(present: number, total: number, minTotal: number): 'ok' | 'warn' | 'danger' {
  if (total === 0 || minTotal === 0) return 'ok'
  const ratio = present / minTotal
  if (ratio >= 1) return 'ok'
  if (ratio >= 0.8) return 'warn'
  return 'danger'
}

const WEEKS = Array.from({ length: 52 }, (_, i) => i + 1)

export default function HeatmapPage() {
  const { data: blocks = [] } = useQuery<VacationBlock[]>({
    queryKey: ['vacation-blocks', YEAR],
    queryFn: () => api.get(`/vacation-blocks?year=${YEAR}`).then(r => r.data),
  })

  const { data: workshops = [] } = useQuery<Workshop[]>({
    queryKey: ['workshops'],
    queryFn: () => api.get('/workshops').then(r => r.data),
  })

  const { data: rules = [] } = useQuery<CoverageRule[]>({
    queryKey: ['coverage-rules'],
    queryFn: () => api.get('/coverage-rules').then(r => r.data),
  })

  const { data: periods = [] } = useQuery<SeasonPeriod[]>({
    queryKey: ['season-periods', YEAR],
    queryFn: () => api.get(`/season-periods?year=${YEAR}`).then(r => r.data),
  })

  // Compute heatmap data
  const getCell = (workshopId: string, week: number) => {
    const ws = weekStart(week)
    const we = new Date(ws); we.setDate(we.getDate() + 6)

    // Find employees in this workshop
    const wsBlocks = blocks.filter(b => {
      const shift = workshops.find(w => w.id === workshopId)?.shifts.find(s => s.id === b.user?.shift_id)
      return !!shift
    })

    // Count absent this week
    const absent = wsBlocks.filter(b => {
      const bs = new Date(b.date_start), be = new Date(b.date_end)
      return bs <= we && be >= ws
    }).length

    // Total employees in workshop (rough: sum all shift users)
    const ws_obj = workshops.find(w => w.id === workshopId)
    const total = blocks.filter(b =>
      ws_obj?.shifts.some(s => s.id === b.user?.shift_id)
    ).length || 10

    const present = total - absent

    // Get rule
    const periodStatus = periods.find(p => {
      const ps = new Date(p.date_start), pe = new Date(p.date_end)
      return ps <= ws && pe >= ws
    })?.status ?? 'NEUTRAL'

    const rule = rules.find(r => r.workshop_id === workshopId && r.period_status === periodStatus)
    const minTotal = rule?.min_total ?? 1

    return { present, total, minTotal, absent, level: coverageLevel(present, total, minTotal) }
  }

  const cellColor = { ok: 'bg-green-400', warn: 'bg-yellow-400', danger: 'bg-red-500' }
  const cellText = { ok: 'text-green-900', warn: 'text-yellow-900', danger: 'text-white' }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Тепловая карта покрытия {YEAR}</h1>

      <div className="flex gap-4 mb-4 text-xs">
        <span className="badge bg-green-100 text-green-800">Норма (&ge;100%)</span>
        <span className="badge bg-yellow-100 text-yellow-800">На грани (80–99%)</span>
        <span className="badge bg-red-100 text-red-800">Дефицит (&lt;80%)</span>
      </div>

      <div className="card overflow-auto">
        <table className="text-xs border-collapse w-full">
          <thead>
            <tr>
              <th className="sticky left-0 bg-gray-50 px-3 py-2 text-left font-medium text-gray-600 border-r border-gray-200">
                Цех
              </th>
              {WEEKS.map(w => (
                <th key={w} className="px-1 py-2 text-center text-gray-400 font-normal min-w-[28px]">
                  {w}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {workshops.map(ws => (
              <tr key={ws.id} className="border-t border-gray-100">
                <td className="sticky left-0 bg-white px-3 py-2 font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap">
                  {ws.name}
                </td>
                {WEEKS.map(w => {
                  const cell = getCell(ws.id, w)
                  return (
                    <td key={w} className="p-0.5">
                      <div
                        className={`h-6 w-full rounded-sm flex items-center justify-center ${cellColor[cell.level]} ${cellText[cell.level]}`}
                        title={`Нед. ${w} | ${ws.name} | Присутствует: ${cell.present}/${cell.minTotal}`}
                      >
                        {cell.level !== 'ok' && cell.present}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
