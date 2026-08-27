<script setup lang="ts">
import type { DayEntry } from '@/features/calendar/domain/calendar-dates'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseIcon from '@/core/components/base-icon.vue'
import { TOUR_TYPE_COLORS, TOUR_TYPE_ICONS } from '@/features/tours/data/models/tour-type'

interface FriendPreview { userId: string, name: string }

const props = defineProps<{ entries: DayEntry[], friends: FriendPreview[] }>()

const { t } = useI18n({ useScope: 'global' })

// Per kind: exactly one → show the item itself; more than one → a single generic
// count chip. Keeps a cell to at most two short rows, so it never overflows.
// The entry, not just its tour: the sole pill also carries the span day counter, so it
// needs `dayIndex` / `dayCount`.
const soleEntry = computed(() => (props.entries.length === 1 ? props.entries[0]! : null))
const soleFriend = computed(() => (props.friends.length === 1 ? props.friends[0]! : null))
</script>

<template>
  <span
    v-if="soleEntry"
    class="pill"
    :style="
      soleEntry.tour.tourType
        ? { backgroundColor: TOUR_TYPE_COLORS[soleEntry.tour.tourType] }
        : undefined
    "
  >
    <BaseIcon
      v-if="soleEntry.tour.tourType"
      :name="TOUR_TYPE_ICONS[soleEntry.tour.tourType]"
      size="xs"
    />
    <span class="chip-name">{{ soleEntry.tour.name ?? t('tours.infoSheet.unnamedTour') }}</span>
    <!-- Without this the grid shows one tour on N cells with nothing marking it as one
         tour — the legibility problem the counter exists to solve. -->
    <span
      v-if="soleEntry.dayCount > 1"
      class="day-counter"
      role="img"
      :aria-label="
        t('calendar.planned.dayCounterLabel', {
          day: soleEntry.dayIndex,
          total: soleEntry.dayCount,
        })
      "
    >
      {{ t('calendar.planned.dayCounter', { day: soleEntry.dayIndex, total: soleEntry.dayCount }) }}
    </span>
  </span>
  <span v-else-if="entries.length > 1" class="count-chip">
    {{ t('calendar.planned.tourCount', { count: entries.length }) }}
  </span>

  <span v-if="soleFriend" class="friend-chip">
    <span class="chip-name">{{ soleFriend.name }}</span>
  </span>
  <span v-else-if="friends.length > 1" class="count-chip">
    {{ t('calendar.planned.friendCount', { count: friends.length }) }}
  </span>
</template>

<style scoped>
.pill,
.friend-chip,
.count-chip {
  display: flex;
  align-items: center;
  gap: var(--spacing-xxs);
  padding: 2px var(--spacing-xs);
  border-radius: var(--radius-pill);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  min-width: 0;
  max-width: 100%;
}

/* Tour: primary-filled with its type color. Friend: neutral outlined. Count:
   dashed generic. */
.pill {
  background-color: var(--color-primary);
  color: var(--color-on-primary);
}

.friend-chip {
  background-color: var(--color-surface-variant);
  color: var(--color-on-surface);
  border: 1px solid var(--color-outline-variant);
}

.count-chip {
  background-color: transparent;
  border: 1px dashed var(--color-outline-variant);
  color: var(--color-on-surface-variant);
}

/* Span position, e.g. `2/3`. Tabular so the fraction doesn't jitter cell to cell. */
.day-counter {
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  opacity: 0.75;
}

.chip-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
