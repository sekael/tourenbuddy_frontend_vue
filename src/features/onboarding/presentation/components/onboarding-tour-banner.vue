<script setup lang="ts">
import { useI18n } from 'vue-i18n'

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
    <button type="button" class="finish-btn" @click="emit('finish')">
      {{ t('onboarding.tour.controls.finish') }}
    </button>

    <div class="step-info">
      <span class="step-title">{{ title }}</span>
      <span class="progress" aria-live="polite">{{ current }} / {{ total }}</span>
    </div>

    <div class="nav">
      <button
        type="button"
        class="nav-btn"
        :disabled="!canBack || busy"
        :aria-label="t('onboarding.tour.controls.previous')"
        @click="emit('back')"
      >
        <span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>
      </button>
      <button
        type="button"
        class="nav-btn"
        :disabled="busy"
        :aria-label="t('onboarding.tour.controls.next')"
        @click="emit('next')"
      >
        <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
      </button>
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
  top: calc(var(--spacing-md) + env(safe-area-inset-top, 0px));
  left: 50%;
  transform: translateX(-50%);
  z-index: 2147483000;
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  /* Constant width across steps: the title column flexes/ellipsises inside this
     fixed box, so a long step name never resizes the banner. Capped to the
     viewport on narrow screens. */
  width: min(22rem, calc(100vw - 2 * var(--spacing-md)));
  padding: var(--spacing-xs) var(--spacing-xs) var(--spacing-xs) var(--spacing-md);
  border-radius: 26px;
  background-color: var(--color-fab-surface);
  border: 1px solid var(--color-fab-border);
  box-shadow: var(--shadow-lg);
  pointer-events: auto;
  white-space: nowrap;
}

.finish-btn {
  padding: var(--spacing-xs) var(--spacing-md);
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-radius: 18px;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-fab-on-surface);
  transition:
    background-color 0.15s,
    border-color 0.15s;
}

.finish-btn:hover {
  background-color: rgba(255, 255, 255, 0.16);
  border-color: rgba(255, 255, 255, 0.85);
}

.step-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  /* Take the slack between Finish and the arrows so the banner stays fixed
     width; the title ellipsises within it rather than growing the box. */
  flex: 1;
  min-width: 0;
}

.step-title {
  max-width: 100%;
  /* Wrap to a maximum of 2 lines (ellipsis past that), horizontally centered —
     long titles break instead of forcing the fixed-width banner wider. */
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  /* Override the banner's `white-space: nowrap` so the title actually wraps
     (line-clamp only ellipsises wrapped text — without this it just clips). */
  white-space: normal;
  overflow-wrap: break-word;
  text-align: center;
  line-height: 1.2;
  font-size: var(--font-size-sm);
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
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-fab-on-surface);
  transition:
    background-color 0.15s,
    opacity 0.15s;
}

.nav-btn:hover:not(:disabled) {
  background-color: color-mix(in srgb, var(--color-fab-surface-strong) 60%, transparent);
}

.nav-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.nav-btn .material-symbols-outlined {
  font-size: 22px;
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
