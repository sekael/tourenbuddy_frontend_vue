<script setup lang="ts">
import type { Contact } from '@/features/contacts/domain/entities/contact'
import BaseIcon from '@/core/components/base-icon.vue'
import { resolveContactName } from '@/features/contacts/domain/entities/contact'

const props = withDefaults(
  defineProps<{
    contact: Contact
    selected: boolean
    mode?: 'select' | 'action'
  }>(),
  {
    mode: 'select',
  },
)

const emit = defineEmits<{
  toggle: [contactId: string]
  open: [contactId: string, rect: DOMRect]
}>()

function handleClick(event: MouseEvent) {
  if (props.mode === 'action') {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    emit('open', props.contact.id, rect)
  }
  else {
    emit('toggle', props.contact.id)
  }
}
</script>

<template>
  <button
    class="chip"
    :class="{ selected: props.selected }"
    type="button"
    @click="handleClick($event)"
  >
    <BaseIcon
      v-if="props.selected && props.mode === 'select'"
      name="check"
      class="check-icon"
    />
    {{ resolveContactName(props.contact) }}
  </button>
</template>

<style scoped>
.chip {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-pill);
  border: 1.5px solid var(--color-outline-variant);
  background-color: transparent;
  color: var(--color-on-surface);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  min-height: 44px;
  transition: all 0.15s;
  cursor: pointer;
}

.chip:hover {
  background-color: var(--color-surface-variant);
}

.chip.selected {
  background-color: color-mix(in srgb, var(--color-primary) 10%, transparent);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.check-icon {
  font-size: 16px;
  line-height: 1;
}
</style>
