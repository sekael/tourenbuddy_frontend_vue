<script setup lang="ts">
import type { ProfileSection } from './profile-overview.vue'
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
import { offlineBlockedAt } from '@/core/offline/mutate'
import { isOnline } from '@/core/offline/use-online-status'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
import CalendarSyncSettings from '@/features/calendar/presentation/components/calendar-sync-settings.vue'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'
import PhoneVerificationNotice from '@/features/friendships/presentation/components/phone-verification-notice.vue'
import { useFriendshipsStore } from '@/features/friendships/presentation/stores/friendships-store'
import NotificationPreferencesSection from '@/features/notifications/presentation/components/notification-preferences-section.vue'
import { useNotificationsStore } from '@/features/notifications/presentation/stores/notifications-store'
import { useOnboardingTourStore } from '@/features/onboarding/presentation/stores/onboarding-tour-store'
import { useToursStore } from '@/features/tours/presentation/stores/tours-store'
import { useUserProfileStore } from '@/features/user/presentation/stores/user-profile-store'
import PhoneVerificationDialog from './phone-verification-dialog.vue'
import ProfileOverview from './profile-overview.vue'

const emit = defineEmits<{ close: [] }>()

const router = useRouter()
const { t } = useI18n({ useScope: 'global' })
const authStore = useAuthStore()
const userProfileStore = useUserProfileStore()
const contactsStore = useContactsStore()
const toursStore = useToursStore()
const friendshipsStore = useFriendshipsStore()
const onboardingTourStore = useOnboardingTourStore()
const notificationsStore = useNotificationsStore()

const isDesktop = useIsDesktop()
// The overview shows everything at a glance; each section opens as its own view.
const view = ref<'overview' | ProfileSection>('overview')
const isEditing = computed(() => view.value === 'edit')
// On mobile every section takes a full-screen page (forms get the keyboard's room,
// the overview sheet keeps its own height); `editAsPage` also hides the in-form
// action row (the page's top app bar provides Save/Cancel).
const editAsPage = computed(() => !isDesktop.value && isEditing.value)
const title = computed(() => ({
  overview: t('user.profile.title'),
  edit: t('user.profile.editBtn'),
  notifications: t('notifications.sectionTitle'),
  calendar: t('calendar.sync.title'),
})[view.value])

function openSection(section: ProfileSection) {
  if (section === 'edit')
    startEdit()
  else
    view.value = section
}

function goBack() {
  if (isEditing.value)
    cancelEdit()
  else
    view.value = 'overview'
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

function startEdit() {
  const p = full.value
  editFirstName.value = p?.firstName ?? ''
  editLastName.value = p?.lastName ?? ''
  editPhone.value = p?.phoneNumber ?? ''
  editError.value = null
  view.value = 'edit'
}

function cancelEdit() {
  view.value = 'overview'
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

    // The name update above already queued offline. The phone half below hits the
    // network directly (checkPhoneAvailability + OTP verification), so offline it
    // must NOT run — bump the shared block signal so the global "unavailable
    // offline" snackbar fires, and close edit like the non-phone branch.
    if (phoneChanged && phone && !isOnline.value) {
      offlineBlockedAt.value = Date.now()
      view.value = 'overview'
    }
    else if (phoneChanged && phone) {
      // Pre-check availability so user isn't shown the discoverability notice
      // for a number that will be rejected as already registered.
      await userProfileStore.checkPhoneAvailability(phone)
      pendingPhoneForNotice.value = phone
      view.value = 'overview'
      showVerificationNotice.value = true
    }
    else {
      view.value = 'overview'
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
    view.value = 'edit'
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
    view.value = 'overview'
  }
  else {
    editError.value = t('user.profile.removePhoneFailed')
  }
}

async function handleSignOut() {
  // Before signOut: the row delete needs the session (#148 — a shared device must stop
  // receiving the previous user's pushes). Bounded + never throws.
  await notificationsStore.removeThisDevice()
  contactsStore.clear()
  toursStore.clear()
  userProfileStore.clear()
  await authStore.signOut()
  emit('close')
  router.push({ name: 'home' })
}
</script>

<template>
  <AdaptiveOverlay
    :title="title"
    :page="view !== 'overview'"
    :show-back="view !== 'overview'"
    @close="emit('close')"
    @back="goBack"
  >
    <template v-if="editAsPage" #page-action>
      <BaseButton type="submit" form="profile-edit-form" variant="primary" size="sm" :disabled="isSaving">
        {{ isSaving ? t('user.shared.savingBtn') : t('user.shared.saveBtn') }}
      </BaseButton>
    </template>

    <!-- Sections push/pop: forward slides in from the right, back from the left. -->
    <Transition :name="view === 'overview' ? 'view-pop' : 'view-push'" mode="out-in">
      <ProfileOverview
        v-if="view === 'overview'"
        @open="openSection"
        @show-tour="handleShowTour"
        @sign-out="handleSignOut"
      />
      <NotificationPreferencesSection v-else-if="view === 'notifications'" />
      <CalendarSyncSettings v-else-if="view === 'calendar'" />

      <!-- Edit mode -->
      <form v-else id="profile-edit-form" class="edit-form" @submit.prevent="handleSave">
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
              :disabled="!isOnline"
              @input="onEditPhoneInput"
            >
            <BaseTooltip v-if="full?.phoneNumber" :text="t('user.profile.removePhoneBtn')">
              <BaseIconButton
                name="delete"
                :label="t('user.profile.removePhoneBtn')"
                data-testid="remove-phone-btn"
                shape="square"
                tone="danger"
                :disabled="isRemovingPhone || showRemovePhoneConfirm || !isOnline"
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
    </Transition>
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
  color: var(--field-label-color);
}

.optional {
  font-weight: var(--font-weight-regular);
}

.input {
  padding: var(--spacing-md);
  border: 1.5px solid var(--color-outline-variant);
  border-radius: var(--input-radius);
  font-size: var(--font-size-base);
  color: var(--color-on-surface);
  background-color: var(--input-bg);
  outline: none;
  transition:
    border-color var(--motion-duration-medium) var(--motion-ease-standard),
    background-color var(--motion-duration-medium) var(--motion-ease-standard),
    box-shadow var(--motion-duration-medium) var(--motion-ease-standard);
}

.input:focus {
  border-color: var(--color-primary);
  background-color: var(--input-bg-focus);
  box-shadow: var(--input-focus-ring);
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
