export default function HelpPage() {
  const sections = [
    {
      title: 'Дашборд',
      text: 'Быстрый сводный экран. Проверяй: всего сотрудников, утверждённые отпуска, черновики AI, конфликты, изменения менеджера и сотрудников без пожеланий.',
      tips: ['Начинай день с этого раздела', 'Если конфликтов много — переходи в Конфликты и Согласование'],
      color: 'from-[#4fa5b3] to-[#3f7280]',
    },
    {
      title: 'Диаграмма',
      text: 'Годовая лента отпусков по цехам/сменам/сотрудникам. Показывает кто и когда отсутствует, помогает быстро найти перегруженные периоды.',
      tips: ['Используй фильтр проблемных случаев', 'Проверяй сгущения отпусков в пиковые месяцы'],
      color: 'from-[#d89013] to-[#e09a18]',
    },
    {
      title: 'Тепловая карта',
      text: 'Контроль покрытия по неделям (1–52). Цвет ячейки отражает уровень риска относительно минимальной нормы в цехе.',
      tips: ['Красный = дефицит, действовать срочно', 'Жёлтый = зона риска, желательно перераспределить'],
      color: 'from-[#d54a34] to-[#b73f2d]',
    },
    {
      title: 'Согласование',
      text: 'Рабочий контур принятия решений по каждому отпускному блоку: утвердить, изменить даты и оставить комментарий.',
      tips: ['Каждое изменение фиксируй осмысленным комментарием', 'После правок пересмотри тепловую карту'],
      color: 'from-[#6e9f2f] to-[#5b8627]',
    },
    {
      title: 'Конфликты',
      text: 'Список проблем и AI-рекомендации по их устранению. Используется для приоритизации ручных действий менеджера.',
      tips: ['Сначала закрывай конфликты высокого влияния', 'Проверяй рекомендации AI перед применением'],
      color: 'from-[#9153d6] to-[#6d3fb0]',
    },
    {
      title: 'Структура',
      text: 'Справочник оргструктуры: цеха, смены, сотрудники, нормы. Этот раздел задаёт основу корректного планирования.',
      tips: ['Перед генерацией убедись, что структура актуальна', 'Неверная структура = неверные расчёты'],
      color: 'from-[#4f5962] to-[#3b434a]',
    },
    {
      title: 'Календарь',
      text: 'Редактирование сезонов и правил покрытия. Здесь задаются ограничения, по которым работает генератор графика.',
      tips: ['HIGH-сезоны заводи аккуратно', 'После изменения правил перегенерируй график'],
      color: 'from-[#2f8f86] to-[#216c65]',
    },
  ]

  return (
    <div className="text-slate-100">
      <div className="text-center mb-5">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#2f3438] border border-[#4a5258] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#cbd5df] mb-2">
          <span>Manager guide</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight bg-gradient-to-r from-[#5db3be] via-[#e09a18] to-[#d64a35] bg-clip-text text-transparent drop-shadow-sm">
          Помощь по планированию отпусков
        </h1>
        <p className="text-xs text-[#b9c4ce] mt-2">
          Короткий гайд для нового менеджера: что делать в каждом разделе и как принимать решения.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {sections.map((s) => (
          <div key={s.title} className="card p-4 bg-[#2f3438] border-[#4a545b]">
            <div className={`inline-block rounded-md bg-gradient-to-r ${s.color} px-2.5 py-1 text-xs font-semibold mb-3`}>
              {s.title}
            </div>
            <p className="text-sm text-[#d8e1ea] leading-relaxed mb-3">{s.text}</p>
            <div className="space-y-1">
              {s.tips.map((tip) => (
                <div key={tip} className="text-xs text-[#b9c4ce]">• {tip}</div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
