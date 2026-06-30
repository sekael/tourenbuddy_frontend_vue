<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AdaptiveOverlay from '@/core/components/adaptive-overlay.vue'
import BaseButton from '@/core/components/base-button.vue'
import BaseIconButton from '@/core/components/base-icon-button.vue'
import BaseIcon from '@/core/components/base-icon.vue'
import BaseTooltip from '@/core/components/base-tooltip.vue'
import { useAsYouTypePhone } from '@/core/composables/use-as-you-type-phone'
import { useIsDesktop } from '@/core/composables/use-is-desktop'
import { InvalidPhoneNumberError, PhoneAlreadyRegisteredError } from '@/core/exceptions'
import { SUPPORTED_LOCALES } from '@/core/i18n/supported'
import { formatPhoneForDisplay } from '@/core/utils/phone-normalize'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'
import PhoneVerificationNotice from '@/features/friendships/presentation/components/phone-verification-notice.vue'
import { useFriendshipsStore } from '@/features/friendships/presentation/stores/friendships-store'
import { useLocaleStore } from '@/features/i18n/presentation/stores/use-locale-store'
import NotificationPreferencesSection from '@/features/notifications/presentation/components/notification-preferences-section.vue'
import { useOnboardingTourStore } from '@/features/onboarding/presentation/stores/onboarding-tour-store'
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
const friendshipsStore = useFriendshipsStore()
const onboardingTourStore = useOnboardingTourStore()

const isDesktop = useIsDesktop()
const isEditing = ref(false)
// On mobile, editing the profile takes a full-screen page; `editAsPage` also
// hides the in-form action row (the page's top app bar provides Save/Cancel).
const editAsPage = computed(() => !isDesktop.value && isEditing.value)

function handleClose() {
  if (editAsPage.value)
    cancelEdit()
  else
    emit('close')
}

const editFirstName = ref('')
const editLastName = ref('')
const editPhone = ref('')
const { formatted: editPhoneFormatted, onInput: onEditPhoneInput } = useAsYouTypePhone(editPhone)
const editError = ref<string | null>(null)
const isSaving = ref(false)

const showPhoneVerification = ref(false)
const showVerificationNotice = ref(false)
const showRemovePhoneConfirm = ref(false)
const isRemovingPhone = ref(false)
const pendingPhone = ref('')
const pendingPhoneForNotice = ref('')
const removePhoneRelationships = ref<{ hasPending: boolean, hasFriendship: boolean } | null>(null)

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
      // Pre-check availability so user isn't shown the discoverability notice
      // for a number that will be rejected as already registered.
      await userProfileStore.checkPhoneAvailability(phone)
      pendingPhoneForNotice.value = phone
      isEditing.value = false
      showVerificationNotice.value = true
    }
    else {
      isEditing.value = false
    }
  }
  catch (err) {
    if (err instanceof PhoneAlreadyRegisteredError) {
      editError.value = t('user.phoneVerification.alreadyRegisteredError')
    }
    else {
      editError.value
        = err instanceof InvalidPhoneNumberError || err instanceof Error
          ? (err as Error).message
          : t('user.profile.saveFailed')
    }
  }
  finally {
    isSaving.value = false
  }
}

function handleAddPhone() {
  startEdit()
}

// Reopen the onboarding tour: close this sheet so the tour can stage its own
// overlays, then signal map-page (the tour controller) to start at last step.
function handleShowTour() {
  emit('close')
  onboardingTourStore.requestReopen()
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
    if (err instanceof PhoneAlreadyRegisteredError) {
      editError.value = t('user.phoneVerification.alreadyRegisteredError')
    }
    else {
      editError.value
        = err instanceof InvalidPhoneNumberError || err instanceof Error
          ? (err as Error).message
          : t('user.profile.saveFailed')
    }
    isEditing.value = true
  }
  finally {
    isSaving.value = false
  }
}

function handleNoticeClose() {
  showVerificationNotice.value = false
}

async function handleRemovePhone() {
  if (full.value?.phoneVerified) {
    removePhoneRelationships.value = friendshipsStore.currentUserHasAnyRelationship()
    showRemovePhoneConfirm.value = true
  }
  else {
    await executeDeletePhone()
  }
}

async function executeDeletePhone() {
  isRemovingPhone.value = true
  await userProfileStore.deletePhone()
  isRemovingPhone.value = false
  if (!userProfileStore.error) {
    showRemovePhoneConfirm.value = false
    isEditing.value = false
  }
  else {
    editError.value = t('user.profile.removePhoneFailed')
  }
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
  <AdaptiveOverlay :title="t('user.profile.title')" :page="isEditing" @close="handleClose">
    <template v-if="editAsPage" #page-action>
      <BaseButton type="submit" form="profile-edit-form" variant="primary" size="sm" :disabled="isSaving">
        {{ isSaving ? t('user.shared.savingBtn') : t('user.shared.saveBtn') }}
      </BaseButton>
    </template>

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

        <div class="phone-row" data-tour="phone-verification">
          <template v-if="full?.phoneNumber">
            <BaseIcon name="phone" class="phone-icon" />
            <span class="phone-number">{{ displayPhoneNumber }}</span>
            <BaseTooltip v-if="full.phoneVerified" :text="t('user.profile.verifiedTooltip')">
              <BaseIcon name="verified" class="verified-icon" />
            </BaseTooltip>
            <BaseButton v-else variant="text" size="sm" data-testid="verify-btn" @click="startEdit">
              {{ t('user.profile.verifyBtn') }}
            </BaseButton>
          </template>
          <BaseButton v-else variant="text" size="sm" data-testid="add-phone-btn" @click="handleAddPhone">
            <BaseIcon name="add" />
            {{ t('user.profile.addPhoneBtn') }}
          </BaseButton>
        </div>

        <hr class="divider">

        <!-- Language selector -->
        <section class="language-section">
          <h3 class="section-title">
            {{ t('user.profile.languageLabel') }}
          </h3>
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
        </section>

        <hr class="divider">

        <!-- Notification preferences -->
        <div data-tour="notifications">
          <NotificationPreferencesSection />
        </div>

        <hr class="divider">

        <div class="actions">
          <BaseButton variant="secondary" class="menu-row" data-testid="edit-profile-btn" @click="startEdit">
            <BaseIcon name="edit" />
            {{ t('user.profile.editBtn') }}
          </BaseButton>
          <BaseButton variant="secondary" class="menu-row" @click="handleShowTour">
            <BaseIcon name="tour" />
            {{ t('onboarding.tour.controls.reopen') }}
          </BaseButton>
          <BaseButton variant="danger-outline" class="menu-row" @click="handleSignOut">
            <BaseIcon name="logout" />
            {{ t('user.profile.signOutBtn') }}
          </BaseButton>
        </div>
      </template>

      <!-- Edit mode -->
      <template v-else>
        <form id="profile-edit-form" class="edit-form" @submit.prevent="handleSave">
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
            <div class="phone-input-row">
              <input
                id="edit-phone"
                :value="editPhoneFormatted"
                type="tel"
                class="input"
                :placeholder="t('user.shared.phonePlaceholder')"
                autocomplete="tel"
                @input="onEditPhoneInput"
              >
              <BaseTooltip v-if="full?.phoneNumber" :text="t('user.profile.removePhoneBtn')">
                <BaseIconButton
                  name="delete"
                  :label="t('user.profile.removePhoneBtn')"
                  data-testid="remove-phone-btn"
                  shape="square"
                  tone="danger"
                  :disabled="isRemovingPhone || showRemovePhoneConfirm"
                  @click="handleRemovePhone"
                />
              </BaseTooltip>
            </div>
          </div>

          <!-- Inline remove-phone confirmation (verified only) -->
          <div v-if="showRemovePhoneConfirm" class="remove-phone-confirm">
            <div class="remove-phone-warning">
              <BaseIcon name="warning" class="warn-icon" />
              <div class="remove-phone-disclaimers">
                <p class="remove-phone-disclaimer">
                  {{ t('user.profile.removePhoneDisclaimer') }}
                </p>
                <p
                  v-if="removePhoneRelationships?.hasFriendship && removePhoneRelationships?.hasPending"
                  class="remove-phone-disclaimer"
                >
                  {{ t('user.profile.removePhoneBothWarning') }}
                </p>
                <p v-else-if="removePhoneRelationships?.hasFriendship" class="remove-phone-disclaimer">
                  {{ t('user.profile.removePhoneFriendshipWarning') }}
                </p>
                <p v-else-if="removePhoneRelationships?.hasPending" class="remove-phone-disclaimer">
                  {{ t('user.profile.removePhonePendingWarning') }}
                </p>
              </div>
            </div>
            <div class="remove-phone-actions">
              <BaseButton
                type="button"
                variant="secondary"
                size="sm"
                :disabled="isRemovingPhone"
                @click="showRemovePhoneConfirm = false"
              >
                {{ t('user.profile.removePhoneCancelBtn') }}
              </BaseButton>
              <BaseButton
                type="button"
                variant="danger"
                size="sm"
                :disabled="isRemovingPhone"
                @click="executeDeletePhone"
              >
                {{ t('user.profile.removePhoneConfirmBtn') }}
              </BaseButton>
            </div>
          </div>

          <p v-if="editError" class="error-text">
            {{ editError }}
          </p>

          <div v-if="!editAsPage" class="edit-actions">
            <BaseButton type="button" variant="secondary" @click="cancelEdit">
              {{ t('user.shared.cancelBtn') }}
            </BaseButton>
            <BaseButton type="submit" variant="primary" :disabled="isSaving">
              {{ isSaving ? t('user.shared.savingBtn') : t('user.shared.saveBtn') }}
            </BaseButton>
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
  border-radius: var(--radius-round);
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
  /* Avatar width is 48px */
  padding-left: calc(48px + var(--spacing-md));
}

.phone-icon {
  font-size: var(--icon-size-sm);
  color: var(--color-on-surface-variant);
}

.phone-number {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface);
}

.verified-icon {
  font-size: var(--icon-size-sm);
  color: var(--color-fab-surface-strong);
}

.language-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.section-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-on-surface-variant);
  text-transform: uppercase;
  letter-spacing: 0.05em;
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
  font-size: var(--font-size-base);
  color: var(--color-on-surface);
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

.divider {
  border: 0;
  border-top: 1px solid var(--color-outline-variant);
  margin: 0;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

/* Menu rows are BaseButtons (secondary / danger-outline) laid out as full-width
   left-aligned list items; only the alignment override lives here. */
.menu-row {
  justify-content: flex-start;
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

/* Edit-actions cancel/save use shared BaseButton; fill the row like before. */
.edit-actions :deep(.base-button) {
  flex: 1;
}

.phone-input-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.phone-input-row .input {
  flex: 1;
  min-width: 0;
}

.remove-phone-confirm {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border: 1px solid var(--color-error);
  border-radius: var(--radius-sm);
  background-color: var(--color-error-container);
}

.remove-phone-warning {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-xs);
}

.remove-phone-warning .warn-icon {
  font-size: var(--icon-size-sm);
  color: var(--color-error);
  flex-shrink: 0;
  margin-top: 2px;
}

/* Disclaimer lines stack in the column beside the icon, sharing one indent. */
.remove-phone-disclaimers {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.remove-phone-disclaimer {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface);
  line-height: 1.5;
}

.remove-phone-actions {
  display: flex;
  gap: var(--spacing-sm);
}

/* Remove-phone cancel/confirm use shared BaseButton; fill the row. */
.remove-phone-actions :deep(.base-button) {
  flex: 1;
}
</style>
