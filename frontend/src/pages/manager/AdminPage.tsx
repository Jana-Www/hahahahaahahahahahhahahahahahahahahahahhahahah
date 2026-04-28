import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { Workshop, User } from '../../lib/types'
import { QUAL_LABEL } from '../../lib/utils'

export default function AdminPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'workshops' | 'users'>('workshops')

  const { data: workshops = [] } = useQuery<Workshop[]>({
    queryKey: ['workshops'],
    queryFn: () => api.get('/workshops').then(r => r.data),
  })

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
  })

  // Workshop form
  const [wsName, setWsName] = useState('')
  const createWs = useMutation({
    mutationFn: () => api.post('/workshops', { name: wsName }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['workshops'] }); setWsName('') },
  })
  const deleteWs = useMutation({
    mutationFn: (id: string) => api.delete(`/workshops/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workshops'] }),
  })

  // Shift form
  const [shiftName, setShiftName] = useState('')
  const [shiftWsId, setShiftWsId] = useState('')
  const createShift = useMutation({
    mutationFn: () => api.post(`/workshops/${shiftWsId}/shifts`, { name: shiftName }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['workshops'] }); setShiftName('') },
  })

  // User form
  const [newUser, setNewUser] = useState({
    full_name: '', login: '', password: '', role: 'EMPLOYEE',
    position: '', qualification: 'STD', shift_id: '',
    vacation_days_norm: 28, vacation_days_used: 0,
  })
  const createUser = useMutation({
    mutationFn: () => api.post('/users', { ...newUser, shift_id: newUser.shift_id || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setNewUser({ full_name: '', login: '', password: '', role: 'EMPLOYEE', position: '', qualification: 'STD', shift_id: '', vacation_days_norm: 28, vacation_days_used: 0 })
    },
  })
  const deleteUser = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  const allShifts = workshops.flatMap(w => w.shifts.map(s => ({ ...s, workshop_name: w.name })))
  const shiftMap = Object.fromEntries(allShifts.map(s => [s.id, s]))

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Структура подразделения</h1>

      <div className="flex gap-2 mb-6">
        {[['workshops', 'Цеха и смены'], ['users', 'Сотрудники']].map(([k, v]) => (
          <button key={k} onClick={() => setTab(k as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === k ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {v}
          </button>
        ))}
      </div>

      {tab === 'workshops' && (
        <div className="grid grid-cols-2 gap-6">
          {/* Workshops */}
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Цеха</h2>
            <div className="flex gap-2 mb-4">
              <input className="input flex-1" placeholder="Название цеха" value={wsName} onChange={e => setWsName(e.target.value)} />
              <button className="btn-primary" onClick={() => createWs.mutate()} disabled={!wsName}>Добавить</button>
            </div>
            <div className="space-y-2">
              {workshops.map(w => (
                <div key={w.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm font-medium">{w.name}</span>
                  <button className="text-xs text-red-500 hover:text-red-700" onClick={() => deleteWs.mutate(w.id)}>Удалить</button>
                </div>
              ))}
            </div>
          </div>

          {/* Shifts */}
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Смены</h2>
            <div className="space-y-2 mb-4">
              <select className="input" value={shiftWsId} onChange={e => setShiftWsId(e.target.value)}>
                <option value="">— выберите цех —</option>
                {workshops.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <div className="flex gap-2">
                <input className="input flex-1" placeholder="Название смены" value={shiftName} onChange={e => setShiftName(e.target.value)} />
                <button className="btn-primary" onClick={() => createShift.mutate()} disabled={!shiftName || !shiftWsId}>Добавить</button>
              </div>
            </div>
            <div className="space-y-1">
              {allShifts.map(s => (
                <div key={s.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0 text-sm">
                  <span>{s.name} <span className="text-gray-400 text-xs">— {s.workshop_name}</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div>
          {/* Add user form */}
          <div className="card p-5 mb-6">
            <h2 className="font-semibold text-gray-900 mb-4">Добавить сотрудника</h2>
            <div className="grid grid-cols-3 gap-3">
              <input className="input" placeholder="ФИО" value={newUser.full_name} onChange={e => setNewUser(p => ({ ...p, full_name: e.target.value }))} />
              <input className="input" placeholder="Логин" value={newUser.login} onChange={e => setNewUser(p => ({ ...p, login: e.target.value }))} />
              <input className="input" type="password" placeholder="Пароль" value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} />
              <input className="input" placeholder="Должность" value={newUser.position} onChange={e => setNewUser(p => ({ ...p, position: e.target.value }))} />
              <select className="input" value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}>
                <option value="EMPLOYEE">Сотрудник</option>
                <option value="MANAGER">Менеджер</option>
              </select>
              <select className="input" value={newUser.qualification} onChange={e => setNewUser(p => ({ ...p, qualification: e.target.value }))}>
                <option value="STD">Взаимозаменяемый</option>
                <option value="KEY">Ключевой</option>
              </select>
              <select className="input" value={newUser.shift_id} onChange={e => setNewUser(p => ({ ...p, shift_id: e.target.value }))}>
                <option value="">— смена —</option>
                {allShifts.map(s => <option key={s.id} value={s.id}>{s.workshop_name} / {s.name}</option>)}
              </select>
              <input className="input" type="number" placeholder="Норма дней" value={newUser.vacation_days_norm} onChange={e => setNewUser(p => ({ ...p, vacation_days_norm: +e.target.value }))} />
              <input className="input" type="number" placeholder="Использовано ранее" value={newUser.vacation_days_used} onChange={e => setNewUser(p => ({ ...p, vacation_days_used: +e.target.value }))} />
            </div>
            <button className="btn-primary mt-3" onClick={() => createUser.mutate()} disabled={!newUser.full_name || !newUser.login || !newUser.password}>
              Добавить сотрудника
            </button>
          </div>

          {/* Users table */}
          <div className="card overflow-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  {['ФИО', 'Логин', 'Должность', 'Квалификация', 'Смена', 'Норма / Исп.', 'Роль', ''].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{u.full_name}</td>
                    <td className="px-3 py-2 text-gray-500">{u.login}</td>
                    <td className="px-3 py-2 text-gray-500">{u.position ?? '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`badge ${u.qualification === 'KEY' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600'}`}>
                        {QUAL_LABEL[u.qualification]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {u.shift_id ? shiftMap[u.shift_id]?.name ?? '—' : '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-500">{u.vacation_days_norm} / {u.vacation_days_used}</td>
                    <td className="px-3 py-2">
                      <span className={`badge ${u.role === 'MANAGER' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>
                        {u.role === 'MANAGER' ? 'Менеджер' : 'Сотрудник'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <button className="text-xs text-red-500 hover:text-red-700" onClick={() => deleteUser.mutate(u.id)}>
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
