<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '@/core/components/base-button.vue'
import BaseIcon from '@/core/components/base-icon.vue'
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
      <BaseButton variant="text" size="sm" class="back-btn" @click="router.push({ name: 'email-entry' })">
        <BaseIcon name="arrow_back" size="sm" />
        {{ t('auth.verifyOtp.backBtn') }}
      </BaseButton>
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

        <BaseButton type="submit" variant="primary" :disabled="isVerifying || code.length < 6">
          {{ isVerifying ? t('auth.shared.sendingBtn') : t('auth.verifyOtp.verifyBtn') }}
        </BaseButton>
      </form>

      <BaseButton variant="secondary" :disabled="isResending" @click="handleResend">
        {{ isResending ? t('auth.shared.sendingBtn') : t('auth.verifyOtp.resendBtn') }}
      </BaseButton>
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

/* Visual styling comes from BaseButton (text); only layout lives here. */
.back-btn {
  align-self: flex-start;
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
  color: var(--color-success);
  font-size: var(--font-size-sm);
}
</style>
