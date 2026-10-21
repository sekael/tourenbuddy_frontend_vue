<script setup lang="ts">
import type { Tour } from '@/features/tours/domain/entities/tour'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseIcon from '@/core/components/base-icon.vue'
import { useFormatter } from '@/core/composables/use-formatter'
import { useFriendDisplayName } from '@/features/friendships/presentation/composables/use-friend-display-name'
import { cssFill, distinctTypeColors, TOUR_TYPE_COLORS } from '@/features/tours/data/models/tour-type'
import { outingDisplayName, outingSpan } from '@/features/tours/domain/outing'

/** One tour-list row standing for a whole outing (#338, design D18). */
const props = defineProps<{ segments: Tour[] }>()
const emit = defineEmits<{ click: [] }>()

const { t } = useI18n({ useScope: 'global' })
const { formatDateRange } = useFormatter()

const first = computed(() => props.segments[0]!)
const name = computed(() => outingDisplayName(props.segments) ?? t('tours.infoSheet.unnamedTour'))

// The segments' colours split like a multi-activity marker; one colour tints like a tour row.
const colors = computed(() => distinctTypeColors(props.segments.flatMap(s => s.tourTypes), TOUR_TYPE_COLORS))
const avatarStyle = computed(() => colors.value.length > 1
  ? { background: cssFill(colors.value), color: 'var(--color-on-primary)' }
  : colors.value.length === 1 ? { '--avatar-tint': colors.value[0] } : undefined)

const { displayName: ownerName, isResolved: ownerResolved } = useFriendDisplayName(
  () => (first.value.isFriendTour ? first.value.userId : null),
)

const subtitle = computed(() => {
  const span = outingSpan(props.segments)
  return [
    first.value.isFriendTour && ownerName.value ? t('tours.list.ownedByLabel', { name: ownerName.value }) : null,
    t('tours.outing.segmentCount', { count: props.segments.length }),
    span ? formatDateRange.value(span.start, span.end, { day: 'numeric', month: 'short' }) : null,
  ].filter(Boolean).join(' · ')
})
</script>

<template>
  <li class="tour-row" data-testid="outing-row" @click="emit('click')">
    <div class="tour-avatar" :style="avatarStyle">
      <BaseIcon name="timeline" />
      <BaseIcon v-if="first.isFriendTour" name="group" class="friend-badge" />
    </div>
    <div class="tour-info">
      <span class="tour-name">{{ name }}</span>
      <!-- A friend's outing names its owner in the accent colour, like a friend's tour row. -->
      <span v-if="!first.isFriendTour || ownerResolved" :class="first.isFriendTour ? 'tour-owner' : 'tour-subtitle'">{{ subtitle }}</span>
      <span v-else class="tour-owner-skeleton" aria-hidden="true" />
    </div>
    <BaseIcon name="chevron_right" class="row-arrow" />
  </li>
</template>

<style scoped>
/* Same row anatomy as TourListRow, so the two read as one list. */
.tour-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color var(--motion-duration-short) var(--motion-ease-standard);
}

@media (hover: hover) {
  .tour-row:hover {
    background-color: var(--color-surface-variant);
  }
}

.tour-row:active {
  background-color: var(--color-surface-variant);
}

.tour-avatar {
  --avatar-tint: var(--color-primary);

  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: color-mix(in srgb, var(--avatar-tint) 16%, transparent);
  color: var(--avatar-tint);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.friend-badge {
  position: absolute;
  right: -2px;
  bottom: -2px;
  font-size: 14px;
  padding: 2px;
  border-radius: 50%;
  background-color: var(--color-surface);
  color: var(--color-on-surface-variant);
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

.tour-subtitle,
.tour-owner {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tour-owner {
  color: var(--color-primary);
}

.tour-owner-skeleton {
  font-size: var(--font-size-sm);
  min-height: 1em;
  width: 7ch;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, currentcolor 10%, transparent);
}

.row-arrow {
  color: var(--color-outline-variant);
  flex-shrink: 0;
}
</style>
