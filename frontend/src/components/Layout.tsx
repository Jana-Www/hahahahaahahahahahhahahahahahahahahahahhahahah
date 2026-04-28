import { Link, useLocation, useNavigate } from 'react-router-dom'
import { clearAuth, getUser, isManager } from '../lib/auth'

const EMPLOYEE_NAV = [
  { to: '/employee/dashboard', label: 'Мой отпуск' },
  { to: '/employee/wishes', label: 'Мои пожелания' },
]

const MANAGER_NAV = [
  { to: '/manager/dashboard', label: 'Дашборд' },
  { to: '/manager/gantt', label: 'Диаграмма' },
  { to: '/manager/heatmap', label: 'Тепловая карта' },
  { to: '/manager/approval', label: 'Согласование' },
  { to: '/manager/conflicts', label: 'Конфликты' },
  { to: '/manager/admin', label: 'Структура' },
  { to: '/manager/calendar', label: 'Календарь' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const nav = useNavigate()
  const location = useLocation()
  const user = getUser()
  const manager = isManager()
  const links = manager ? MANAGER_NAV : EMPLOYEE_NAV

  const handleLogout = () => {
    clearAuth()
    nav('/login')
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top header — always visible */}
      <header className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="font-bold text-blue-600 text-sm">Vacation Planner</span>
          <span className="text-gray-300">·</span>
          <span className="text-xs text-gray-400">AI-планировщик</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 hidden sm:block">{user?.full_name}</span>
          <span className="text-xs text-gray-300 hidden sm:block">|</span>
          <span className="text-xs text-gray-400 hidden sm:block">
            {manager ? 'Менеджер' : 'Сотрудник'}
          </span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 active:bg-red-700 rounded-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
            </svg>
            Выйти
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-52 bg-white border-r border-gray-200 flex flex-col shrink-0">
          <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
            {links.map(l => (
              <Link
                key={l.to}
                to={l.to}
                className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                  location.pathname === l.to
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  )
}
