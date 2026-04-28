export type UserRole = 'EMPLOYEE' | 'MANAGER'
export type Qualification = 'KEY' | 'STD'
export type SeasonStatus = 'HIGH' | 'LOW' | 'NEUTRAL'
export type VacationStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'MODIFIED' | 'CONFLICT'
export type JobStatus = 'RUNNING' | 'DONE' | 'FAILED'

export interface User {
  id: string
  full_name: string
  login: string
  role: UserRole
  position?: string
  line_text?: string
  qualification: Qualification
  shift_id?: string
  vacation_days_norm: number
  vacation_days_used: number
}

export interface Workshop {
  id: string
  name: string
  shifts: Shift[]
}

export interface Shift {
  id: string
  name: string
  workshop_id: string
}

export interface SeasonPeriod {
  id: string
  year: number
  date_start: string
  date_end: string
  status: SeasonStatus
}

export interface CoverageRule {
  id: string
  workshop_id: string
  period_status: SeasonStatus
  min_total: number
  min_key: number
  max_on_vacation?: number
}

export interface WishRequest {
  id: string
  user_id: string
  year: number
  is_locked: boolean
  v1_start?: string; v1_end?: string; v1_comment?: string
  v2_start?: string; v2_end?: string; v2_comment?: string
  v3_start?: string; v3_end?: string; v3_comment?: string
  user?: User
}

export interface VacationBlock {
  id: string
  user_id: string
  year: number
  date_start: string
  date_end: string
  status: VacationStatus
  wish_variant_used?: number
  ai_explanation?: string
  manager_comment?: string
  updated_at: string
  user?: User
}

export interface GenerationJob {
  id: string
  year: number
  status: JobStatus
  error_message?: string
  started_at: string
  finished_at?: string
}

export interface DashboardStats {
  total_employees: number
  approved: number
  pending: number
  draft: number
  conflict: number
  modified: number
  without_wishes: number
}

export interface ConflictItem {
  code: string
  severity: string
  description: string
  employee_name?: string
  workshop_name?: string
  date_start?: string
  date_end?: string
}
