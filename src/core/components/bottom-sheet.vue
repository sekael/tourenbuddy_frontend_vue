<script setup lang="ts">
const props = defineProps<{
  title?: string
  ariaLabel?: string
  /** Collapse to just the header (drag handle + title). Content slot is not rendered. */
  collapsed?: boolean
}>()

const emit = defineEmits<{ close: [] }>()

const titleId = 'bottom-sheet-title'
</script>

<template>
  <div
    class="bottom-sheet"
    role="dialog"
    aria-modal="true"
    :aria-labelledby="props.title ? titleId : undefined"
    :aria-label="!props.title ? (props.ariaLabel ?? 'Bottom sheet') : undefined"
  >
    <div class="drag-handle" aria-hidden="true" />

    <div class="header">
      <h2 v-if="props.title" :id="titleId" class="title">
        {{ props.title }}
      </h2>
      <div v-else class="title-spacer" />
      <button type="button" class="close-btn" aria-label="Close" @click="emit('close')">
        <span class="material-symbols-outlined" aria-hidden="true">close</span>
      </button>
    </div>

    <div v-if="!props.collapsed" class="content">
      <slot />
    </div>

    <div v-if="$slots.footer && !props.collapsed" class="footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<style scoped>
.bottom-sheet {
  width: 100%;
  max-width: var(--bottom-sheet-max-width, 480px);
  max-height: 60vh;
  display: flex;
  flex-direction: column;
  background-color: var(--color-background);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  border: 1px solid var(--color-outline-variant);
  border-bottom: none;
  box-shadow: var(--shadow-lg);
  padding: var(--spacing-sm) var(--spacing-xl) 0;
  /* Restore pointer events — parent sheet-container sets pointer-events: none
     to allow FAB clicks through transparent areas */
  pointer-events: auto;
}

.drag-handle {
  width: 36px;
  height: 4px;
  background-color: var(--color-outline-variant);
  border-radius: 9999px;
  align-self: center;
  margin-bottom: var(--spacing-xs);
  flex-shrink: 0;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  padding-bottom: var(--spacing-md);
}

.title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
}

.title-spacer {
  flex: 1;
}

.close-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-on-surface-variant);
  flex-shrink: 0;
  transition: background-color 0.15s;
}

.close-btn:hover {
  background-color: var(--color-surface-variant);
}

.content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-bottom: var(--spacing-md);
}

.footer {
  flex-shrink: 0;
  border-top: 1px solid var(--color-outline-variant);
  padding: var(--spacing-sm) 0 var(--spacing-xl);
}
</style>
