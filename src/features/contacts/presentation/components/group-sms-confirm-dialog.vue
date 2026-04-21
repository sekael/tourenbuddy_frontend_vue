<script setup lang="ts">
import type { Contact } from '@/features/contacts/domain/entities/contact'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { buildGroupSmsRecipients } from '@/features/contacts/core/utils/contact-actions'
import { resolveContactName } from '@/features/contacts/domain/entities/contact'

const props = defineProps<{
  partners: Contact[]
}>()

const emit = defineEmits<{
  confirm: [recipients: string[]]
  cancel: []
}>()

const { t } = useI18n({ useScope: 'global' })

const result = computed(() => buildGroupSmsRecipients(props.partners))
const canSend = computed(() => result.value.included.length > 0)

function handleSend() {
  if (!canSend.value)
    return
  const uri = `sms:${result.value.included.map(r => r.e164).join(',')}`
  window.location.href = uri
  emit(
    'confirm',
    result.value.included.map(r => r.e164),
  )
}
</script>

<template>
  <div class="dialog-backdrop" @click.self="emit('cancel')">
    <div class="dialog-card" role="dialog" aria-modal="true" aria-labelledby="group-sms-title">
      <div class="dialog-header">
        <h2 id="group-sms-title" class="dialog-title">
          {{ t('contacts.groupSms.title') }}
        </h2>
        <button type="button" class="close-btn" aria-label="Close" @click="emit('cancel')">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <div class="dialog-body">
        <div v-if="result.included.length > 0" class="recipient-section">
          <p class="section-label">
            {{ t('contacts.groupSms.willReceiveLabel') }}
          </p>
          <ul class="recipient-list">
            <li v-for="item in result.included" :key="item.contact.id" class="recipient-row">
              <span class="material-symbols-outlined recipient-icon ok-icon">check_circle</span>
              <span>{{ resolveContactName(item.contact) }}</span>
              <span class="recipient-phone">{{ item.e164 }}</span>
            </li>
          </ul>
        </div>

        <div v-if="result.excluded.length > 0" class="recipient-section">
          <p class="section-label excluded-label">
            {{ t('contacts.groupSms.cannotReceiveLabel') }}
          </p>
          <ul class="recipient-list">
            <li v-for="item in result.excluded" :key="item.contact.id" class="recipient-row">
              <span class="material-symbols-outlined recipient-icon excluded-icon">cancel</span>
              <span>{{ resolveContactName(item.contact) }}</span>
              <span class="recipient-reason">{{ item.reason }}</span>
            </li>
          </ul>
        </div>

        <p v-if="!canSend" class="no-recipients-msg">
          {{ t('contacts.groupSms.noRecipients') }}
        </p>
      </div>

      <div class="dialog-footer">
        <button type="button" class="cancel-btn" @click="emit('cancel')">
          {{ t('contacts.groupSms.cancelBtn') }}
        </button>
        <button
          type="button"
          class="send-btn"
          :disabled="!canSend"
          data-testid="send-btn"
          @click="handleSend"
        >
          <span class="material-symbols-outlined">sms</span>
          {{ t('contacts.groupSms.sendBtn') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 60;
}

.dialog-card {
  background-color: var(--color-background);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 400px;
  max-height: 90dvh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  animation: dialog-enter 0.2s cubic-bezier(0.4, 0, 0.2, 1) both;
}

@keyframes dialog-enter {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-lg) var(--spacing-lg) var(--spacing-md);
  border-bottom: 1px solid var(--color-outline-variant);
  flex-shrink: 0;
}

.dialog-title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  flex: 1;
}

.close-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-on-surface-variant);
  flex-shrink: 0;
  transition: background-color 0.15s;
}

.close-btn:hover {
  background-color: var(--color-surface-variant);
}

.close-btn .material-symbols-outlined {
  font-size: 18px;
}

.dialog-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--spacing-md) var(--spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.recipient-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.section-label {
  font-size: var(--font-size-xs, 11px);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-on-surface-variant);
}

.excluded-label {
  color: var(--color-error);
}

.recipient-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.recipient-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) 0;
  font-size: var(--font-size-sm);
  color: var(--color-on-surface);
}

.recipient-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.ok-icon {
  color: var(--color-success, #22c55e);
}

.excluded-icon {
  color: var(--color-error);
}

.recipient-phone {
  margin-left: auto;
  font-family: monospace;
  font-size: var(--font-size-xs, 11px);
  color: var(--color-on-surface-variant);
}

.recipient-reason {
  margin-left: auto;
  font-size: var(--font-size-xs, 11px);
  color: var(--color-error);
  font-style: italic;
}

.no-recipients-msg {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
  text-align: center;
  padding: var(--spacing-md) 0;
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-lg);
  border-top: 1px solid var(--color-outline-variant);
  flex-shrink: 0;
}

.cancel-btn {
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-md);
  border: 1.5px solid var(--color-outline-variant);
  color: var(--color-on-surface-variant);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  transition: background-color 0.15s;
}

.cancel-btn:hover {
  background-color: var(--color-surface-variant);
}

.send-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-md);
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  transition: opacity 0.15s;
}

.send-btn:hover:not(:disabled) {
  opacity: 0.85;
}

.send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.send-btn .material-symbols-outlined {
  font-size: 16px;
}
</style>
