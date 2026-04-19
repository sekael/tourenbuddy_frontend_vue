<script setup lang="ts">
import type { Tour } from '@/features/tours/domain/entities/tour'
import { computed } from 'vue'
import { resolveContactName } from '@/features/contacts/domain/entities/contact'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'

const props = defineProps<{ tour: Tour }>()
const emit = defineEmits<{ click: [] }>()

const contactsStore = useContactsStore()

const displayName = computed(() => props.tour.name ?? 'Unnamed tour')

const initial = computed(() => props.tour.name?.[0]?.toUpperCase() ?? '?')

const partnerSubtitle = computed(() => {
  if (!props.tour.partnerIds.length)
    return null
  return (
    props.tour.partnerIds
      .map((id) => {
        const contact = contactsStore.contacts.find(c => c.id === id)
        return contact ? resolveContactName(contact) : null
      })
      .filter(Boolean)
      .join(', ') || null
  )
})
</script>

<template>
  <li class="tour-row" @click="emit('click')">
    <div class="tour-avatar">
      {{ initial }}
    </div>
    <div class="tour-info">
      <span class="tour-name">{{ displayName }}</span>
      <span v-if="partnerSubtitle" class="tour-subtitle">{{ partnerSubtitle }}</span>
    </div>
    <span class="material-symbols-outlined row-arrow">chevron_right</span>
  </li>
</template>

<style scoped>
.tour-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color 0.15s;
}

.tour-row:hover {
  background-color: var(--color-surface-variant);
}

.tour-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: color-mix(in srgb, var(--color-primary) 16%, transparent);
  color: var(--color-primary);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.tour-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.tour-name {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-on-surface);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tour-subtitle {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-arrow {
  font-size: 20px;
  color: var(--color-outline-variant);
  flex-shrink: 0;
}
</style>
