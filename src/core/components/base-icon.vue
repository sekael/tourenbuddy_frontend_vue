<script setup lang="ts">
import type { Component } from 'vue'
import { computed } from 'vue'
import { useLogger } from '@/core/logging/use-logger'
import { iconRegistry } from './icons'

type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const props = defineProps<{
  /** Internal icon name, e.g. "close", "location_on". Must exist in iconRegistry. */
  name: string
  /**
   * Token-driven size. When omitted, no size class is applied and the SVG
   * inherits the 20px base font-size (or a consumer's own font-size override,
   * e.g. a small positioned badge).
   */
  size?: IconSize
}>()

const logger = useLogger('BaseIcon')

// Resolve the runtime name to its registry SVG. An empty name is valid (some
// call sites bind `:name="… ? 'check' : ''"`) and renders nothing. A non-empty
// name missing from the registry is a bug: shout in dev, degrade to nothing in
// prod (a typo'd icon must not blank a whole panel for users).
const iconComponent = computed<Component | undefined>(() => {
  const icon = iconRegistry[props.name]
  if (import.meta.env.DEV && props.name && !icon)
    logger.error(`Unknown icon name "${props.name}" — register it in icons.ts`)
  return icon
})
</script>

<template>
  <component
    :is="iconComponent"
    v-if="iconComponent"
    class="base-icon"
    :class="props.size ? `base-icon--${props.size}` : undefined"
    aria-hidden="true"
  />
</template>

<style scoped>
/* SVG icons are 1em square, so font-size drives their rendered size — mirroring
   the previous icon-font default of 20px and the token-based size modifiers. */
.base-icon {
  font-size: 20px;
}

.base-icon--xs {
  font-size: var(--icon-size-xs);
}

.base-icon--sm {
  font-size: var(--icon-size-sm);
}

.base-icon--md {
  font-size: var(--icon-size-md);
}

.base-icon--lg {
  font-size: var(--icon-size-lg);
}

.base-icon--xl {
  font-size: var(--icon-size-xl);
}
</style>
