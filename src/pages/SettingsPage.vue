<script setup lang="ts">
import type { AppSettings } from '../types'

const props = defineProps<{
  settings: AppSettings
  notificationsSupported: boolean
}>()

const emit = defineEmits<{
  (e: 'update:dailyGoal', value: number): void
  (e: 'toggleNotifications'): void
  (e: 'savePreferences'): void
  (e: 'requestNotifications'): void
}>()
</script>

<template>
  <section class="page-section narrow-section">
    <div class="hero-copy">
      <p class="eyebrow">PREFERÊNCIAS</p>
      <h1>Faça o espaço<br><em>caber em você.</em></h1>
    </div>

    <div class="settings-list">
      <div class="setting-row">
        <div>
          <strong>Meta diária</strong>
          <span>Quanto tempo você quer reservar por dia?</span>
        </div>
        <div class="setting-control">
          <input :value="props.settings.dailyGoal" type="number" min="1" @input="emit('update:dailyGoal', Number(($event.target as HTMLInputElement).value))">
          <span>min</span>
        </div>
      </div>

      <div class="setting-row">
        <div>
          <strong>Notificações</strong>
          <span>Receba um aviso quando a sessão terminar.</span>
        </div>
        <button class="toggle" :class="{ on: props.settings.notifications }" @click="emit('toggleNotifications')"><i></i></button>
      </div>

      <div class="setting-row">
        <div>
          <strong>Permissão do navegador</strong>
          <span>{{ props.notificationsSupported ? 'Ative para receber avisos fora da aba.' : 'Seu navegador não suporta notificações.' }}</span>
        </div>
        <button class="secondary-button small" @click="emit('requestNotifications')">Permitir</button>
      </div>

      <button class="primary-button wide" @click="emit('savePreferences')">Salvar preferências <span>✓</span></button>
    </div>
  </section>
</template>
