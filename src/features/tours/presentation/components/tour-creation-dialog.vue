<script setup lang="ts">
import type { DrawnTrack } from '@/features/map/domain/drawn-track'
import type { LngLat } from '@/features/map/domain/entities/trail'
import type { TourType } from '@/features/tours/data/models/tour-type'
import type { CreationStage, StagePayload } from '@/features/tours/presentation/composables/creation-stages'
import { storeToRefs } from 'pinia'
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/core/components/base-button.vue'
import BaseIcon from '@/core/components/base-icon.vue'
import FullScreenPage from '@/core/components/full-screen-page.vue'
import SideDrawer from '@/core/components/side-drawer.vue'
import { useFormatter } from '@/core/composables/use-formatter'
import { useIsDesktop } from '@/core/composables/use-is-desktop'
import { useMapStore } from '@/features/map/presentation/stores/map-store'
import TourForm from '@/features/tours/presentation/components/tour-form.vue'

/**
 * Creating a tour (map-first-tour-creation): a full-screen page on phones, the side drawer beside
 * the map on desktop. One form per stage, all kept mounted so each keeps its edits and uploads; the
 * strip on top switches between them, and one save sends them all (D4).
 */
const props = defineProps<{
  stages: CreationStage[]
  /** The stage on screen. */
  active: number
  title: string
  /** Day numbers continue after this many (the outing an added stage joins). */
  dayOffset?: number
  /** The span a split started from, for "Day 2 of 3". */
  dayCount?: number | null
}>()

const emit = defineEmits<{
  confirm: [stages: StagePayload[]]
  close: []
  select: [index: number]
  /** Drop a later stage (its form's uploads are already discarded). */
  remove: [index: number]
  pickPoint: [type: 'start' | 'end' | 'goal']
  drawTrack: [seed: DrawnTrack | null]
  nextDay: [split?: number]
  /** A stage's form changed what the map draws. */
  stageChange: [index: number, change: { tourTypes?: TourType[], start?: { lng: number, lat: number } | null, end?: { lng: number, lat: number } | null, track?: LngLat[] | null }]
}>()

const { t } = useI18n({ useScope: 'global' })
const { formatDate } = useFormatter()
const mapStore = useMapStore()
const { isPickingLocation } = storeToRefs(mapStore)
const isDesktop = useIsDesktop()

type FormApi = InstanceType<typeof TourForm>
const forms = reactive<Record<string, FormApi>>({})
function setForm(key: string, el: unknown) {
  if (el)
    forms[key] = el as FormApi
  else
    delete forms[key]
}
const formAt = (i: number) => forms[props.stages[i]?.key ?? '']

/** One label per stage: "Day 2", or "Day 2 of 3" while laying out a split span. */
function dayLabel(i: number) {
  const n = (props.dayOffset ?? 0) + i + 1
  return props.dayCount && n <= props.dayCount ? t('tours.creation.dayOf', { n, count: props.dayCount }) : t('tours.creation.day', { n })
}

const submitBlocked = computed(() => props.stages.some(s => forms[s.key]?.submitBlocked))
/** The days the save leaves planned: a split counts the tour it splits too. */
const saveLabel = computed(() => {
  const days = props.dayCount ? (props.dayOffset ?? 0) + props.stages.length : props.stages.length
  return days > 1 ? t('tours.creation.saveDays', { count: days }) : t('tours.creation.saveBtn')
})

/** Every stage's payload, or none: the first stage that can't be saved comes to the front. */
function handleSubmit() {
  if (isPickingLocation.value)
    return
  const payloads: StagePayload[] = []
  for (const [i, stage] of props.stages.entries()) {
    const out = formAt(i)?.collect(i === props.active)
    if (!out) {
      emit('select', i)
      return
    }
    payloads.push({ draft: out.draft, goal: stage.goal, preUploadedTourId: out.preUploadedTourId, draftId: out.draftId })
  }
  emit('confirm', payloads)
}

/** The day a split span still lacks (D5), or null once every day has its stage. */
const missingDay = computed(() => {
  const n = (props.dayOffset ?? 0) + props.stages.length + 1
  return props.dayCount && n <= props.dayCount ? n : null
})

/**
 * Closing asks first: a planned route (and every stage's typing) is work to lose. Discarding
 * cancels everything — each stage's uploads go with it.
 */
const confirmingClose = ref(false)
function handleClose() {
  confirmingClose.value = true
}
function discardAll() {
  props.stages.forEach((_, i) => formAt(i)?.discard())
  emit('close')
}

function removeStage(i: number) {
  formAt(i)?.discard()
  emit('remove', i)
}

/** Which day the form shows as dated (for the strip). */
function stageDate(i: number) {
  const date = formAt(i)?.plannedDate
  return date ? formatDate.value(new Date(date), { weekday: 'short', day: 'numeric', month: 'numeric' }) : null
}

defineExpose({
  route: () => formAt(props.active)?.route() ?? null,
  snapshotOf: (i: number) => formAt(i)?.snapshot() ?? null,
})
</script>

<template>
  <component
    :is="isDesktop ? SideDrawer : FullScreenPage" :title="title" :collapsed="isPickingLocation && !isDesktop"
    @close="handleClose"
  >
    <div v-if="confirmingClose" class="discard" role="alertdialog" aria-labelledby="discard-title" data-testid="discard-confirm">
      <p id="discard-title" class="discard-text">
        <BaseIcon name="warning" class="discard-icon" />
        {{ stages.length > 1 ? t('tours.creation.discardDays', { count: stages.length }) : t('tours.creation.discard') }}
      </p>
      <div class="discard-actions">
        <BaseButton type="button" variant="secondary" size="sm" data-testid="discard-keep" @click="confirmingClose = false">
          {{ t('tours.creation.keepEditing') }}
        </BaseButton>
        <BaseButton type="button" variant="danger" size="sm" data-testid="discard-confirm-btn" @click="discardAll">
          {{ t('contacts.shared.discardBtn') }}
        </BaseButton>
      </div>
    </div>

    <nav v-if="stages.length > 1" class="stage-strip" :aria-label="t('tours.creation.daysLabel')" data-testid="stage-strip">
      <button
        v-for="(stage, i) in stages" :key="stage.key" type="button" class="stage" :class="{ 'stage--active': i === active }"
        :aria-current="i === active ? 'step' : undefined" :data-testid="`stage-${i}`" @click="emit('select', i)"
      >
        <span class="stage-day">{{ dayLabel(i) }}<template v-if="stageDate(i)"> · {{ stageDate(i) }}</template></span>
        <span class="stage-name">{{ formAt(i)?.tourName || t('tours.infoSheet.unnamedTour') }}</span>
      </button>
    </nav>
    <div v-if="missingDay" class="missing-day" data-testid="missing-day">
      <span>{{ t('tours.creation.dayMissing', { day: dayLabel(missingDay - (dayOffset ?? 0) - 1) }) }}</span>
      <BaseButton type="button" variant="primary" size="sm" data-testid="plan-missing-day" @click="emit('nextDay')">
        <BaseIcon name="add_location_alt" />
        {{ t('tours.creation.planDay', { day: t('tours.creation.day', { n: missingDay }) }) }}
      </BaseButton>
    </div>
    <div v-if="stages.length > 1 && active > 0" class="stage-tools">
      <BaseButton type="button" variant="secondary" size="sm" data-testid="stage-remove" @click="removeStage(active)">
        <BaseIcon name="delete" />
        {{ t('tours.creation.removeDay', { day: dayLabel(active) }) }}
      </BaseButton>
    </div>

    <TourForm
      v-for="(stage, i) in stages" v-show="i === active" :key="stage.key" :ref="el => setForm(stage.key, el)"
      :form-id="`tour-create-form-${i}`" :id-prefix="i === 0 ? 'tf' : `tf${i}`"
      :embedded="!isDesktop"
      :submit-label="saveLabel"
      :allow-goal-edit="true"
      :current-goal="stage.goal"
      :initial-draft="stage.seed"
      :pick="stage.picks"
      :drawn-track="stage.drawnTrack"
      :disabled="isPickingLocation"
      stages
      @submit="handleSubmit"
      @cancel="handleClose"
      @pick-point="emit('pickPoint', $event)"
      @draw-track="emit('drawTrack', $event)"
      @next-day="emit('nextDay', $event)"
      @track-change="emit('stageChange', i, { track: $event })"
      @tour-types-change="emit('stageChange', i, { tourTypes: $event })"
      @start-point-change="emit('stageChange', i, { start: $event })"
      @end-point-change="emit('stageChange', i, { end: $event })"
    />

    <template #page-action>
      <BaseButton
        type="submit" :form="`tour-create-form-${active}`" variant="primary" size="sm" data-testid="create-save"
        :disabled="submitBlocked"
      >
        {{ saveLabel }}
      </BaseButton>
    </template>
  </component>
</template>

<style scoped>
.stage-strip {
  display: flex;
  gap: var(--spacing-xs);
  overflow-x: auto;
  margin: 0 calc(-1 * var(--spacing-xs)) var(--spacing-sm);
  padding: 2px var(--spacing-xs) var(--spacing-xs);
  scrollbar-width: none;
}

.stage {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: flex-start;
  max-width: 11rem;
  min-height: 48px;
  padding: var(--spacing-xxs) var(--spacing-sm);
  border: 1.5px solid var(--color-outline-variant);
  border-radius: var(--radius-md);
  background: var(--color-background);
  color: var(--color-on-surface);
  text-align: left;
  font: inherit;
  cursor: pointer;
}

.stage--active {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1px var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 6%, var(--color-background));
}

.stage-day {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-on-surface-variant);
  white-space: nowrap;
}

.stage--active .stage-day {
  color: var(--color-primary);
}

.stage-name {
  max-width: 100%;
  overflow: hidden;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.discard,
.missing-day {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  background: var(--color-surface-variant);
}

.discard {
  /* Stays in sight however far the form is scrolled: the × that asked is at the top. */
  position: sticky;
  top: 0;
  z-index: 2;
  background: color-mix(in srgb, var(--color-error-container) 70%, var(--color-background));
}

.discard-text {
  display: flex;
  gap: var(--spacing-xs);
  margin: 0;
  font-weight: var(--font-weight-medium);
}

.discard-icon {
  flex: none;
  color: var(--color-error);
}

.discard-actions {
  display: flex;
  gap: var(--spacing-sm);
  margin-left: auto;
}

.stage-tools {
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--spacing-sm);
}
</style>
