export function formatDate(d: string | undefined | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function daysBetween(start: string, end: string): number {
  const a = new Date(start), b = new Date(end)
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1
}

export const VACATION_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Черновик',
  PENDING: 'На рассмотрении',
  APPROVED: 'Утверждён',
  MODIFIED: 'Изменён',
  CONFLICT: 'Конфликт',
}

export const VACATION_STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  MODIFIED: 'bg-orange-100 text-orange-800',
  CONFLICT: 'bg-red-100 text-red-800',
}

export const SEASON_LABEL: Record<string, string> = {
  HIGH: 'Высокий сезон',
  LOW: 'Низкий сезон',
  NEUTRAL: 'Нейтральный',
}

export const SEASON_COLOR: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-700',
  LOW: 'bg-green-100 text-green-700',
  NEUTRAL: 'bg-gray-100 text-gray-600',
}

export const QUAL_LABEL: Record<string, string> = {
  KEY: 'Ключевой',
  STD: 'Взаимозаменяемый',
}
