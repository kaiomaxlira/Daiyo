<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import DashboardPage from './pages/DashboardPage.vue'
import HistoryPage from './pages/HistoryPage.vue'
import NewSessionPage from './pages/NewSessionPage.vue'
import SettingsPage from './pages/SettingsPage.vue'
import TimerPage from './pages/TimerPage.vue'
import AuthPage from './pages/AuthPage.vue'
import type { AppSettings, SessionStatus, StudySession, TimerMethod, TimerPhase, User } from './types'
import { getSessions, getSettings, saveSession, saveSettings } from './storage'
import { getCurrentUser, isAuthenticated, login, logout, register } from './auth'

type AppPage = 'auth' | 'dashboard' | 'new' | 'timer' | 'history' | 'settings'

const page = ref<AppPage>('auth')
const authMode = ref<'login' | 'register'>('login')
const authName = ref('')
const authEmail = ref('')
const authPassword = ref('')
const authError = ref('')
const authLoading = ref(false)
const currentUser = ref<User | null>(getCurrentUser())
const sessions = ref<StudySession[]>([])
const settings = ref<AppSettings>(getSettings())
const activeSession = ref<StudySession | null>(null)
const now = ref(Date.now())
const topic = ref('')
const selectedMethod = ref<TimerMethod>('CUSTOM')
const customMinutes = ref(30)
const error = ref('')
const notice = ref('')
let ticker: number | undefined

const methods: { id: TimerMethod; label: string; detail: string; study: number; cycles: number }[] = [
  { id: 'CUSTOM', label: 'Personalizado', detail: 'Escolha seu ritmo', study: 30, cycles: 1 },
  { id: 'POMODORO', label: 'Pomodoro', detail: '25 min + pausa', study: 25, cycles: 4 },
  { id: 'DEEP_WORK', label: 'Deep Work', detail: '50 min de foco', study: 50, cycles: 3 },
  { id: 'TWO_HOURS', label: '2 horas', detail: 'Bloco sem pausas', study: 120, cycles: 1 },
  { id: 'SHORT', label: 'Sessão curta', detail: '15 min + pausa', study: 15, cycles: 1 },
]

const completedSessions = computed(() => sessions.value.filter((session) => session.status === 'COMPLETED'))
const todayMinutes = computed(() => completedSessions.value.filter((session) => isToday(session.finishedAt)).reduce((sum, session) => sum + Math.round(session.actualDuration / 60), 0))
const goalPercent = computed(() => Math.round((todayMinutes.value / settings.value.dailyGoal) * 100))
const activeStatus = computed(() => activeSession.value?.status ?? null)
const notificationsSupported = typeof window !== 'undefined' && 'Notification' in window
const currentMethod = computed(() => methods.find((method) => method.id === selectedMethod.value) ?? methods[0])
const displaySeconds = computed(() => activeSession.value ? remainingSeconds(activeSession.value, now.value) : 0)
const elapsedSeconds = computed(() => activeSession.value ? elapsedActiveSeconds(activeSession.value, now.value) : 0)
const progress = computed(() => activeSession.value ? Math.min(1, elapsedSeconds.value / totalTimelineSeconds(activeSession.value)) : 0)
const phaseLabel = computed(() => activeSession.value?.currentPhase === 'STUDY' ? 'FOCO' : 'PAUSA')

function isToday(value: string | null): boolean {
  if (!value) return false
  return new Date(value).toDateString() === new Date().toDateString()
}
function formatTime(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  return [Math.floor(safe / 3600), Math.floor((safe % 3600) / 60), safe % 60].map((part) => String(part).padStart(2, '0')).join(':')
}
function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}min`
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}min`
}
function phaseSchedule(session: StudySession): { phase: TimerPhase; seconds: number }[] {
  if (session.method === 'POMODORO') return [25, 5, 25, 5, 25, 5, 25, 15].map((minutes, index) => ({ phase: index === 7 ? 'LONG_BREAK' : index % 2 ? 'SHORT_BREAK' : 'STUDY', seconds: minutes * 60 }))
  if (session.method === 'DEEP_WORK') return [50, 10, 50, 10, 50].map((minutes, index) => ({ phase: index % 2 ? 'SHORT_BREAK' : 'STUDY', seconds: minutes * 60 }))
  if (session.method === 'SHORT') return [{ phase: 'STUDY', seconds: 15 * 60 }, { phase: 'SHORT_BREAK', seconds: 5 * 60 }]
  return [{ phase: 'STUDY', seconds: session.plannedDuration }]
}
function totalTimelineSeconds(session: StudySession): number { return phaseSchedule(session).reduce((sum, item) => sum + item.seconds, 0) }
function elapsedActiveSeconds(session: StudySession, timestamp: number): number {
  if (!session.startedAt) return 0
  const end = session.finishedAt ? new Date(session.finishedAt).getTime() : timestamp
  const paused = session.accumulatedPausedTime + (session.status === 'PAUSED' && session.pausedAt ? end - new Date(session.pausedAt).getTime() : 0)
  return Math.max(0, Math.min(totalTimelineSeconds(session), (end - new Date(session.startedAt).getTime() - paused) / 1000))
}
function remainingSeconds(session: StudySession, timestamp: number): number {
  return Math.max(0, totalTimelineSeconds(session) - elapsedActiveSeconds(session, timestamp))
}
function phaseFor(session: StudySession, timestamp: number): TimerPhase {
  let remaining = elapsedActiveSeconds(session, timestamp)
  let cycle = 1
  for (const item of phaseSchedule(session)) {
    if (remaining < item.seconds) { session.currentCycle = cycle; return item.phase }
    remaining -= item.seconds
    if (item.phase === 'STUDY') cycle += 1
  }
  return 'STUDY'
}
function studiedSecondsAt(session: StudySession, timestamp: number): number {
  let remaining = elapsedActiveSeconds(session, timestamp)
  return phaseSchedule(session).reduce((total, item) => {
    const portion = Math.min(remaining, item.seconds)
    remaining = Math.max(0, remaining - item.seconds)
    return total + (item.phase === 'STUDY' ? portion : 0)
  }, 0)
}
async function persist(session: StudySession): Promise<void> { session.updatedAt = new Date().toISOString(); await saveSession(session) }
async function load(): Promise<void> {
  sessions.value = await getSessions()
  activeSession.value = sessions.value.find((session) => ['RUNNING', 'PAUSED', 'BREAK'].includes(session.status)) ?? null
  if (activeSession.value) {
    if (remainingSeconds(activeSession.value, Date.now()) <= 0 && activeSession.value.status === 'RUNNING') await finishSession(false)
    else setPage('timer')
  }
}
async function submitAuth(): Promise<void> {
  authLoading.value = true
  authError.value = ''

  try {
    const user = authMode.value === 'login'
      ? await login(authEmail.value.trim(), authPassword.value)
      : await register(authName.value.trim(), authEmail.value.trim(), authPassword.value)

    currentUser.value = user
    page.value = 'dashboard'
    notice.value = 'Login realizado com sucesso.'
  } catch (errorValue) {
    authError.value = errorValue instanceof Error ? errorValue.message : 'Não foi possível realizar a autenticação.'
  } finally {
    authLoading.value = false
  }
}

async function handleLogout(): Promise<void> {
  await logout()
  currentUser.value = null
  page.value = 'auth'
  authMode.value = 'login'
  authEmail.value = ''
  authPassword.value = ''
  authName.value = ''
  authError.value = ''
}

function selectMethod(method: TimerMethod): void {
  selectedMethod.value = method
  const preset = methods.find((item) => item.id === method)
  if (preset && method !== 'CUSTOM') customMinutes.value = preset.study
}
function setPage(next: AppPage): void {
  if (next === page.value) return
  page.value = next
  notice.value = ''
  if (next === 'timer' && activeSession.value) startTicker()
}
function openNew(method: TimerMethod = 'CUSTOM'): void { selectMethod(method); topic.value = ''; error.value = ''; setPage('new') }
function newSession(): StudySession {
  const preset = currentMethod.value
  const minutes = selectedMethod.value === 'CUSTOM' ? customMinutes.value : preset.study
  const nowIso = new Date().toISOString()
  return { id: crypto.randomUUID(), topic: topic.value.trim(), method: selectedMethod.value, methodLabel: preset.label, status: 'RUNNING', plannedDuration: minutes * 60, actualDuration: 0, startedAt: nowIso, pausedAt: null, finishedAt: null, accumulatedPausedTime: 0, currentPhase: 'STUDY', currentCycle: 1, totalCycles: preset.cycles, shortBreakDuration: selectedMethod.value === 'POMODORO' ? 5 * 60 : 10 * 60, longBreakDuration: 15 * 60, createdAt: nowIso, updatedAt: nowIso }
}
async function createSession(): Promise<void> {
  if (!topic.value.trim()) { error.value = 'O tema é obrigatório.'; return }
  if (customMinutes.value <= 0) { error.value = 'A duração deve ser maior que zero.'; return }
  if (activeSession.value) { error.value = 'Você já possui uma sessão em andamento.'; return }
  const session = newSession(); sessions.value.push(session); activeSession.value = session; await persist(session); setPage('timer'); startTicker()
}
function startTicker(): void { if (ticker === undefined) ticker = window.setInterval(() => { now.value = Date.now(); refreshTimer() }, 1000) }
function stopTicker(): void { if (ticker !== undefined) { window.clearInterval(ticker); ticker = undefined } }
async function refreshTimer(): Promise<void> {
  if (!activeSession.value) return
  const session = activeSession.value
  session.currentPhase = phaseFor(session, now.value)
  if (remainingSeconds(session, now.value) <= 0 && session.status === 'RUNNING') await finishSession(false)
}
async function pauseSession(): Promise<void> { if (!activeSession.value || activeSession.value.status !== 'RUNNING') return; activeSession.value.status = 'PAUSED'; activeSession.value.pausedAt = new Date().toISOString(); await persist(activeSession.value) }
async function resumeSession(): Promise<void> {
  if (!activeSession.value || activeSession.value.status !== 'PAUSED') return
  activeSession.value.accumulatedPausedTime += Date.now() - new Date(activeSession.value.pausedAt ?? Date.now()).getTime()
  activeSession.value.pausedAt = null; activeSession.value.status = 'RUNNING'; await persist(activeSession.value)
}
async function finishSession(withConfirm = true): Promise<void> {
  if (!activeSession.value) return
  if (withConfirm && !window.confirm('Finalizar sessão? Seu tempo estudado será registrado.')) return
  const session = activeSession.value; session.status = 'COMPLETED'; session.finishedAt = new Date().toISOString(); session.actualDuration = Math.round(studiedSecondsAt(session, Date.now())); await persist(session); activeSession.value = null; stopTicker(); notice.value = 'Sessão concluída. Seu tempo foi registrado.'; setPage('dashboard')
  if (settings.value.notifications && 'Notification' in window && Notification.permission === 'granted') new Notification('Daiyo', { body: `Sua sessão de ${session.topic} terminou.` })
}
async function cancelSession(): Promise<void> { if (!activeSession.value || !window.confirm('Cancelar esta sessão? Ela não será contabilizada.')) return; activeSession.value.status = 'CANCELED'; activeSession.value.finishedAt = new Date().toISOString(); await persist(activeSession.value); activeSession.value = null; stopTicker(); setPage('dashboard') }
async function requestNotifications(): Promise<void> { if ('Notification' in window) { const permission = await Notification.requestPermission(); settings.value.notifications = permission === 'granted'; saveSettings(settings.value) } }
function savePreferences(): void { saveSettings(settings.value); notice.value = 'Preferências salvas.' }
function statusLabel(status: SessionStatus): string { return ({ COMPLETED: 'Concluída', CANCELED: 'Cancelada', RUNNING: 'Em foco', PAUSED: 'Pausada', BREAK: 'Pausa', CREATED: 'Criada' })[status] }
function dateLabel(value: string): string { return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) }

onMounted(async () => {
  const authenticated = isAuthenticated()
  if (authenticated) {
    currentUser.value = getCurrentUser()
    page.value = 'dashboard'
  }

  await load()
  if (activeSession.value) startTicker()
})
onBeforeUnmount(stopTicker)
</script>

<template>
  <div class="app-shell">
    <aside v-if="page !== 'auth'" class="sidebar">
      <div class="brand"><span class="brand-mark" aria-hidden="true"></span><span>Daiyo</span></div>
      <p class="eyebrow">SEU ESPAÇO DE FOCO</p>
      <nav>
        <button :class="{ active: page === 'dashboard' }" @click="setPage('dashboard')"><span>⌂</span> Visão geral</button>
        <button :class="{ active: page === 'new' }" @click="openNew()"><span>＋</span> Nova sessão</button>
        <button :class="{ active: page === 'history' }" @click="setPage('history')"><span>◷</span> Histórico</button>
        <button :class="{ active: page === 'settings' }" @click="setPage('settings')"><span>⚙</span> Configurações</button>
      </nav>
      <div class="sidebar-bottom">
        <div class="mini-orbit"></div>
        <p>{{ currentUser?.name ?? 'Usuário' }}<br><strong>Um foco de cada vez.</strong></p>
        <button class="text-button" @click="handleLogout()">Sair</button>
      </div>
    </aside>

    <main v-if="page === 'auth'" class="main-content">
      <AuthPage
        :mode="authMode"
        :name="authName"
        :email="authEmail"
        :password="authPassword"
        :loading="authLoading"
        :error="authError"
        @update:mode="authMode = $event"
        @update:name="authName = $event"
        @update:email="authEmail = $event"
        @update:password="authPassword = $event"
        @submit="submitAuth()"
      />
    </main>

    <main v-else class="main-content">
      <header class="topbar">
        <div class="crumb-wrap">
          <span class="mobile-brand">Daiyo</span>
          <span class="breadcrumb">{{ page === 'dashboard' ? 'Visão geral' : page === 'new' ? 'Nova sessão' : page === 'timer' ? 'Sessão em andamento' : page === 'history' ? 'Histórico' : 'Configurações' }}</span>
        </div>
      </header>
      <div v-if="notice" class="toast" role="status">{{ notice }} <button @click="notice = ''">×</button></div>

      <DashboardPage
        v-if="page === 'dashboard'"
        :goal-percent="goalPercent"
        :today-minutes="todayMinutes"
        :completed-sessions="completedSessions.length"
        :methods="methods"
        @open-new="openNew($event as TimerMethod | undefined)"
      />

      <NewSessionPage
        v-else-if="page === 'new'"
        :topic="topic"
        :selected-method="selectedMethod"
        :custom-minutes="customMinutes"
        :error="error"
        :methods="methods"
        @update:topic="topic = $event"
        @select-method="selectMethod($event as TimerMethod)"
        @update:custom-minutes="customMinutes = Number($event)"
        @create-session="createSession()"
      />

      <TimerPage
        v-else-if="page === 'timer' && activeSession"
        :active-session="activeSession"
        :active-status="activeStatus"
        :phase-label="phaseLabel"
        :progress="progress"
        :display-seconds="displaySeconds"
        :elapsed-seconds="elapsedSeconds"
        :format-time="formatTime"
        :format-minutes="formatMinutes"
        @pause-or-resume="activeStatus === 'PAUSED' ? resumeSession() : pauseSession()"
        @finish-session="finishSession()"
        @cancel-session="cancelSession()"
      />

      <HistoryPage
        v-else-if="page === 'history'"
        :sessions="sessions"
        :format-minutes="formatMinutes"
        :date-label="dateLabel"
        :status-label="statusLabel"
      />

      <SettingsPage
        v-else
        :settings="settings"
        :notifications-supported="notificationsSupported"
        @update:daily-goal="settings.dailyGoal = Number($event)"
        @toggle-notifications="settings.notifications = !settings.notifications; savePreferences()"
        @save-preferences="savePreferences()"
        @request-notifications="requestNotifications()"
      />
    </main>
    <nav v-if="page !== 'auth'" class="mobile-nav"><button :class="{ active: page === 'dashboard' }" @click="setPage('dashboard')">⌂<small>Início</small></button><button :class="{ active: page === 'new' }" @click="openNew()">＋<small>Nova</small></button><button :class="{ active: page === 'history' }" @click="setPage('history')">◷<small>Histórico</small></button><button :class="{ active: page === 'settings' }" @click="setPage('settings')">⚙<small>Ajustes</small></button></nav>
  </div>
</template>
