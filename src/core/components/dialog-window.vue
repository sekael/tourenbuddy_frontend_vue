<script setup lang="ts">
const props = defineProps<{
  title?: string
  ariaLabel?: string
}>()

const emit = defineEmits<{ close: [] }>()

const titleId = 'dialog-window-title'
</script>

<template>
  <div class="dialog-backdrop" @click.self="emit('close')">
    <div
      class="dialog-card"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="props.title ? titleId : undefined"
      :aria-label="!props.title ? (props.ariaLabel ?? 'Dialog') : undefined"
    >
      <div class="dialog-header">
        <h2 v-if="props.title" :id="titleId" class="dialog-title">
          {{ props.title }}
        </h2>
        <div v-else class="title-spacer" />
        <button type="button" class="close-btn" aria-label="Close" @click="emit('close')">
          <span class="material-symbols-outlined" aria-hidden="true">close</span>
        </button>
      </div>
      <div class="dialog-content">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}

.dialog-card {
  background-color: var(--color-background);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 560px;
  max-height: 90dvh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
  animation: dialog-enter 0.2s cubic-bezier(0.4, 0, 0.2, 1) both;
  pointer-events: auto;
  overflow: hidden;
}

@keyframes dialog-enter {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  padding: var(--spacing-xl) var(--spacing-xl) var(--spacing-md);
  border-bottom: 1px solid var(--color-outline-variant);
}

.dialog-title {
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

.dialog-content {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: var(--spacing-lg) var(--spacing-xl) var(--spacing-xl);
  flex: 1;
  min-height: 0;
  scrollbar-width: thin;
  scrollbar-color: var(--color-outline-variant) transparent;
}

.dialog-content::-webkit-scrollbar {
  width: 5px;
}

.dialog-content::-webkit-scrollbar-thumb {
  background-color: var(--color-outline-variant);
  border-radius: 9999px;
}
</style>
