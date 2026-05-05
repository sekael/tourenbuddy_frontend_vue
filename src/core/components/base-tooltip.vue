<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { useIsTouch } from '../composables/use-is-touch'

const props = defineProps<{
  text: string
}>()

const isTouch = useIsTouch()
const visible = ref(false)
const wrapperRef = ref<HTMLElement | null>(null)
const posStyle = ref<{ top: string, left: string, transform: string }>({
  top: '0px',
  left: '0px',
  transform: 'translate(-50%, -100%)',
})
let dismissTimer: ReturnType<typeof setTimeout> | null = null

const tooltipId = `tooltip-${Math.random().toString(36).slice(2, 9)}`

const OFFSET = 8

function computePosition() {
  if (!wrapperRef.value)
    return
  const rect = wrapperRef.value.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  if (rect.top < 48) {
    posStyle.value = {
      top: `${rect.bottom + OFFSET}px`,
      left: `${centerX}px`,
      transform: 'translate(-50%, 0)',
    }
  }
  else {
    posStyle.value = {
      top: `${rect.top - OFFSET}px`,
      left: `${centerX}px`,
      transform: 'translate(-50%, -100%)',
    }
  }
}

function showTooltip() {
  computePosition()
  visible.value = true
}

function hideTooltip() {
  visible.value = false
  clearTimeout(dismissTimer!)
  dismissTimer = null
}

function onMouseEnter() {
  if (isTouch.value)
    return
  showTooltip()
}

function onMouseLeave() {
  if (isTouch.value)
    return
  hideTooltip()
}

function onTouchStart() {
  if (!isTouch.value)
    return
  showTooltip()
  clearTimeout(dismissTimer!)
  dismissTimer = setTimeout(hideTooltip, 3000)
}

function onEscape() {
  hideTooltip()
}

onUnmounted(() => {
  clearTimeout(dismissTimer!)
})
</script>

<template>
  <span
    ref="wrapperRef"
    class="tooltip-wrapper"
    :aria-describedby="tooltipId"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
    @touchstart.passive="onTouchStart"
    @keydown.escape="onEscape"
  >
    <slot />
  </span>
  <Teleport to="body">
    <span
      :id="tooltipId"
      class="tooltip-bubble"
      :class="{ 'tooltip-bubble--visible': visible }"
      :style="posStyle"
      role="tooltip"
    >{{ props.text }}</span>
  </Teleport>
</template>

<style>
.tooltip-bubble {
  position: fixed;
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
  z-index: 9999;

  opacity: 0;
  visibility: hidden;
  transition: opacity 0.15s ease;
}

.tooltip-bubble--visible {
  opacity: 1;
  visibility: visible;
}
</style>

<style scoped>
.tooltip-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
</style>
