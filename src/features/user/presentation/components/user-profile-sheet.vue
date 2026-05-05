<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AdaptiveOverlay from '@/core/components/adaptive-overlay.vue'
import BaseTooltip from '@/core/components/base-tooltip.vue'
import { useAsYouTypePhone } from '@/core/composables/use-as-you-type-phone'
import { InvalidPhoneNumberError } from '@/core/exceptions'
import { SUPPORTED_LOCALES } from '@/core/i18n/supported'
import { formatPhoneForDisplay } from '@/core/utils/phone-normalize'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'
import PhoneVerificationNotice from '@/features/friendships/presentation/components/phone-verification-notice.vue'
import { useLocaleStore } from '@/features/i18n/presentation/stores/use-locale-store'
import { useToursStore } from '@/features/tours/presentation/stores/tours-store'
import { useUserProfileStore } from '@/features/user/presentation/stores/user-profile-store'
import PhoneVerificationDialog from './phone-verification-dialog.vue'

const emit = defineEmits<{ close: [] }>()

const router = useRouter()
const { t } = useI18n({ useScope: 'global' })
const authStore = useAuthStore()
const userProfileStore = useUserProfileStore()
const contactsStore = useContactsStore()
const toursStore = useToursStore()
const localeStore = useLocaleStore()

const isEditing = ref(false)
const editFirstName = ref('')
const editLastName = ref('')
const editPhone = ref('')
const { formatted: editPhoneFormatted, onInput: onEditPhoneInput } = useAsYouTypePhone(editPhone)
const editError = ref<string | null>(null)
const isSaving = ref(false)

const showPhoneVerification = ref(false)
const showVerificationNotice = ref(false)
const pendingPhone = ref('')
const pendingPhoneForNotice = ref('')

const full = computed(() => userProfileStore.fullProfile)

const displayPhoneNumber = computed(() => {
  const phone = full.value?.phoneNumber
  if (!phone)
    return null
  return formatPhoneForDisplay(phone) || phone
})

const displayName = computed(() => {
  const p = full.value
  if (!p)
    return authStore.currentUser?.email ?? 'User'
  if (p.firstName && p.lastName)
    return `${p.firstName} ${p.lastName}`
  if (p.firstName)
    return p.firstName
  return p.email ?? 'User'
})

function startEdit() {
  const p = full.value
  editFirstName.value = p?.firstName ?? ''
  editLastName.value = p?.lastName ?? ''
  editPhone.value = p?.phoneNumber ?? ''
  editError.value = null
  isEditing.value = true
}

function cancelEdit() {
  isEditing.value = false
  editError.value = null
}

async function handleSave() {
  editError.value = null

  if (!editFirstName.value.trim() || !editLastName.value.trim()) {
    editError.value = t('user.profile.nameRequired')
    return
  }

  isSaving.value = true
  try {
    await userProfileStore.updateProfile({
      firstName: editFirstName.value.trim(),
      lastName: editLastName.value.trim(),
    })

    const phone = editPhone.value.trim()
    const phoneChanged = phone !== (full.value?.phoneNumber ?? '')

    if (phoneChanged && phone) {
      // Show discoverability notice before sending OTP
      pendingPhoneForNotice.value = phone
      isEditing.value = false
      showVerificationNotice.value = true
    }
    else {
      isEditing.value = false
    }
  }
  catch (err) {
    editError.value
      = err instanceof InvalidPhoneNumberError || err instanceof Error
        ? (err as Error).message
        : t('user.profile.saveFailed')
  }
  finally {
    isSaving.value = false
  }
}

function handleAddPhone() {
  startEdit()
}

function handleVerificationComplete() {
  showPhoneVerification.value = false
}

function handleVerificationClose() {
  showPhoneVerification.value = false
}

async function handleNoticeAcknowledged() {
  showVerificationNotice.value = false
  isSaving.value = true
  try {
    await userProfileStore.sendPhoneVerification(pendingPhoneForNotice.value)
    pendingPhone.value = pendingPhoneForNotice.value
    showPhoneVerification.value = true
  }
  catch (err) {
    editError.value
      = err instanceof InvalidPhoneNumberError || err instanceof Error
        ? (err as Error).message
        : 'Failed to send verification code'
    isEditing.value = true
  }
  finally {
    isSaving.value = false
  }
}

function handleNoticeClose() {
  showVerificationNotice.value = false
}

async function handleSignOut() {
  contactsStore.clear()
  toursStore.clear()
  userProfileStore.clear()
  await authStore.signOut()
  emit('close')
  router.push({ name: 'home' })
}
</script>

<template>
  <AdaptiveOverlay :title="t('user.profile.title')" @close="emit('close')">
    <div class="profile-content">
      <!-- View mode -->
      <template v-if="!isEditing">
        <div class="profile-info">
          <div class="avatar">
            {{ displayName.charAt(0).toUpperCase() }}
          </div>
          <div class="info">
            <p class="name">
              {{ displayName }}
            </p>
            <p class="email">
              {{ full?.email ?? authStore.currentUser?.email ?? '' }}
            </p>
          </div>
        </div>

        <div class="phone-row">
          <template v-if="full?.phoneNumber">
            <span class="material-symbols-outlined phone-icon">phone</span>
            <span class="phone-number">{{ displayPhoneNumber }}</span>
            <BaseTooltip v-if="full.phoneVerified" :text="t('user.profile.verifiedTooltip')">
              <span class="material-symbols-outlined verified-icon">verified</span>
            </BaseTooltip>
            <button v-else class="verify-btn" @click="startEdit">
              {{ t('user.profile.verifyBtn') }}
            </button>
          </template>
          <button v-else class="add-phone-btn" @click="handleAddPhone">
            <span class="material-symbols-outlined">add</span>
            {{ t('user.profile.addPhoneBtn') }}
          </button>
        </div>

        <!-- Language selector -->
        <div class="language-row">
          <label class="label">{{ t('user.profile.languageLabel') }}</label>
          <div class="language-options">
            <button
              v-for="loc in SUPPORTED_LOCALES"
              :key="loc.code"
              type="button"
              class="language-option"
              :class="{ 'language-option--active': localeStore.locale === loc.code }"
              @click="localeStore.setLocale(loc.code)"
            >
              {{ loc.label }}
            </button>
          </div>
        </div>

        <div class="actions">
          <button class="edit-btn" @click="startEdit">
            <span class="material-symbols-outlined">edit</span>
            {{ t('user.profile.editBtn') }}
          </button>
          <button class="sign-out-btn" @click="handleSignOut">
            <span class="material-symbols-outlined">logout</span>
            {{ t('user.profile.signOutBtn') }}
          </button>
        </div>
      </template>

      <!-- Edit mode -->
      <template v-else>
        <form class="edit-form" @submit.prevent="handleSave">
          <div class="field">
            <label for="edit-first-name" class="label">{{ t('user.shared.firstNameLabel') }}</label>
            <input
              id="edit-first-name"
              v-model="editFirstName"
              type="text"
              class="input"
              autocomplete="given-name"
            >
          </div>

          <div class="field">
            <label for="edit-last-name" class="label">{{ t('user.shared.lastNameLabel') }}</label>
            <input
              id="edit-last-name"
              v-model="editLastName"
              type="text"
              class="input"
              autocomplete="family-name"
            >
          </div>

          <div class="field">
            <label for="edit-phone" class="label">{{ t('user.shared.phoneLabel') }}
              <span class="optional">{{ t('user.shared.optional') }}</span></label>
            <input
              id="edit-phone"
              :value="editPhoneFormatted"
              type="tel"
              class="input"
              :placeholder="t('user.shared.phonePlaceholder')"
              autocomplete="tel"
              @input="onEditPhoneInput"
            >
          </div>

          <p v-if="editError" class="error-text">
            {{ editError }}
          </p>

          <div class="edit-actions">
            <button type="button" class="cancel-btn" @click="cancelEdit">
              {{ t('user.shared.cancelBtn') }}
            </button>
            <button type="submit" class="save-btn" :disabled="isSaving">
              {{ isSaving ? t('user.shared.savingBtn') : t('user.shared.saveBtn') }}
            </button>
          </div>
        </form>
      </template>
    </div>
  </AdaptiveOverlay>

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
</template>

<style scoped>
.profile-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}

.profile-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  flex-shrink: 0;
}

.info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.name {
  font-weight: var(--font-weight-semibold);
}

.email {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}

.phone-row {
  display: flex;
  justify-content: start;
  align-items: center;
  gap: var(--spacing-sm);
  min-height: 24px;
}

.phone-icon {
  font-size: 18px;
  color: var(--color-on-surface-variant);
}

.phone-number {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface);
}

.verified-icon {
  font-size: 18px;
  color: #1d4ed8;
}

.verify-btn {
  font-size: var(--font-size-sm);
  color: var(--color-primary);
  font-weight: var(--font-weight-medium);
}

.add-phone-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}

.add-phone-btn .material-symbols-outlined {
  font-size: 18px;
}

.add-phone-btn:hover {
  color: var(--color-primary);
}

.language-row {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.language-options {
  display: flex;
  gap: var(--spacing-xs);
  flex-wrap: wrap;
}

.language-option {
  padding: var(--spacing-xs) var(--spacing-md);
  border: 1.5px solid var(--color-outline-variant);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
  transition:
    border-color 0.15s,
    color 0.15s;
}

.language-option:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.language-option--active {
  border-color: var(--color-primary);
  color: var(--color-primary);
  font-weight: var(--font-weight-semibold);
}

.actions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.edit-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  border: 1px solid var(--color-outline-variant);
  border-radius: 12px;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-on-surface);
  transition: background-color 0.2s;
}

.edit-btn:hover {
  background-color: var(--color-surface-variant);
}

.sign-out-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  border: 1px solid var(--color-outline-variant);
  border-radius: 12px;
  color: var(--color-error);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  transition: background-color 0.2s;
}

.sign-out-btn:hover {
  background-color: var(--color-error-container);
}

/* Edit form */
.edit-form {
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

.optional {
  font-weight: var(--font-weight-regular);
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

.edit-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.cancel-btn {
  flex: 1;
  padding: var(--spacing-md);
  border: 1px solid var(--color-outline-variant);
  border-radius: 12px;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-on-surface);
  transition: background-color 0.2s;
}

.cancel-btn:hover {
  background-color: var(--color-surface-variant);
}

.save-btn {
  flex: 1;
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

.save-btn:hover:not(:disabled) {
  background-color: var(--color-primary-dark);
  transform: translateY(-1px);
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
