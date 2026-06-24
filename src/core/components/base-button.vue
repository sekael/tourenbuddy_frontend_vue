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
const BUTTON_VARIANTS = ['primary', 'secondary', 'danger', 'text'] as const
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
  font-family: inherit;
  font-weight: var(--font-weight-semibold);
  border-radius: var(--button-radius);
  transition:
    background-color 0.2s,
    transform 0.15s,
    opacity 0.15s;
}

.base-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Variants */
.base-button--primary {
  background-color: var(--color-primary);
  color: var(--color-on-primary);
}

.base-button--primary:hover:not(:disabled) {
  transform: scale(1.02);
}

.base-button--secondary {
  background-color: transparent;
  color: var(--color-on-surface);
  border: 1px solid var(--color-outline-variant);
}

.base-button--secondary:hover:not(:disabled) {
  background-color: var(--color-surface-variant);
}

.base-button--danger {
  background-color: var(--color-error);
  color: var(--color-on-error);
}

.base-button--danger:hover:not(:disabled) {
  transform: scale(1.02);
}

.base-button--text {
  background-color: transparent;
  color: var(--color-on-surface-variant);
}

.base-button--text:hover:not(:disabled) {
  background-color: var(--color-surface-variant);
}

/* Sizes */
.base-button--sm {
  padding: var(--button-padding-sm);
  font-size: var(--button-font-size-sm);
}

.base-button--md {
  padding: var(--button-padding-md);
  font-size: var(--button-font-size-md);
}

.base-button--lg {
  padding: var(--button-padding-lg);
  font-size: var(--button-font-size-lg);
}
</style>
