<script setup lang="ts">
import type { NotificationType } from '../../domain/entities/notification-preferences'
import { storeToRefs } from 'pinia'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseIconButton from '@/core/components/base-icon-button.vue'
import BaseTooltip from '@/core/components/base-tooltip.vue'
import { isOnline } from '@/core/offline/use-online-status'
import { ALL_NOTIFICATION_TYPES } from '../../domain/entities/notification-preferences'
import { useNotificationCapability } from '../composables/use-notification-capability'
import { useNotificationsStore } from '../stores/notifications-store'

const { t } = useI18n({ useScope: 'global' })
const notificationsStore = useNotificationsStore()
const { prefs, pushPermission, pushEnabled, isLoading } = storeToRefs(notificationsStore)
const { pushSupported, requiresPwaInstall } = useNotificationCapability()

// Push is this device's state (#148), email is account-wide.
const allOff = computed(
  () => prefs.value !== null && !pushEnabled.value && !prefs.value.notifEmailEnabled,
)
const pushDenied = computed(() => pushPermission.value === 'denied')

function isTypeMuted(type: NotificationType): boolean {
  return prefs.value?.notifMutedTypes.includes(type) ?? false
}

function handlePushToggle(event: Event) {
  notificationsStore.setPushEnabled((event.target as HTMLInputElement).checked)
}

function handleEmailToggle(event: Event) {
  notificationsStore.setEmailEnabled((event.target as HTMLInputElement).checked)
}

function handleTypeToggle(type: NotificationType, event: Event) {
  const muted = !(event.target as HTMLInputElement).checked
  notificationsStore.setTypeMuted(type, muted)
}

onMounted(() => {
  notificationsStore.loadPrefs()
})
</script>

<template>
  <section class="notifications-section">
    <div v-if="isLoading && !prefs" class="loading-placeholder" />

    <template v-else-if="prefs">
      <ul class="rows">
        <li class="row">
          <span class="row-label">{{ t('notifications.pushLabel') }}</span>
          <span v-if="requiresPwaInstall" class="unavailable">
            <span class="unavailable__label">{{ t('notifications.pushUnavailable') }}</span>
            <BaseTooltip :text="t('notifications.installHint')">
              <BaseIconButton
                name="info"
                :label="t('notifications.installHint')"
                size="sm"
                class="unavailable__info"
              />
            </BaseTooltip>
          </span>
          <span v-else-if="pushDenied" class="unavailable">
            <span class="unavailable__label">{{ t('notifications.pushUnavailable') }}</span>
            <BaseTooltip :text="t('notifications.deniedHint')">
              <BaseIconButton
                name="info"
                :label="t('notifications.deniedHint')"
                size="sm"
                class="unavailable__info unavailable__info--warning"
              />
            </BaseTooltip>
          </span>
          <label v-else-if="pushSupported" class="switch">
            <input
              type="checkbox"
              :checked="pushEnabled"
              :disabled="!isOnline"
              :aria-label="t('notifications.pushLabel')"
              data-testid="push-toggle"
              @change="handlePushToggle"
            >
            <span class="track" />
          </label>
        </li>

        <li class="row">
          <span class="row-label">{{ t('notifications.emailLabel') }}</span>
          <label class="switch">
            <input
              type="checkbox"
              :checked="prefs.notifEmailEnabled"
              :aria-label="t('notifications.emailLabel')"
              @change="handleEmailToggle"
            >
            <span class="track" />
          </label>
        </li>
      </ul>

      <div class="types-block" :class="{ 'types-block--disabled': allOff }">
        <span class="types-label">{{ t('notifications.typesLabel') }}</span>
        <span class="row-description">{{ t('notifications.typesHint') }}</span>
        <ul class="rows">
          <li
            v-for="type in ALL_NOTIFICATION_TYPES"
            :key="type"
            class="row row--with-description"
          >
            <div class="row-text">
              <span class="row-label">{{ t(`notifications.type.${type}`) }}</span>
              <span
                v-if="type === 'tour_interest' || type === 'tour_suggestions'"
                class="row-description"
              >{{ t(`notifications.typeDescription.${type}`) }}</span>
            </div>
            <label class="switch" :class="{ 'switch--disabled': allOff }">
              <input
                type="checkbox"
                :checked="!allOff && !isTypeMuted(type)"
                :aria-label="t(`notifications.type.${type}`)"
                :disabled="allOff"
                @change="handleTypeToggle(type, $event)"
              >
              <span class="track" />
            </label>
          </li>
        </ul>
      </div>

      <p v-if="allOff" class="disclaimer" data-testid="all-off-hint">
        {{ t('notifications.allOffDisclaimer') }}
      </p>
    </template>
  </section>
</template>

<style scoped>
.notifications-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.rows {
  display: flex;
  flex-direction: column;
  list-style: none;
  margin: 0;
  padding: 0;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  min-height: 40px;
  padding: var(--spacing-xs) 0;
}

.row-label {
  font-size: var(--font-size-base);
  color: var(--color-on-surface);
  flex: 1;
  min-width: 0;
}

.row--with-description {
  align-items: flex-start;
}

.row-text {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  gap: 2px;
}

.row-description {
  font-size: var(--font-size-xs);
  color: var(--color-on-surface-variant);
  line-height: 1.4;
}

.unavailable {
  display: flex;
  align-items: center;
  gap: var(--spacing-xxs);
  flex-shrink: 0;
  white-space: nowrap;
}

.unavailable__label {
  font-size: var(--font-size-xs);
  color: var(--color-on-surface-variant);
}

.unavailable__info {
  color: var(--color-on-surface-variant);
}

.unavailable__info--warning {
  color: var(--color-error);
}

.types-block {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: var(--spacing-sm);
  transition: opacity var(--motion-duration-short) var(--motion-ease-standard);
}

.types-block--disabled {
  opacity: 0.5;
}

.types-label {
  font-size: var(--heading-section-size);
  font-weight: var(--heading-section-weight);
  color: var(--heading-section-color);
  letter-spacing: var(--heading-section-tracking);
}

.disclaimer {
  font-size: var(--font-size-xs);
  color: var(--color-on-surface-variant);
  line-height: 1.4;
  margin: 0;
}

.loading-placeholder {
  height: 96px;
  border-radius: var(--radius-sm);
  background-color: var(--color-surface-variant);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* Sleek switch */
.switch {
  position: relative;
  display: inline-block;
  width: 38px;
  height: 22px;
  flex-shrink: 0;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.track {
  position: absolute;
  inset: 0;
  background-color: var(--color-outline-variant);
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: background-color var(--motion-duration-short) var(--motion-ease-standard);
}

.track::before {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  height: 18px;
  width: 18px;
  background-color: var(--color-background);
  border-radius: var(--radius-round);
  box-shadow: var(--shadow-control);
  transition: transform var(--motion-duration-short) var(--motion-ease-spring);
}

input:checked + .track {
  background-color: var(--color-primary);
}

input:checked + .track::before {
  transform: translateX(16px);
}

.switch--disabled .track,
input:disabled + .track {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
