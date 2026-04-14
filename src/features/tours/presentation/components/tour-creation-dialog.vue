<script setup lang="ts">
import type { Season } from '@/features/tours/data/models/season'
import type { TourType } from '@/features/tours/data/models/tour-type'
import type { TourDraft } from '@/features/tours/domain/entities/tour'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import ContactChip from '@/features/contacts/presentation/components/contact-chip.vue'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'
import { SEASON_LABELS, SEASON_VALUES } from '@/features/tours/data/models/season'
import {
  TOUR_TYPE_ICONS,
  TOUR_TYPE_LABELS,
  TOUR_TYPE_VALUES,
} from '@/features/tours/data/models/tour-type'
import {
  GpxFileTooLargeError,
  GpxParseError,
  parseGpxFile,
} from '@/features/tours/data/services/gpx-parser'

const props = defineProps<{
  /** Pre-filled elevation from Swisstopo lookup. */
  initialElevation?: number | null
  /** Pre-filled name suggestion from Swisstopo. */
  initialName?: string | null
  /** Pre-filled start point from secondary location pick. */
  initialStartPoint?: { lng: number, lat: number } | null
  /** Pre-filled end point from secondary location pick. */
  initialEndPoint?: { lng: number, lat: number } | null
}>()

const emit = defineEmits<{
  confirm: [draft: TourDraft]
  close: []
  pickPoint: [type: 'start' | 'end']
}>()

const contactsStore = useContactsStore()
const { contacts } = storeToRefs(contactsStore)

const tourName = ref(props.initialName ?? '')
const plannedDate = ref('')
const selectedPartnerIds = ref<Set<string>>(new Set())
const selectedTourType = ref<TourType | null>(null)
const elevation = ref<string>(props.initialElevation != null ? String(props.initialElevation) : '')
const elevationAutoFilled = ref(props.initialElevation != null)
const description = ref('')
const selectedSeasons = ref<Set<Season>>(new Set())
const startPoint = ref<{ lng: number, lat: number } | null>(props.initialStartPoint ?? null)
const endPoint = ref<{ lng: number, lat: number } | null>(props.initialEndPoint ?? null)
const equipment = ref('')
const notes = ref('')
const gpxTrack = ref<GeoJSON.FeatureCollection | null>(null)
const gpxFileName = ref<string | null>(null)
const gpxError = ref<string | null>(null)
const nameError = ref(false)

// Resolved display values: single point defaults to the other, both null stays null.
const effectiveStartPoint = computed(() => startPoint.value ?? endPoint.value ?? null)
const effectiveEndPoint = computed(() => endPoint.value ?? startPoint.value ?? null)

// Sync props → reactive state when parent updates values (e.g. after point pick)
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
      gpxError.value = 'File too large (max 2 MB)'
    }
    else if (err instanceof GpxParseError) {
      gpxError.value = 'Invalid GPX file'
    }
    else {
      gpxError.value = 'Failed to read file'
    }
    gpxTrack.value = null
    gpxFileName.value = null
  }
  // Reset file input so same file can be re-selected after removing
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

function handleConfirm() {
  if (!tourName.value.trim()) {
    nameError.value = true
    document.getElementById('tourName')?.focus()
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
  emit('confirm', draft)
}
</script>

<template>
  <div class="dialog-backdrop" @click.self="emit('close')">
    <div class="dialog">
      <div class="header">
        <h2 class="title">
          New Tour
        </h2>
        <button class="close-btn" aria-label="Close" @click="emit('close')">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <form class="form" @submit.prevent="handleConfirm">
        <div class="scroll-body">
          <!-- SECTION: Location Details -->
          <div class="section">
            <p class="section-label">
              Location
            </p>

            <div class="field">
              <label class="label" for="tourName">Tour Name <span class="required-mark">*</span></label>
              <input
                id="tourName"
                v-model="tourName"
                class="input"
                :class="{ 'input--error': nameError }"
                type="text"
                maxlength="100"
                placeholder="e.g. Rigi Kulm"
                aria-required="true"
                :aria-invalid="nameError"
                @input="nameError = false"
              >
              <p v-if="nameError" class="field-error">
                Tour name is required.
              </p>
            </div>

            <div class="field">
              <label class="label" for="elevation">
                Elevation (m)
              </label>
              <input
                id="elevation"
                v-model="elevation"
                class="input"
                type="number"
                min="0"
                max="9000"
                placeholder="Elevation in meters"
                @input="elevationAutoFilled = false"
              >
            </div>

            <div class="field">
              <p class="label">
                Start Point
              </p>
              <div class="point-row">
                <span class="point-coords">{{
                  effectiveStartPoint ? formatPoint(effectiveStartPoint) : 'Not set'
                }}</span>
                <span v-if="!startPoint && endPoint" class="optional-hint">same as end</span>
                <button type="button" class="pick-btn" @click="emit('pickPoint', 'start')">
                  <span class="material-symbols-outlined">my_location</span>
                  {{ startPoint ? 'Change' : 'Pick' }}
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
                End Point
              </p>
              <div class="point-row">
                <span class="point-coords">{{
                  effectiveEndPoint ? formatPoint(effectiveEndPoint) : 'Not set'
                }}</span>
                <span v-if="!endPoint && startPoint" class="optional-hint">round trip</span>
                <button type="button" class="pick-btn" @click="emit('pickPoint', 'end')">
                  <span class="material-symbols-outlined">my_location</span>
                  {{ endPoint ? 'Change' : 'Pick' }}
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
              Tour Partners
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
              Activity Type
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
                <span class="type-label">{{ TOUR_TYPE_LABELS[type] }}</span>
              </button>
            </div>
          </div>

          <!-- SECTION: Season -->
          <div class="section">
            <p class="section-label">
              Season
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
                {{ SEASON_LABELS[season] }}
              </button>
            </div>
          </div>

          <!-- SECTION: Details -->
          <div class="section">
            <p class="section-label">
              Details
            </p>

            <div class="field">
              <label class="label" for="plannedDate">Planned Date</label>
              <input id="plannedDate" v-model="plannedDate" class="input" type="date">
            </div>

            <div class="field">
              <label class="label" for="description">Description / Guide</label>
              <textarea
                id="description"
                v-model="description"
                class="input textarea"
                rows="3"
                placeholder="Route description, links, notes…"
              />
            </div>

            <div class="field">
              <label class="label" for="equipment">Equipment</label>
              <textarea
                id="equipment"
                v-model="equipment"
                class="input textarea"
                rows="2"
                placeholder="Gear list…"
              />
            </div>

            <div class="field">
              <label class="label" for="notes">Notes</label>
              <textarea
                id="notes"
                v-model="notes"
                class="input textarea"
                rows="2"
                placeholder="Any other info…"
              />
            </div>
          </div>

          <!-- SECTION: GPX Track -->
          <div class="section">
            <p class="section-label">
              GPX Track
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
          <button type="button" class="cancel-btn" @click="emit('close')">
            Cancel
          </button>
          <button type="submit" class="submit-btn">
            Save Tour
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 100;
}

@media (min-width: 600px) {
  .dialog-backdrop {
    align-items: center;
  }
}

.dialog {
  background-color: var(--color-background);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  width: 100%;
  max-width: 560px;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
  max-height: 85dvh;
}

@media (min-width: 600px) {
  .dialog {
    border-radius: var(--radius-lg);
    max-height: 90dvh;
  }
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-xl) var(--spacing-xl) var(--spacing-md);
  flex-shrink: 0;
}

.title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
}

.close-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-on-surface-variant);
  flex-shrink: 0;
}

.close-btn:hover {
  background-color: var(--color-surface-variant);
}

.form {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.scroll-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 var(--spacing-xl) var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
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

.auto-fill-badge {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-normal);
  color: var(--color-primary);
  background-color: color-mix(in srgb, var(--color-primary) 10%, transparent);
  border-radius: 4px;
  padding: 1px 6px;
}

.auto-fill-badge .material-symbols-outlined {
  font-size: 14px;
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
  padding: var(--spacing-md) var(--spacing-xl) var(--spacing-xl);
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
