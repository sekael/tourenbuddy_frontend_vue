<script setup lang="ts">
const props = defineProps<{
  message: string
  visible: boolean
}>()

const emit = defineEmits<{ dismiss: [] }>()
</script>

<template>
  <Transition name="snackbar">
    <div v-if="props.visible" class="snackbar error" role="alert">
      <span class="message">{{ props.message }}</span>
      <button class="dismiss-btn" @click="emit('dismiss')">
        <span class="material-symbols-outlined">close</span>
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.snackbar {
  position: fixed;
  bottom: var(--spacing-xl);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-sm);
  max-width: 90vw;
  z-index: 200;
  box-shadow: var(--shadow-lg);
}

.error {
  background-color: var(--color-error);
  color: var(--color-on-error);
}

.message {
  font-size: var(--font-size-sm);
  flex: 1;
}

.dismiss-btn {
  color: inherit;
  font-size: var(--font-size-sm);
  opacity: 0.8;
}

.dismiss-btn:hover {
  opacity: 1;
}

.snackbar-enter-active,
.snackbar-leave-active {
  transition:
    opacity 0.2s,
    transform 0.2s;
}

.snackbar-enter-from,
.snackbar-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}
</style>
