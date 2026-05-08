<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AdaptiveOverlay from '@/core/components/adaptive-overlay.vue'
import { useIsDesktop } from '@/core/composables/use-is-desktop'

const emit = defineEmits<{ acknowledged: [], close: [] }>()

const { t } = useI18n({ useScope: 'global' })
const isDesktop = useIsDesktop()
const acknowledged = ref(false)
</script>

<template>
  <Teleport to="body">
    <div v-if="!isDesktop" class="sheet-container" @click.self="emit('close')">
      <AdaptiveOverlay
        :title="t('friendships.verificationNotice.title')"
        @close="emit('close')"
      >
        <div class="notice-content">
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
      </AdaptiveOverlay>
    </div>

    <AdaptiveOverlay
      v-else
      :title="t('friendships.verificationNotice.title')"
      @close="emit('close')"
    >
      <div class="notice-content">
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
    </AdaptiveOverlay>
  </Teleport>
</template>

<style scoped>
.sheet-container {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 120;
  background: rgba(15, 23, 42, 0.35);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
}

.notice-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
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
