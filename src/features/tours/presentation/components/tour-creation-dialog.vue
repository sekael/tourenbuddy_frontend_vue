<script setup lang="ts">
import type { DrawnTrack } from '@/features/map/domain/drawn-track'
import type { LngLat } from '@/features/map/domain/entities/trail'
import type { TourType } from '@/features/tours/data/models/tour-type'
import type { CreationStage, StagePayload } from '@/features/tours/presentation/composables/creation-stages'
import { useResizeObserver } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, reactive, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/core/components/base-button.vue'
import BaseIconButton from '@/core/components/base-icon-button.vue'
import BaseIcon from '@/core/components/base-icon.vue'
import FullScreenPage from '@/core/components/full-screen-page.vue'
import SideDrawer from '@/core/components/side-drawer.vue'
import { useFormatter } from '@/core/composables/use-formatter'
import { useIsDesktop } from '@/core/composables/use-is-desktop'
import { useMapStore } from '@/features/map/presentation/stores/map-store'
import { isSameGoal } from '@/features/tours/domain/distance'
import TourForm from '@/features/tours/presentation/components/tour-form.vue'

/**
 * Creating a tour (map-first-tour-creation): a full-screen page on phones, the side drawer beside
 * the map on desktop. One form per stage, all kept mounted so each keeps its edits and uploads; the
 * day tabs on top switch between them, and one save sends them all (D4). What a trip's days share —
 * activities, partners, who sees it, the dates one after another — follows from a day to the later
 * days that still held what it held (D11).
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
  /** The day before stage `index` now ends elsewhere, and the stage still starts where it ended. */
  handoverMoved: [index: number, point: { location: { lng: number, lat: number }, name: string, elevation: number | null }]
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

/** A day's tab name: its tour name (one line, the tab's title holds it whole). */
const stageName = (i: number): string => formAt(i)?.tourName || t('tours.infoSheet.unnamedTour')

// Past three days on a phone the tabs scroll: the day on screen scrolls into sight.
const strip = useTemplateRef<HTMLElement>('strip')
function showActiveDay(behavior: ScrollBehavior = 'smooth') {
  const tab = strip.value?.querySelector<HTMLElement>('.stage--active')
  // Centred in the room the pinned "+" leaves.
  const room = (strip.value?.clientWidth ?? 0) - (strip.value?.querySelector<HTMLElement>('.stage-add')?.offsetWidth ?? 0)
  strip.value?.scrollTo?.({ left: tab ? tab.offsetLeft - (room - tab.offsetWidth) / 2 : 0, behavior })
}
/** More days lie past the "+": they fade out under it. */
const moreDays = ref(false)
function measureDays() {
  const el = strip.value
  moreDays.value = !!el && el.scrollLeft + el.clientWidth < el.scrollWidth - 1
}
// On the way in, and back from the route step (the form folded away meanwhile, the strip no size).
useResizeObserver(strip, () => {
  showActiveDay('instant')
  measureDays()
})
watch(() => props.active, () => showActiveDay(), { flush: 'post' })

/** Which day the form shows as dated (for the tabs). */
function stageDate(i: number) {
  const date = formAt(i)?.plannedDate
  return date ? formatDate.value(new Date(date), { weekday: 'short', day: 'numeric', month: 'numeric' }) : null
}

// ── Shared fields follow (D11) ──────────────────────────────────────────────
/** Each day's value of `read`, by stage key (JSON: compared by value). */
function byStage(read: (form: FormApi) => unknown) {
  return () =>
    Object.fromEntries(props.stages.map(s => [s.key, forms[s.key] ? JSON.stringify(read(forms[s.key]!)) : null]))
}
/** A change on one day, handed to every later day for which `take` holds. */
function onDayChange(now: Record<string, string | null>, before: Record<string, string | null>, take: (j: number, was: unknown, next: unknown, i: number) => void) {
  props.stages.forEach((stage, i) => {
    const [next, was] = [now[stage.key], before[stage.key]]
    if (next == null || was == null || next === was)
      return
    for (let j = i + 1; j < props.stages.length; j++)
      take(j, JSON.parse(was), JSON.parse(next), i)
  })
}
watch(byStage(form => form.shared), (now, before) => onDayChange(now, before, (j, was, next) => {
  const form = formAt(j)
  if (!form)
    return
  const [old, value] = [was as Record<string, unknown>, next as Record<string, unknown>]
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
  const mine = form.shared as Record<string, unknown>
  const taken = Object.keys(value).filter(k => !same(value[k], old[k]) && same(mine[k], old[k]))
  if (taken.length)
    form.adopt(Object.fromEntries(taken.map(k => [k, value[k]])))
}))
/** `date` ("YYYY-MM-DD") `n` days on. */
function daysOn(date: string, n: number) {
  const day = new Date(`${date}T00:00:00Z`)
  day.setUTCDate(day.getUTCDate() + n)
  return day.toISOString().slice(0, 10)
}
// The dates go on day by day: a later day undated, or still the day after the day after, moves along.
watch(byStage(form => form.plannedDate), (now, before) => onDayChange(now, before, (j, was, next, i) => {
  const form = formAt(j)
  const theirs = form?.plannedDate
  if (form && (theirs === '' || (was && theirs === daysOn(was as string, j - i))))
    form.adopt({ plannedDate: next ? daysOn(next as string, j - i) : '' })
}))

// The next day starts where a day ends: when that end moves (or the day gains or loses its end), a
// next day still starting at the old spot moves along (the page moves its start and track) — and
// takes the height once it is looked up there. Not the name: an unnamed goal's is the tour's, typed.
watch(byStage(form => form.handover && { location: form.handover.location, elevation: form.handover.elevation }), (now, before) => props.stages.forEach((stage, i) => {
  const [next, was] = [now[stage.key], before[stage.key]]
  const handover = formAt(i)?.handover
  const start = formAt(i + 1)?.route().start?.location
  const old = was == null ? null : (JSON.parse(was) as { location: { lng: number, lat: number } } | null)?.location
  if (handover && start && old && next !== was && isSameGoal(start, old, 1))
    emit('handoverMoved', i + 1, { ...handover, location: { ...handover.location } })
}))

defineExpose({
  route: () => formAt(props.active)?.route() ?? null,
  routeOf: (i: number) => formAt(i)?.route() ?? null,
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

    <nav
      v-if="stages.length > 1" ref="strip" class="stage-strip" :class="{ 'stage-strip--more': moreDays }"
      :aria-label="t('tours.creation.daysLabel')" data-testid="stage-strip" @scroll.passive="measureDays"
    >
      <button
        v-for="(stage, i) in stages" :key="stage.key" type="button" class="stage" :class="{ 'stage--active': i === active }"
        :aria-current="i === active ? 'step' : undefined" :title="stageName(i)" :data-testid="`stage-${i}`" @click="emit('select', i)"
      >
        <span class="stage-day">{{ dayLabel(i) }}<span v-if="stageDate(i)" class="stage-date">{{ stageDate(i) }}</span></span>
        <span class="stage-name">{{ stageName(i) }}</span>
      </button>
      <span v-if="!missingDay" class="stage-add">
        <BaseIconButton name="add" variant="tonal" :label="t('tours.form.nextDayBtn')" data-testid="stage-add" @click="emit('nextDay')" />
      </span>
    </nav>
    <div v-if="missingDay" class="missing-day" data-testid="missing-day">
      <span>{{ t('tours.creation.dayMissing', { day: dayLabel(missingDay - (dayOffset ?? 0) - 1) }) }}</span>
      <BaseButton type="button" variant="primary" size="sm" data-testid="plan-missing-day" @click="emit('nextDay')">
        <BaseIcon name="add_location_alt" />
        {{ t('tours.creation.planDay', { day: t('tours.creation.day', { n: missingDay }) }) }}
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
      :stages="i === stages.length - 1"
      @submit="handleSubmit"
      @cancel="handleClose"
      @pick-point="emit('pickPoint', $event)"
      @draw-track="emit('drawTrack', $event)"
      @next-day="emit('nextDay', $event)"
      @track-change="emit('stageChange', i, { track: $event })"
      @tour-types-change="emit('stageChange', i, { tourTypes: $event })"
      @start-point-change="emit('stageChange', i, { start: $event })"
      @end-point-change="emit('stageChange', i, { end: $event })"
    >
      <template v-if="i > 0" #end>
        <div class="stage-tools">
          <BaseButton type="button" variant="text" size="sm" data-testid="stage-remove" @click="removeStage(i)">
            <BaseIcon name="delete" />
            {{ t('tours.creation.removeDay', { day: dayLabel(i) }) }}
          </BaseButton>
        </div>
      </template>
    </TourForm>

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
/* The trip's days as tabs, the app's selectable chips: outlined, the day on screen tinted, all one
   size; three and "+" side by side at 360px, more scroll under the "+", which stays in sight. */
.stage-strip {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  margin: 0 calc(-1 * var(--spacing-xs)) var(--spacing-md);
  padding: 2px 0 var(--spacing-xs) var(--spacing-xs);
  scrollbar-width: none;
}

.stage {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  min-width: 5rem;
  max-width: 12rem;
  height: 56px;
  padding: 0 var(--spacing-xs);
  border: 1.5px solid var(--color-outline-variant);
  border-radius: var(--radius-md);
  background: var(--color-background);
  color: var(--color-on-surface);
  text-align: left;
  font: inherit;
  cursor: pointer;
  transition:
    background-color var(--motion-duration-short) var(--motion-ease-standard),
    border-color var(--motion-duration-short) var(--motion-ease-standard);
}

@media (hover: hover) {
  .stage:hover {
    border-color: var(--color-primary);
  }
}

.stage:focus-visible {
  outline: none;
  box-shadow: var(--input-focus-ring);
}

.stage--active {
  background: var(--chip-selected-bg);
  border-color: var(--chip-selected-border-color);
  color: var(--chip-selected-color);
}

.stage-day {
  display: flex;
  gap: var(--spacing-xxs);
  max-width: 100%;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-on-surface-variant);
  white-space: nowrap;
}

.stage--active .stage-day {
  color: var(--color-primary);
}

.stage-date {
  overflow: hidden;
  font-weight: 400;
  text-overflow: ellipsis;
}

/* One line, ending in "…": the tabs stand even; the form below holds the whole name. */
.stage-name {
  max-width: 100%;
  overflow: hidden;
  font-size: 0.8125rem;
  font-weight: var(--font-weight-medium);
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Adding a day is an action, not a day: the app's round tonal button, pinned at the row's end on
   the sheet's own ground; days past it fade out before they reach it. */
.stage-add {
  position: sticky;
  right: 0;
  display: flex;
  flex: none;
  align-self: stretch;
  align-items: center;
  margin-left: -6px;
  padding: 0 var(--spacing-xs) 0 var(--spacing-sm);
  background: var(--color-background);
}

.stage-strip--more .stage-add::before {
  content: '';
  position: absolute;
  top: 0;
  right: 100%;
  bottom: 0;
  width: var(--spacing-xl);
  background: linear-gradient(to right, transparent, var(--color-background));
  pointer-events: none;
}

.stage-add :deep(.base-icon-button) {
  width: 44px;
  height: 44px;
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
  justify-content: center;
  margin-top: var(--spacing-md);
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--color-outline-variant);
}

.stage-tools :deep(.base-button) {
  color: var(--color-error);
}
</style>
