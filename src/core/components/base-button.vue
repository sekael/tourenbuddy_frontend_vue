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
  /* Uniform 1px border on EVERY variant so filled and outlined variants share
     identical geometry — border adds to auto height, so without this a bordered
     variant renders 2px taller than a borderless one. Outline variants only set
     border-color below. */
  border: 1px solid transparent;
  border-radius: var(--button-radius);
  /* `--button-*` component tokens are defined only by a design variant; each
     fallback here is the Classic value (see tokens.css, DESIGN.md). */
  letter-spacing: var(--button-tracking, normal);
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

/* Variants */
.base-button--primary {
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  box-shadow: var(--button-primary-shadow, none);
}

.base-button--primary:hover:not(:disabled) {
  transform: scale(var(--hover-scale));
}

.base-button--primary-outline {
  background-color: var(--button-primary-outline-bg, transparent);
  color: var(--button-primary-outline-color, var(--color-primary));
  border-color: var(--button-outline-border-color, var(--color-primary));
}

.base-button--primary-outline:hover:not(:disabled) {
  background-color: var(--button-primary-outline-hover-bg, color-mix(in srgb, var(--color-primary) 8%, transparent));
}

.base-button--secondary {
  background-color: var(--button-secondary-bg, transparent);
  color: var(--color-on-surface);
  border-color: var(--button-outline-border-color, var(--color-outline-variant));
}

.base-button--secondary:hover:not(:disabled) {
  background-color: var(--button-secondary-hover-bg, var(--color-surface-variant));
}

.base-button--danger {
  background-color: var(--color-error);
  color: var(--color-on-error);
  box-shadow: var(--button-danger-shadow, none);
}

.base-button--danger:hover:not(:disabled) {
  transform: scale(var(--hover-scale));
}

.base-button--danger-outline {
  background-color: var(--button-danger-outline-bg, transparent);
  color: var(--button-danger-outline-color, var(--color-error));
  border-color: var(--button-outline-border-color, var(--color-error));
}

.base-button--danger-outline:hover:not(:disabled) {
  background-color: var(--button-danger-outline-hover-bg, color-mix(in srgb, var(--color-error) 8%, transparent));
}

.base-button--text {
  background-color: transparent;
  color: var(--button-text-color, var(--color-on-surface-variant));
}

.base-button--text:hover:not(:disabled) {
  background-color: var(--color-surface-variant);
}

/* Press feedback. Primary/danger multiply in their hover scale so Classic
   (hover 1.02, press 1) looks exactly as before while pressed. */
.base-button:active:not(:disabled) {
  transform: scale(var(--press-scale));
}

.base-button--primary:active:not(:disabled),
.base-button--danger:active:not(:disabled) {
  transform: scale(calc(var(--hover-scale) * var(--press-scale)));
}

/* Sizes */
.base-button--sm {
  padding: var(--button-padding-sm);
  font-size: var(--button-font-size-sm);
  min-height: var(--button-min-height-sm, auto);
}

.base-button--md {
  padding: var(--button-padding-md);
  font-size: var(--button-font-size-md);
  min-height: var(--button-min-height-md, auto);
}

.base-button--lg {
  padding: var(--button-padding-lg);
  font-size: var(--button-font-size-lg);
  min-height: var(--button-min-height-lg, auto);
}
</style>
