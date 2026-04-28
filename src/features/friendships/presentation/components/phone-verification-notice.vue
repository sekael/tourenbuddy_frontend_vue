<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const emit = defineEmits<{ acknowledged: [], close: [] }>()

const { t } = useI18n({ useScope: 'global' })
const acknowledged = ref(false)
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="dialog">
      <button class="close-btn" @click="emit('close')">
        <span class="material-symbols-outlined">close</span>
      </button>

      <h2 class="title">
        {{ t('friendships.verificationNotice.title') }}
      </h2>

      <div class="notice-body">
        <span class="material-symbols-outlined notice-icon">privacy_tip</span>
        <p class="notice-text">
          {{ t('friendships.verificationNotice.body') }}
        </p>
      </div>

      <label class="checkbox-row">
        <input v-model="acknowledged" type="checkbox" class="checkbox">
        <span class="checkbox-label">{{ t('friendships.verificationNotice.acknowledge') }}</span>
      </label>

      <button
        type="button"
        class="confirm-btn"
        :disabled="!acknowledged"
        @click="emit('acknowledged')"
      >
        {{ t('friendships.verificationNotice.acknowledge') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xl);
  z-index: 110;
}

.dialog {
  position: relative;
  background-color: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  box-shadow: var(--shadow-lg);
}

.close-btn {
  position: absolute;
  top: var(--spacing-md);
  right: var(--spacing-md);
  color: var(--color-on-surface-variant);
  display: flex;
  align-items: center;
  justify-content: center;
}

.title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  padding-right: var(--spacing-xl);
}

.notice-body {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  background-color: color-mix(in srgb, var(--color-primary) 8%, transparent);
}

.notice-icon {
  font-size: 24px;
  color: var(--color-primary);
  flex-shrink: 0;
}

.notice-text {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
  line-height: 1.6;
}

.checkbox-row {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  cursor: pointer;
}

.checkbox {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  margin-top: 2px;
  accent-color: var(--color-primary);
}

.checkbox-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-on-surface);
  line-height: 1.4;
}

.confirm-btn {
  padding: var(--spacing-md);
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  border-radius: 12px;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  transition: background-color 0.2s;
}

.confirm-btn:hover:not(:disabled) {
  background-color: var(--color-primary-dark);
}

.confirm-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
