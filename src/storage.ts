import type { AppSettings, StudySession } from './types'
import { getApiToken } from './api'

const DB_NAME = 'daiyo-db'
const STORE_NAME = 'sessions'
const SETTINGS_KEY = 'daiyo-settings'
const FALLBACK_KEY = 'daiyo-sessions'
const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/api'

function fallbackSessions(): StudySession[] {
  try { return JSON.parse(localStorage.getItem(FALLBACK_KEY) ?? '[]') as StudySession[] } catch { return [] }
}

function fallbackSettings(): AppSettings {
  try { return { dailyGoal: 120, notifications: true, sounds: true, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') } } catch { return { dailyGoal: 120, notifications: true, sounds: true } }
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getApiToken()
  const headers = new Headers(init.headers ?? {})
  headers.set('Accept', 'application/json')

  if (!(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(errorText || 'Erro na requisição.')
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export async function getSessions(): Promise<StudySession[]> {
  const token = getApiToken()
  if (!token) return fallbackSessions()

  try {
    return await apiRequest<StudySession[]>('/sessions')
  } catch {
    return fallbackSessions()
  }
}

export async function saveSession(session: StudySession): Promise<void> {
  const persistableSession = JSON.parse(JSON.stringify(session)) as StudySession
  const sessions = await getSessions()
  const next = [...sessions.filter((item) => item.id !== persistableSession.id), persistableSession]
  localStorage.setItem(FALLBACK_KEY, JSON.stringify(next))

  const token = getApiToken()
  if (!token) {
    if (!('indexedDB' in window)) return
    await new Promise<void>((resolve) => {
      const request = indexedDB.open(DB_NAME, 1)
      request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
      request.onerror = () => resolve()
      request.onsuccess = () => {
        const transaction = request.result.transaction(STORE_NAME, 'readwrite')
        transaction.objectStore(STORE_NAME).put(persistableSession)
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => resolve()
      }
    })
    return
  }

  try {
    const existing = sessions.some((item) => item.id === persistableSession.id)
    if (existing) {
      await apiRequest<StudySession>(`/sessions/${persistableSession.id}`, {
        method: 'PUT',
        body: JSON.stringify(persistableSession),
      })
      return
    }

    await apiRequest<StudySession>('/sessions', {
      method: 'POST',
      body: JSON.stringify(persistableSession),
    })
  } catch {
    if (!('indexedDB' in window)) return
    await new Promise<void>((resolve) => {
      const request = indexedDB.open(DB_NAME, 1)
      request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
      request.onerror = () => resolve()
      request.onsuccess = () => {
        const transaction = request.result.transaction(STORE_NAME, 'readwrite')
        transaction.objectStore(STORE_NAME).put(persistableSession)
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => resolve()
      }
    })
  }
}

export async function getSettings(): Promise<AppSettings> {
  const token = getApiToken()
  if (!token) return fallbackSettings()

  try {
    return await apiRequest<AppSettings>('/settings')
  } catch {
    return fallbackSettings()
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const token = getApiToken()
  if (!token) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    return
  }

  try {
    await apiRequest<AppSettings>('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    })
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  }
}
