<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  hasFriendship: boolean
}>()

const emit = defineEmits<{
  cancel: []
  confirm: [reportReason: string | null]
}>()

const { t } = useI18n({ useScope: 'global' })

const reportEnabled = ref(false)
const reportReason = ref('')

function handleConfirm() {
  emit('confirm', reportEnabled.value ? (reportReason.value.trim() || null) : null)
}
</script>

<template>
  <div class="dialog-backdrop" @click.self="emit('cancel')">
    <div class="dialog" role="dialog" aria-modal="true">
      <h2 class="dialog-title">
        {{ t('blocks.confirm.title') }}
      </h2>

      <p class="dialog-body">
        {{ props.hasFriendship ? t('blocks.confirm.bodyWithFriend') : t('blocks.confirm.bodyWithoutFriend') }}
      </p>

      <p class="cooldown-notice">
        <span class="material-symbols-outlined notice-icon">schedule</span>
        {{ t('blocks.confirm.cooldownNotice') }}
      </p>

      <label class="report-toggle">
        <input v-model="reportEnabled" type="checkbox">
        {{ t('blocks.confirm.reportToggle') }}
      </label>

      <textarea
        v-if="reportEnabled"
        v-model="reportReason"
        class="report-input"
        :placeholder="t('blocks.confirm.reportPlaceholder')"
        maxlength="1000"
        rows="3"
      />

      <div class="dialog-actions">
        <button
          type="button"
          class="btn btn--cancel"
          @click="emit('cancel')"
        >
          {{ t('blocks.confirm.cancelBtn') }}
        </button>
        <button
          type="button"
          class="btn btn--confirm"
          @click="handleConfirm"
        >
          {{ t('blocks.confirm.confirmBtn') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dialog-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: var(--spacing-md);
}

.dialog {
  background-color: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  max-width: 420px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  box-shadow: var(--shadow-lg);
}

.dialog-title {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-on-surface);
}

.dialog-body {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
  line-height: 1.5;
}

.cooldown-notice {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-xs);
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
  background-color: color-mix(in srgb, var(--color-warning, #f59e0b) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-warning, #f59e0b) 30%, transparent);
  border-radius: var(--radius-sm);
  padding: var(--spacing-sm) var(--spacing-md);
}

.notice-icon {
  font-size: 16px;
  flex-shrink: 0;
  margin-top: 1px;
}

.report-toggle {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
  cursor: pointer;
}

.report-input {
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-sm);
  padding: var(--spacing-sm);
  font-size: var(--font-size-sm);
  color: var(--color-on-surface);
  background-color: var(--color-surface-variant);
  resize: vertical;
  width: 100%;
}

.dialog-actions {
  display: flex;
  gap: var(--spacing-sm);
  justify-content: flex-end;
  margin-top: var(--spacing-sm);
}

.btn {
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  transition: background-color 0.15s;
}

.btn--cancel {
  border: 1.5px solid var(--color-outline-variant);
  color: var(--color-on-surface-variant);
}

.btn--cancel:hover {
  background-color: var(--color-surface-variant);
}

.btn--confirm {
  border: 1.5px solid var(--color-error, #dc2626);
  color: var(--color-error, #dc2626);
}

.btn--confirm:hover {
  background-color: color-mix(in srgb, var(--color-error, #dc2626) 10%, transparent);
}
</style>
