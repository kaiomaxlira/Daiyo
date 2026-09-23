export type SessionStatus = 'CREATED' | 'RUNNING' | 'PAUSED' | 'BREAK' | 'COMPLETED' | 'CANCELED'
export type TimerMethod = 'CUSTOM' | 'POMODORO' | 'DEEP_WORK' | 'TWO_HOURS' | 'SHORT'
export type TimerPhase = 'STUDY' | 'SHORT_BREAK' | 'LONG_BREAK'

export interface User {
  id: number | string
  name: string
  email: string
  createdAt?: string
  updatedAt?: string
}

export interface StudySession {
  id: string
  userId?: number | string | null
  topic: string
  method: TimerMethod
  methodLabel: string
  status: SessionStatus
  plannedDuration: number
  actualDuration: number
  startedAt: string | null
  pausedAt: string | null
  finishedAt: string | null
  accumulatedPausedTime: number
  currentPhase: TimerPhase
  currentCycle: number
  totalCycles: number
  shortBreakDuration: number
  longBreakDuration: number
  createdAt: string
  updatedAt: string
}

export interface AppSettings {
  dailyGoal: number
  notifications: boolean
  sounds: boolean
}
