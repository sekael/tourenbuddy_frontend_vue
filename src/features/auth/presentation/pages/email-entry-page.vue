<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import BaseButton from '@/core/components/base-button.vue'
import BaseIcon from '@/core/components/base-icon.vue'
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
      <BaseButton variant="text" size="sm" class="back-btn" @click="router.back()">
        <BaseIcon name="arrow_back" size="sm" />
        {{ t('auth.shared.backBtn') }}
      </BaseButton>
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

        <BaseButton type="submit" variant="primary" :disabled="isLoading">
          {{ isLoading ? t('auth.shared.sendingBtn') : t('auth.emailEntry.sendCodeBtn') }}
        </BaseButton>
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

/* Submit uses the standard primary BaseButton (full-width via the flex column). */
</style>
