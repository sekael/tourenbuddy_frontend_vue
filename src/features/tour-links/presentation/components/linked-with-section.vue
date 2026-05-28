<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AdaptiveOverlay from '@/core/components/adaptive-overlay.vue'
import { useToursStore } from '@/features/tours/presentation/stores/tours-store'

const props = defineProps<{
  /** Tour ids of the group siblings (excluding the current tour). */
  siblings: string[]
}>()
const emit = defineEmits<{
  /** Navigate to a sibling tour. */
  openTour: [tourId: string]
}>()

const { t } = useI18n({ useScope: 'global' })

const toursStore = useToursStore()
const { tours, friendTours } = storeToRefs(toursStore)

const overflowOpen = ref(false)

function tourName(id: string): string {
  const t1 = tours.value.find(t => t.id === id)
  const t2 = friendTours.value.find(t => t.id === id)
  return t1?.name ?? t2?.name ?? t('tours.infoSheet.unnamedTour')
}

function partnerName(id: string): string {
  const t2 = friendTours.value.find(t => t.id === id)
  if (!t2)
    return tourName(id)
  // For a friend's tour, use the friend's name from partnerNames (their userId).
  const friend = (t2.partnerNames ?? []).find(p => p.userId === t2.userId)
  if (friend) {
    const fullName = [friend.firstName, friend.lastName].filter(Boolean).join(' ')
    return fullName || tourName(id)
  }
  return tourName(id)
}

const inlineIds = computed(() => props.siblings.slice(0, 2))
const overflowIds = computed(() => props.siblings.slice(2))
const overflowCount = computed(() => overflowIds.value.length)

function handlePillClick(id: string) {
  emit('openTour', id)
}

function handleOverflowSelect(id: string) {
  overflowOpen.value = false
  emit('openTour', id)
}
</script>

<template>
  <section v-if="props.siblings.length > 0" class="linked-with-section">
    <h4 class="section-title">
      {{ t('tourLinks.linkedWithHeader') }}
    </h4>
    <div class="pills-row">
      <button
        v-for="id in inlineIds"
        :key="id"
        type="button"
        class="pill"
        @click="handlePillClick(id)"
      >
        {{ partnerName(id) }}
      </button>
      <button
        v-if="overflowCount > 0"
        type="button"
        class="pill pill--more"
        @click="overflowOpen = true"
      >
        {{ t('tourLinks.moreLinked', { count: overflowCount }) }}
      </button>
    </div>

    <AdaptiveOverlay v-if="overflowOpen" :title="t('tourLinks.linkedWithHeader')" @close="overflowOpen = false">
      <ul class="overflow-list">
        <li v-for="id in overflowIds" :key="id">
          <button type="button" class="overflow-row" @click="handleOverflowSelect(id)">
            <span class="overflow-name">{{ partnerName(id) }}</span>
            <span class="overflow-tour">{{ tourName(id) }}</span>
          </button>
        </li>
      </ul>
    </AdaptiveOverlay>
  </section>
</template>

<style scoped>
.linked-with-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.section-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-on-surface-variant);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0;
}

.pills-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.pill {
  padding: var(--spacing-xxs) var(--spacing-sm);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-outline-variant);
  background: var(--color-surface-variant);
  color: var(--color-on-surface);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: background 0.15s;
}

.pill:hover {
  background: var(--color-surface);
}

.pill--more {
  font-weight: var(--font-weight-medium);
}

.overflow-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.overflow-row {
  display: flex;
  justify-content: space-between;
  width: 100%;
  padding: var(--spacing-sm);
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.overflow-row:hover {
  background: var(--color-surface-variant);
}

.overflow-name {
  font-weight: var(--font-weight-medium);
}

.overflow-tour {
  color: var(--color-on-surface-variant);
  font-size: var(--font-size-sm);
}
</style>
