<script setup lang="ts">
import type { StudySession } from '../types'

const props = defineProps<{
  activeSession: StudySession
  activeStatus: string | null
  phaseLabel: string
  progress: number
  displaySeconds: number
  elapsedSeconds: number
  formatTime: (value: number) => string
  formatMinutes: (value: number) => string
}>()

const emit = defineEmits<{
  (e: 'pauseOrResume'): void
  (e: 'finishSession'): void
  (e: 'cancelSession'): void
}>()
</script>

<template>
  <section class="timer-section">
    <div class="timer-head">
      <div>
        <p class="eyebrow">{{ props.activeSession.methodLabel }}</p>
        <h1>{{ props.activeSession.topic }}</h1>
      </div>
      <span class="live-badge"><i></i>{{ props.activeStatus === 'PAUSED' ? 'PAUSADA' : props.phaseLabel }}</span>
    </div>

    <div class="timer-stage">
      <div class="ring" :style="{ '--progress': `${props.progress * 360}deg` }">
        <div>
          <span>{{ props.formatTime(props.displaySeconds) }}</span>
          <small>tempo restante</small>
        </div>
      </div>
      <p class="timer-caption">{{ props.activeStatus === 'PAUSED' ? 'O tempo está pausado.' : 'Seu foco está acontecendo agora.' }}</p>
    </div>

    <div class="timer-meta">
      <div>
        <span>Tempo em foco</span>
        <strong>{{ props.formatTime(props.elapsedSeconds) }}</strong>
      </div>
      <div>
        <span>Progresso</span>
        <strong>{{ Math.round(props.progress * 100) }}%</strong>
      </div>
      <div>
        <span>Meta da sessão</span>
        <strong>{{ props.formatMinutes(Math.round(props.activeSession.plannedDuration / 60)) }}</strong>
      </div>
    </div>

    <div class="timer-actions">
      <button class="primary-button" @click="emit('pauseOrResume')">
        {{ props.activeStatus === 'PAUSED' ? 'Continuar' : 'Pausar' }}
        <span>{{ props.activeStatus === 'PAUSED' ? '→' : 'Ⅱ' }}</span>
      </button>
      <button class="secondary-button" @click="emit('finishSession')">Finalizar</button>
      <button class="cancel-button" @click="emit('cancelSession')">Cancelar sessão</button>
    </div>
  </section>
</template>
