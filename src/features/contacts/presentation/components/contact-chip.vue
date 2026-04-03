<script setup lang="ts">
import type { Contact } from '@/features/contacts/domain/entities/contact'
import { resolveContactName } from '@/features/contacts/domain/entities/contact'

const props = defineProps<{
  contact: Contact
  selected: boolean
}>()

const emit = defineEmits<{ toggle: [contactId: string] }>()
</script>

<template>
  <button
    class="chip"
    :class="{ selected: props.selected }"
    type="button"
    @click="emit('toggle', props.contact.id)"
  >
    <span v-if="props.selected" class="check-icon">✓</span>
    {{ resolveContactName(props.contact) }}
  </button>
</template>

<style scoped>
.chip {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-lg);
  border: 1.5px solid var(--color-outline);
  background-color: transparent;
  color: var(--color-on-surface);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  transition: all 0.15s;
  cursor: pointer;
}

.chip:hover {
  background-color: var(--color-surface-variant);
}

.chip.selected {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-on-primary);
}

.check-icon {
  font-size: var(--font-size-xs);
}
</style>
