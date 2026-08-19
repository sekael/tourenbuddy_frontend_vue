<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import BaseButton from '@/core/components/base-button.vue'
import AuthHeroLayout from '@/features/auth/presentation/components/auth-hero-layout.vue'
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
  <AuthHeroLayout>
    <!-- h3, not h1 — the hero layout owns the page's only first-level heading. -->
    <h3 class="title">
      {{ t('auth.emailEntry.title') }}
    </h3>
    <p class="subtitle">
      {{ t('auth.emailEntry.subtitle') }}
    </p>

    <form class="form" @submit.prevent="handleSubmit">
      <div class="field">
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
  </AuthHeroLayout>
</template>

<style scoped>
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

/* Opaque fill — input contrast must not depend on the photo behind the card. */
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
</style>
