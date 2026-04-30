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
    <div className="text-slate-100">
      <div className="text-center mb-4">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#2f3438] border border-[#4a5258] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#cbd5df] mb-2">
          <span>Manager view</span>
          <span>•</span>
          <span>{YEAR}</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight bg-gradient-to-r from-[#5db3be] via-[#e09a18] to-[#d64a35] bg-clip-text text-transparent drop-shadow-sm">
          Тепловая карта покрытия {YEAR}
        </h1>
      </div>

      <div className="card p-3 mb-4 flex gap-4 text-xs flex-wrap bg-[#2f3438] border-[#4a545b]">
        <span className="badge bg-[#335543] text-[#cbf4da]">Норма (&ge;100%)</span>
        <span className="badge bg-[#5c4a2f] text-[#ffe3b0]">На грани (80–99%)</span>
        <span className="badge bg-[#5b3136] text-[#ffd2d6]">Дефицит (&lt;80%)</span>
      </div>

      <div className="card overflow-auto bg-[#2f3438] border-[#4a545b]">
        <table className="text-xs border-collapse w-full">
          <thead>
            <tr>
              <th className="sticky left-0 bg-[#3a4248] px-3 py-2 text-left font-medium text-[#c8d2dc] border-r border-[#4f5962]">
                Цех
              </th>
              <th colSpan={WEEKS.length} className="px-3 py-1 text-center text-[11px] uppercase tracking-wide text-[#9fd6e3] bg-[#3a4248]">
                Недели года (1–52)
              </th>
            </tr>
            <tr>
              <th className="sticky left-0 bg-[#3a4248] px-3 py-2 text-left font-medium text-[#c8d2dc] border-r border-[#4f5962]">
                Цех
              </th>
              {WEEKS.map(w => (
                <th key={w} className="px-1 py-2 text-center text-[#a8b3be] font-normal min-w-[28px] bg-[#3a4248]">
                  {w}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {workshops.map((ws, idx) => (
              <tr key={ws.id} className="border-t border-[#434c54]">
                <td className={`sticky left-0 px-3 py-2 font-medium text-[#d8e1ea] border-r border-[#4f5962] whitespace-nowrap ${idx % 2 ? 'bg-[#353d43]' : 'bg-[#3f484e]'}`}>
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

      <div className="card mt-4 p-4 bg-[#2f3438] border-[#4a545b]">
        <div className="text-xs uppercase tracking-wide text-[#9fd6e3] font-semibold mb-3">Инструкция по чтению тепловой карты</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg bg-[#3a4248] border border-[#4f5962] p-3">
            <div className="font-semibold text-[#e7f0f7] mb-1">1) Заголовок и период</div>
            <p className="text-[#b9c4ce] leading-relaxed">
              Вверху указан год, по которому построена карта. Все значения в таблице относятся только к выбранному году.
            </p>
          </div>
          <div className="rounded-lg bg-[#3a4248] border border-[#4f5962] p-3">
            <div className="font-semibold text-[#e7f0f7] mb-1">2) Легенда цветов</div>
            <p className="text-[#b9c4ce] leading-relaxed">
              Зелёный — норма покрытия, жёлтый — риск, красный — дефицит персонала. Цвет показывает уровень отклонения от минимальной нормы.
            </p>
          </div>
          <div className="rounded-lg bg-[#3a4248] border border-[#4f5962] p-3">
            <div className="font-semibold text-[#e7f0f7] mb-1">3) Оси таблицы</div>
            <p className="text-[#b9c4ce] leading-relaxed">
              Строки — цеха. Колонки с числами 1–52 — недели года. Пересечение строки и колонки — состояние покрытия в конкретной неделе.
            </p>
          </div>
          <div className="rounded-lg bg-[#3a4248] border border-[#4f5962] p-3">
            <div className="font-semibold text-[#e7f0f7] mb-1">4) Числа в жёлтых/красных ячейках</div>
            <p className="text-[#b9c4ce] leading-relaxed">
              Это количество сотрудников, которые присутствуют в цехе в эту неделю. На зелёных ячейках число скрыто, чтобы не перегружать экран.
            </p>
          </div>
          <div className="rounded-lg bg-[#3a4248] border border-[#4f5962] p-3 md:col-span-2">
            <div className="font-semibold text-[#e7f0f7] mb-1">5) Подсказка при наведении</div>
            <p className="text-[#b9c4ce] leading-relaxed">
              Наведи курсор на ячейку: увидишь неделю, название цеха и формат <span className="text-[#e7f0f7] font-medium">Присутствует: X / minTotal</span>,
              где <span className="text-[#e7f0f7] font-medium">X</span> — фактическое покрытие, а <span className="text-[#e7f0f7] font-medium">minTotal</span> — минимальная норма.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
