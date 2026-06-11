<script setup lang="ts">
import { useI18n } from 'vue-i18n'

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
      <span class="material-symbols-outlined welcome-icon" aria-hidden="true">explore</span>
      <h2 class="welcome-title">
        {{ t('onboarding.tour.welcome.title') }}
      </h2>
      <p class="welcome-body">
        {{ t('onboarding.tour.welcome.body') }}
      </p>

      <div class="welcome-actions">
        <button type="button" class="start-btn" @click="emit('start')">
          {{ t('onboarding.tour.welcome.start') }}
        </button>
        <button type="button" class="skip-btn" @click="emit('skip')">
          {{ t('onboarding.tour.welcome.skip') }}
        </button>
        <button type="button" class="dismiss-btn" @click="emit('dismiss')">
          {{ t('onboarding.tour.welcome.dismiss') }}
        </button>
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
    background-color: rgba(0, 0, 0, 0.6);
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
  font-size: 48px;
  color: var(--color-primary);
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

.start-btn {
  padding: var(--spacing-md);
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  border-radius: 12px;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  transition:
    background-color 0.2s,
    transform 0.15s;
}

.start-btn:hover {
  background-color: var(--color-primary-dark);
  transform: translateY(-1px);
}

.skip-btn {
  padding: var(--spacing-md);
  border: 1px solid var(--color-outline-variant);
  border-radius: 12px;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-on-surface);
  transition: background-color 0.2s;
}

.skip-btn:hover {
  background-color: var(--color-surface-variant);
}

.dismiss-btn {
  padding: var(--spacing-xs);
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
  transition: color 0.2s;
}

.dismiss-btn:hover {
  color: var(--color-on-surface);
}
</style>
