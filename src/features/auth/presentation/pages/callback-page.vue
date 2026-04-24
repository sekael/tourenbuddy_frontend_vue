<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/core/utils/supabase'

const router = useRouter()
const route = useRoute()
const { t } = useI18n({ useScope: 'global' })

const errorDescription = ref<string | null>((route.query.error_description as string) ?? null)

let unsubscribe: (() => void) | null = null

onMounted(() => {
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN') {
      router.replace({ name: 'map' })
    }
  })
  unsubscribe = data.subscription.unsubscribe
})

onUnmounted(() => {
  unsubscribe?.()
})
</script>

<template>
  <div class="page">
    <div class="card">
      <template v-if="errorDescription">
        <h1 class="title error-title">
          {{ t('auth.callback.errorTitle') }}
        </h1>
        <p class="subtitle">
          {{ t('auth.callback.errorBody') }}
        </p>
        <button class="back-btn-primary" @click="router.push({ name: 'email-entry' })">
          {{ t('auth.callback.backToEmailBtn') }}
        </button>
      </template>
      <template v-else>
        <div class="spinner" aria-hidden="true" />
        <p class="loading-text">
          {{ t('auth.callback.loading') }}
        </p>
      </template>
    </div>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: var(--spacing-xl);
  background-color: var(--color-background);
}

.card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-lg);
  width: 100%;
  max-width: 400px;
  text-align: center;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-outline-variant);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  color: var(--color-on-surface-variant);
}

.title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-medium);
  letter-spacing: -0.01em;
}

.error-title {
  color: var(--color-error);
}

.subtitle {
  color: var(--color-on-surface-variant);
}

.back-btn-primary {
  padding: var(--spacing-md);
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  border-radius: 12px;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  width: 100%;
  transition:
    background-color 0.2s,
    transform 0.15s;
}

.back-btn-primary:hover {
  background-color: var(--color-primary-dark);
  transform: translateY(-1px);
}
</style>
