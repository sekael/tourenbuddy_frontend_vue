<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  variant?: ButtonVariant
  size?: ButtonSize
}>(), {
  variant: 'primary',
  size: 'md',
})
// Runtime whitelist is the source of truth; the prop types are derived from it,
// so the two can never drift. Typed props are erased at runtime, so the
// component still guards against invalid values that slip through as plain JS.
const BUTTON_VARIANTS = ['primary', 'primary-outline', 'secondary', 'danger', 'danger-outline', 'text'] as const
const BUTTON_SIZES = ['sm', 'md', 'lg'] as const

type ButtonVariant = typeof BUTTON_VARIANTS[number]
type ButtonSize = typeof BUTTON_SIZES[number]

const variant = computed(() => (BUTTON_VARIANTS.includes(props.variant) ? props.variant : 'primary'))
const size = computed(() => (BUTTON_SIZES.includes(props.size) ? props.size : 'md'))
const buttonClasses = computed(() => [`base-button--${variant.value}`, `base-button--${size.value}`])
</script>

<template>
  <button type="button" class="base-button" :class="buttonClasses">
    <slot />
  </button>
</template>

<style scoped>
.base-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  font-family: inherit;
  font-weight: var(--font-weight-semibold);
  letter-spacing: -0.01em;
  /* Uniform 1px border on EVERY variant keeps identical geometry wherever a
     consumer adds a visible border. */
  border: 1px solid transparent;
  border-radius: var(--button-radius);
  transition:
    background-color var(--motion-duration-medium) var(--motion-ease-standard),
    box-shadow var(--motion-duration-medium) var(--motion-ease-standard),
    transform var(--motion-duration-short) var(--motion-ease-spring),
    opacity var(--motion-duration-short) var(--motion-ease-standard);
}

.base-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}

.base-button:active:not(:disabled) {
  transform: scale(var(--press-scale));
}

/* Filled — the one decisive action, with a soft glow in its own hue */
.base-button--primary {
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  box-shadow: 0 6px 16px -6px rgba(37, 99, 235, 0.5);
}

.base-button--primary:hover:not(:disabled) {
  background-color: var(--color-primary-dark);
}

.base-button--danger {
  background-color: var(--color-error);
  color: var(--color-on-error);
  box-shadow: 0 6px 16px -6px rgba(220, 38, 38, 0.45);
}

.base-button--danger:hover:not(:disabled) {
  background-color: var(--color-error-strong);
}

/* Tonal — everything else. The container fill separates the button from a white
   sheet or a tinted card; labels stay ≥ 4.5:1 on the hover fill too. */
.base-button--secondary {
  background-color: var(--color-secondary-container);
  color: var(--color-on-secondary-container);
}

.base-button--primary-outline {
  background-color: var(--color-secondary-container);
  color: var(--color-primary-dark);
}

.base-button--secondary:hover:not(:disabled),
.base-button--primary-outline:hover:not(:disabled) {
  background-color: var(--color-secondary-container-hover);
}

.base-button--danger-outline {
  background-color: var(--color-error-container);
  color: var(--color-error-text);
}

.base-button--danger-outline:hover:not(:disabled) {
  background-color: color-mix(in srgb, var(--color-error) 16%, var(--color-background));
}

.base-button--text {
  background-color: transparent;
  color: var(--color-primary);
}

.base-button--text:hover:not(:disabled) {
  background-color: var(--color-surface-variant);
}

/* Sizes */
.base-button--sm {
  padding: var(--button-padding-sm);
  font-size: var(--button-font-size-sm);
  min-height: 36px;
}

.base-button--md {
  padding: var(--button-padding-md);
  font-size: var(--button-font-size-md);
  min-height: 48px;
}

.base-button--lg {
  padding: var(--button-padding-lg);
  font-size: var(--button-font-size-lg);
  min-height: 56px;
}
</style>
