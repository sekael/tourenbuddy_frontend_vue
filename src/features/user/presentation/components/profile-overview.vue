<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/core/components/base-button.vue'
import BaseIcon from '@/core/components/base-icon.vue'
import { SUPPORTED_LOCALES } from '@/core/i18n/supported'
import { formatPhoneForDisplay } from '@/core/utils/phone-normalize'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
import { useCalendarFeedStore } from '@/features/calendar/presentation/stores/calendar-feed-store'
import { useLocaleStore } from '@/features/i18n/presentation/stores/use-locale-store'
import { useNotificationCapability } from '@/features/notifications/presentation/composables/use-notification-capability'
import { useNotificationsStore } from '@/features/notifications/presentation/stores/notifications-store'
import { useUserProfileStore } from '@/features/user/presentation/stores/user-profile-store'

export type ProfileSection = 'edit' | 'notifications' | 'calendar'

// The profile at a glance: who you are, each setting's current state, and one tap
// to the section that changes it.
const emit = defineEmits<{ open: [section: ProfileSection], showTour: [], signOut: [] }>()

const { t } = useI18n({ useScope: 'global' })
const authStore = useAuthStore()
const userProfileStore = useUserProfileStore()
const localeStore = useLocaleStore()
const notificationsStore = useNotificationsStore()
const calendarStore = useCalendarFeedStore()
const { pushSupported } = useNotificationCapability()

const full = computed(() => userProfileStore.fullProfile)
const email = computed(() => full.value?.email ?? authStore.currentUser?.email ?? '')
const displayName = computed(() => {
  const p = full.value
  return [p?.firstName, p?.lastName].filter(Boolean).join(' ') || email.value || 'User'
})
const displayPhone = computed(() => {
  const phone = full.value?.phoneNumber
  return phone ? formatPhoneForDisplay(phone) || phone : null
})

const localeIndex = computed(() => SUPPORTED_LOCALES.findIndex(l => l.code === localeStore.locale))

const notificationsValue = computed(() => {
  const p = notificationsStore.prefs
  if (!p)
    return ''
  const push = p.notifPushEnabled && pushSupported.value && notificationsStore.pushPermission !== 'denied'
  const email = p.notifEmailEnabled
  const key = push && email ? 'pushAndEmail' : push ? 'push' : email ? 'email' : 'off'
  return t(`user.profile.notificationsSummary.${key}`)
})

const calendarProblem = computed(() => calendarStore.feeds.some(f => f.lastError))
const calendarValue = computed(() => calendarProblem.value
  ? t('user.profile.calendarProblem')
  : t('user.profile.calendarSummary', { count: calendarStore.feeds.length }))

onMounted(() => {
  if (!notificationsStore.prefs)
    notificationsStore.loadPrefs()
  calendarStore.loadFeeds()
})
</script>

<template>
  <div class="overview">
    <button
      type="button"
      class="identity"
      data-testid="edit-profile-btn"
      data-tour="phone-verification"
      :title="t('user.profile.editBtn')"
      @click="emit('open', 'edit')"
    >
      <span class="avatar" aria-hidden="true">{{ displayName.charAt(0).toUpperCase() }}</span>
      <span class="identity-text">
        <span class="name">{{ displayName }}</span>
        <span class="secondary-text">{{ email }}</span>
        <span class="phone secondary-text" data-testid="phone-status">
          <template v-if="displayPhone">
            <span>{{ displayPhone }}</span>
            <template v-if="full?.phoneVerified">
              <BaseIcon name="verified" class="verified-icon" />
              <span class="visually-hidden">{{ t('user.profile.verifiedTooltip') }}</span>
            </template>
            <span v-else class="badge badge--alert">{{ t('user.profile.notVerified') }}</span>
          </template>
          <span v-else class="badge">{{ t('user.profile.addPhoneBtn') }}</span>
        </span>
      </span>
      <BaseIcon name="chevron_right" class="chevron" />
    </button>

    <ul class="group">
      <li class="row">
        <BaseIcon name="language" class="row-icon" />
        <span id="profile-language-label" class="row-label">{{ t('user.profile.languageLabel') }}</span>
        <div
          class="language"
          role="group"
          aria-labelledby="profile-language-label"
          data-tab-indicator
          :style="{ '--tab-index': localeIndex, '--tab-count': SUPPORTED_LOCALES.length }"
        >
          <button
            v-for="loc in SUPPORTED_LOCALES"
            :key="loc.code"
            type="button"
            :aria-pressed="localeStore.locale === loc.code"
            @click="localeStore.setLocale(loc.code)"
          >
            {{ loc.label }}
          </button>
        </div>
      </li>
      <li>
        <button type="button" class="row row--nav" data-tour="notifications" @click="emit('open', 'notifications')">
          <BaseIcon name="notifications" class="row-icon" />
          <span class="row-text">
            <span class="row-label">{{ t('notifications.sectionTitle') }}</span>
            <span class="row-value">{{ notificationsValue }}</span>
          </span>
          <BaseIcon name="chevron_right" class="chevron" />
        </button>
      </li>
      <li>
        <button type="button" class="row row--nav" data-tour="calendar-sync" @click="emit('open', 'calendar')">
          <BaseIcon name="calendar_today" class="row-icon" />
          <span class="row-text">
            <span class="row-label">{{ t('calendar.sync.title') }}</span>
            <span class="row-value" :class="{ 'row-value--alert': calendarProblem }">{{ calendarValue }}</span>
          </span>
          <BaseIcon name="chevron_right" class="chevron" />
        </button>
      </li>
      <li>
        <button type="button" class="row row--nav" @click="emit('showTour')">
          <BaseIcon name="tour" class="row-icon" />
          <span class="row-text">
            <span class="row-label">{{ t('onboarding.tour.controls.reopen') }}</span>
          </span>
          <BaseIcon name="chevron_right" class="chevron" />
        </button>
      </li>
    </ul>

    <BaseButton variant="secondary" class="sign-out" @click="emit('signOut')">
      <BaseIcon name="logout" />
      {{ t('user.profile.signOutBtn') }}
    </BaseButton>
  </div>
</template>

<style scoped>
/* Sized to fit the sheet's 70% cap on a 780px-tall phone without scrolling */
.overview {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

/* Identity card and settings rows share one tappable-tile look */
.identity,
.row {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  width: 100%;
  padding: var(--spacing-xs) var(--spacing-md);
  background-color: var(--color-surface-variant);
  color: var(--color-on-surface);
  text-align: start;
  transition:
    background-color var(--motion-duration-short) var(--motion-ease-standard),
    transform var(--motion-duration-short) var(--motion-ease-spring);
}

@media (hover: hover) {
  .identity:hover,
  .row--nav:hover {
    background-color: var(--color-secondary-container);
  }
}

.identity:active,
.row--nav:active {
  background-color: var(--color-secondary-container);
}

.identity:active,
.row--nav:active {
  transform: scale(var(--press-scale));
}

.identity {
  padding-block: var(--spacing-sm);
  border-radius: var(--card-radius);
}

.avatar {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: var(--radius-round);
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
}

.identity-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.name {
  font-weight: var(--font-weight-semibold);
}

.secondary-text {
  overflow: hidden;
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.phone {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.verified-icon {
  font-size: var(--icon-size-sm);
  color: var(--color-primary);
}

.badge {
  padding: 0 var(--spacing-sm);
  border-radius: var(--radius-pill);
  background-color: var(--color-secondary-container);
  color: var(--color-on-secondary-container);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  line-height: 20px;
}

.badge--alert {
  background-color: var(--color-error-container);
  color: var(--color-error-text);
}

.chevron {
  flex-shrink: 0;
  color: var(--color-on-surface-variant);
}

/* Settings: one card of rows, 2px seams of the sheet between them */
.group {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  overflow: hidden;
  border-radius: var(--card-radius);
  list-style: none;
}

/* One height for one- and two-line rows, so summaries loading in never shift
   the sheet */
.row {
  min-height: 58px;
}

.row-icon {
  flex-shrink: 0;
  color: var(--color-primary);
}

/* Label over its current value: reads at a glance, and long (German) labels
   never collide with the value. */
.row-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.row-label {
  font-weight: var(--font-weight-medium);
}

.row-value {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}

.row-value:empty {
  display: none;
}

.row-value--alert {
  color: var(--color-error-text);
}

.row > .row-label {
  flex: 1 0 auto;
}

.language {
  flex: 0 1 184px;
  min-width: 0;
}

.language > button {
  min-height: 32px;
  padding-inline: var(--spacing-xs);
}

.sign-out {
  width: 100%;
}
</style>
