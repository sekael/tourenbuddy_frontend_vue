<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import DialogWindow from '@/core/components/dialog-window.vue'

defineProps<{
  /** Number of friend sibling tours the current tour is linked with. */
  linkedCount: number
}>()

const emit = defineEmits<{ confirm: [], cancel: [] }>()

const { t } = useI18n({ useScope: 'global' })
</script>

<template>
  <DialogWindow :title="t('tourLinks.editWarningTitle')" @close="emit('cancel')">
    <div class="body">
      <p>{{ t('tourLinks.editWarningBody', { count: linkedCount }) }}</p>
      <p class="hint">
        {{ t('tourLinks.editWarningHint') }}
      </p>
    </div>
    <div class="actions">
      <button type="button" class="btn" @click="emit('cancel')">
        {{ t('tours.infoSheet.cancelBtn') }}
      </button>
      <button type="button" class="btn btn--danger" @click="emit('confirm')">
        {{ t('tourLinks.editWarningProceedBtn') }}
      </button>
    </div>
  </DialogWindow>
</template>

<style scoped>
.body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
}

.hint {
  color: var(--color-on-surface-variant);
  font-size: var(--font-size-sm);
  margin: 0;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  padding: 0 var(--spacing-md) var(--spacing-md);
}

.btn {
  padding: var(--spacing-xs) var(--spacing-md);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-sm);
  background: transparent;
  cursor: pointer;
}

.btn--danger {
  background: var(--color-error);
  color: var(--color-on-error);
  border-color: var(--color-error);
}
</style>
