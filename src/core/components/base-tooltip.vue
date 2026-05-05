<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { useIsTouch } from '../composables/use-is-touch'

const props = defineProps<{
  text: string
}>()

const isTouch = useIsTouch()
const visible = ref(false)
let dismissTimer: ReturnType<typeof setTimeout> | null = null

const tooltipId = `tooltip-${Math.random().toString(36).slice(2, 9)}`

function show() {
  if (!isTouch.value)
    return
  visible.value = true
  clearTimeout(dismissTimer!)
  dismissTimer = setTimeout(() => (visible.value = false), 3000)
}

function hide() {
  visible.value = false
  clearTimeout(dismissTimer!)
  dismissTimer = null
}

onUnmounted(() => {
  clearTimeout(dismissTimer!)
})
</script>

<template>
  <span
    class="tooltip-wrapper"
    :aria-describedby="tooltipId"
    @touchstart.passive="show"
    @keydown.escape="hide"
  >
    <slot />
    <span
      :id="tooltipId"
      class="tooltip-bubble"
      :class="{ 'tooltip-bubble--visible': visible }"
      role="tooltip"
    >{{ props.text }}</span>
  </span>
</template>

<style scoped>
.tooltip-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.tooltip-bubble {
  position: absolute;
  bottom: calc(100% + var(--spacing-xs));
  left: 50%;
  transform: translateX(-50%);
  background-color: var(--color-on-surface);
  color: var(--color-surface);
  font-size: 0.75rem;
  line-height: 1.4;
  padding: var(--spacing-xxs) var(--spacing-xs);
  border-radius: var(--radius-sm);
  max-width: 200px;
  white-space: normal;
  text-align: center;
  box-shadow: var(--shadow-md);
  pointer-events: none;
  z-index: 100;

  opacity: 0;
  visibility: hidden;
  transition: opacity 0.15s ease;
}

@media (hover: hover) {
  .tooltip-wrapper:hover .tooltip-bubble {
    opacity: 1;
    visibility: visible;
  }
}

.tooltip-bubble--visible {
  opacity: 1;
  visibility: visible;
}
</style>
