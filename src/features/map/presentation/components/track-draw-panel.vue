<script setup lang="ts">
import type { TrailOverlayId } from '@/features/map/data/trail-overlays'
import type { LngLat } from '@/features/map/domain/entities/trail'
import type { SnapNetwork } from '@/features/map/domain/snap-network'
import type { NetworkIssue } from '@/features/map/presentation/composables/use-track-drawing'
import type { ProfiledLine } from '@/features/tours/data/services/swisstopo-profile-service'
import type { RouteMetrics } from '@/features/tours/domain/route-metrics'
import { useElementSize } from '@vueuse/core'
import { computed, ref, useTemplateRef, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/core/components/base-button.vue'
import BaseIconButton from '@/core/components/base-icon-button.vue'
import BaseIcon from '@/core/components/base-icon.vue'
import PaceBadge from '@/core/components/pace-badge.vue'
import { useFormatter } from '@/core/composables/use-formatter'
import { useIsDesktop } from '@/core/composables/use-is-desktop'
import { formatPace, pace, PACE_MAX, PACE_MIN, PACE_STEP } from '@/core/composables/use-pace'
import { useSheetInset } from '@/core/composables/use-sheet-inset'
import { isOnline } from '@/core/offline/use-online-status'
import { TRAIL_OVERLAYS } from '@/features/map/data/trail-overlays'
import ElevationProfile from './elevation-profile.vue'

/**
 * The drawing's panel, laid out like the swisstopo app's: what the line follows first (the map's
 * trail layers, switchable right here; the roads and paths after them) beside the close button, the numbers — distance, time, climb,
 * descent — the elevation profile, and undo / redo / back to start beside Done. Every row keeps
 * its height from the first tap on, so the panel never jumps as the numbers arrive. The time opens
 * the pace, tortoise to hare, in the status line's place; closed, a pace off the standard shows as
 * its factor badge.
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
const { formatElevation, formatDistance, formatDuration } = useFormatter()

const status = computed(() => {
  if (props.issue === 'unavailable')
    return t('map.draw.status.unavailable')
  if (!props.network)
    return t('map.draw.status.ways')
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

const duration = computed(() => (props.minutes == null ? '–' : formatDuration.value(props.minutes)))
const paceOpen = ref(false)

const line = computed(() => props.profile?.line ?? ([] as LngLat[]))

// On a phone the panel is a bottom sheet: bottom toasts (`--sheet-inset`) rise above its buttons.
// Docked left on desktop, it leaves the centred toasts clear.
const panel = useTemplateRef<HTMLElement>('panel')
const { height } = useElementSize(panel, undefined, { box: 'border-box' })
const isDesktop = useIsDesktop()
const publishInset = useSheetInset()
watchEffect(() => publishInset(isDesktop.value ? 0 : height.value))
</script>

<template>
  <section ref="panel" class="draw-panel" :aria-label="t('map.draw.title')" data-testid="track-draw-panel">
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
    <!-- The pace takes the status line's place while open: the panel keeps its height, the map its track. -->
    <p v-if="!paceOpen" class="status" :class="{ 'status--warn': issue }" role="status">
      {{ status }}
    </p>
    <div v-else id="draw-pace" class="pace" data-testid="draw-pace">
      <label for="draw-pace-input" class="pace-label">{{ t('tours.route.pace') }}</label>
      <BaseIcon name="snail" />
      <input
        id="draw-pace-input" v-model.number="pace" type="range" :min="PACE_MIN" :max="PACE_MAX" :step="PACE_STEP"
        :aria-valuetext="formatPace(pace)"
      >
      <BaseIcon name="cruelty_free" />
      <output for="draw-pace-input" class="pace-value">{{ formatPace(pace) }}</output>
    </div>

    <dl class="stats" :class="{ 'stats--empty': points < 2 }">
      <div>
        <dt class="visually-hidden">
          {{ t('tours.route.distance') }}
        </dt><dd>{{ formatDistance(metrics.distance ?? 0) }}</dd>
      </div>
      <div>
        <dt class="visually-hidden">
          {{ t('tours.route.time') }}
        </dt>
        <dd>
          <button
            type="button" class="pace-toggle" :aria-expanded="paceOpen" aria-controls="draw-pace"
            :title="t('map.draw.pace.open')" data-testid="draw-pace-toggle" @click="paceOpen = !paceOpen"
          >
            {{ duration }}
            <!-- One width for either: the figures never move as the pace leaves 1.0. Open, the slider shows the factor. -->
            <span class="pace-slot">
              <PaceBadge v-if="!paceOpen && pace !== 1" />
              <BaseIcon v-else name="speed" size="sm" />
            </span>
            <span class="visually-hidden">{{ t('map.draw.pace.open') }} ({{ formatPace(pace) }})</span>
          </button>
        </dd>
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
  /* The pace row's height, which takes its place. */
  min-height: 44px;
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
  /* Spread over the row: four figures — 17.0 km, 10:40 h 1.3×, 2120 m up and down — fit a 360 px phone. */
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-xxs);
  margin: 0;
  font-size: var(--font-size-base);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

/* The longest figures need 16 px more than a 360 px phone has at full size. */
@media (max-width: 380px) {
  .stats {
    font-size: 0.9375rem;
  }
}

.stats div {
  display: flex;
  gap: 2px;
}

.stats dt,
.stats dd {
  margin: 0;
}

.pace-toggle {
  position: relative;
  isolation: isolate;
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xxs);
  /* A thumb's height, filled like the panel's other buttons so it reads as one. */
  min-height: 44px;
  padding: 0 var(--spacing-xxs) 0 6px;
  border: none;
  background: none;
  color: var(--color-on-secondary-container);
  font: inherit;
  cursor: pointer;
}

.pace-toggle::before {
  content: '';
  position: absolute;
  inset: 2px 0;
  z-index: -1;
  border-radius: var(--radius-pill);
  background: var(--color-secondary-container);
}

.pace-toggle:hover::before,
.pace-toggle[aria-expanded='true']::before {
  background: var(--color-secondary-container-hover);
}

.pace-slot {
  display: inline-flex;
  justify-content: center;
  /* The widest badge ("1.5×"). */
  width: 2.15em;
}

.pace-slot .pace-badge {
  padding-inline: 0.3em;
  background: var(--color-background);
}

.pace {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  min-height: 44px;
  color: var(--color-on-surface-variant);
}

.pace-label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-on-surface);
}

/* The whole row height takes the finger. */
.pace input {
  flex: 1;
  min-width: 0;
  height: 44px;
  margin: 0;
  accent-color: var(--color-primary);
  cursor: pointer;
}

.pace-value {
  min-width: 4ch;
  text-align: end;
  font-size: var(--font-size-sm);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--color-on-surface);
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
