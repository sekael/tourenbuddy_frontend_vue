<script setup lang="ts">
import type { Tour } from '@/features/tours/domain/entities/tour'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import BottomSheet from '@/core/components/bottom-sheet.vue'
import SideDrawer from '@/core/components/side-drawer.vue'
import { useIsDesktop } from '@/core/composables/use-is-desktop'
import { resolveContactName } from '@/features/contacts/domain/entities/contact'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'

const props = defineProps<{ tour: Tour }>()
const emit = defineEmits<{ close: [] }>()

const contactsStore = useContactsStore()
const { contacts } = storeToRefs(contactsStore)
const isDesktop = useIsDesktop()

const displayName = computed(() => props.tour.name ?? 'Unnamed tour')

const formattedDate = computed(() => {
  if (!props.tour.plannedDate) return null
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(props.tour.plannedDate)
})

const partners = computed(() => contacts.value.filter((c) => props.tour.partnerIds.includes(c.id)))

const coordinates = computed(
  () => `${props.tour.goal.lat.toFixed(4)}°N, ${props.tour.goal.lng.toFixed(4)}°E`,
)
</script>

<template>
  <component :is="isDesktop ? SideDrawer : BottomSheet" :title="displayName" @close="emit('close')">
    <div class="details">
      <div v-if="formattedDate" class="detail-row">
        <span class="detail-icon material-symbols-outlined">calendar_today</span>
        <span>{{ formattedDate }}</span>
      </div>

      <div class="detail-row">
        <span class="detail-icon material-symbols-outlined">location_on</span>
        <span class="coords">{{ coordinates }}</span>
      </div>

      <div v-if="partners.length > 0" class="detail-row partners-row">
        <span class="detail-icon material-symbols-outlined">group</span>
        <div class="partner-chips">
          <span v-for="partner in partners" :key="partner.id" class="partner-chip">
            {{ resolveContactName(partner) }}
          </span>
        </div>
      </div>
    </div>
  </component>
</template>

<style scoped>
.details {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.detail-row {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
  color: var(--color-on-surface-variant);
  font-size: var(--font-size-base);
}

.detail-icon {
  flex-shrink: 0;
  font-size: 20px;
  color: var(--color-outline);
}

.coords {
  font-family: monospace;
  font-size: var(--font-size-sm);
}

.partners-row {
  align-items: flex-start;
}

.partner-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.partner-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px var(--spacing-sm);
  border-radius: var(--radius-lg);
  background-color: var(--color-surface-variant);
  color: var(--color-on-surface-variant);
  font-size: var(--font-size-sm);
}
</style>
