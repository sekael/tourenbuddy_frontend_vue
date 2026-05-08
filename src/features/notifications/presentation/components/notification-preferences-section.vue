<script setup lang="ts">
import type { NotificationType } from '../../domain/entities/notification-preferences'
import { storeToRefs } from 'pinia'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ALL_NOTIFICATION_TYPES } from '../../domain/entities/notification-preferences'
import { useNotificationCapability } from '../composables/use-notification-capability'
import { useNotificationsStore } from '../stores/notifications-store'

const { t } = useI18n({ useScope: 'global' })
const notificationsStore = useNotificationsStore()
const { prefs, pushPermission, isLoading } = storeToRefs(notificationsStore)
const { pushSupported, requiresPwaInstall } = useNotificationCapability()

const allOff = computed(
  () => prefs.value !== null && !prefs.value.notifPushEnabled && !prefs.value.notifEmailEnabled,
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
    <h3 class="section-title">
      {{ t('notifications.sectionTitle') }}
    </h3>

    <div v-if="isLoading" class="loading-placeholder" />

    <template v-else-if="prefs">
      <ul class="rows">
        <li class="row">
          <span class="row-label">{{ t('notifications.pushLabel') }}</span>
          <span v-if="requiresPwaInstall" class="row-hint">
            {{ t('notifications.installHint') }}
          </span>
          <span v-else-if="pushDenied" class="row-hint row-hint--warning">
            {{ t('notifications.deniedHint') }}
          </span>
          <label v-else-if="pushSupported" class="switch">
            <input
              type="checkbox"
              :checked="prefs.notifPushEnabled"
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
              @change="handleEmailToggle"
            >
            <span class="track" />
          </label>
        </li>
      </ul>

      <div class="types-block" :class="{ 'types-block--disabled': allOff }">
        <span class="types-label">{{ t('notifications.typesLabel') }}</span>
        <ul class="rows">
          <li
            v-for="type in ALL_NOTIFICATION_TYPES"
            :key="type"
            class="row"
          >
            <span class="row-label">{{ t(`notifications.type.${type}`) }}</span>
            <label class="switch" :class="{ 'switch--disabled': allOff }">
              <input
                type="checkbox"
                :checked="!allOff && !isTypeMuted(type)"
                :disabled="allOff"
                @change="handleTypeToggle(type, $event)"
              >
              <span class="track" />
            </label>
          </li>
        </ul>
      </div>

      <p v-if="allOff" class="disclaimer">
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

.section-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-on-surface-variant);
  text-transform: uppercase;
  letter-spacing: 0.05em;
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

.row-hint {
  font-size: var(--font-size-xs);
  color: var(--color-on-surface-variant);
  text-align: right;
  max-width: 60%;
  line-height: 1.35;
}

.row-hint--warning {
  color: var(--color-error);
}

.types-block {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: var(--spacing-xs);
  padding-top: var(--spacing-sm);
  border-top: 1px solid var(--color-outline-variant);
  transition: opacity 0.2s;
}

.types-block--disabled {
  opacity: 0.5;
}

.types-label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-on-surface-variant);
  text-transform: uppercase;
  letter-spacing: 0.04em;
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
  border-radius: 22px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.track::before {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  height: 18px;
  width: 18px;
  background-color: white;
  border-radius: 50%;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
  transition: transform 0.2s;
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
