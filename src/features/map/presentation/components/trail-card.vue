<script setup lang="ts">
import type { Trail } from '@/features/map/domain/entities/trail'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/core/components/base-button.vue'
import BaseIcon from '@/core/components/base-icon.vue'
import BottomSheet from '@/core/components/bottom-sheet.vue'
import SideDrawer from '@/core/components/side-drawer.vue'
import { useFormatter } from '@/core/composables/use-formatter'
import { useIsDesktop } from '@/core/composables/use-is-desktop'
import { pace } from '@/core/composables/use-pace'
import { labelMinutes } from '@/features/tours/domain/route-metrics'
import GradeBadge from '@/features/tours/presentation/components/grade-badge.vue'
import PaceNote from '@/features/tours/presentation/components/pace-note.vue'
import RouteNumbers from '@/features/tours/presentation/components/route-numbers.vue'
import TourTypeBadge from '@/features/tours/presentation/components/tour-type-badge.vue'
import { trailTitle } from '../composables/trail-title'
import { useMapStore } from '../stores/map-store'
import TrailCandidateList from './trail-candidate-list.vue'

const emit = defineEmits<{
  close: []
  /** Plan this route as a tour (smarter-tour-creation D7). */
  plan: [trail: Trail]
}>()

const { t } = useI18n({ useScope: 'global' })
const { formatElevation, formatDuration } = useFormatter()
const isDesktop = useIsDesktop()
const mapStore = useMapStore()
const { trailCard } = storeToRefs(mapStore)

const selected = computed(() => trailCard.value?.candidates.find(c => c.id === trailCard.value?.selectedId) ?? null)
const route = computed(() => selected.value?.route ?? null)
/** Back to the list only when the details were opened from one. */
const fromList = computed(() => selected.value !== null && (trailCard.value?.candidates.length ?? 0) > 1)
/** Details read like a tour's (design D10): the summit as title, its altitude leads the hero. */
const title = computed(() => {
  if (!selected.value)
    return t('map.trail.listTitle', { count: (trailCard.value?.candidates.length ?? 0) + (trailCard.value?.more ?? 0) })
  return route.value?.targetName || trailTitle(selected.value, t)
})
/** SAC's ascent time at the user's pace, as every time the app shows; an odd label as it is. */
const ascentTime = computed(() => {
  const label = route.value?.ascentTime
  const minutes = label ? labelMinutes(label) : null
  return minutes == null ? label : formatDuration.value(Math.round(minutes * 100 / pace.value))
})
const numbers = computed(() => ({ ascent: route.value?.ascentM ?? null, descent: route.value?.descentM ?? null, distance: null }))

function openSac() {
  window.open(route.value!.sacUrl!, '_blank', 'noopener')
}
</script>

<template>
  <component
    :is="isDesktop ? SideDrawer : BottomSheet" v-if="trailCard" :title="title" fit-content
    :show-back="fromList" :back-label="fromList ? t('map.trail.backToList') : undefined"
    @close="emit('close')" @back="mapStore.selectTrail(null)"
  >
    <div class="body">
      <TrailCandidateList
        v-if="!selected" :candidates="trailCard.candidates" :more="trailCard.more"
        @select="mapStore.selectTrail"
      />
      <template v-else-if="route">
        <div class="hero">
          <TourTypeBadge :types="['skitour']" class="hero-badge" />
          <div class="hero-text">
            <span v-if="route.targetAltitude != null" class="hero-headline">
              <BaseIcon name="landscape" size="sm" class="hero-headline-icon" />
              {{ formatElevation(route.targetAltitude) }}
            </span>
            <span v-if="route.name" class="hero-name">{{ route.name }}</span>
            <!-- Separate items: a wrap falls between them, never inside one. -->
            <span class="hero-meta">
              <GradeBadge v-if="route.difficulty" :grade="route.difficulty" />
              <span v-if="ascentTime" class="fact" data-testid="trail-ascent-time">
                <BaseIcon name="schedule" size="sm" />{{ t('tours.route.ascent') }} {{ ascentTime }}
                <PaceNote />
              </span>
              <RouteNumbers :metrics="numbers" />
            </span>
          </div>
        </div>
        <div class="actions">
          <BaseButton variant="primary" data-testid="trail-plan-tour" @click="emit('plan', selected!)">
            <BaseIcon name="add_location_alt" />
            {{ t('map.trail.planTour') }}
          </BaseButton>
          <BaseButton v-if="route.sacUrl" variant="secondary" data-testid="trail-sac" @click="openSac">
            <BaseIcon name="open_in_new" />
            {{ t('map.trail.openSac') }}
          </BaseButton>
        </div>
      </template>
      <p v-else class="no-info">
        {{ t('map.trail.noInfo') }}
      </p>
      <p class="credit">
        © swisstopo
      </p>
    </div>
  </component>
</template>

<style scoped>
.body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding-bottom: var(--spacing-md);
}

.hero,
.actions,
.no-info,
.credit {
  margin: 0;
  padding: 0 var(--spacing-md);
}

/* The tour sheet's hero, in small: disc, then altitude, route name and facts. */
.hero {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
}

.hero-badge {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
}

.hero-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-xxs);
  min-width: 0;
}

.hero-headline {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xxs);
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
  color: var(--color-on-surface);
}

.hero-headline-icon {
  color: var(--color-on-surface-variant);
}

.hero-name {
  color: var(--color-on-surface);
}

.hero-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-xxs) var(--spacing-sm);
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}

.fact {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xxs);
  white-space: nowrap;
}

/* Side by side when both labels fit, else stacked full width — the plan first. */
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.actions > * {
  flex: 1 1 auto;
}

.no-info {
  color: var(--color-on-surface-variant);
}

.credit {
  font-size: var(--font-size-xs);
  color: var(--color-on-surface-variant);
}
</style>
