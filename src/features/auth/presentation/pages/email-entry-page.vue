<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const error = ref<string | null>(null)
const isLoading = ref(false)

const emailRegex = /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/

async function handleSubmit() {
  error.value = null

  if (!emailRegex.test(email.value)) {
    error.value = 'Please enter a valid email address'
    return
  }

  isLoading.value = true
  try {
    await authStore.sendEmailOtp(email.value)
    router.push({ name: 'verify-otp', query: { email: email.value } })
  }
  catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to send code. Please try again.'
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
        ← Back
      </button>
      <h1 class="title">
        Enter your email
      </h1>
      <p class="subtitle">
        We'll send you a one-time login code
      </p>

      <form class="form" @submit.prevent="handleSubmit">
        <div class="field">
          <label for="email" class="label">Email address</label>
          <input
            id="email"
            v-model="email"
            type="email"
            class="input"
            placeholder="you@example.com"
            autocomplete="email"
            required
          >
        </div>

        <p v-if="error" class="error-text">
          {{ error }}
        </p>

        <button type="submit" class="submit-btn" :disabled="isLoading">
          {{ isLoading ? 'Sending...' : 'Send Code' }}
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
</style>
