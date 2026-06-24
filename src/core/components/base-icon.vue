<script setup lang="ts">
import { computed } from 'vue'

type IconSize = 'sm' | 'md' | 'lg' | 'xl'

const props = withDefaults(defineProps<{
  /** Material Symbols ligature name, e.g. "close", "arrow_back". */
  name: string
  size?: IconSize
  /** Optional weight axis override (100–700). Falls back to the global 300. */
  weight?: number
}>(), {
  size: 'md',
})

// Restate the full variation-settings shorthand because it cannot be patched per-axis.
const weightStyle = computed(() =>
  props.weight == null
    ? undefined
    : `font-variation-settings: 'FILL' 0, 'wght' ${props.weight}, 'GRAD' 0, 'opsz' 24`,
)
</script>

<template>
  <span
    class="material-symbols-outlined base-icon"
    :class="`base-icon--${props.size}`"
    :style="weightStyle"
    aria-hidden="true"
  >{{ props.name }}</span>
</template>

<style scoped>
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
