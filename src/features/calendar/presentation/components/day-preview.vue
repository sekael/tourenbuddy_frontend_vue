<script setup lang="ts">
import type { Tour } from '@/features/tours/domain/entities/tour'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseIcon from '@/core/components/base-icon.vue'
import { TOUR_TYPE_COLORS, TOUR_TYPE_ICONS } from '@/features/tours/data/models/tour-type'

interface DayEntry { tour: Tour, isFriend: boolean }
interface FriendPreview { userId: string, name: string }

const props = defineProps<{ entries: DayEntry[], friends: FriendPreview[] }>()

const { t } = useI18n({ useScope: 'global' })

// Per kind: exactly one → show the item itself; more than one → a single generic
// count chip. Keeps a cell to at most two short rows, so it never overflows.
const soleTour = computed(() => (props.entries.length === 1 ? props.entries[0]!.tour : null))
const soleFriend = computed(() => (props.friends.length === 1 ? props.friends[0]! : null))
</script>

<template>
  <span
    v-if="soleTour"
    class="pill"
    :style="soleTour.tourType ? { backgroundColor: TOUR_TYPE_COLORS[soleTour.tourType] } : undefined"
  >
    <BaseIcon v-if="soleTour.tourType" :name="TOUR_TYPE_ICONS[soleTour.tourType]" size="xs" />
    <span class="chip-name">{{ soleTour.name ?? t('tours.infoSheet.unnamedTour') }}</span>
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

.chip-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
