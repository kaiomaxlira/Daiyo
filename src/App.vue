<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { AppSettings, SessionStatus, StudySession, TimerMethod, TimerPhase } from './types'
import { getSessions, getSettings, saveSession, saveSettings } from './storage'

const page = ref<'dashboard' | 'new' | 'timer' | 'history' | 'settings'>('dashboard')
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
    else page.value = 'timer'
  }
}
function selectMethod(method: TimerMethod): void {
  selectedMethod.value = method
  const preset = methods.find((item) => item.id === method)
  if (preset && method !== 'CUSTOM') customMinutes.value = preset.study
}
function openNew(method: TimerMethod = 'CUSTOM'): void { selectMethod(method); topic.value = ''; error.value = ''; page.value = 'new' }
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
  const session = newSession(); sessions.value.push(session); activeSession.value = session; await persist(session); page.value = 'timer'; startTicker()
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
  const session = activeSession.value; session.status = 'COMPLETED'; session.finishedAt = new Date().toISOString(); session.actualDuration = Math.round(studiedSecondsAt(session, Date.now())); await persist(session); activeSession.value = null; stopTicker(); notice.value = 'Sessão concluída. Seu tempo foi registrado.'; page.value = 'dashboard'
  if (settings.value.notifications && 'Notification' in window && Notification.permission === 'granted') new Notification('Daiyo', { body: `Sua sessão de ${session.topic} terminou.` })
}
async function cancelSession(): Promise<void> { if (!activeSession.value || !window.confirm('Cancelar esta sessão? Ela não será contabilizada.')) return; activeSession.value.status = 'CANCELED'; activeSession.value.finishedAt = new Date().toISOString(); await persist(activeSession.value); activeSession.value = null; stopTicker(); page.value = 'dashboard' }
async function requestNotifications(): Promise<void> { if ('Notification' in window) { const permission = await Notification.requestPermission(); settings.value.notifications = permission === 'granted'; saveSettings(settings.value) } }
function savePreferences(): void { saveSettings(settings.value); notice.value = 'Preferências salvas.' }
function setPage(next: typeof page.value): void { page.value = next; notice.value = ''; if (next === 'timer' && activeSession.value) startTicker() }
function statusLabel(status: SessionStatus): string { return ({ COMPLETED: 'Concluída', CANCELED: 'Cancelada', RUNNING: 'Em foco', PAUSED: 'Pausada', BREAK: 'Pausa', CREATED: 'Criada' })[status] }
function dateLabel(value: string): string { return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) }

onMounted(async () => { await load(); if (activeSession.value) startTicker() })
onBeforeUnmount(stopTicker)
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand"><span class="brand-mark">D</span><span>Daiyo</span></div>
      <p class="eyebrow">SEU ESPAÇO DE FOCO</p>
      <nav>
        <button :class="{ active: page === 'dashboard' }" @click="setPage('dashboard')"><span>⌂</span> Visão geral</button>
        <button :class="{ active: page === 'new' }" @click="openNew()"><span>＋</span> Nova sessão</button>
        <button :class="{ active: page === 'history' }" @click="setPage('history')"><span>◷</span> Histórico</button>
        <button :class="{ active: page === 'settings' }" @click="setPage('settings')"><span>⚙</span> Configurações</button>
      </nav>
      <div class="sidebar-bottom"><div class="mini-orbit"></div><p>Um dia de cada vez.<br><strong>Um foco de cada vez.</strong></p></div>
    </aside>

    <main class="main-content">
      <header class="topbar"><div><span class="mobile-brand">Daiyo</span><span class="breadcrumb">{{ page === 'dashboard' ? 'Visão geral' : page === 'new' ? 'Nova sessão' : page === 'timer' ? 'Sessão em andamento' : page === 'history' ? 'Histórico' : 'Configurações' }}</span></div><button class="avatar" aria-label="Perfil">K</button></header>
      <div v-if="notice" class="toast" role="status">{{ notice }} <button @click="notice = ''">×</button></div>

      <section v-if="page === 'dashboard'" class="page-section">
        <div class="hero-copy"><p class="eyebrow">{{ new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()) }}</p><h1>Boa tarde, Kaio<span>.</span></h1><p>Reserve um espaço para aquilo que importa hoje.</p></div>
        <div class="dashboard-grid">
          <article class="focus-card"><div class="focus-card-top"><div><p class="eyebrow light">PRÓXIMO PASSO</p><h2>Comece pelo que<br><em>pede atenção.</em></h2></div><div class="card-sun">◒</div></div><button class="primary-button" @click="openNew('TWO_HOURS')">Criar uma sessão <span>→</span></button></article>
          <article class="stat-panel"><div class="stat-header"><p class="eyebrow">HOJE</p><span class="stat-icon">◷</span></div><strong>{{ formatMinutes(todayMinutes) }}</strong><span>tempo estudado</span><div class="goal-line"><div><span>Meta diária</span><b>{{ goalPercent }}%</b></div><div class="progress-bar"><i :style="{ width: `${Math.min(100, goalPercent)}%` }"></i></div></div></article>
          <article class="stat-panel"><div class="stat-header"><p class="eyebrow">SESSÕES</p><span class="stat-icon">✦</span></div><strong>{{ completedSessions.length }}</strong><span>concluídas no total</span><div class="stat-foot">Consistência nasce do retorno.</div></article>
        </div>
        <div class="section-heading"><div><p class="eyebrow">ESCOLHA SEU RITMO</p><h2>Métodos rápidos</h2></div><button class="text-button" @click="openNew()">Ver todos <span>→</span></button></div>
        <div class="method-grid"><button v-for="method in methods.slice(1)" :key="method.id" class="method-card" @click="openNew(method.id)"><span class="method-number">0{{ methods.indexOf(method) }}</span><strong>{{ method.label }}</strong><small>{{ method.detail }}</small><span class="method-arrow">↗</span></button></div>
      </section>

      <section v-else-if="page === 'new'" class="page-section narrow-section"><div class="hero-copy"><p class="eyebrow">NOVA SESSÃO</p><h1>O que vai ocupar<br><em>sua atenção?</em></h1><p>Defina um pequeno compromisso. O resto fica mais simples.</p></div><div class="form-panel"><label for="topic">Tema da sessão</label><input id="topic" v-model="topic" placeholder="Ex.: Inteligência Artificial" @keyup.enter="createSession"><p class="field-hint">Dê um nome que faça sentido quando você olhar para trás.</p><label>Método</label><div class="method-options"><button v-for="method in methods" :key="method.id" :class="{ selected: selectedMethod === method.id }" @click="selectMethod(method.id)"><span>{{ method.label }}</span><small>{{ method.detail }}</small><b v-if="selectedMethod === method.id">✓</b></button></div><div v-if="selectedMethod === 'CUSTOM'" class="duration-field"><label for="minutes">Duração em minutos</label><input id="minutes" v-model.number="customMinutes" type="number" min="1" max="1440"><span>min</span></div><p v-if="error" class="error-message" role="alert">{{ error }}</p><button class="primary-button wide" @click="createSession">Começar agora <span>→</span></button></div></section>

      <section v-else-if="page === 'timer' && activeSession" class="timer-section"><div class="timer-head"><div><p class="eyebrow">{{ activeSession.methodLabel }}</p><h1>{{ activeSession.topic }}</h1></div><span class="live-badge"><i></i>{{ activeStatus === 'PAUSED' ? 'PAUSADA' : phaseLabel }}</span></div><div class="timer-stage"><div class="ring" :style="{ '--progress': `${progress * 360}deg` }"><div><span>{{ formatTime(displaySeconds) }}</span><small>tempo restante</small></div></div><p class="timer-caption">{{ activeStatus === 'PAUSED' ? 'O tempo está pausado.' : 'Seu foco está acontecendo agora.' }}</p></div><div class="timer-meta"><div><span>Tempo em foco</span><strong>{{ formatTime(elapsedSeconds) }}</strong></div><div><span>Progresso</span><strong>{{ Math.round(progress * 100) }}%</strong></div><div><span>Meta da sessão</span><strong>{{ formatMinutes(Math.round(activeSession.plannedDuration / 60)) }}</strong></div></div><div class="timer-actions"><button class="primary-button" @click="activeStatus === 'PAUSED' ? resumeSession() : pauseSession()">{{ activeStatus === 'PAUSED' ? 'Continuar' : 'Pausar' }} <span>{{ activeStatus === 'PAUSED' ? '→' : 'Ⅱ' }}</span></button><button class="secondary-button" @click="finishSession()">Finalizar</button><button class="cancel-button" @click="cancelSession">Cancelar sessão</button></div></section>

      <section v-else-if="page === 'history'" class="page-section"><div class="hero-copy"><p class="eyebrow">REGISTRO DE PRESENÇA</p><h1>Seu caminho<br><em>até aqui.</em></h1></div><div class="history-list"><div v-if="!sessions.length" class="empty-state">Nenhuma sessão registrada ainda. Seu primeiro bloco começa quando você decidir.</div><article v-for="session in [...sessions].sort((a, b) => b.createdAt.localeCompare(a.createdAt))" :key="session.id" class="history-row"><div class="history-dot" :class="session.status"></div><div class="history-main"><strong>{{ session.topic }}</strong><span>{{ session.methodLabel }} · {{ dateLabel(session.createdAt) }}</span></div><b>{{ formatMinutes(Math.round((session.actualDuration || session.plannedDuration) / 60)) }}</b><span class="status-pill" :class="session.status">{{ statusLabel(session.status) }}</span></article></div></section>

      <section v-else class="page-section narrow-section"><div class="hero-copy"><p class="eyebrow">PREFERÊNCIAS</p><h1>Faça o espaço<br><em>caber em você.</em></h1></div><div class="settings-list"><div class="setting-row"><div><strong>Meta diária</strong><span>Quanto tempo você quer reservar por dia?</span></div><div class="setting-control"><input v-model.number="settings.dailyGoal" type="number" min="1"><span>min</span></div></div><div class="setting-row"><div><strong>Notificações</strong><span>Receba um aviso quando a sessão terminar.</span></div><button class="toggle" :class="{ on: settings.notifications }" @click="settings.notifications = !settings.notifications; savePreferences()"><i></i></button></div><div class="setting-row"><div><strong>Permissão do navegador</strong><span>{{ notificationsSupported ? 'Ative para receber avisos fora da aba.' : 'Seu navegador não suporta notificações.' }}</span></div><button class="secondary-button small" @click="requestNotifications">Permitir</button></div><button class="primary-button wide" @click="savePreferences">Salvar preferências <span>✓</span></button></div></section>
    </main>
    <nav class="mobile-nav"><button :class="{ active: page === 'dashboard' }" @click="setPage('dashboard')">⌂<small>Início</small></button><button :class="{ active: page === 'new' }" @click="openNew()">＋<small>Nova</small></button><button :class="{ active: page === 'history' }" @click="setPage('history')">◷<small>Histórico</small></button><button :class="{ active: page === 'settings' }" @click="setPage('settings')">⚙<small>Ajustes</small></button></nav>
  </div>
</template>
