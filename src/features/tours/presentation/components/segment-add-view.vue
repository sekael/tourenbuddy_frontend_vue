<script setup lang="ts">
import type { Tour } from '@/features/tours/domain/entities/tour'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseIcon from '@/core/components/base-icon.vue'
import { useLogger } from '@/core/logging/use-logger'
import { outingKey, outingSegments } from '@/features/tours/domain/outing'
import TourListRow from '@/features/tours/presentation/components/tour-list-row.vue'
import { useToursStore } from '@/features/tours/presentation/stores/tours-store'

/**
 * "Add a segment" after `anchor` (#338, design D17): a new goal on the map, or one of the
 * owner's standalone tours. Rendered in place of a sheet's body, under the rule that decides
 * it — one day is one tour, a night starts the next segment (smarter-tour-creation D8).
 */
const props = defineProps<{ anchor: Tour }>()
const emit = defineEmits<{
  /** Pick a new goal on the map; the host seeds the creation form. */
  pickNew: []
  /** An existing tour joined; carries the outing's key. */
  added: [outingKey: string]
}>()

const { t } = useI18n({ useScope: 'global' })
const log = useLogger('segment-add-view')
const toursStore = useToursStore()
const { tours } = storeToRefs(toursStore)

/** Own tours in no outing yet, dated ones first. */
const candidates = computed(() =>
  tours.value
    .filter(tour => tour.id !== props.anchor.id && outingSegments(tours.value, outingKey(tour)).length === 0)
    .sort((a, b) => (a.plannedDate?.getTime() ?? Infinity) - (b.plannedDate?.getTime() ?? Infinity)),
)

const busy = ref(false)
const error = ref<string | null>(null)

async function addExisting(tourId: string) {
  if (busy.value)
    return
  busy.value = true
  error.value = null
  try {
    await toursStore.addToOuting(props.anchor.id, tourId)
    const anchor = tours.value.find(tour => tour.id === props.anchor.id)
    const key = anchor && outingKey(anchor)
    if (key)
      emit('added', key)
  }
  catch (err) {
    log.error('Adding a segment failed', err)
    error.value = t('tours.outing.saveFailed')
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="add-view">
    <p class="rule" data-testid="segment-rule">
      <BaseIcon name="info" size="sm" class="rule-icon" />
      {{ t('tours.outing.ruleHint') }}
    </p>
    <button type="button" class="new-segment" data-testid="add-segment-new" @click="emit('pickNew')">
      <span class="new-icon"><BaseIcon name="add_location_alt" /></span>
      <span class="new-text">
        <span class="new-title">{{ t('tours.outing.addNew') }}</span>
        <span class="new-hint">{{ t('tours.outing.addNewHint') }}</span>
      </span>
    </button>

    <p v-if="error" class="error">
      {{ error }}
    </p>

    <h4 class="section-title">
      {{ t('tours.outing.addExistingHeader') }}
    </h4>
    <ul v-if="candidates.length > 0" class="candidates" :class="{ 'candidates--busy': busy }">
      <TourListRow v-for="tour in candidates" :key="tour.id" :tour="tour" @click="addExisting(tour.id)" />
    </ul>
    <p v-else class="empty">
      {{ t('tours.outing.addExistingEmpty') }}
    </p>
  </div>
</template>

<style scoped>
.add-view {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.new-segment {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border: 1px dashed var(--color-outline-variant);
  border-radius: var(--radius-md);
  background: transparent;
  text-align: left;
  cursor: pointer;
}

@media (hover: hover) {
  .new-segment:hover {
    background-color: var(--color-surface-variant);
  }
}

.new-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-pill);
  background-color: var(--color-primary);
  color: var(--color-on-primary);
}

.new-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.new-title {
  font-weight: var(--font-weight-medium);
  color: var(--color-on-surface);
}

.rule {
  display: flex;
  gap: var(--spacing-xs);
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}

.rule-icon {
  flex-shrink: 0;
  margin-top: 1px;
}

.new-hint,
.empty {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}

.section-title {
  margin: 0;
  font-size: var(--heading-section-size);
  font-weight: var(--heading-section-weight);
  color: var(--heading-section-color);
  letter-spacing: var(--heading-section-tracking);
}

.candidates {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.candidates--busy {
  opacity: 0.6;
  pointer-events: none;
}

.error {
  font-size: var(--font-size-sm);
  color: var(--color-error);
}
</style>
