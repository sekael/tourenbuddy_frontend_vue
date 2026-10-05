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
  padding: var(--chip-padding);
  border-radius: var(--chip-radius);
  border: 1.5px solid var(--color-outline-variant);
  background-color: transparent;
  color: var(--chip-color);
  font-size: var(--chip-font-size);
  font-weight: var(--font-weight-medium);
  min-height: var(--chip-min-height);
  transition: all var(--motion-duration-short) var(--motion-ease-standard);
  cursor: pointer;
}

.chip:hover {
  background-color: var(--color-surface-variant);
}

.chip.selected {
  background-color: var(--chip-selected-bg);
  border-color: var(--chip-selected-border-color);
  color: var(--chip-selected-color);
}

.check-icon {
  font-size: 16px;
  line-height: 1;
}
</style>
