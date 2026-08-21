<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '@/core/components/base-button.vue'
import BaseIcon from '@/core/components/base-icon.vue'
import AuthHeroLayout from '@/features/auth/presentation/components/auth-hero-layout.vue'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const { t } = useI18n({ useScope: 'global' })

// Post-verify navigation is NOT handled here: `setupAuthRedirect` watches the same
// transition for every `redirectIfAuth` route, this one included. A local copy would
// double-push (swallowed as a NavigationDuplicated failure) and re-create the per-page
// patching that left `home-page.vue` stranded in the first place.

const email = (route.query.email as string) ?? ''
const code = ref('')
const error = ref<string | null>(null)
const isVerifying = ref(false)
const isResending = ref(false)
const resendSuccess = ref(false)

/** Last value handed to `verifyOtp`, so autofill never resubmits a rejected code. */
const attempted = ref<string | null>(null)

// One watcher normalizes AND auto-submits, in that order. Normalize on every change
// rather than in a @paste handler: iOS autofill, the Android clipboard suggestion chip
// and drag-drop all populate the field without firing a paste event. `123 456` and a
// trailing newline from a mail client are the same code with formatting attached — strip
// it rather than erroring on something the user did correctly.
watch(code, (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 6)
  if (digits !== value) {
    // Write-back re-runs this watcher with the clean value, which is where the submit
    // check below fires. Returning here keeps the two concerns on separate ticks.
    code.value = digits
    return
  }
  if (digits.length === 6 && !isVerifying.value && digits !== attempted.value)
    handleVerify()
})

async function handleVerify() {
  // Guards the explicit-submit path too: `handleVerify` clears `code` on failure, so a
  // form submit after a rejection would otherwise verify an empty string.
  if (isVerifying.value || code.value.length < 6)
    return

  attempted.value = code.value
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
  <AuthHeroLayout>
    <BaseButton variant="text" size="sm" class="back-btn" @click="router.push({ name: 'home' })">
      <BaseIcon name="arrow_back" size="sm" />
      {{ t('auth.verifyOtp.backBtn') }}
    </BaseButton>
    <!-- h3, not h1 — the hero layout owns the page's only first-level heading. -->
    <h3 class="title">
      {{ t('auth.verifyOtp.title') }}
    </h3>
    <p class="subtitle">
      {{ t('auth.verifyOtp.subtitlePrefix') }} <strong>{{ email }}</strong>
    </p>

    <form class="form" @submit.prevent="handleVerify">
      <div class="field">
        <!-- Hidden, not absent: the placeholder is not an accessible name. -->
        <label for="otp-code" class="visually-hidden">{{ t('auth.verifyOtp.inputLabel') }}</label>
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
  </AuthHeroLayout>
</template>

<style scoped>
/* Visual styling comes from BaseButton (text); only layout lives here.
   Negative margin cancels the button's own horizontal padding so the arrow's
   optical edge lines up with the card text below — without shrinking the tap
   target by zeroing the padding. */
.back-btn {
  align-self: flex-start;
  margin-left: calc(-1 * var(--spacing-md));
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
