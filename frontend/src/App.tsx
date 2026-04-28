import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense, Component, type ReactNode, type ErrorInfo } from 'react'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('React crash:', error, info) }
  render() {
    if (this.state.error) {
      const err = this.state.error as Error
      return (
        <div style={{ padding: 32, fontFamily: 'monospace', background: '#fff1f2', minHeight: '100vh' }}>
          <h2 style={{ color: '#dc2626' }}>⚠ Ошибка рендеринга</h2>
          <pre style={{ background: '#fee2e2', padding: 16, borderRadius: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {err.message}{'\n\n'}{err.stack}
          </pre>
          <button onClick={() => { this.setState({ error: null }); window.location.href = '/login' }}
            style={{ marginTop: 16, padding: '8px 20px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
            Вернуться на логин
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

const EmployeeDashboard = lazy(() => import('./pages/employee/EmployeeDashboard'))
const WishesPage = lazy(() => import('./pages/employee/WishesPage'))
const ManagerDashboard = lazy(() => import('./pages/manager/ManagerDashboard'))
const GanttPage = lazy(() => import('./pages/manager/GanttPage'))
const HeatmapPage = lazy(() => import('./pages/manager/HeatmapPage'))
const ApprovalPage = lazy(() => import('./pages/manager/ApprovalPage'))
const ConflictsPage = lazy(() => import('./pages/manager/ConflictsPage'))
const AdminPage = lazy(() => import('./pages/manager/AdminPage'))
const CalendarPage = lazy(() => import('./pages/manager/CalendarPage'))

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center text-gray-400">
      Загрузка...
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* Employee routes */}
          <Route path="/employee/dashboard" element={
            <ProtectedRoute role="EMPLOYEE"><EmployeeDashboard /></ProtectedRoute>
          } />
          <Route path="/employee/wishes" element={
            <ProtectedRoute role="EMPLOYEE"><WishesPage /></ProtectedRoute>
          } />

          {/* Manager routes */}
          <Route path="/manager/dashboard" element={
            <ProtectedRoute role="MANAGER"><ManagerDashboard /></ProtectedRoute>
          } />
          <Route path="/manager/gantt" element={
            <ProtectedRoute role="MANAGER"><GanttPage /></ProtectedRoute>
          } />
          <Route path="/manager/heatmap" element={
            <ProtectedRoute role="MANAGER"><HeatmapPage /></ProtectedRoute>
          } />
          <Route path="/manager/approval" element={
            <ProtectedRoute role="MANAGER"><ApprovalPage /></ProtectedRoute>
          } />
          <Route path="/manager/conflicts" element={
            <ProtectedRoute role="MANAGER"><ConflictsPage /></ProtectedRoute>
          } />
          <Route path="/manager/admin" element={
            <ProtectedRoute role="MANAGER"><AdminPage /></ProtectedRoute>
          } />
          <Route path="/manager/calendar" element={
            <ProtectedRoute role="MANAGER"><CalendarPage /></ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
