<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAsYouTypePhone } from '@/core/composables/use-as-you-type-phone'
import { InvalidPhoneNumberError } from '@/core/exceptions'
import PhoneVerificationNotice from '@/features/friendships/presentation/components/phone-verification-notice.vue'
import PhoneVerificationDialog from '@/features/user/presentation/components/phone-verification-dialog.vue'
import { useUserProfileStore } from '@/features/user/presentation/stores/user-profile-store'

const router = useRouter()
const store = useUserProfileStore()
const { t } = useI18n({ useScope: 'global' })

const firstName = ref('')
const lastName = ref('')
const phoneNumber = ref('')
const { formatted: phoneNumberFormatted, onInput: onPhoneNumberInput }
  = useAsYouTypePhone(phoneNumber)
const errors = ref<{ firstName?: string, lastName?: string, phoneNumber?: string }>({})
const isLoading = ref(false)
const submitError = ref<string | null>(null)

const showPhoneVerification = ref(false)
const showVerificationNotice = ref(false)
const pendingPhone = ref('')
const pendingPhoneForNotice = ref('')

onMounted(async () => {
  if (!store.profile) {
    await store.loadProfile()
  }
})

function validate(): boolean {
  const newErrors: typeof errors.value = {}
  if (!firstName.value.trim())
    newErrors.firstName = t('user.onboarding.firstNameRequired')
  if (!lastName.value.trim())
    newErrors.lastName = t('user.onboarding.lastNameRequired')
  errors.value = newErrors
  return Object.keys(newErrors).length === 0
}

async function handleSubmit() {
  if (!validate())
    return

  isLoading.value = true
  submitError.value = null

  try {
    await store.updateProfile({
      firstName: firstName.value.trim(),
      lastName: lastName.value.trim(),
    })

    const phone = phoneNumber.value.trim()
    if (phone) {
      // Show discoverability notice before sending OTP
      pendingPhoneForNotice.value = phone
      showVerificationNotice.value = true
    }
    else {
      router.push({ name: 'map' })
    }
  }
  catch (err) {
    if (err instanceof InvalidPhoneNumberError) {
      errors.value = { ...errors.value, phoneNumber: err.message }
    }
    else {
      submitError.value
        = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
    }
  }
  finally {
    isLoading.value = false
  }
}

function handleSkip() {
  store.skipOnboarding()
  router.push({ name: 'map' })
}

function handleVerificationComplete() {
  showPhoneVerification.value = false
  router.push({ name: 'map' })
}

function handleVerificationClose() {
  showPhoneVerification.value = false
  router.push({ name: 'map' })
}

async function handleNoticeAcknowledged() {
  showVerificationNotice.value = false
  isLoading.value = true
  try {
    await store.sendPhoneVerification(pendingPhoneForNotice.value)
    pendingPhone.value = pendingPhoneForNotice.value
    showPhoneVerification.value = true
  }
  catch (err) {
    if (err instanceof InvalidPhoneNumberError) {
      errors.value = { ...errors.value, phoneNumber: err.message }
    }
    else {
      submitError.value = err instanceof Error ? err.message : 'Something went wrong.'
    }
  }
  finally {
    isLoading.value = false
  }
}

function handleNoticeClose() {
  showVerificationNotice.value = false
}
</script>

<template>
  <div class="page">
    <div class="card">
      <h1 class="title">
        {{ t('user.onboarding.title') }}
      </h1>
      <p class="subtitle">
        {{ t('user.onboarding.subtitle') }}
      </p>

      <form class="form" @submit.prevent="handleSubmit">
        <div class="field">
          <label for="firstName" class="label">{{ t('user.shared.firstNameLabel') }}
            <span class="required">{{ t('user.shared.required') }}</span></label>
          <input
            id="firstName"
            v-model="firstName"
            type="text"
            class="input"
            :class="{ 'input--error': errors.firstName }"
            :placeholder="t('user.shared.firstNamePlaceholder')"
            autocomplete="given-name"
          >
          <p v-if="errors.firstName" class="error-text">
            {{ errors.firstName }}
          </p>
        </div>

        <div class="field">
          <label for="lastName" class="label">{{ t('user.shared.lastNameLabel') }}
            <span class="required">{{ t('user.shared.required') }}</span></label>
          <input
            id="lastName"
            v-model="lastName"
            type="text"
            class="input"
            :class="{ 'input--error': errors.lastName }"
            :placeholder="t('user.shared.lastNamePlaceholder')"
            autocomplete="family-name"
          >
          <p v-if="errors.lastName" class="error-text">
            {{ errors.lastName }}
          </p>
        </div>

        <div class="field">
          <label for="phoneNumber" class="label">{{ t('user.shared.phoneLabel') }}
            <span class="optional">{{ t('user.shared.optional') }}</span></label>
          <input
            id="phoneNumber"
            :value="phoneNumberFormatted"
            type="tel"
            class="input"
            :class="{ 'input--error': errors.phoneNumber }"
            :placeholder="t('user.shared.phonePlaceholder')"
            autocomplete="tel"
            @input="onPhoneNumberInput"
          >
          <p v-if="errors.phoneNumber" class="error-text">
            {{ errors.phoneNumber }}
          </p>
        </div>

        <p v-if="submitError" class="error-text">
          {{ submitError }}
        </p>

        <button type="submit" class="submit-btn" :disabled="isLoading">
          {{ isLoading ? t('user.shared.savingBtn') : t('user.onboarding.continueBtn') }}
        </button>
      </form>

      <button class="skip-btn" @click="handleSkip">
        {{ t('user.onboarding.skipBtn') }}
      </button>
    </div>

    <PhoneVerificationNotice
      v-if="showVerificationNotice"
      @acknowledged="handleNoticeAcknowledged"
      @close="handleNoticeClose"
    />

    <PhoneVerificationDialog
      v-if="showPhoneVerification"
      :phone="pendingPhone"
      @verified="handleVerificationComplete"
      @close="handleVerificationClose"
    />
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

.title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-medium);
  letter-spacing: -0.01em;
}

.subtitle {
  color: var(--color-on-surface-variant);
  line-height: 1.5;
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

.required {
  color: var(--color-error);
}

.optional {
  font-weight: var(--font-weight-regular);
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

.input--error {
  border-color: var(--color-error);
}

.error-text {
  color: var(--color-error);
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

.skip-btn {
  text-align: center;
  color: var(--color-on-surface-variant);
  font-size: var(--font-size-sm);
  padding: var(--spacing-xs);
}

.skip-btn:hover {
  color: var(--color-on-surface);
}
</style>
