<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const email = (route.query.email as string) ?? ''
const otp = ref('')
const error = ref<string | null>(null)
const isLoading = ref(false)
const isResending = ref(false)
const resendSuccess = ref(false)

async function handleVerify() {
  error.value = null

  if (otp.value.length < 6) {
    error.value = 'Please enter the full code'
    return
  }

  isLoading.value = true
  try {
    await authStore.verifyOtp(email, otp.value.trim())
    router.push({ name: 'map' })
  }
  catch (err) {
    error.value = err instanceof Error ? err.message : 'Invalid code. Please try again.'
  }
  finally {
    isLoading.value = false
  }
}

async function handleResend() {
  isResending.value = true
  resendSuccess.value = false
  try {
    await authStore.sendEmailOtp(email)
    resendSuccess.value = true
  }
  catch {
    error.value = 'Failed to resend code. Please try again.'
  }
  finally {
    isResending.value = false
  }
}
</script>

<template>
  <div class="page">
    <div class="card">
      <button class="back-btn" @click="router.back()">
        ← Back
      </button>
      <h1 class="title">
        Check your email
      </h1>
      <p class="subtitle">
        We sent a login code to <strong>{{ email }}</strong>
      </p>

      <form class="form" @submit.prevent="handleVerify">
        <div class="field">
          <label for="otp" class="label">One-time code</label>
          <input
            id="otp"
            v-model="otp"
            type="text"
            class="input otp-input"
            placeholder="Enter code"
            autocomplete="one-time-code"
            maxlength="8"
            required
          >
        </div>

        <p v-if="error" class="error-text">
          {{ error }}
        </p>
        <p v-if="resendSuccess" class="success-text">
          Code resent! Check your email.
        </p>

        <button type="submit" class="submit-btn" :disabled="isLoading">
          {{ isLoading ? 'Verifying...' : 'Verify Code' }}
        </button>
      </form>

      <button class="resend-btn" :disabled="isResending" @click="handleResend">
        {{ isResending ? 'Sending...' : 'Resend code' }}
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
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  padding: var(--spacing-xs) 0;
}

.title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
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
  border: 1px solid var(--color-outline);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-base);
  color: var(--color-on-surface);
  background-color: var(--color-surface);
  outline: none;
  transition: border-color 0.2s;
}

.otp-input {
  letter-spacing: 0.2em;
  font-size: var(--font-size-xl);
  text-align: center;
}

.input:focus {
  border-color: var(--color-primary);
}

.error-text {
  color: var(--color-error);
  font-size: var(--font-size-sm);
}

.success-text {
  color: #2e7d32;
  font-size: var(--font-size-sm);
}

.submit-btn {
  padding: var(--spacing-md);
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  transition: background-color 0.2s;
}

.submit-btn:hover:not(:disabled) {
  background-color: var(--color-primary-dark);
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
