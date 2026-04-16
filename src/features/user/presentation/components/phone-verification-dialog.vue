<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { useUserProfileStore } from '@/features/user/presentation/stores/user-profile-store'

const props = defineProps<{ phone: string }>()
const emit = defineEmits<{ verified: []; close: [] }>()

const store = useUserProfileStore()

const otp = ref('')
const error = ref<string | null>(null)
const isVerifying = ref(false)
const isResending = ref(false)
const resendSuccess = ref(false)
const isVerified = ref(false)

const RESEND_COOLDOWN = 30
const resendCooldown = ref(0)
let cooldownTimer: ReturnType<typeof setInterval> | null = null

function startCooldown() {
  resendCooldown.value = RESEND_COOLDOWN
  cooldownTimer = setInterval(() => {
    resendCooldown.value--
    if (resendCooldown.value <= 0 && cooldownTimer) {
      clearInterval(cooldownTimer)
      cooldownTimer = null
    }
  }, 1000)
}

onUnmounted(() => {
  if (cooldownTimer) clearInterval(cooldownTimer)
})

async function handleVerify() {
  error.value = null

  if (otp.value.length < 6) {
    error.value = 'Please enter the full 6-digit code'
    return
  }

  isVerifying.value = true
  try {
    await store.verifyPhone(props.phone, otp.value.trim())
    isVerified.value = true
    setTimeout(() => emit('verified'), 1200)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Invalid code. Please try again.'
  } finally {
    isVerifying.value = false
  }
}

async function handleResend() {
  if (resendCooldown.value > 0) return
  isResending.value = true
  resendSuccess.value = false
  error.value = null
  try {
    await store.sendPhoneVerification(props.phone)
    resendSuccess.value = true
    startCooldown()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to resend code.'
  } finally {
    isResending.value = false
  }
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="dialog">
      <button class="close-btn" @click="emit('close')">
        <span class="material-symbols-outlined">close</span>
      </button>

      <template v-if="isVerified">
        <div class="verified-state">
          <span class="verified-icon material-symbols-outlined">check_circle</span>
          <p class="verified-text">Phone verified!</p>
        </div>
      </template>

      <template v-else>
        <h2 class="title">Verify your phone</h2>
        <p class="subtitle">
          We sent a code to <strong>{{ phone }}</strong>
        </p>

        <form class="form" @submit.prevent="handleVerify">
          <div class="field">
            <label for="phone-otp" class="label">Verification code</label>
            <input
              id="phone-otp"
              v-model="otp"
              type="text"
              class="input otp-input"
              placeholder="000000"
              autocomplete="one-time-code"
              inputmode="numeric"
              maxlength="6"
            />
          </div>

          <p v-if="error" class="error-text">
            {{ error }}
          </p>
          <p v-if="resendSuccess" class="success-text">Code resent!</p>

          <button type="submit" class="submit-btn" :disabled="isVerifying">
            {{ isVerifying ? 'Verifying...' : 'Verify' }}
          </button>
        </form>

        <button
          class="resend-btn"
          :disabled="isResending || resendCooldown > 0"
          @click="handleResend"
        >
          {{
            resendCooldown > 0
              ? `Resend in ${resendCooldown}s`
              : isResending
                ? 'Sending...'
                : 'Resend code'
          }}
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xl);
  z-index: 100;
}

.dialog {
  position: relative;
  background-color: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  box-shadow: var(--shadow-lg);
}

.close-btn {
  position: absolute;
  top: var(--spacing-md);
  right: var(--spacing-md);
  color: var(--color-on-surface-variant);
  display: flex;
  align-items: center;
  justify-content: center;
}

.title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-medium);
}

.subtitle {
  color: var(--color-on-surface-variant);
  font-size: var(--font-size-sm);
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

.otp-input {
  letter-spacing: 0.3em;
  font-size: var(--font-size-xl);
  text-align: center;
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
  cursor: not-allowed;
}

.verified-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-xl) 0;
}

.verified-icon {
  font-size: 48px;
  color: #15803d;
}

.verified-text {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-medium);
  color: #15803d;
}
</style>
