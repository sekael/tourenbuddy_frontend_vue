<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import BaseButton from '@/core/components/base-button.vue'
import { usePwaUpdate } from '@/core/composables/use-pwa-update'

// First row of the profile while an update waits: the speed-dial dot leads here, so the
// reason must be visible without scrolling. Unaffected by dismissing the banner.
const { t } = useI18n({ useScope: 'global' })
const { updateAvailable, apply } = usePwaUpdate()
</script>

<template>
  <div v-if="updateAvailable" class="notice" role="status" data-testid="app-update-notice">
    <span class="text">{{ t('core.pwa.update.message') }}</span>
    <BaseButton variant="primary" size="sm" @click="apply">
      {{ t('core.pwa.update.action') }}
    </BaseButton>
  </div>
</template>

<style scoped>
.notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--card-radius);
  background-color: var(--color-secondary-container);
  color: var(--color-on-surface);
}

.text {
  font-weight: var(--font-weight-medium);
}
</style>
