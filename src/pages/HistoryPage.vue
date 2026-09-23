<script setup lang="ts">
import type { SessionStatus, StudySession } from '../types'

const props = defineProps<{
  sessions: StudySession[]
  formatMinutes: (value: number) => string
  dateLabel: (value: string) => string
  statusLabel: (value: SessionStatus) => string
}>()
</script>

<template>
  <section class="page-section">
    <div class="hero-copy">
      <p class="eyebrow">REGISTRO DE PRESENÇA</p>
      <h1>Seu caminho<br><em>até aqui.</em></h1>
    </div>

    <div class="history-list">
      <div v-if="!props.sessions.length" class="empty-state">Nenhuma sessão registrada ainda. Seu primeiro bloco começa quando você decidir.</div>

      <article v-for="session in [...props.sessions].sort((a, b) => b.createdAt.localeCompare(a.createdAt))" :key="session.id" class="history-row">
        <div class="history-dot" :class="session.status"></div>
        <div class="history-main">
          <strong>{{ session.topic }}</strong>
          <span>{{ session.methodLabel }} · {{ props.dateLabel(session.createdAt) }}</span>
        </div>
        <b>{{ props.formatMinutes(Math.round((session.actualDuration || session.plannedDuration) / 60)) }}</b>
        <span class="status-pill" :class="session.status">{{ props.statusLabel(session.status) }}</span>
      </article>
    </div>
  </section>
</template>
