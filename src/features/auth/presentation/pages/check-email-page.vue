<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const { t } = useI18n({ useScope: 'global' })

const email = (route.query.email as string) ?? ''
const error = ref<string | null>(null)
const isResending = ref(false)
const resendSuccess = ref(false)

async function handleResend() {
  isResending.value = true
  resendSuccess.value = false
  error.value = null
  try {
    await authStore.sendMagicLink(email)
    resendSuccess.value = true
  } catch {
    error.value = t('auth.checkEmail.resendError')
  } finally {
    isResending.value = false
  }
}
</script>

<template>
  <div class="page">
    <div class="card">
      <button class="back-btn" @click="router.back()">
        <span class="material-symbols-outlined">arrow_back</span>
        {{ t('auth.checkEmail.backBtn') }}
      </button>
      <h1 class="title">
        {{ t('auth.checkEmail.title') }}
      </h1>
      <p class="subtitle">
        {{ t('auth.checkEmail.subtitlePrefix') }} <strong>{{ email }}</strong>
      </p>

      <p v-if="error" class="error-text">
        {{ error }}
      </p>
      <p v-if="resendSuccess" class="success-text">
        {{ t('auth.checkEmail.resendSuccess') }}
      </p>

      <button class="resend-btn" :disabled="isResending" @click="handleResend">
        {{ isResending ? t('auth.shared.sendingBtn') : t('auth.checkEmail.resendBtn') }}
      </button>
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

.error-text {
  color: var(--color-error);
  font-size: var(--font-size-sm);
}

.success-text {
  color: #15803d;
  font-size: var(--font-size-sm);
}

.resend-btn {
  text-align: center;
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  padding: var(--spacing-xs);
}

.resend-btn:disabled {
  opacity: 0.6;
}
</style>
