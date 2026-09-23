import type { AppSettings, StudySession } from './types'

const DB_NAME = 'daiyo-db'
const STORE_NAME = 'sessions'
const SETTINGS_KEY = 'daiyo-settings'
const FALLBACK_KEY = 'daiyo-sessions'

function fallbackSessions(): StudySession[] {
  try { return JSON.parse(localStorage.getItem(FALLBACK_KEY) ?? '[]') as StudySession[] } catch { return [] }
}

export async function getSessions(): Promise<StudySession[]> {
  if (!('indexedDB' in window)) return fallbackSessions()
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
    request.onerror = () => resolve(fallbackSessions())
    request.onsuccess = () => {
      const transaction = request.result.transaction(STORE_NAME, 'readonly')
      const read = transaction.objectStore(STORE_NAME).getAll()
      read.onsuccess = () => resolve(read.result as StudySession[])
      read.onerror = () => resolve(fallbackSessions())
    }
  })
}

export async function saveSession(session: StudySession): Promise<void> {
  const persistableSession = JSON.parse(JSON.stringify(session)) as StudySession
  const sessions = await getSessions()
  const next = [...sessions.filter((item) => item.id !== persistableSession.id), persistableSession]
  localStorage.setItem(FALLBACK_KEY, JSON.stringify(next))
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

export function getSettings(): AppSettings {
  try { return { dailyGoal: 120, notifications: true, sounds: true, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') } } catch { return { dailyGoal: 120, notifications: true, sounds: true } }
}

export function saveSettings(settings: AppSettings): void { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)) }
