<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import BaseButton from '@/core/components/base-button.vue'
import { usePwaUpdate } from '@/core/composables/use-pwa-update'

const { t } = useI18n({ useScope: 'global' })
const { showBanner, apply, dismissBanner } = usePwaUpdate()
</script>

<template>
  <Transition name="banner">
    <div v-if="showBanner" class="banner" role="status">
      <div class="content">
        <p class="text">
          {{ t('core.pwa.update.message') }}
        </p>
        <div class="actions">
          <BaseButton variant="text" size="sm" @click="dismissBanner">
            {{ t('core.pwa.update.dismiss') }}
          </BaseButton>
          <BaseButton variant="primary" size="sm" @click="apply">
            {{ t('core.pwa.update.action') }}
          </BaseButton>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.banner {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: var(--color-surface);
  border-top: 1px solid var(--color-outline-variant);
  box-shadow: var(--shadow-lg);
  z-index: 300;
  padding: var(--spacing-lg) var(--spacing-xl);
  padding-bottom: calc(var(--spacing-lg) + var(--safe-bottom));
}

.content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-lg);
  max-width: 600px;
  margin: 0 auto;
}

.text {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
  flex: 1;
}

.actions {
  display: flex;
  gap: var(--spacing-md);
  flex-shrink: 0;
}

.banner-enter-active,
.banner-leave-active {
  transition: transform var(--motion-duration-long) var(--motion-ease-standard);
}

.banner-enter-from,
.banner-leave-to {
  transform: translateY(100%);
}
</style>
