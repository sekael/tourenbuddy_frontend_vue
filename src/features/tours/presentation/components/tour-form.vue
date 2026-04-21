<script setup lang="ts">
import type { Season } from '@/features/tours/data/models/season'
import type { TourType } from '@/features/tours/data/models/tour-type'
import type { TourDraft } from '@/features/tours/domain/entities/tour'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
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
  /** When true, disable all inputs and buttons — used while location picker is active. */
  disabled?: boolean
}>()

const emit = defineEmits<{
  submit: [draft: TourDraft]
  cancel: []
  pickPoint: [type: 'start' | 'end' | 'goal']
}>()

const { t } = useI18n({ useScope: 'global' })

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
const equipment = ref(props.initialDraft?.equipment ?? '')
const notes = ref(props.initialDraft?.notes ?? '')
const gpxTrack = ref<GeoJSON.FeatureCollection | null>(props.initialDraft?.gpxTrack ?? null)
const gpxFileName = ref<string | null>(gpxTrack.value ? 'Existing track' : null)
const gpxError = ref<string | null>(null)
const nameError = ref(false)

// Resolved display values: single point defaults to the other, both null stays null.
const effectiveStartPoint = computed(() => startPoint.value ?? endPoint.value ?? null)
const effectiveEndPoint = computed(() => endPoint.value ?? startPoint.value ?? null)

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
    if (val)
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
  () => props.initialEndPoint,
  (val) => {
    if (val)
      endPoint.value = val
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

  try {
    gpxTrack.value = await parseGpxFile(file)
    gpxFileName.value = file.name
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
    gpxTrack.value = null
    gpxFileName.value = null
  }
  input.value = ''
}

function removeGpx() {
  gpxTrack.value = null
  gpxFileName.value = null
  gpxError.value = null
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

  const draft: TourDraft = {
    name: tourName.value.trim(),
    plannedDate: plannedDate.value ? new Date(plannedDate.value) : null,
    partnerIds: Array.from(selectedPartnerIds.value),
    tourType: selectedTourType.value,
    elevation: elevation.value ? Number(elevation.value) : null,
    gpxTrack: gpxTrack.value,
    description: description.value.trim() || null,
    seasons: selectedSeasons.value.size > 0 ? Array.from(selectedSeasons.value) : null,
    startPoint: effectiveStartPoint.value,
    endPoint: effectiveEndPoint.value,
    equipment: equipment.value.trim() || null,
    notes: notes.value.trim() || null,
  }
  emit('submit', draft)
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
          <div v-if="currentGoal" class="field">
            <p class="label">
              {{ t('tours.form.goalLabel') }}
            </p>
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

          <div class="field">
            <p class="label">
              {{ t('tours.form.startPointLabel') }}
            </p>
            <div class="point-row">
              <span class="point-coords">{{
                effectiveStartPoint ? formatPoint(effectiveStartPoint) : t('tours.form.pointNotSet')
              }}</span>
              <span v-if="!startPoint && endPoint" class="optional-hint">{{
                t('tours.form.sameAsEnd')
              }}</span>
              <button type="button" class="pick-btn" @click="emit('pickPoint', 'start')">
                <span class="material-symbols-outlined">my_location</span>
                {{ startPoint ? t('tours.form.changeGoalBtn') : t('tours.form.pickBtn') }}
              </button>
              <button
                v-if="startPoint"
                type="button"
                class="remove-point-btn"
                @click="startPoint = null"
              >
                <span class="material-symbols-outlined">close</span>
              </button>
            </div>
          </div>

          <div class="field">
            <p class="label">
              {{ t('tours.form.endPointLabel') }}
            </p>
            <div class="point-row">
              <span class="point-coords">{{
                effectiveEndPoint ? formatPoint(effectiveEndPoint) : t('tours.form.pointNotSet')
              }}</span>
              <span v-if="!endPoint && startPoint" class="optional-hint">{{
                t('tours.form.roundTrip')
              }}</span>
              <button type="button" class="pick-btn" @click="emit('pickPoint', 'end')">
                <span class="material-symbols-outlined">my_location</span>
                {{ endPoint ? t('tours.form.changeGoalBtn') : t('tours.form.pickBtn') }}
              </button>
              <button
                v-if="endPoint"
                type="button"
                class="remove-point-btn"
                @click="endPoint = null"
              >
                <span class="material-symbols-outlined">close</span>
              </button>
            </div>
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
            {{ t('tours.form.gpxSectionLabel') }}
          </p>
          <div class="gpx-row">
            <label class="pick-btn gpx-upload-btn">
              <span class="material-symbols-outlined">upload_file</span>
              Upload GPX
              <input
                type="file"
                accept=".gpx,application/gpx+xml"
                class="hidden-input"
                @change="handleGpxUpload"
              >
            </label>
            <span v-if="gpxFileName" class="gpx-filename">
              <span class="material-symbols-outlined gpx-ok-icon">check_circle</span>
              {{ gpxFileName }}
            </span>
            <button v-if="gpxFileName" type="button" class="remove-point-btn" @click="removeGpx">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          <p v-if="gpxError" class="gpx-error">
            {{ gpxError }}
          </p>
        </div>
      </div>
      <!-- end scroll-body -->

      <div class="actions">
        <button type="button" class="cancel-btn" @click="emit('cancel')">
          {{ t('tours.form.cancelBtn') }}
        </button>
        <button type="submit" class="submit-btn">
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
.gpx-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.gpx-upload-btn {
  cursor: pointer;
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
</style>
