<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'

const router = useRouter()
const authStore = useAuthStore()
const { t } = useI18n({ useScope: 'global' })

const email = ref('')
const error = ref<string | null>(null)
const isLoading = ref(false)

const emailRegex = /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/

async function handleSubmit() {
  error.value = null

  if (!emailRegex.test(email.value)) {
    error.value = t('auth.emailEntry.invalidEmail')
    return
  }

  isLoading.value = true
  try {
    await authStore.sendEmailOtp(email.value)
    router.push({ name: 'verify-otp', query: { email: email.value } })
  }
  catch (err) {
    error.value = err instanceof Error ? err.message : t('auth.emailEntry.sendError')
  }
  finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="page">
    <div class="card">
      <button class="back-btn" @click="router.back()">
        <span class="material-symbols-outlined">arrow_back</span>
        {{ t('auth.shared.backBtn') }}
      </button>
      <h1 class="title">
        {{ t('auth.emailEntry.title') }}
      </h1>
      <p class="subtitle">
        {{ t('auth.emailEntry.subtitle') }}
      </p>

      <form class="form" @submit.prevent="handleSubmit">
        <div class="field">
          <label for="email" class="label">{{ t('auth.emailEntry.emailLabel') }}</label>
          <input
            id="email"
            v-model="email"
            type="email"
            class="input"
            :placeholder="t('auth.emailEntry.emailPlaceholder')"
            autocomplete="email"
            required
          >
        </div>

        <p v-if="error" class="error-text">
          {{ error }}
        </p>

        <button type="submit" class="submit-btn" :disabled="isLoading">
          {{ isLoading ? t('auth.shared.sendingBtn') : t('auth.emailEntry.sendCodeBtn') }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: -webkit-fill-available;
  min-height: 100lvh;
  padding: calc(var(--spacing-xl) + env(safe-area-inset-top, 0px)) var(--spacing-xl)
    calc(var(--spacing-xl) + env(safe-area-inset-bottom, 0px));
  background-color: var(--color-background);
}

.card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  width: 100%;
  max-width: 400px;
}

.back-btn {
  align-self: flex-start;
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  padding: var(--spacing-xs) 0;
}

.title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-medium);
  letter-spacing: -0.01em;
}

.subtitle {
  color: var(--color-on-surface-variant);
}

.form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-on-surface-variant);
}

.input {
  padding: var(--spacing-md);
  border: 1.5px solid var(--color-outline-variant);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-base);
  color: var(--color-on-surface);
  background-color: var(--color-background);
  outline: none;
  transition: border-color 0.2s;
}

.input:focus {
  border-color: var(--color-primary);
}

.error-text {
  color: var(--color-error);
  font-size: var(--font-size-sm);
}

.submit-btn {
  padding: var(--spacing-md);
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  border-radius: 12px;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  transition:
    background-color 0.2s,
    transform 0.15s;
}

.submit-btn:hover:not(:disabled) {
  background-color: var(--color-primary-dark);
  transform: translateY(-1px);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
