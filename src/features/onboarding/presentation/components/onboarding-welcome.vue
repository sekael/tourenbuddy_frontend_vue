<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import BaseButton from '@/core/components/base-button.vue'
import BaseIcon from '@/core/components/base-icon.vue'

// Pre-tour welcome screen. Shown once on auto-start (before the driver.js tour
// runs), so it renders its own dark backdrop rather than relying on the tour
// overlay. The three actions map to the auto-start gate — see the handlers in
// `use-onboarding-tour.ts`.
const emit = defineEmits<{ start: [], skip: [], dismiss: [] }>()

const { t } = useI18n({ useScope: 'global' })
</script>

<template>
  <div class="welcome-backdrop" role="dialog" aria-modal="true" :aria-label="t('onboarding.tour.welcome.title')">
    <div class="welcome-card">
      <BaseIcon name="explore" class="welcome-icon" />
      <h2 class="welcome-title">
        {{ t('onboarding.tour.welcome.title') }}
      </h2>
      <p class="welcome-body">
        {{ t('onboarding.tour.welcome.body') }}
      </p>

      <div class="welcome-actions">
        <BaseButton size="md" class="start-btn" @click="emit('start')">
          {{ t('onboarding.tour.welcome.start') }}
        </BaseButton>
        <BaseButton variant="secondary" size="md" class="skip-btn" @click="emit('skip')">
          {{ t('onboarding.tour.welcome.skip') }}
        </BaseButton>
        <BaseButton variant="text" size="sm" class="dismiss-btn" @click="emit('dismiss')">
          {{ t('onboarding.tour.welcome.dismiss') }}
        </BaseButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.welcome-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  display: flex;
  align-items: center;
  justify-content: center;
  /* Mobile: a full-screen page, not a dialog — solid background fills the
     viewport (no dimmed map behind, no floating card). */
  padding: var(--spacing-xl) var(--spacing-lg);
  padding-top: calc(var(--spacing-xl) + env(safe-area-inset-top, 0px));
  padding-bottom: calc(var(--spacing-xl) + env(safe-area-inset-bottom, 0px));
  background-color: var(--color-background);
}

.welcome-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  width: 100%;
  text-align: center;
}

/* Desktop: revert to a centered dialog card over a dimmed backdrop. */
@media (min-width: 600px) {
  .welcome-backdrop {
    padding: var(--spacing-lg);
    background-color: var(--color-backdrop-strong);
  }

  .welcome-card {
    max-width: 360px;
    padding: var(--spacing-xl);
    border-radius: var(--radius-lg);
    background-color: var(--color-background);
    box-shadow: var(--shadow-lg);
  }
}

.welcome-icon {
  color: var(--color-primary);
  font-size: var(--icon-size-xl);
}

.welcome-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-on-surface);
}

.welcome-body {
  font-size: var(--font-size-base);
  color: var(--color-on-surface-variant);
  line-height: 1.5;
}

.welcome-actions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  width: 100%;
  margin-top: var(--spacing-sm);
}

.start-btn,
.skip-btn,
.dismiss-btn {
  width: 100%;
}
</style>
