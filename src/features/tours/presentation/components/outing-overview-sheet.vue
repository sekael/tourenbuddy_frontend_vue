<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/core/components/base-button.vue'
import BaseIcon from '@/core/components/base-icon.vue'
import BottomSheet from '@/core/components/bottom-sheet.vue'
import SideDrawer from '@/core/components/side-drawer.vue'
import { useFormatter } from '@/core/composables/use-formatter'
import { useIsDesktop } from '@/core/composables/use-is-desktop'
import { useLogger } from '@/core/logging/use-logger'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
import { useFriendDisplayName } from '@/features/friendships/presentation/composables/use-friend-display-name'
import { cssFill, distinctTypeColors, TOUR_TYPE_COLORS } from '@/features/tours/data/models/tour-type'
import { outingDisplayName, outingSegments, outingSpan, outingWay, spanDays } from '@/features/tours/domain/outing'
import { totalMetrics } from '@/features/tours/domain/route-metrics'
import OutingSegmentTimeline from '@/features/tours/presentation/components/outing-segment-timeline.vue'
import RouteNumbers from '@/features/tours/presentation/components/route-numbers.vue'
import SegmentAddView from '@/features/tours/presentation/components/segment-add-view.vue'
import { useRouteMetrics } from '@/features/tours/presentation/composables/use-route-metrics'
import { useToursStore } from '@/features/tours/presentation/stores/tours-store'

/** The whole outing (#338, design D15): its span, its numbered segments, the owner's controls. */
const props = defineProps<{
  outingKey: string
  /** Offer a back button (opened from the tour list). */
  showBack?: boolean
}>()
const emit = defineEmits<{
  close: []
  back: []
  openSegment: [tourId: string]
  /** Pick a new segment's goal on the map, appended after `anchorId`. */
  addSegmentNew: [anchorId: string]
}>()

const { t } = useI18n({ useScope: 'global' })
const { formatDateRange } = useFormatter()
const isDesktop = useIsDesktop()
const log = useLogger('outing-overview-sheet')
const toursStore = useToursStore()
const { tours, friendTours } = storeToRefs(toursStore)
const { currentUser } = storeToRefs(useAuthStore())

const segments = computed(() => outingSegments([...tours.value, ...friendTours.value], props.outingKey))
const first = computed(() => segments.value[0] ?? null)
const isOwner = computed(() => !!first.value && first.value.userId === currentUser.value?.id)
const name = computed(() => outingDisplayName(segments.value) ?? t('tours.infoSheet.unnamedTour'))

const mode = ref<'view' | 'edit' | 'add'>('view')
watch(() => props.outingKey, () => (mode.value = 'view'))

const spanDates = computed(() => outingSpan(segments.value))
const span = computed(() => {
  const s = spanDates.value
  return s ? formatDateRange.value(s.start, s.end, { year: 'numeric', month: 'short', day: 'numeric' }) : null
})
/** "2 days · 3 segments" — the days only when the outing spans more than one (D20). */
const headline = computed(() => {
  const count = t('tours.outing.segmentCount', { count: segments.value.length })
  const days = spanDates.value ? spanDays(spanDates.value) : 1
  return days > 1 ? `${t('tours.outing.dayCount', { count: days })} · ${count}` : count
})
const way = computed(() => outingWay(segments.value))
const metrics = useRouteMetrics(segments)
const totals = computed(() => totalMetrics(segments.value.map(s => metrics.value.get(s.id)!)))
const badgeFill = computed(() => {
  const colors = distinctTypeColors(segments.value.flatMap(s => s.tourTypes), TOUR_TYPE_COLORS)
  return colors.length > 0 ? { background: cssFill(colors) } : undefined
})
const { displayName: ownerName, isResolved: ownerResolved } = useFriendDisplayName(
  () => (first.value?.isFriendTour ? first.value.userId : null),
)

// ── Owner edits ──────────────────────────────────────────────────────────────
const draftName = ref('')
const busy = ref(false)
const error = ref<string | null>(null)

const segmentsEl = ref<HTMLElement | null>(null)

function startEdit() {
  draftName.value = first.value?.outing?.name ?? ''
  error.value = null
  mode.value = 'edit'
  // A phone sheet shows the header and the name field first; editing is mostly about the stages.
  if (!isDesktop.value)
    void nextTick(() => segmentsEl.value?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }))
}

/** Every outing edit is a few tour writes; one failure message covers them all. */
async function run(action: () => Promise<unknown>) {
  busy.value = true
  error.value = null
  try {
    await action()
  }
  catch (err) {
    log.error('Outing edit failed', err)
    error.value = t('tours.outing.saveFailed')
  }
  finally {
    busy.value = false
  }
}

async function finishEdit() {
  await run(() => toursStore.renameOuting(segments.value, draftName.value))
  if (!error.value)
    mode.value = 'view'
}

const title = computed(() => (mode.value === 'add' ? t('tours.outing.addTitle') : name.value))
const backVisible = computed(() => mode.value === 'add' || !!props.showBack)
const backLabel = computed(() => {
  if (!isDesktop.value || !backVisible.value)
    return undefined
  return mode.value === 'add' ? name.value : t('tours.infoSheet.backToTours')
})

function handleBack() {
  if (mode.value === 'add')
    mode.value = 'view'
  else
    emit('back')
}

function handleAdded() {
  mode.value = 'view'
}
</script>

<template>
  <!-- Browsing: resizable over the map. Editing or adding fits the content (D23) — at the browse
       height the cards sat under the footer on a phone. -->
  <component
    :is="isDesktop ? SideDrawer : BottomSheet" v-if="first" :title="title" :fit-content="!isDesktop"
    :resizable="!isDesktop && mode === 'view'" :show-back="backVisible || undefined" :back-label="backLabel"
    @close="emit('close')" @back="handleBack"
  >
    <SegmentAddView
      v-if="mode === 'add'" :anchor="segments.at(-1)!"
      @pick-new="emit('addSegmentNew', segments.at(-1)!.id)" @added="handleAdded"
    />

    <div v-else class="overview">
      <div class="hero">
        <span class="hero-badge" :style="badgeFill"><BaseIcon name="timeline" size="lg" /></span>
        <div class="hero-text">
          <span class="hero-headline" data-testid="outing-headline">{{ headline }}</span>
          <!-- Dates and totals share a line (wrapping on a narrow phone), so the stages start
               higher in the browse-height sheet. -->
          <span v-if="span || totals.ascent !== null || totals.descent !== null" class="hero-meta hero-meta--wrap">
            <span v-if="span">{{ span }}</span>
            <RouteNumbers :metrics="totals" />
          </span>
          <span v-if="way" class="hero-meta" data-testid="outing-way">{{ way.from }} → {{ way.to }}</span>
          <span v-if="first.isFriendTour" class="hero-meta">
            <BaseIcon name="person" size="sm" />
            <template v-if="ownerResolved">{{ t('tours.infoSheet.createdByLabel', { name: ownerName }) }}</template>
          </span>
        </div>
      </div>

      <label v-if="mode === 'edit'" class="name-field">
        <span class="name-label">{{ t('tours.outing.nameLabel') }}</span>
        <input
          v-model="draftName" class="input" type="text" maxlength="99" data-testid="outing-name-input"
          :placeholder="t('tours.outing.namePlaceholder')" :disabled="busy" @keydown.enter.prevent="finishEdit"
        >
      </label>

      <p v-if="error" class="error">
        {{ error }}
      </p>

      <section ref="segmentsEl" class="segments">
        <h4 class="section-title">
          {{ t('tours.outing.segmentsHeader') }}
        </h4>
        <OutingSegmentTimeline
          :segments="segments" :metrics="metrics" :editing="mode === 'edit'" :busy="busy" :can-connect="isOwner"
          @open="emit('openSegment', $event)"
          @reorder="(from, to) => run(() => toursStore.reorderSegments(segments, from, to))"
          @remove="id => run(() => toursStore.removeFromOuting(segments, id))" @connect="i => run(() => toursStore.connectSegments(segments[i - 1]!, segments[i]!))"
        />
      </section>
    </div>

    <template v-if="isOwner && mode !== 'add'" #footer>
      <div class="actions">
        <BaseButton v-if="mode === 'edit'" variant="primary" size="sm" :disabled="busy" data-testid="outing-done" @click="finishEdit">
          <BaseIcon name="check" />
          {{ t('tours.outing.done') }}
        </BaseButton>
        <template v-else>
          <BaseButton variant="secondary" size="sm" data-testid="outing-edit" @click="startEdit">
            <BaseIcon name="edit" />
            {{ t('tours.outing.edit') }}
          </BaseButton>
          <BaseButton variant="primary" size="sm" data-testid="outing-add-segment" @click="mode = 'add'">
            <BaseIcon name="add_road" />
            {{ t('tours.outing.addSegment') }}
          </BaseButton>
        </template>
      </div>
    </template>
  </component>
</template>

<style scoped>
.overview {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.hero {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.hero-badge {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: var(--radius-pill);
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.hero-text {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxs);
  min-width: 0;
}

.hero-headline {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-on-surface);
}

.hero-meta {
  display: flex;
  align-items: center;
  gap: var(--spacing-xxs);
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}

.hero-meta--wrap {
  flex-wrap: wrap;
  column-gap: var(--spacing-sm);
}

.name-field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxs);
}

.name-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-on-surface-variant);
}

.input {
  min-height: 44px;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-sm);
  background: var(--color-background);
  color: var(--color-on-surface);
  font: inherit;
}

.segments {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--divider-color);
}

.section-title {
  margin: 0;
  font-size: var(--heading-section-size);
  font-weight: var(--heading-section-weight);
  color: var(--heading-section-color);
  letter-spacing: var(--heading-section-tracking);
}

.error {
  font-size: var(--font-size-sm);
  color: var(--color-error);
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
}
</style>
