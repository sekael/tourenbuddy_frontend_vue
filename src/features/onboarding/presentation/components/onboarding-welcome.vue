<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import BaseButton from '@/core/components/base-button.vue'
import BaseIcon from '@/core/components/base-icon.vue'

// Copy is parameterized so the same welcome hosts the app-onboarding tour and the
// calendar tour. Defaults to the onboarding keys; the calendar page overrides
// title/body with calendar-specific copy. The three action labels stay shared —
// they are generic (Start / Skip / Don't show again).
const props = withDefaults(
  defineProps<{ titleKey?: string, bodyKey?: string, icon?: string }>(),
  {
    titleKey: 'onboarding.tour.welcome.title',
    bodyKey: 'onboarding.tour.welcome.body',
    icon: 'explore',
  },
)

// Pre-tour welcome screen. Shown once on auto-start (before the driver.js tour
// runs), so it renders its own dark backdrop rather than relying on the tour
// overlay. The three actions map to the auto-start gate — see the handlers in
// `use-onboarding-tour.ts`.
const emit = defineEmits<{ start: [], skip: [], dismiss: [] }>()

const { t } = useI18n({ useScope: 'global' })
</script>

<template>
  <div class="welcome-backdrop" role="dialog" aria-modal="true" :aria-label="t(props.titleKey)">
    <div class="welcome-card">
      <span class="welcome-badge" aria-hidden="true">
        <BaseIcon :name="props.icon" class="welcome-icon" />
      </span>
      <h2 class="welcome-title">
        {{ t(props.titleKey) }}
      </h2>
      <p class="welcome-body">
        {{ t(props.bodyKey) }}
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
  padding-top: calc(var(--spacing-xl) + var(--safe-top));
  padding-bottom: calc(var(--spacing-xl) + var(--safe-bottom));
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
    backdrop-filter: blur(var(--overlay-backdrop-blur));
    -webkit-backdrop-filter: blur(var(--overlay-backdrop-blur));
  }

  .welcome-card {
    max-width: 380px;
    padding: var(--spacing-xl);
    border-radius: var(--radius-lg);
    background-color: var(--color-background);
    box-shadow: var(--shadow-lg);
  }
}

/* Icon in a soft tinted disc with a slow halo — the one decorative flourish. */
.welcome-badge {
  position: relative;
  display: grid;
  place-items: center;
  width: 72px;
  height: 72px;
  margin-bottom: var(--spacing-xs);
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-primary) 12%, var(--color-background));
}

.welcome-badge::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-primary) 30%, transparent);
  animation: welcome-halo 2.4s var(--motion-ease-standard) 0.6s infinite;
}

@keyframes welcome-halo {
  70%,
  100% {
    box-shadow: 0 0 0 16px transparent;
  }
}

.welcome-icon {
  color: var(--color-primary);
  font-size: var(--icon-size-xl);
}

/* Entrance: card contents rise in one after another. */
.welcome-card > * {
  animation: welcome-rise var(--motion-duration-long) var(--motion-ease-emphasized) backwards;
}

.welcome-card > :nth-child(2) {
  animation-delay: calc(var(--motion-stagger) * 2);
}

.welcome-card > :nth-child(3) {
  animation-delay: calc(var(--motion-stagger) * 3);
}

.welcome-card > :nth-child(4) {
  animation-delay: calc(var(--motion-stagger) * 4);
}

@keyframes welcome-rise {
  from {
    opacity: 0;
    transform: translateY(var(--motion-offset));
  }
}

/* <Transition name="welcome"> in the host pages: the backdrop fades, the card
   settles in (desktop); on exit everything fades out together. */
.welcome-enter-active,
.welcome-leave-active {
  transition: opacity var(--motion-duration-medium) var(--motion-ease-standard);
}

.welcome-enter-active .welcome-card,
.welcome-leave-active .welcome-card {
  transition: transform var(--motion-duration-medium) var(--motion-ease-emphasized);
}

.welcome-enter-from,
.welcome-leave-to {
  opacity: 0;
}

.welcome-enter-from .welcome-card {
  transform: scale(0.97);
}

.welcome-leave-to .welcome-card {
  transform: scale(0.98);
}

@media (prefers-reduced-motion: reduce) {
  .welcome-badge::after,
  .welcome-card > * {
    animation: none;
  }
}

.welcome-title {
  font-size: var(--overlay-title-size);
  letter-spacing: var(--overlay-title-tracking);
  line-height: 1.2;
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
