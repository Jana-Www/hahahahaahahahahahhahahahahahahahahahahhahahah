import { Navigate } from 'react-router-dom'
import { getToken, getUser } from '../lib/auth'
import Layout from './Layout'

interface Props {
  children: React.ReactNode
  role?: 'MANAGER' | 'EMPLOYEE'
}

export default function ProtectedRoute({ children, role }: Props) {
  const token = getToken()
  const user = getUser()

  if (!token || !user) return <Navigate to="/login" replace />
  if (role && user.role !== role) {
    return <Navigate to={user.role === 'MANAGER' ? '/manager/dashboard' : '/employee/dashboard'} replace />
  }

  return <Layout>{children}</Layout>
}
