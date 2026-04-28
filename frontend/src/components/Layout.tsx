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
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <div className="font-bold text-blue-600 text-sm">Vacation Planner</div>
          <div className="text-xs text-gray-400 mt-0.5">AI-планировщик</div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
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

        <div className="p-3 border-t border-gray-100">
          <div className="text-xs text-gray-500 truncate px-2 mb-2">{user?.full_name}</div>
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-1.5 text-xs text-gray-500 hover:text-red-600 rounded transition-colors"
          >
            Выйти
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  )
}
