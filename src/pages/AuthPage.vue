<script setup lang="ts">
const props = defineProps<{
  mode: 'login' | 'register'
  name: string
  email: string
  password: string
  loading: boolean
  error: string
}>()

const emit = defineEmits<{
  (e: 'update:mode', value: 'login' | 'register'): void
  (e: 'update:name', value: string): void
  (e: 'update:email', value: string): void
  (e: 'update:password', value: string): void
  (e: 'submit'): void
}>()

const toggleMode = () => emit('update:mode', props.mode === 'login' ? 'register' : 'login')
</script>

<template>
  <section class="page-section auth-shell">
    <div class="auth-card">
      <p class="eyebrow">ACESSO</p>
      <h1>{{ props.mode === 'login' ? 'Entrar no Daiyo' : 'Criar conta' }}</h1>
      <p class="auth-subtitle">
        {{ props.mode === 'login' ? 'Acesse sua conta para continuar seu foco.' : 'Crie sua conta para salvar sessões e metas.' }}
      </p>

      <div class="auth-form">
        <label v-if="props.mode === 'register'">
          Nome
          <input :value="props.name" type="text" placeholder="Seu nome" @input="emit('update:name', ($event.target as HTMLInputElement).value)" />
        </label>

        <label>
          E-mail
          <input :value="props.email" type="email" placeholder="seu@email.com" @input="emit('update:email', ($event.target as HTMLInputElement).value)" />
        </label>

        <label>
          Senha
          <input :value="props.password" type="password" placeholder="••••••••" @input="emit('update:password', ($event.target as HTMLInputElement).value)" />
        </label>

        <p v-if="props.error" class="error-message" role="alert">{{ props.error }}</p>

        <button class="primary-button wide" :disabled="props.loading" @click="emit('submit')">
          {{ props.loading ? 'Aguarde...' : props.mode === 'login' ? 'Entrar' : 'Criar conta' }}
        </button>

        <button class="text-button auth-toggle" @click="toggleMode">
          {{ props.mode === 'login' ? 'Ainda não tem conta? Criar agora' : 'Já tem conta? Entrar' }}
        </button>
      </div>
    </div>
  </section>
</template>
