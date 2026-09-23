<script setup lang="ts">
interface MethodOption {
  id: string
  label: string
  detail: string
  study: number
}

const props = defineProps<{
  topic: string
  selectedMethod: string
  customMinutes: number
  error: string
  methods: MethodOption[]
}>()

const emit = defineEmits<{
  (e: 'update:topic', value: string): void
  (e: 'selectMethod', value: string): void
  (e: 'update:customMinutes', value: number): void
  (e: 'createSession'): void
}>()

const setTopic = (value: string) => emit('update:topic', value)
const setMethod = (value: string) => emit('selectMethod', value)
const setMinutes = (value: number) => emit('update:customMinutes', value)
</script>

<template>
  <section class="page-section narrow-section">
    <div class="hero-copy">
      <p class="eyebrow">NOVA SESSÃO</p>
      <h1>O que vai ocupar<br><em>sua atenção?</em></h1>
      <p>Defina um pequeno compromisso. O resto fica mais simples.</p>
    </div>

    <div class="form-panel">
      <label for="topic">Tema da sessão</label>
      <input id="topic" :value="props.topic" placeholder="Ex.: Inteligência Artificial" @input="setTopic(($event.target as HTMLInputElement).value)" @keyup.enter="emit('createSession')">
      <p class="field-hint">Dê um nome que faça sentido quando você olhar para trás.</p>

      <label>Método</label>
      <div class="method-options">
        <button v-for="method in props.methods" :key="method.id" :class="{ selected: props.selectedMethod === method.id }" @click="setMethod(method.id)">
          <span>{{ method.label }}</span>
          <small>{{ method.detail }}</small>
          <b v-if="props.selectedMethod === method.id">✓</b>
        </button>
      </div>

      <div v-if="props.selectedMethod === 'CUSTOM'" class="duration-field">
        <label for="minutes">Duração em minutos</label>
        <input id="minutes" :value="props.customMinutes" type="number" min="1" max="1440" @input="setMinutes(Number(($event.target as HTMLInputElement).value))">
        <span>min</span>
      </div>

      <p v-if="props.error" class="error-message" role="alert">{{ props.error }}</p>
      <button class="primary-button wide" @click="emit('createSession')">Começar agora <span>→</span></button>
    </div>
  </section>
</template>
