import type { AppSettings, StudySession, User } from './types'

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/api'
const TOKEN_KEY = 'daiyo-auth-token'

export interface AuthResponse {
  token: string
  user: User
}

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload extends LoginPayload {
  name: string
}

export function getApiToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setApiToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearApiToken(): void {
  localStorage.removeItem(TOKEN_KEY)
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
  })

  if (!response.ok) {
    const message = await response.text().catch(() => 'Erro na requisição.')
    throw new Error(message || 'Erro na requisição.')
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export async function registerUser(payload: RegisterPayload): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function loginUser(payload: LoginPayload): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function logoutUser(): Promise<void> {
  await apiRequest<void>('/logout', { method: 'POST' })
  clearApiToken()
}

export async function fetchSessions(): Promise<StudySession[]> {
  return apiRequest<StudySession[]>('/sessions')
}

export async function createSession(payload: Partial<StudySession>): Promise<StudySession> {
  return apiRequest<StudySession>('/sessions', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateSession(id: string, payload: Partial<StudySession>): Promise<StudySession> {
  return apiRequest<StudySession>(`/sessions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function fetchSettings(): Promise<AppSettings> {
  return apiRequest<AppSettings>('/settings')
}

export async function saveSettingsOnServer(settings: AppSettings): Promise<AppSettings> {
  return apiRequest<AppSettings>('/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  })
}
