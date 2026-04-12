<script setup lang="ts">
import type { Contact } from '@/features/contacts/domain/entities/contact'
import { computed } from 'vue'
import { getPrimaryPhone, resolveContactName } from '@/features/contacts/domain/entities/contact'
import { usePhoneActions } from '@/features/contacts/presentation/composables/use-phone-actions'

const props = withDefaults(
  defineProps<{
    contact: Contact
    selected: boolean
    showActions?: boolean
  }>(),
  {
    showActions: false,
  },
)

const emit = defineEmits<{ toggle: [contactId: string] }>()

const primaryPhone = computed(() => getPrimaryPhone(props.contact))
const { telLink, whatsAppLink } = usePhoneActions(primaryPhone)
</script>

<template>
  <div class="chip-wrapper">
    <button
      class="chip"
      :class="{ selected: props.selected }"
      type="button"
      @click="emit('toggle', props.contact.id)"
    >
      <span v-if="props.selected" class="check-icon material-symbols-outlined">check</span>
      {{ resolveContactName(props.contact) }}
    </button>
    <template v-if="props.showActions && primaryPhone">
      <a v-if="telLink" :href="telLink" class="action-icon" title="Call" @click.stop>
        <span class="material-symbols-outlined">call</span>
      </a>
      <a
        v-if="whatsAppLink"
        :href="whatsAppLink"
        class="action-icon"
        title="WhatsApp"
        target="_blank"
        rel="noopener noreferrer"
        @click.stop
      >
        <span class="material-symbols-outlined">chat</span>
      </a>
    </template>
  </div>
</template>

<style scoped>
.chip-wrapper {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: 9999px;
  border: 1.5px solid var(--color-outline-variant);
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
  background-color: rgba(71, 85, 105, 0.1);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.check-icon {
  font-size: 16px;
  line-height: 1;
}

.action-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-on-surface-variant);
  border-radius: 50%;
  padding: 2px;
  transition:
    color 0.15s,
    background-color 0.15s;
}

.action-icon:hover {
  color: var(--color-primary);
  background-color: var(--color-surface-variant);
}

.action-icon .material-symbols-outlined {
  font-size: 18px;
}
</style>
