<script setup lang="ts">
import type { NearbyStop } from '@/features/tours/data/services/swisstopo-stop-service'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseIcon from '@/core/components/base-icon.vue'
import { useFormatter } from '@/core/composables/use-formatter'
import { useLogger } from '@/core/logging/use-logger'
import { isOnline } from '@/core/offline/use-online-status'
import { findStopsNear } from '@/features/tours/data/services/swisstopo-stop-service'
import { isSameGoal } from '@/features/tours/domain/distance'
import { landsByAir } from '@/features/tours/domain/legs'
import { useToursStore } from '@/features/tours/presentation/stores/tours-store'

/**
 * One-tap start or end points near the goal (design D2 of smarter-tour-creation): where the
 * user's own earlier tour to this goal started (ended), then the nearest public-transport
 * stops — the trailheads. Shows nothing until something is known; a failed lookup shows none.
 */
const props = defineProps<{
  role: 'start' | 'end'
  /** The goal the suggestions sit around. */
  around: { lng: number, lat: number }
  /** A point not to suggest again (the start, when suggesting an end). */
  exclude?: { lng: number, lat: number } | null
  /** The tour being edited — its own points are no history. */
  tourId?: string
  /** The end is a landing: only earlier landings — the stops around a summit are no landing field. */
  landing?: boolean
}>()
const emit = defineEmits<{ pick: [pick: { location: { lng: number, lat: number }, name: string }] }>()

const MAX = 3
/** "Your earlier tour to this goal": goals this close are the same objective. */
const SAME_GOAL_M = 300
/** A suggestion this close to `exclude` is the same place. */
const SAME_PLACE_M = 100
/** A stop this close to the goal is no start: the tour would have no way up (an end there is the ride down). */
const AT_GOAL_M = 500

const { t } = useI18n({ useScope: 'global' })
const { formatDistance } = useFormatter()
const log = useLogger('point-suggestions')
const { tours } = storeToRefs(useToursStore())

interface Suggestion { kind: 'history' | 'stop', name: string, location: { lng: number, lat: number }, distance?: number }

const isExcluded = (p: { lng: number, lat: number }) => !!props.exclude && isSameGoal(p, props.exclude, SAME_PLACE_M)

const history = computed<Suggestion[]>(() => {
  const seen = new Set<string>()
  return tours.value
    .filter(tour => tour.id !== props.tourId && isSameGoal(tour.goal, props.around, SAME_GOAL_M) && (!props.landing || landsByAir(tour)))
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
    .flatMap((tour) => {
      const [point, name] = props.role === 'start'
        ? [tour.startPoint, tour.startPointName]
        : [tour.endPoint, tour.endPointName]
      if (!point || !name || seen.has(name) || isExcluded(point))
        return []
      seen.add(name)
      return [{ kind: 'history' as const, name, location: point }]
    })
    .slice(0, 1)
})

const stops = ref<NearbyStop[]>([])
let controller: AbortController | null = null
watch(
  () => [props.around.lng, props.around.lat, isOnline.value, props.landing] as const,
  async ([lng, lat, online, landing]) => {
    controller?.abort()
    stops.value = []
    if (!online || landing)
      return
    const own = (controller = new AbortController())
    try {
      const found = await findStopsNear({ lng, lat }, own.signal)
      if (controller === own)
        stops.value = found
    }
    catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError'))
        log.warn('Stop suggestions unavailable', err)
    }
  },
  { immediate: true },
)

const suggestions = computed<Suggestion[]>(() => {
  const names = new Set(history.value.map(s => s.name))
  const near = stops.value
    .filter(stop => !names.has(stop.name) && !isExcluded(stop) && (props.role === 'end' || stop.distance >= AT_GOAL_M))
    .map(stop => ({ kind: 'stop' as const, name: stop.name, location: { lng: stop.lng, lat: stop.lat }, distance: stop.distance }))
  return [...history.value, ...near].slice(0, MAX)
})
</script>

<template>
  <div v-if="suggestions.length > 0" class="suggestions" :data-testid="`${role}-suggestions`">
    <span class="label">{{ t('tours.form.suggestions.label') }}</span>
    <button
      v-for="s in suggestions" :key="`${s.kind}:${s.name}`" type="button" class="suggestion"
      :aria-label="s.kind === 'history' ? t('tours.form.suggestions.history', { name: s.name }) : t('tours.form.suggestions.stop', { name: s.name })"
      data-testid="point-suggestion" @click="emit('pick', { location: s.location, name: s.name })"
    >
      <BaseIcon :name="s.kind === 'history' ? 'history' : 'directions_bus'" size="sm" class="icon" />
      <span class="name">{{ s.name }}</span>
      <span v-if="s.distance != null" class="meta">{{ formatDistance(s.distance) }}</span>
    </button>
  </div>
</template>

<style scoped>
.suggestions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-xs);
}

.label {
  flex-basis: 100%;
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}

.suggestion {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xxs);
  min-height: 36px;
  max-width: 100%;
  padding: var(--spacing-xxs) var(--spacing-sm);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-pill);
  background: var(--color-background);
  color: var(--color-on-surface);
  font: inherit;
  font-size: var(--font-size-sm);
  cursor: pointer;
}

@media (hover: hover) {
  .suggestion:hover {
    background: var(--color-surface-variant);
  }
}

.icon {
  flex-shrink: 0;
  color: var(--color-primary);
}

.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta {
  flex-shrink: 0;
  color: var(--color-on-surface-variant);
  font-variant-numeric: tabular-nums;
}
</style>
