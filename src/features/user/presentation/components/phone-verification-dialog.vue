<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AdaptiveOverlay from '@/core/components/adaptive-overlay.vue'
import { useIsDesktop } from '@/core/composables/use-is-desktop'
import { normalizePhone } from '@/core/utils/phone-normalize'
import { useUserProfileStore } from '@/features/user/presentation/stores/user-profile-store'

const props = defineProps<{ phone: string }>()

const emit = defineEmits<{ verified: [], close: [] }>()
const { t } = useI18n({ useScope: 'global' })
const displayPhone = computed(() => {
  const result = normalizePhone(props.phone)
  return result.ok ? result.value : props.phone
})
const store = useUserProfileStore()
const isDesktop = useIsDesktop()

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
  if (cooldownTimer)
    clearInterval(cooldownTimer)
})

async function handleVerify() {
  error.value = null

  if (otp.value.length < 6) {
    error.value = t('user.phoneVerification.incompleteCode')
    return
  }

  isVerifying.value = true
  try {
    await store.verifyPhone(props.phone, otp.value.trim())
    isVerified.value = true
    setTimeout(() => emit('verified'), 1200)
  }
  catch (err) {
    error.value = err instanceof Error ? err.message : t('user.phoneVerification.invalidCode')
  }
  finally {
    isVerifying.value = false
  }
}

async function handleResend() {
  if (resendCooldown.value > 0)
    return
  isResending.value = true
  resendSuccess.value = false
  error.value = null
  try {
    await store.sendPhoneVerification(props.phone)
    resendSuccess.value = true
    startCooldown()
  }
  catch (err) {
    error.value = err instanceof Error ? err.message : t('user.phoneVerification.resendError')
  }
  finally {
    isResending.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="!isDesktop" class="sheet-container" @click.self="emit('close')">
      <AdaptiveOverlay
        :title="isVerified ? '' : t('user.phoneVerification.title')"
        @close="emit('close')"
      >
        <div class="dialog-content">
          <template v-if="isVerified">
            <div class="verified-state">
              <span class="verified-icon material-symbols-outlined">check_circle</span>
              <p class="verified-text">
                {{ t('user.phoneVerification.verifiedMsg') }}
              </p>
            </div>
          </template>

          <template v-else>
            <p class="subtitle">
              {{ t('user.phoneVerification.subtitlePrefix') }} <strong>{{ displayPhone }}</strong>
            </p>

            <form class="form" @submit.prevent="handleVerify">
              <div class="field">
                <label for="phone-otp" class="label">{{ t('user.phoneVerification.codeLabel') }}</label>
                <input
                  id="phone-otp"
                  v-model="otp"
                  type="text"
                  class="input otp-input"
                  :placeholder="t('user.phoneVerification.codePlaceholder')"
                  autocomplete="one-time-code"
                  inputmode="numeric"
                  maxlength="6"
                >
              </div>

              <p v-if="error" class="error-text">
                {{ error }}
              </p>
              <p v-if="resendSuccess" class="success-text">
                {{ t('user.phoneVerification.resendSuccess') }}
              </p>

              <button type="submit" class="submit-btn" :disabled="isVerifying">
                {{
                  isVerifying
                    ? t('user.phoneVerification.verifyingBtn')
                    : t('user.phoneVerification.verifyBtn')
                }}
              </button>
            </form>

            <button
              class="resend-btn"
              :disabled="isResending || resendCooldown > 0"
              @click="handleResend"
            >
              {{
                resendCooldown > 0
                  ? `${t('user.phoneVerification.resendCountdown')} ${resendCooldown}s`
                  : isResending
                    ? t('user.phoneVerification.sendingBtn')
                    : t('user.phoneVerification.resendBtn')
              }}
            </button>
          </template>
        </div>
      </AdaptiveOverlay>
    </div>

    <AdaptiveOverlay
      v-else
      :title="isVerified ? '' : t('user.phoneVerification.title')"
      @close="emit('close')"
    >
      <div class="dialog-content">
        <template v-if="isVerified">
          <div class="verified-state">
            <span class="verified-icon material-symbols-outlined">check_circle</span>
            <p class="verified-text">
              {{ t('user.phoneVerification.verifiedMsg') }}
            </p>
          </div>
        </template>

        <template v-else>
          <p class="subtitle">
            {{ t('user.phoneVerification.subtitlePrefix') }} <strong>{{ displayPhone }}</strong>
          </p>

          <form class="form" @submit.prevent="handleVerify">
            <div class="field">
              <label for="phone-otp-desktop" class="label">{{ t('user.phoneVerification.codeLabel') }}</label>
              <input
                id="phone-otp-desktop"
                v-model="otp"
                type="text"
                class="input otp-input"
                :placeholder="t('user.phoneVerification.codePlaceholder')"
                autocomplete="one-time-code"
                inputmode="numeric"
                maxlength="6"
              >
            </div>

            <p v-if="error" class="error-text">
              {{ error }}
            </p>
            <p v-if="resendSuccess" class="success-text">
              {{ t('user.phoneVerification.resendSuccess') }}
            </p>

            <button type="submit" class="submit-btn" :disabled="isVerifying">
              {{
                isVerifying
                  ? t('user.phoneVerification.verifyingBtn')
                  : t('user.phoneVerification.verifyBtn')
              }}
            </button>
          </form>

          <button
            class="resend-btn"
            :disabled="isResending || resendCooldown > 0"
            @click="handleResend"
          >
            {{
              resendCooldown > 0
                ? `${t('user.phoneVerification.resendCountdown')} ${resendCooldown}s`
                : isResending
                  ? t('user.phoneVerification.sendingBtn')
                  : t('user.phoneVerification.resendBtn')
            }}
          </button>
        </template>
      </div>
    </AdaptiveOverlay>
  </Teleport>
</template>

<style scoped>
.sheet-container {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 120;
  background: rgba(15, 23, 42, 0.35);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
}

.dialog-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
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
