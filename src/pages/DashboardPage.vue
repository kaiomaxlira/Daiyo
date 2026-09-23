<script setup lang="ts">
interface MethodOption {
  id: string
  label: string
  detail: string
}

const props = defineProps<{
  goalPercent: number
  todayMinutes: number
  completedSessions: number
  methods: MethodOption[]
}>()

const emit = defineEmits<{
  (e: 'openNew', method?: string): void
}>()

const openNew = (method?: string) => emit('openNew', method)
</script>

<template>
  <section class="page-section">
    <div class="hero-copy">
      <p class="eyebrow">{{ new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()) }}</p>
      <h1>Boa tarde<span>.</span></h1>
      <p>Reserve um espaço para aquilo que importa hoje.</p>
    </div>

    <div class="dashboard-grid">
      <article class="focus-card">
        <div class="focus-card-top">
          <div>
            <p class="eyebrow light">PRÓXIMO PASSO</p>
            <h2>Comece pelo que<br><em>pede atenção.</em></h2>
          </div>
          <div class="card-sun">◒</div>
        </div>
        <button class="primary-button" @click="openNew('TWO_HOURS')">Criar uma sessão <span>→</span></button>
      </article>

      <article class="stat-panel">
        <div class="stat-header"><p class="eyebrow">HOJE</p><span class="stat-icon">◷</span></div>
        <strong>{{ props.todayMinutes }}min</strong>
        <span>tempo estudado</span>
        <div class="goal-line">
          <div><span>Meta diária</span><b>{{ props.goalPercent }}%</b></div>
          <div class="progress-bar"><i :style="{ width: `${Math.min(100, props.goalPercent)}%` }"></i></div>
        </div>
      </article>

      <article class="stat-panel">
        <div class="stat-header"><p class="eyebrow">SESSÕES</p><span class="stat-icon">✦</span></div>
        <strong>{{ props.completedSessions }}</strong>
        <span>concluídas no total</span>
        <div class="stat-foot">Consistência nasce do retorno.</div>
      </article>
    </div>

    <div class="section-heading">
      <div>
        <p class="eyebrow">ESCOLHA SEU RITMO</p>
        <h2>Métodos rápidos</h2>
      </div>
      <button class="text-button" @click="openNew()">Ver todos <span>→</span></button>
    </div>

    <div class="method-grid">
      <button v-for="method in props.methods.slice(1)" :key="method.id" class="method-card" @click="openNew(method.id)">
        <span class="method-number">0{{ props.methods.indexOf(method) }}</span>
        <strong>{{ method.label }}</strong>
        <small>{{ method.detail }}</small>
        <span class="method-arrow">↗</span>
      </button>
    </div>
  </section>
</template>
