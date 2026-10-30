<script setup lang="ts">
import type { TrailOverlayId } from '@/features/map/data/trail-overlays'
import type { LngLat } from '@/features/map/domain/entities/trail'
import type { SnapNetwork } from '@/features/map/domain/snap-network'
import type { NetworkIssue } from '@/features/map/presentation/composables/use-track-drawing'
import type { ProfiledLine } from '@/features/tours/data/services/swisstopo-profile-service'
import type { RouteMetrics } from '@/features/tours/domain/route-metrics'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/core/components/base-button.vue'
import BaseIconButton from '@/core/components/base-icon-button.vue'
import BaseIcon from '@/core/components/base-icon.vue'
import { useFormatter } from '@/core/composables/use-formatter'
import { isOnline } from '@/core/offline/use-online-status'
import { TRAIL_OVERLAYS } from '@/features/map/data/trail-overlays'
import ElevationProfile from './elevation-profile.vue'

/**
 * The drawing's panel, laid out like the swisstopo app's: what the line follows (the map's trail
 * layers, switchable right here) beside the close button, the numbers — distance, time, climb,
 * descent — the elevation profile, and undo / redo / back to start beside Done. Every row keeps
 * its height from the first tap on, so the panel never jumps as the numbers arrive.
 */
const props = defineProps<{
  overlays: readonly TrailOverlayId[]
  network: SnapNetwork | null
  /** Both layers are shown, so the activity decided what the line follows. */
  byActivity: boolean
  issue: NetworkIssue
  points: number
  metrics: RouteMetrics
  minutes: number | null
  profile: ProfiledLine | null
  busy: boolean
  canUndo: boolean
  canRedo: boolean
  /** The line already ends at its start: nothing to return. */
  closed: boolean
}>()

const emit = defineEmits<{ toggleOverlay: [id: TrailOverlayId], undo: [], redo: [], returnToStart: [], cancel: [], done: [] }>()

const { t } = useI18n({ useScope: 'global' })
const { formatElevation, formatDistance } = useFormatter()

const status = computed(() => {
  if (props.issue === 'unavailable')
    return t('map.draw.status.unavailable')
  if (!props.network)
    return t('map.draw.status.straight')
  const follows = t(`map.draw.status.${props.network}`)
  return props.byActivity ? `${follows} ${t('map.draw.status.byActivity')}` : follows
})

const hint = computed(() => {
  if (props.points === 0)
    return t('map.draw.hint.start')
  if (props.points === 1)
    return t('map.draw.hint.next')
  return isOnline.value ? t('map.draw.hint.profileLoading') : t('map.draw.hint.profileOffline')
})

const duration = computed(() => {
  const m = props.minutes
  if (m == null)
    return '–'
  return m < 60 ? t('map.draw.minutes', { m }) : t('map.draw.hours', { h: Math.floor(m / 60), m: String(m % 60).padStart(2, '0') })
})

const line = computed(() => props.profile?.line ?? ([] as LngLat[]))
</script>

<template>
  <section class="draw-panel" :aria-label="t('map.draw.title')" data-testid="track-draw-panel">
    <div class="snap" role="group" :aria-label="t('map.draw.followLabel')">
      <button
        v-for="o in TRAIL_OVERLAYS" :key="o.id" type="button" class="chip"
        :class="{ 'chip--on': overlays.includes(o.id), 'chip--snapping': network === o.id }"
        :aria-pressed="overlays.includes(o.id)" @click="emit('toggleOverlay', o.id)"
      >
        <BaseIcon :name="o.icon" size="sm" />
        {{ t(o.labelKey) }}
      </button>
      <span class="spacer" />
      <BaseIconButton name="close" variant="tonal" :label="t('tours.picker.cancelBtn')" data-testid="draw-cancel" @click="emit('cancel')" />
    </div>
    <p class="status" :class="{ 'status--warn': issue || !network }" role="status">
      {{ status }}
    </p>

    <dl class="stats" :class="{ 'stats--empty': points < 2 }">
      <div>
        <dt class="visually-hidden">
          {{ t('tours.route.distance') }}
        </dt><dd>{{ formatDistance(metrics.distance ?? 0) }}</dd>
      </div>
      <div>
        <dt class="visually-hidden">
          {{ t('map.draw.time') }}
        </dt><dd>{{ duration }}</dd>
      </div>
      <div>
        <dt><span aria-hidden="true">↗</span><span class="visually-hidden">{{ t('tours.route.ascent') }}</span></dt>
        <dd>{{ metrics.ascent == null ? '–' : formatElevation(metrics.ascent) }}</dd>
      </div>
      <div>
        <dt><span aria-hidden="true">↘</span><span class="visually-hidden">{{ t('tours.route.descent') }}</span></dt>
        <dd>{{ metrics.descent == null ? '–' : formatElevation(metrics.descent) }}</dd>
      </div>
    </dl>

    <ElevationProfile v-if="profile && points >= 2" :line="line" :heights="profile.heights" />
    <p v-else class="profile-hint">
      {{ hint }}
    </p>

    <div class="actions">
      <BaseIconButton name="undo" size="lg" variant="tonal" :label="t('map.draw.undo')" :disabled="!canUndo" data-testid="draw-undo" @click="emit('undo')" />
      <BaseIconButton name="redo" size="lg" variant="tonal" :label="t('map.draw.redo')" :disabled="!canRedo" data-testid="draw-redo" @click="emit('redo')" />
      <BaseButton
        variant="secondary" class="return" :disabled="points < 2 || closed || busy" :title="t('map.draw.returnToStartHint')"
        data-testid="draw-return" @click="emit('returnToStart')"
      >
        <BaseIcon name="u_turn_left" />
        {{ t('map.draw.returnToStart') }}
      </BaseButton>
      <span class="spacer" />
      <BaseButton variant="primary" :disabled="points < 2 || busy" data-testid="draw-done" @click="emit('done')">
        {{ t('map.draw.done') }}
      </BaseButton>
    </div>
  </section>
</template>

<style scoped>
.draw-panel {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  /* Above the collapsed form bar (full-screen page z 60), which it covers on phones. */
  z-index: 61;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-md) calc(var(--spacing-md) + var(--safe-bottom));
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  background: var(--color-background);
  box-shadow: var(--shadow-lg);
}

/* Docked left: the middle of the map, where the tour is drawn, stays clear. */
@media (min-width: 600px) {
  .draw-panel {
    left: var(--spacing-lg);
    right: auto;
    bottom: var(--spacing-lg);
    width: 420px;
    border-radius: var(--radius-lg);
    padding-bottom: var(--spacing-md);
  }
}

.snap {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xxs);
  min-height: 36px;
  padding: 0 var(--spacing-sm);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-pill);
  background: var(--color-background);
  color: var(--color-on-surface-variant);
  font: inherit;
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
}

.chip--on {
  border-color: transparent;
  background: var(--color-surface-variant);
  color: var(--color-on-surface);
}

/* The layer the line follows right now. */
.chip--snapping {
  background: color-mix(in srgb, #e3061b 12%, var(--color-background));
  color: #b0000f;
}

.status {
  /* Two lines held: a longer status must not push the toggles up. */
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  min-height: calc(2 * 1.4em);
  margin: 0;
  font-size: var(--font-size-sm);
  line-height: 1.4;
  color: var(--color-on-surface-variant);
}

.status--warn {
  color: var(--color-on-surface);
}

.stats {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xxs) var(--spacing-md);
  margin: 0;
  font-size: var(--font-size-base);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.stats div {
  display: flex;
  gap: 2px;
}

.stats dt,
.stats dd {
  margin: 0;
}

.stats--empty {
  color: var(--color-on-surface-variant);
  font-weight: 500;
}

.profile-hint {
  display: flex;
  align-items: center;
  height: 72px;
  margin: 0;
  padding: 0 var(--spacing-md);
  border-radius: var(--radius-sm);
  background: var(--color-surface-variant);
  color: var(--color-on-surface-variant);
  font-size: var(--font-size-sm);
}

.actions {
  display: flex;
  align-items: center;
  /* Four controls on a 360 px phone. */
  gap: var(--spacing-xxs);
}

.spacer {
  flex: 1;
}

/* Tight on a 360 px phone beside undo, redo and Done: the label carries it, not padding. */
.actions .return {
  min-height: var(--icon-button-size-lg);
  padding-inline: var(--spacing-sm) var(--spacing-md);
  white-space: nowrap;
}
</style>
