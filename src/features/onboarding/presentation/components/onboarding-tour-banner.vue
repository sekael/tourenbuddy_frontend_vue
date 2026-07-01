<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import BaseButton from '@/core/components/base-button.vue'
import BaseIconButton from '@/core/components/base-icon-button.vue'

defineProps<{
  /** Short label for the current step (e.g. "Verify phone number"). */
  title: string
  /** 1-based current step number. */
  current: number
  /** Total step count. */
  total: number
  /** Whether the back control is enabled (false on the first step). */
  canBack: boolean
  /** True while a step is being staged — disables the nav arrows. */
  busy?: boolean
}>()

const emit = defineEmits<{ back: [], next: [], finish: [] }>()

const { t } = useI18n({ useScope: 'global' })
</script>

<template>
  <div class="tour-banner" role="region" :aria-label="t('onboarding.tour.bannerLabel')">
    <span class="step-title">{{ title }}</span>

    <div class="controls">
      <BaseButton variant="secondary" size="sm" class="finish-btn" @click="emit('finish')">
        {{ t('onboarding.tour.controls.finish') }}
      </BaseButton>

      <span class="progress" aria-live="polite">{{ current }} / {{ total }}</span>

      <div class="nav">
        <BaseIconButton
          name="arrow_back"
          :label="t('onboarding.tour.controls.previous')"
          size="sm"
          class="nav-btn"
          :disabled="!canBack || busy"
          @click="emit('back')"
        />
        <BaseIconButton
          name="arrow_forward"
          :label="t('onboarding.tour.controls.next')"
          size="sm"
          class="nav-btn"
          :disabled="busy"
          @click="emit('next')"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* driver.js adds `.driver-active` to <body> and `.driver-active * { pointer-events: none }`.
   The banner is teleported to <body>, so without this its buttons inherit
   `pointer-events: none` and clicks fall through to the container (the real bug
   behind the "dead" controls). The scoped attribute selector out-specifies
   driver's `.driver-active *`, re-enabling the whole banner subtree. */
.tour-banner,
.tour-banner * {
  pointer-events: auto;
}

.tour-banner {
  /* Above driver.js' overlay + popover so the controls stay clickable and the
     backdrop-tap-to-advance never swallows banner clicks. */
  position: fixed;
  top: calc(var(--spacing-md) + var(--safe-top));
  left: 50%;
  transform: translateX(-50%);
  z-index: 2147483000;
  /* Two rows: the title gets the full banner width on top, the controls
     (finish / progress / nav) sit on their own row beneath it. A long step
     name now wraps across the whole width instead of being squeezed into a
     narrow column and breaking mid-word. */
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  /* Constant width across steps so a long title never resizes the banner;
     capped to the viewport on narrow screens. */
  width: min(24rem, calc(100vw - 2 * var(--spacing-md)));
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-lg);
  background-color: var(--color-fab-surface);
  border: 1px solid var(--color-fab-border);
  box-shadow: var(--shadow-lg);
  pointer-events: auto;
}

.controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
}

.finish-btn {
  border-color: var(--color-contrast-outline);
  color: var(--color-fab-on-surface);
}

.finish-btn:hover {
  background-color: var(--color-contrast-surface);
  border-color: var(--color-contrast-outline-strong);
}

.step-title {
  /* Full banner width, wrapping at word boundaries — there's room now, so a
     long label breaks between words (never mid-word). */
  width: 100%;
  text-align: center;
  line-height: 1.25;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-fab-on-surface);
}

.progress {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-fab-on-surface);
  opacity: 0.8;
  font-variant-numeric: tabular-nums;
}

.nav {
  display: flex;
  align-items: center;
  gap: var(--spacing-xxs);
}

.nav-btn {
  color: var(--color-fab-on-surface);
}

.nav-btn:hover:not(:disabled) {
  background-color: color-mix(in srgb, var(--color-fab-surface-strong) 60%, transparent);
}

.nav-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

/* Slide/fade in from the top (Transition name="tour-slide" in map-page). */
.tour-slide-enter-active,
.tour-slide-leave-active {
  transition:
    transform 0.25s ease,
    opacity 0.25s ease;
}

.tour-slide-enter-from,
.tour-slide-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-16px);
}
</style>
