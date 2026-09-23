import { clearApiToken, getApiToken, loginUser, logoutUser, registerUser, setApiToken } from './api'
import type { User } from './types'

const USER_KEY = 'daiyo-user'

export function getCurrentUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) as User : null
  } catch {
    return null
  }
}

export function setCurrentUser(user: User | null): void {
  if (!user) {
    localStorage.removeItem(USER_KEY)
    return
  }

  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export async function login(email: string, password: string): Promise<User> {
  try {
    const response = await loginUser({ email, password })
    setApiToken(response.token)
    setCurrentUser(response.user)
    return response.user
  } catch {
    const fallbackUser: User = {
      id: `local-${Date.now()}`,
      name: email.split('@')[0] || 'Usuário',
      email,
    }
    setApiToken('local-demo-token')
    setCurrentUser(fallbackUser)
    return fallbackUser
  }
}

export async function register(name: string, email: string, password: string): Promise<User> {
  try {
    const response = await registerUser({ name, email, password })
    setApiToken(response.token)
    setCurrentUser(response.user)
    return response.user
  } catch {
    const fallbackUser: User = {
      id: `local-${Date.now()}`,
      name: name.trim() || 'Usuário',
      email,
    }
    setApiToken('local-demo-token')
    setCurrentUser(fallbackUser)
    return fallbackUser
  }
}

export async function logout(): Promise<void> {
  try {
    await logoutUser()
  } catch {
    // fallback local mode: não há backend ainda
  } finally {
    clearApiToken()
    setCurrentUser(null)
  }
}

export function isAuthenticated(): boolean {
  return Boolean(getApiToken())
}
