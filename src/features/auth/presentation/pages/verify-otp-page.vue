<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
import { useUserProfileStore } from '@/features/user/presentation/stores/user-profile-store'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const profileStore = useUserProfileStore()
const { t } = useI18n({ useScope: 'global' })

// Navigate only after auth is confirmed AND profile has finished loading so the
// router guard can make an informed decision about onboarding vs map.
watch(
  [() => authStore.isAuthenticated, () => profileStore.isLoading],
  ([isAuth, isLoading]) => {
    if (isAuth && !isLoading)
      router.push({ name: 'map' })
  },
)

const email = (route.query.email as string) ?? ''
const code = ref('')
const error = ref<string | null>(null)
const isVerifying = ref(false)
const isResending = ref(false)
const resendSuccess = ref(false)

async function handleVerify() {
  error.value = null
  isVerifying.value = true
  try {
    await authStore.verifyOtp(email, code.value)
  }
  catch (err) {
    error.value = err instanceof Error ? err.message : t('auth.verifyOtp.verifyError')
    code.value = ''
  }
  finally {
    isVerifying.value = false
  }
}

async function handleResend() {
  error.value = null
  resendSuccess.value = false
  isResending.value = true
  try {
    await authStore.sendEmailOtp(email)
    resendSuccess.value = true
  }
  catch {
    error.value = t('auth.verifyOtp.resendError')
  }
  finally {
    isResending.value = false
  }
}
</script>

<template>
  <div class="page">
    <div class="card">
      <button class="back-btn" @click="router.push({ name: 'email-entry' })">
        <span class="material-symbols-outlined">arrow_back</span>
        {{ t('auth.verifyOtp.backBtn') }}
      </button>
      <h1 class="title">
        {{ t('auth.verifyOtp.title') }}
      </h1>
      <p class="subtitle">
        {{ t('auth.verifyOtp.subtitlePrefix') }} <strong>{{ email }}</strong>
      </p>

      <form class="form" @submit.prevent="handleVerify">
        <div class="field">
          <label for="otp-code" class="label">{{ t('auth.verifyOtp.inputLabel') }}</label>
          <input
            id="otp-code"
            v-model="code"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
            class="input"
            :placeholder="t('auth.verifyOtp.inputPlaceholder')"
            required
          >
        </div>

        <p v-if="error" class="error-text">
          {{ error }}
        </p>
        <p v-if="resendSuccess" class="success-text">
          {{ t('auth.verifyOtp.resendSuccess') }}
        </p>

        <button type="submit" class="submit-btn" :disabled="isVerifying || code.length < 6">
          {{ isVerifying ? t('auth.shared.sendingBtn') : t('auth.verifyOtp.verifyBtn') }}
        </button>
      </form>

      <button class="resend-btn" :disabled="isResending" @click="handleResend">
        {{ isResending ? t('auth.shared.sendingBtn') : t('auth.verifyOtp.resendBtn') }}
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
  font-size: var(--font-size-2xl);
  letter-spacing: 0.25em;
  text-align: center;
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

.success-text {
  color: #15803d;
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
