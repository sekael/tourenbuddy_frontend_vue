<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import BaseIconButton from './base-icon-button.vue'

const props = defineProps<{
  title?: string
  ariaLabel?: string
  /** Collapse to a header-only card; suppress backdrop-click dismissal and hide close button. */
  collapsed?: boolean
  showBack?: boolean
}>()

const emit = defineEmits<{ close: [], back: [] }>()

const titleId = 'dialog-window-title'

function handleBackdropClick() {
  if (props.collapsed)
    return
  emit('close')
}

// The dialog is always as tall as its content. The body keeps its natural height
// (it never stretches), so measuring it as it changes — views swapping, tabs,
// data loading — gives the height the scroll box should have; the box glides to
// it in both directions. The card's max-height caps it and the content scrolls
// beyond. The first size lands without a glide.
const bodyRef = ref<HTMLElement | null>(null)
const bodyHeight = ref<number | null>(null)
const glide = ref(false)
let observer: ResizeObserver | undefined

onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    bodyHeight.value = Math.ceil(entry!.borderBoxSize?.[0]?.blockSize ?? (entry!.target as HTMLElement).offsetHeight)
  })
  observer.observe(bodyRef.value!)
  requestAnimationFrame(() => requestAnimationFrame(() => (glide.value = true)))
})

onBeforeUnmount(() => observer?.disconnect())

const contentStyle = computed(() => bodyHeight.value === null || props.collapsed
  ? undefined
  : { height: `${bodyHeight.value}px` })
</script>

<template>
  <div
    class="dialog-backdrop"
    :class="{ 'dialog-backdrop--collapsed': props.collapsed }"
    @click.self="handleBackdropClick"
  >
    <div
      class="dialog-card"
      :class="{ 'dialog-card--collapsed': props.collapsed }"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="props.title ? titleId : undefined"
      :aria-label="!props.title ? (props.ariaLabel ?? 'Dialog') : undefined"
    >
      <div class="dialog-header">
        <BaseIconButton
          v-if="props.showBack && !props.collapsed"
          name="arrow_back"
          variant="tonal"
          size="sm"
          label="Back"
          @click="emit('back')"
        />
        <h2 v-if="props.title" :id="titleId" class="dialog-title">
          {{ props.title }}
        </h2>
        <div v-else class="title-spacer" />
        <slot name="header-actions" />
        <BaseIconButton
          v-if="!props.collapsed"
          name="close"
          variant="tonal"
          size="sm"
          label="Close"
          @click="emit('close')"
        />
      </div>
      <div
        class="dialog-content"
        :class="{ 'dialog-content--glide': glide }"
        :style="contentStyle"
        :inert="props.collapsed || undefined"
        :aria-hidden="props.collapsed || undefined"
      >
        <div ref="bodyRef" class="dialog-body">
          <slot />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Dialogs hang from a fixed top line rather than centring: when the content
   changes height only the bottom edge moves, so the header (title, back, close)
   never shifts under the pointer. The same inset is kept below, so a dialog that
   reaches its full height sits balanced on the screen. */
.dialog-backdrop {
  --dialog-inset: clamp(var(--spacing-xl), 12dvh, 7rem);

  position: fixed;
  inset: 0;
  background: var(--color-backdrop);
  backdrop-filter: blur(var(--overlay-backdrop-blur));
  -webkit-backdrop-filter: blur(var(--overlay-backdrop-blur));
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: var(--dialog-inset) var(--spacing-xl);
  z-index: 50;
  transition:
    background var(--motion-duration-medium) var(--motion-ease-emphasized),
    backdrop-filter var(--motion-duration-medium) var(--motion-ease-emphasized),
    padding var(--motion-duration-medium) var(--motion-ease-emphasized);
}

/* When picking a location: remove backdrop, pin the card to the top edge */
.dialog-backdrop--collapsed {
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  pointer-events: none;
  padding-top: 0;
}

.dialog-card {
  background-color: var(--color-background);
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 560px;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
  transform-origin: top center;
  animation: dialog-enter var(--motion-duration-medium) var(--motion-ease-emphasized) both;
  pointer-events: auto;
  overflow: hidden;
  transition:
    max-height var(--motion-duration-medium) var(--motion-ease-emphasized),
    border-radius var(--motion-duration-medium) var(--motion-ease-emphasized);
}

@keyframes dialog-enter {
  from {
    opacity: 0;
    transform: translateY(calc(-1 * var(--motion-offset))) scale(0.98);
  }
}

/* Collapsed: header-only bar anchored to top-center, matching side-drawer--collapsed.
   animation-name intentionally NOT overridden here — same pattern as side-drawer.vue —
   so toggling collapsed off does not restart dialog-enter. */
.dialog-card--collapsed {
  max-width: 400px;
  max-height: 4.5rem;
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
  pointer-events: auto;
}

.dialog-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-shrink: 0;
  padding: var(--spacing-lg) var(--spacing-xl) var(--spacing-md);
}

.dialog-title {
  font-size: var(--overlay-title-size);
  font-weight: var(--font-weight-semibold);
  flex: 1;
  letter-spacing: var(--overlay-title-tracking);
}

.title-spacer {
  flex: 1;
}

/* Scroll box: its height follows the body (inline style); it may shrink below
   that when the card hits its max-height, and then scrolls. */
.dialog-content {
  flex: 0 1 auto;
  min-height: 0;
  overflow-y: auto;
  /* Explicit: an unset overflow-x computes to `auto` alongside overflow-y here
     (CSS Overflow spec), which would silently open a horizontal scrollbar the
     moment any row's content is a pixel too wide. Dialogs scroll vertically only. */
  overflow-x: hidden;
  /* Overscroll stops here — never chains to the page behind the dialog. */
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: var(--color-outline-variant) transparent;
  opacity: 1;
  transition: opacity var(--motion-duration-short) var(--motion-ease-standard);
}

.dialog-content--glide {
  transition:
    opacity var(--motion-duration-short) var(--motion-ease-standard),
    height var(--motion-duration-medium) var(--motion-ease-emphasized);
}

.dialog-content::-webkit-scrollbar {
  width: 5px;
}

.dialog-content::-webkit-scrollbar-thumb {
  background-color: var(--color-outline-variant);
  border-radius: var(--radius-pill);
}

/* Natural height, never stretched — the measure the scroll box follows */
.dialog-body {
  display: flex;
  flex-direction: column;
  padding: var(--spacing-md) var(--spacing-lg) var(--spacing-xl);
}

.dialog-card--collapsed .dialog-content {
  opacity: 0;
  flex: 0;
  overflow: hidden;
  pointer-events: none;
}
</style>
