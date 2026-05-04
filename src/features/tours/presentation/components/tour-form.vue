<script setup lang="ts">
import type { Season } from '@/features/tours/data/models/season'
import type { TourType } from '@/features/tours/data/models/tour-type'
import type { TourDraft } from '@/features/tours/domain/entities/tour'
import { storeToRefs } from 'pinia'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
import ContactChip from '@/features/contacts/presentation/components/contact-chip.vue'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'
import { SEASON_VALUES } from '@/features/tours/data/models/season'
import {
  TOUR_TYPE_I18N_KEYS,
  TOUR_TYPE_ICONS,
  TOUR_TYPE_VALUES,
} from '@/features/tours/data/models/tour-type'
import {
  GpxFileTooLargeError,
  GpxParseError,
  parseGpxFile,
} from '@/features/tours/data/services/gpx-parser'
import { removeGpx, uploadGpx } from '@/features/tours/data/services/gpx-storage-service'

const props = defineProps<{
  /** Label for the submit button. */
  submitLabel: string
  /** When true the goal row shows a "Change" button that emits pickPoint: 'goal'. */
  allowGoalEdit?: boolean
  /** Current goal coordinates, controlled by the parent. */
  currentGoal?: { lng: number, lat: number } | null
  /** Seeds all editable fields (edit mode). */
  initialDraft?: TourDraft | null
  /** Prop-updates from parent after elevation lookup (create mode). */
  initialElevation?: number | null
  /** Prop-updates from parent after name suggestion (create mode). */
  initialName?: string | null
  /** Prop-updates from parent after start-point pick. */
  initialStartPoint?: { lng: number, lat: number } | null
  /** Prop-updates from parent after end-point pick. */
  initialEndPoint?: { lng: number, lat: number } | null
  /** Metadata (name + elevation) fetched after start-point pick. */
  initialStartPointMeta?: { name: string | null, elevation: number | null } | null
  /** Metadata (name + elevation) fetched after end-point pick. */
  initialEndPointMeta?: { name: string | null, elevation: number | null } | null
  /** When true, disable all inputs and buttons — used while location picker is active. */
  disabled?: boolean
}>()

const emit = defineEmits<{
  submit: [draft: TourDraft, gpxFile: File | null, gpxRemoved: boolean, preUploadedTourId: string | null]
  cancel: []
  pickPoint: [type: 'start' | 'end' | 'goal']
}>()

const { t } = useI18n({ useScope: 'global' })

const authStore = useAuthStore()
const contactsStore = useContactsStore()
const { contacts } = storeToRefs(contactsStore)

// ── Internal form state ──────────────────────────────────────────────────────
const tourName = ref(props.initialDraft?.name ?? props.initialName ?? '')
const plannedDate = ref(
  props.initialDraft?.plannedDate ? props.initialDraft.plannedDate.toISOString().split('T')[0] : '',
)
const selectedPartnerIds = ref<Set<string>>(new Set(props.initialDraft?.partnerIds ?? []))
const selectedTourType = ref<TourType | null>(props.initialDraft?.tourType ?? null)
const elevation = ref<string>(
  props.initialDraft?.elevation != null
    ? String(props.initialDraft.elevation)
    : props.initialElevation != null
      ? String(props.initialElevation)
      : '',
)
const elevationAutoFilled = ref(props.initialElevation != null)
const description = ref(props.initialDraft?.description ?? '')
const selectedSeasons = ref<Set<Season>>(new Set(props.initialDraft?.seasons ?? []))
const startPoint = ref<{ lng: number, lat: number } | null>(
  props.initialDraft?.startPoint ?? props.initialStartPoint ?? null,
)
const endPoint = ref<{ lng: number, lat: number } | null>(
  props.initialDraft?.endPoint ?? props.initialEndPoint ?? null,
)
const startPointName = ref<string>(
  props.initialDraft?.startPointName ?? props.initialStartPointMeta?.name ?? '',
)
const startPointElevation = ref<string>(
  props.initialDraft?.startPointElevation != null
    ? String(props.initialDraft.startPointElevation)
    : props.initialStartPointMeta?.elevation != null
      ? String(props.initialStartPointMeta.elevation)
      : '',
)
const endPointName = ref<string>(
  props.initialDraft?.endPointName ?? props.initialEndPointMeta?.name ?? '',
)
const endPointElevation = ref<string>(
  props.initialDraft?.endPointElevation != null
    ? String(props.initialDraft.endPointElevation)
    : props.initialEndPointMeta?.elevation != null
      ? String(props.initialEndPointMeta.elevation)
      : '',
)
const equipment = ref(props.initialDraft?.equipment ?? '')
const notes = ref(props.initialDraft?.notes ?? '')
const gpxFile = ref<File | null>(null)
const gpxFilepath = ref<string | null>(props.initialDraft?.gpxFilepath ?? null)
const gpxRemoved = ref(false)
const gpxError = ref<string | null>(null)
const nameError = ref(false)
const pendingGpxKey = ref<string | null>(null)
const pendingTourId = ref<string | null>(null)
const isUploadingGpx = ref(false)
const wasCancelledDuringUpload = ref(false)

// Sync individual prop updates from parent (create mode post-pick callbacks).
watch(
  () => props.initialElevation,
  (val) => {
    if (val != null) {
      elevation.value = String(val)
      elevationAutoFilled.value = true
    }
  },
)
watch(
  () => props.initialName,
  (val) => {
    if (val != null)
      tourName.value = val
  },
)
watch(
  () => props.initialStartPoint,
  (val) => {
    if (val)
      startPoint.value = val
  },
)
watch(
  () => props.initialStartPointMeta,
  (val) => {
    if (val) {
      if (val.name != null)
        startPointName.value = val.name
      if (val.elevation != null)
        startPointElevation.value = String(val.elevation)
    }
  },
)
watch(
  () => props.initialEndPoint,
  (val) => {
    if (val)
      endPoint.value = val
  },
)
watch(
  () => props.initialEndPointMeta,
  (val) => {
    if (val) {
      if (val.name != null)
        endPointName.value = val.name
      if (val.elevation != null)
        endPointElevation.value = String(val.elevation)
    }
  },
)

// ── Helpers ──────────────────────────────────────────────────────────────────
function togglePartner(contactId: string) {
  if (selectedPartnerIds.value.has(contactId)) {
    selectedPartnerIds.value.delete(contactId)
  }
  else {
    selectedPartnerIds.value.add(contactId)
  }
  selectedPartnerIds.value = new Set(selectedPartnerIds.value)
}

function toggleTourType(type: TourType) {
  selectedTourType.value = selectedTourType.value === type ? null : type
}

function toggleSeason(season: Season) {
  if (selectedSeasons.value.has(season)) {
    selectedSeasons.value.delete(season)
  }
  else {
    selectedSeasons.value.add(season)
  }
  selectedSeasons.value = new Set(selectedSeasons.value)
}

async function handleGpxUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return

  gpxError.value = null
  input.value = ''

  try {
    await parseGpxFile(file)
  }
  catch (err) {
    if (err instanceof GpxFileTooLargeError) {
      gpxError.value = t('tours.form.gpxTooLarge')
    }
    else if (err instanceof GpxParseError) {
      gpxError.value = t('tours.form.gpxInvalid')
    }
    else {
      gpxError.value = t('tours.form.gpxReadError')
    }
    gpxFile.value = null
    return
  }

  if (pendingGpxKey.value) {
    removeGpx(pendingGpxKey.value).catch(() => {})
    pendingGpxKey.value = null
    pendingTourId.value = null
  }

  gpxFile.value = file
  gpxRemoved.value = false

  const userId = authStore.currentUser?.id
  if (!userId) {
    gpxError.value = t('tours.form.gpxUploadFailed')
    gpxFile.value = null
    return
  }

  const newTourId = crypto.randomUUID()
  pendingTourId.value = newTourId
  isUploadingGpx.value = true
  wasCancelledDuringUpload.value = false

  try {
    const key = await uploadGpx(userId, newTourId, file)
    if (wasCancelledDuringUpload.value) {
      removeGpx(key).catch(() => {})
    }
    else {
      pendingGpxKey.value = key
    }
  }
  catch {
    if (!wasCancelledDuringUpload.value) {
      gpxError.value = t('tours.form.gpxUploadFailed')
      gpxFile.value = null
    }
    pendingTourId.value = null
  }
  finally {
    isUploadingGpx.value = false
  }
}

function handleCancel() {
  if (isUploadingGpx.value) {
    wasCancelledDuringUpload.value = true
  }
  else if (pendingGpxKey.value) {
    removeGpx(pendingGpxKey.value).catch(() => {})
    pendingGpxKey.value = null
  }
  emit('cancel')
}

function handleRemoveGpx() {
  if (pendingGpxKey.value) {
    removeGpx(pendingGpxKey.value).catch(() => {})
    pendingGpxKey.value = null
    pendingTourId.value = null
  }
  gpxFile.value = null
  gpxFilepath.value = null
  gpxRemoved.value = true
  gpxError.value = null
}

function handleRemoveStart() {
  startPoint.value = null
  startPointName.value = ''
  startPointElevation.value = ''
  endPoint.value = null
  endPointName.value = ''
  endPointElevation.value = ''
}

function handleRemoveEnd() {
  endPoint.value = null
  endPointName.value = ''
  endPointElevation.value = ''
}

function handleRoundTrip() {
  if (!startPoint.value)
    return
  endPoint.value = { lng: startPoint.value.lng, lat: startPoint.value.lat }
  endPointName.value = startPointName.value
  endPointElevation.value = startPointElevation.value
}

function formatPoint(point: { lng: number, lat: number }) {
  return `${point.lat.toFixed(4)}°N, ${point.lng.toFixed(4)}°E`
}

function handleSubmit() {
  if (props.disabled)
    return
  if (!tourName.value.trim()) {
    nameError.value = true
    document.getElementById('tf-tourName')?.focus()
    return
  }

  const effectiveGpxFilepath = gpxRemoved.value ? null : (pendingGpxKey.value ?? gpxFilepath.value)
  const preUploadedTourId = pendingTourId.value

  const draft: TourDraft = {
    name: tourName.value.trim(),
    plannedDate: plannedDate.value ? new Date(plannedDate.value) : null,
    partnerIds: Array.from(selectedPartnerIds.value),
    tourType: selectedTourType.value,
    elevation: elevation.value ? Number(elevation.value) : null,
    gpxFilepath: effectiveGpxFilepath,
    description: description.value.trim() || null,
    seasons: selectedSeasons.value.size > 0 ? Array.from(selectedSeasons.value) : null,
    startPoint: startPoint.value,
    endPoint: endPoint.value,
    startPointName: startPointName.value.trim() || null,
    startPointElevation: startPointElevation.value ? Number(startPointElevation.value) : null,
    endPointName: endPointName.value.trim() || null,
    endPointElevation: endPointElevation.value ? Number(endPointElevation.value) : null,
    equipment: equipment.value.trim() || null,
    notes: notes.value.trim() || null,
  }
  emit('submit', draft, null, gpxRemoved.value, preUploadedTourId)
}
</script>

<template>
  <form class="form" @submit.prevent="handleSubmit">
    <fieldset class="form-fieldset" :disabled="props.disabled">
      <div class="scroll-body">
        <!-- SECTION: Location Details -->
        <div class="section">
          <p class="section-label">
            {{ t('tours.form.locationSectionLabel') }}
          </p>

          <div class="field">
            <label class="label" for="tf-tourName">{{ t('tours.form.nameLabel') }} <span class="required-mark">*</span></label>
            <input
              id="tf-tourName"
              v-model="tourName"
              class="input"
              :class="{ 'input--error': nameError }"
              type="text"
              maxlength="100"
              :placeholder="t('tours.form.namePlaceholder')"
              aria-required="true"
              :aria-invalid="nameError"
              @input="nameError = false"
            >
            <p v-if="nameError" class="field-error">
              {{ t('tours.form.nameRequired') }}
            </p>
          </div>

          <!-- Goal (read-only display, with optional change button) -->
          <div v-if="currentGoal" class="point-section point-section--goal">
            <div class="point-section-header">
              <span class="material-symbols-outlined point-section-icon">flag</span>
              <span class="point-section-title">{{ t('tours.form.goalLabel') }}</span>
            </div>
            <div class="point-row">
              <span class="point-coords">{{ formatPoint(currentGoal) }}</span>
              <button
                v-if="allowGoalEdit"
                type="button"
                class="pick-btn"
                @click="emit('pickPoint', 'goal')"
              >
                <span class="material-symbols-outlined">my_location</span>
                {{ t('tours.form.changeGoalBtn') }}
              </button>
            </div>
            <div class="field">
              <label class="label" for="tf-elevation">{{ t('tours.form.elevationLabel') }}</label>
              <input
                id="tf-elevation"
                v-model="elevation"
                class="input"
                type="number"
                min="0"
                max="9000"
                :placeholder="t('tours.form.elevationPlaceholder')"
                @input="elevationAutoFilled = false"
              >
            </div>
          </div>

          <!-- Start point -->
          <div class="point-section point-section--start">
            <div class="point-section-header">
              <span class="material-symbols-outlined point-section-icon">trip_origin</span>
              <span class="point-section-title">{{ t('tours.form.startPointLabel') }}</span>
            </div>
            <div class="point-row">
              <span class="point-coords">{{
                startPoint ? formatPoint(startPoint) : t('tours.form.pointNotSet')
              }}</span>
              <button type="button" class="pick-btn" @click="emit('pickPoint', 'start')">
                <span class="material-symbols-outlined">my_location</span>
                {{ startPoint ? t('tours.form.changeGoalBtn') : t('tours.form.pickBtn') }}
              </button>
              <button
                v-if="startPoint"
                type="button"
                class="remove-point-btn"
                @click="handleRemoveStart"
              >
                <span class="material-symbols-outlined">close</span>
              </button>
            </div>
            <template v-if="startPoint">
              <div class="field">
                <label class="label" for="tf-start-name">{{
                  t('tours.form.pointNameLabel')
                }}</label>
                <input
                  id="tf-start-name"
                  v-model="startPointName"
                  class="input"
                  type="text"
                  maxlength="100"
                  :placeholder="t('tours.form.namePlaceholder')"
                >
              </div>
              <div class="field">
                <label class="label" for="tf-start-elevation">{{
                  t('tours.form.elevationLabel')
                }}</label>
                <input
                  id="tf-start-elevation"
                  v-model="startPointElevation"
                  class="input"
                  type="number"
                  min="0"
                  max="9000"
                  :placeholder="t('tours.form.elevationPlaceholder')"
                >
              </div>
            </template>
          </div>

          <!-- End point: only available once start point is set -->
          <div v-if="startPoint" class="point-section point-section--end">
            <div class="point-section-header">
              <span class="material-symbols-outlined point-section-icon">sports_score</span>
              <span class="point-section-title">{{ t('tours.form.endPointLabel') }}</span>
            </div>
            <template v-if="endPoint">
              <div class="point-row">
                <span class="point-coords">{{ formatPoint(endPoint) }}</span>
                <button type="button" class="pick-btn" @click="emit('pickPoint', 'end')">
                  <span class="material-symbols-outlined">my_location</span>
                  {{ t('tours.form.changeGoalBtn') }}
                </button>
                <button
                  type="button"
                  class="remove-point-btn"
                  @click="handleRemoveEnd"
                >
                  <span class="material-symbols-outlined">close</span>
                </button>
              </div>
              <div class="field">
                <label class="label" for="tf-end-name">{{ t('tours.form.pointNameLabel') }}</label>
                <input
                  id="tf-end-name"
                  v-model="endPointName"
                  class="input"
                  type="text"
                  maxlength="100"
                  :placeholder="t('tours.form.namePlaceholder')"
                >
              </div>
              <div class="field">
                <label class="label" for="tf-end-elevation">{{
                  t('tours.form.elevationLabel')
                }}</label>
                <input
                  id="tf-end-elevation"
                  v-model="endPointElevation"
                  class="input"
                  type="number"
                  min="0"
                  max="9000"
                  :placeholder="t('tours.form.elevationPlaceholder')"
                >
              </div>
            </template>
            <template v-else>
              <div class="point-row">
                <button type="button" class="pick-btn" @click="emit('pickPoint', 'end')">
                  <span class="material-symbols-outlined">add</span>
                  {{ t('tours.form.addEndPointBtn') }}
                </button>
                <button
                  type="button"
                  class="pick-btn"
                  @click="handleRoundTrip"
                >
                  <span class="material-symbols-outlined">replay</span>
                  {{ t('tours.form.roundTripBtn') }}
                </button>
              </div>
            </template>
          </div>
        </div>

        <!-- SECTION: Tour Partners -->
        <div v-if="contacts.length > 0" class="section">
          <p class="section-label">
            {{ t('tours.form.partnersLabel') }}
          </p>
          <div class="chips">
            <ContactChip
              v-for="contact in contacts"
              :key="contact.id"
              :contact="contact"
              :selected="selectedPartnerIds.has(contact.id)"
              @toggle="togglePartner"
            />
          </div>
        </div>

        <!-- SECTION: Tour Type -->
        <div class="section">
          <p class="section-label">
            {{ t('tours.form.activityLabel') }}
          </p>
          <div class="type-chips">
            <button
              v-for="type in TOUR_TYPE_VALUES"
              :key="type"
              type="button"
              class="type-chip"
              :class="{ selected: selectedTourType === type }"
              @click="toggleTourType(type)"
            >
              <span class="material-symbols-outlined type-icon">{{ TOUR_TYPE_ICONS[type] }}</span>
              <span class="type-label">{{
                t(`tours.type.${TOUR_TYPE_I18N_KEYS[type]}` as any)
              }}</span>
            </button>
          </div>
        </div>

        <!-- SECTION: Season -->
        <div class="section">
          <p class="section-label">
            {{ t('tours.form.seasonLabel') }}
          </p>
          <div class="season-chips">
            <button
              v-for="season in SEASON_VALUES"
              :key="season"
              type="button"
              class="season-chip"
              :class="{ selected: selectedSeasons.has(season) }"
              @click="toggleSeason(season)"
            >
              {{ t(`tours.season.${season}` as any) }}
            </button>
          </div>
        </div>

        <!-- SECTION: Details -->
        <div class="section">
          <p class="section-label">
            {{ t('tours.form.detailSectionLabel') }}
          </p>

          <div class="field">
            <label class="label" for="tf-plannedDate">{{ t('tours.form.plannedDateLabel') }}</label>
            <input id="tf-plannedDate" v-model="plannedDate" class="input" type="date">
          </div>

          <div class="field">
            <label class="label" for="tf-description">{{ t('tours.form.descriptionLabel') }}</label>
            <textarea
              id="tf-description"
              v-model="description"
              class="input textarea"
              rows="3"
              :placeholder="t('tours.form.descriptionPlaceholder')"
            />
          </div>

          <div class="field">
            <label class="label" for="tf-equipment">{{ t('tours.form.equipmentLabel') }}</label>
            <textarea
              id="tf-equipment"
              v-model="equipment"
              class="input textarea"
              rows="2"
              :placeholder="t('tours.form.equipmentPlaceholder')"
            />
          </div>

          <div class="field">
            <label class="label" for="tf-notes">{{ t('tours.form.notesLabel') }}</label>
            <textarea
              id="tf-notes"
              v-model="notes"
              class="input textarea"
              rows="2"
              :placeholder="t('tours.form.notesPlaceholder')"
            />
          </div>
        </div>

        <!-- SECTION: GPX Track -->
        <div class="section">
          <p class="section-label">
            {{ t('tours.form.gpxLabel') }}
          </p>
          <div v-if="gpxFile || gpxFilepath" class="gpx-filled-row">
            <span class="gpx-filename">
              <span v-if="isUploadingGpx" class="gpx-spinner" />
              <span v-else class="material-symbols-outlined gpx-ok-icon">route</span>
              {{ gpxFile ? gpxFile.name : t('tours.form.gpxExistingTrack') }}
              <span v-if="isUploadingGpx" class="gpx-uploading-label">{{ t('tours.form.gpxUploading') }}</span>
            </span>
            <label
              class="gpx-icon-btn"
              :title="t('tours.form.gpxReplaceTooltip')"
              :aria-label="t('tours.form.gpxReplaceTooltip')"
            >
              <span class="material-symbols-outlined">upload_file</span>
              <input
                type="file"
                accept=".gpx,application/gpx+xml"
                class="hidden-input"
                @change="handleGpxUpload"
              >
            </label>
            <button
              type="button"
              class="gpx-icon-btn gpx-remove-btn"
              :title="t('tours.form.gpxRemoveTooltip')"
              :aria-label="t('tours.form.gpxRemoveTooltip')"
              @click="handleRemoveGpx"
            >
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          <div v-else class="gpx-empty-row">
            <label class="pick-btn gpx-upload-btn">
              <span class="material-symbols-outlined">upload_file</span>
              {{ t('tours.form.gpxUploadBtn') }}
              <input
                type="file"
                accept=".gpx,application/gpx+xml"
                class="hidden-input"
                @change="handleGpxUpload"
              >
            </label>
          </div>
          <p v-if="gpxError" class="gpx-error">
            {{ gpxError }}
          </p>
        </div>
      </div>
      <!-- end scroll-body -->

      <div class="actions">
        <button type="button" class="cancel-btn" @click="handleCancel">
          {{ t('tours.form.cancelBtn') }}
        </button>
        <button type="submit" class="submit-btn" :disabled="isUploadingGpx">
          {{ submitLabel }}
        </button>
      </div>
    </fieldset>
  </form>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.form-fieldset {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  min-width: 0;
  border: 0;
  margin: 0;
  padding: 0;
}

.form-fieldset[disabled] {
  opacity: 0.7;
}

.scroll-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 var(--spacing-xs) var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
  scrollbar-width: thin;
  scrollbar-color: var(--color-outline-variant) transparent;
}

.scroll-body::-webkit-scrollbar {
  width: 5px;
}

.scroll-body::-webkit-scrollbar-thumb {
  background-color: var(--color-outline-variant);
  border-radius: 9999px;
}

/* Sections */
.section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.section-label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-outline);
}

/* Tour type chips */
.type-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.type-chip {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1.5px solid var(--color-outline-variant);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
  background-color: transparent;
  transition:
    background-color 0.15s,
    border-color 0.15s,
    color 0.15s;
  cursor: pointer;
}

.type-chip:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.type-chip.selected {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-on-primary);
}

.type-icon {
  font-size: 18px;
}

.type-label {
  white-space: nowrap;
}

/* Season chips */
.season-chips {
  display: flex;
  gap: var(--spacing-xs);
}

.season-chip {
  flex: 1;
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1.5px solid var(--color-outline-variant);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
  text-align: center;
  transition:
    background-color 0.15s,
    border-color 0.15s,
    color 0.15s;
  cursor: pointer;
}

.season-chip:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.season-chip.selected {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-on-primary);
}

/* Fields */
.field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-on-surface-variant);
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.optional-hint {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-normal);
  color: var(--color-outline);
}

.input {
  padding: var(--spacing-md);
  border: 1.5px solid var(--color-outline-variant);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-base);
  color: var(--color-on-surface);
  background-color: var(--color-background);
  outline: none;
  transition: border-color 0.2s;
  font-family: inherit;
}

.input:focus {
  border-color: var(--color-primary);
}

.input--error {
  border-color: var(--color-error, #d32f2f);
}

.input--error:focus {
  border-color: var(--color-error, #d32f2f);
}

.required-mark {
  color: var(--color-error, #d32f2f);
}

.field-error {
  margin-top: var(--spacing-xs);
  font-size: var(--font-size-sm);
  color: var(--color-error, #d32f2f);
}

.textarea {
  resize: vertical;
  min-height: 72px;
}

/* Point sections (goal / start / end) */
.point-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-outline-variant);
  border-left: 3px solid var(--color-outline-variant);
  border-radius: var(--radius-sm);
  background-color: var(--color-surface-variant, transparent);
}

.point-section--goal {
  border-left-color: var(--color-primary);
}

.point-section--start {
  border-left-color: #2e7d32;
}

.point-section--end {
  border-left-color: #c62828;
}

.point-section-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-on-surface);
}

.point-section-icon {
  font-size: 18px;
  color: var(--color-on-surface-variant);
}

.point-section--goal .point-section-icon {
  color: var(--color-primary);
}

.point-section--start .point-section-icon {
  color: #2e7d32;
}

.point-section--end .point-section-icon {
  color: #c62828;
}

.point-section-title {
  letter-spacing: 0.02em;
}

/* Point pickers */
.point-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.point-coords {
  flex: 1;
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
  font-family: monospace;
}

.pick-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1.5px solid var(--color-outline-variant);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
  background: transparent;
  cursor: pointer;
  white-space: nowrap;
  transition:
    border-color 0.15s,
    color 0.15s;
}

.pick-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.pick-btn .material-symbols-outlined {
  font-size: 16px;
}

.remove-point-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  color: var(--color-outline);
  flex-shrink: 0;
}

.remove-point-btn:hover {
  background-color: var(--color-surface-variant);
  color: var(--color-on-surface-variant);
}

.remove-point-btn .material-symbols-outlined {
  font-size: 16px;
}

/* GPX */
.gpx-empty-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.gpx-filled-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
  min-height: 44px;
}

.gpx-upload-btn {
  cursor: pointer;
}

.gpx-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: 1.5px solid var(--color-outline-variant);
  border-radius: var(--radius-sm);
  color: var(--color-on-surface-variant);
  background: transparent;
  cursor: pointer;
  flex-shrink: 0;
  transition:
    border-color 0.15s,
    color 0.15s;
}

.gpx-icon-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.gpx-icon-btn .material-symbols-outlined {
  font-size: 20px;
}

.gpx-remove-btn:hover {
  border-color: var(--color-error) !important;
  color: var(--color-error) !important;
}

.hidden-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  overflow: hidden;
}

.gpx-filename {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}

.gpx-ok-icon {
  font-size: 16px;
  color: var(--color-primary);
}

.gpx-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-outline-variant);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: gpx-spin 0.7s linear infinite;
  flex-shrink: 0;
}

@keyframes gpx-spin {
  to {
    transform: rotate(360deg);
  }
}

.gpx-uploading-label {
  font-size: var(--font-size-xs);
  color: var(--color-outline);
}

.gpx-error {
  font-size: var(--font-size-sm);
  color: var(--color-error, #d32f2f);
}

/* Partner chips */
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) 0;
}

/* Actions footer */
.actions {
  display: flex;
  gap: var(--spacing-md);
  justify-content: flex-end;
  padding: var(--spacing-md) 0 var(--spacing-xl);
  border-top: 1px solid var(--color-outline-variant);
  flex-shrink: 0;
}

.cancel-btn {
  padding: var(--spacing-sm) var(--spacing-lg);
  border-radius: 12px;
  border: 1px solid var(--color-outline-variant);
  color: var(--color-on-surface-variant);
  font-size: var(--font-size-base);
  transition: background-color 0.2s;
}

.cancel-btn:hover {
  background-color: var(--color-surface-variant);
}

.submit-btn {
  padding: var(--spacing-sm) var(--spacing-lg);
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  border-radius: 12px;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  transition:
    background-color 0.2s,
    transform 0.15s;
}

.submit-btn:hover {
  background-color: var(--color-primary-dark);
  transform: translateY(-1px);
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.submit-btn:disabled:hover {
  background-color: var(--color-primary);
  transform: none;
}
</style>
