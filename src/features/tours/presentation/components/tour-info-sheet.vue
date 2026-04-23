<script setup lang="ts">
import type { Tour, TourDraft } from '@/features/tours/domain/entities/tour'
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BottomSheet from '@/core/components/bottom-sheet.vue'
import SideDrawer from '@/core/components/side-drawer.vue'
import { useIsDesktop } from '@/core/composables/use-is-desktop'
import { useLogger } from '@/core/logging/use-logger'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
import ContactActionMenu from '@/features/contacts/presentation/components/contact-action-menu.vue'
import ContactChip from '@/features/contacts/presentation/components/contact-chip.vue'
import GroupSmsConfirmDialog from '@/features/contacts/presentation/components/group-sms-confirm-dialog.vue'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'
import { useMapStore } from '@/features/map/presentation/stores/map-store'
import { TOUR_TYPE_I18N_KEYS, TOUR_TYPE_ICONS } from '@/features/tours/data/models/tour-type'
import TourForm from '@/features/tours/presentation/components/tour-form.vue'
import { useToursStore } from '@/features/tours/presentation/stores/tours-store'

const props = defineProps<{
  tour: Tour
  /** Set by map-page after a location pick triggered from this sheet. Reset to null via pointConsumed. */
  editPickedPoint?: {
    type: 'start' | 'end' | 'goal'
    location: { lng: number, lat: number }
    elevation?: number | null
    suggestedName?: string | null
  } | null
  /** Desktop only: show a back button pointing to the tours list. */
  showBack?: boolean
}>()
const emit = defineEmits<{
  close: []
  back: []
  pickPoint: [type: 'start' | 'end' | 'goal']
  pointConsumed: []
  /** Fired when the sheet enters (true) or exits (false) edit mode. */
  editModeChange: [editing: boolean]
  /** Fired when the user requests to edit a contact from the action menu. */
  editContact: [contactId: string]
}>()

const { t, locale } = useI18n({ useScope: 'global' })

const contactsStore = useContactsStore()
const toursStore = useToursStore()
const mapStore = useMapStore()
const authStore = useAuthStore()
const { contacts } = storeToRefs(contactsStore)
const { isPickingLocation } = storeToRefs(mapStore)
const { currentUser } = storeToRefs(authStore)
const isDesktop = useIsDesktop()
const log = useLogger('tour-info-sheet')

const isPicking = computed(() => isPickingLocation.value)

const isOwner = computed(() => !!currentUser.value && currentUser.value.id === props.tour.userId)

// ── View/edit mode ───────────────────────────────────────────────────────────
const mode = ref<'view' | 'edit'>('view')

// Pending goal/points during edit — updated reactively via editPickedPoint prop
const pendingGoal = ref<{ lng: number, lat: number }>({ ...props.tour.goal })
const pendingStartPoint = ref<{ lng: number, lat: number } | null>(null)
const pendingEndPoint = ref<{ lng: number, lat: number } | null>(null)
// Elevation/name updated from Swisstopo after a goal re-pick in edit mode
const pendingElevation = ref<number | null>(null)
const pendingSuggestedName = ref<string | null>(null)

function enterEditMode() {
  pendingGoal.value = { ...props.tour.goal }
  pendingStartPoint.value = null
  pendingEndPoint.value = null
  pendingElevation.value = null
  pendingSuggestedName.value = null
  mode.value = 'edit'
  emit('editModeChange', true)
}

function cancelEdit() {
  mode.value = 'view'
  emit('editModeChange', false)
}

// Sheet dismissed (map background click, close button, tour deleted, etc.) while
// edit mode is still active: notify parent so preview marker is cleaned up.
onBeforeUnmount(() => {
  if (mode.value === 'edit')
    emit('editModeChange', false)
})

// Reactive handoff from map-page after a location pick in edit mode
watch(
  () => props.editPickedPoint,
  (pick) => {
    if (!pick)
      return
    if (pick.type === 'goal') {
      pendingGoal.value = pick.location
      pendingElevation.value = pick.elevation ?? null
      pendingSuggestedName.value = pick.suggestedName ?? null
    }
    else if (pick.type === 'start') {
      pendingStartPoint.value = pick.location
    }
    else {
      pendingEndPoint.value = pick.location
    }
    emit('pointConsumed')
  },
)

// ── Edit save ────────────────────────────────────────────────────────────────
const saveError = ref<string | null>(null)
const isSaving = ref(false)

async function handleEditSubmit(draft: TourDraft) {
  if (mapStore.isPickingLocation) {
    log.debug('Ignoring edit submit while location picker is active')
    return
  }
  saveError.value = null
  isSaving.value = true
  try {
    await toursStore.updateTour(props.tour.id, draft, pendingGoal.value)
    mode.value = 'view'
    emit('editModeChange', false)
  }
  catch (err) {
    saveError.value = err instanceof Error ? err.message : t('tours.infoSheet.saveFailed')
  }
  finally {
    isSaving.value = false
  }
}

// ── Completion toggle ────────────────────────────────────────────────────────
async function toggleCompleted() {
  await toursStore.setCompleted(props.tour.id, !props.tour.completed)
}

// ── Delete ───────────────────────────────────────────────────────────────────
const deleteState = ref<'idle' | 'confirm' | 'loading'>('idle')
const deleteError = ref<string | null>(null)

async function confirmDelete() {
  deleteError.value = null
  deleteState.value = 'loading'
  try {
    await toursStore.deleteTour(props.tour.id)
    emit('close')
  }
  catch (err) {
    deleteError.value = err instanceof Error ? err.message : t('tours.infoSheet.deleteFailed')
    deleteState.value = 'idle'
  }
}

// ── Read-only computed values ────────────────────────────────────────────────
const displayName = computed(() => props.tour.name ?? t('tours.infoSheet.unnamedTour'))

// While the location picker is active and we're in edit mode, collapse the
// sheet/drawer to a header-only surface so the map (and crosshair) stay
// visible and the form can't be submitted with stale state. Applies to both
// desktop (side drawer → compact top-right header) and mobile (bottom sheet
// → title-only bar).
const sheetCollapsed = computed(() => isPicking.value && mode.value === 'edit')
const sheetTitle = computed(() => {
  if (sheetCollapsed.value)
    return t('tours.infoSheet.editTitle', { name: displayName.value })
  return mode.value === 'edit'
    ? `${t('tours.infoSheet.editTitlePrefix')}: ${displayName.value}`
    : displayName.value
})

const formattedDate = computed(() => {
  if (!props.tour.plannedDate)
    return null
  return new Intl.DateTimeFormat(locale.value, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(props.tour.plannedDate)
})

const partners = computed(() => contacts.value.filter(c => props.tour.partnerIds.includes(c.id)))

// ── Contact action menu ──────────────────────────────────────────────────────
const activeMenuContactId = ref<string | null>(null)
const activeMenuContact = computed(() =>
  activeMenuContactId.value
    ? (partners.value.find(c => c.id === activeMenuContactId.value) ?? null)
    : null,
)
const activeChipRect = ref<DOMRect | null>(null)
const showGroupSmsDialog = ref(false)

function openContactMenu(contactId: string, rect: DOMRect) {
  activeMenuContactId.value = contactId
  activeChipRect.value = rect
}

function closeContactMenu() {
  activeMenuContactId.value = null
  activeChipRect.value = null
}

function handleEditContact(contactId: string) {
  closeContactMenu()
  if (!isDesktop.value) {
    emit('close')
  }
  emit('editContact', contactId)
}

const coordinates = computed(
  () => `${props.tour.goal.lat.toFixed(4)}°N, ${props.tour.goal.lng.toFixed(4)}°E`,
)

const formattedElevation = computed(() => {
  if (props.tour.elevation == null)
    return null
  return `${new Intl.NumberFormat(locale.value, { maximumFractionDigits: 0 }).format(props.tour.elevation)} m`
})

const startPointText = computed(() => {
  if (!props.tour.startPoint)
    return null
  return `${props.tour.startPoint.lat.toFixed(4)}°N, ${props.tour.startPoint.lng.toFixed(4)}°E`
})

const endPointText = computed(() => {
  if (!props.tour.endPoint)
    return null
  return `${props.tour.endPoint.lat.toFixed(4)}°N, ${props.tour.endPoint.lng.toFixed(4)}°E`
})

const isRoundTrip = computed(() => {
  const s = props.tour.startPoint
  const e = props.tour.endPoint
  if (!s)
    return false
  if (!e)
    return true
  return s.lng === e.lng && s.lat === e.lat
})

/** Auto-link URLs in plain text: returns array of segments {text, url?}. */
function linkifyText(text: string): Array<{ text: string, url?: string }> {
  const urlPattern = /https?:\/\/[^\s<>[\]{}|\\^`"]+/g
  const segments: Array<{ text: string, url?: string }> = []
  let lastIndex = 0
  for (let match = urlPattern.exec(text); match !== null; match = urlPattern.exec(text)) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index) })
    }
    segments.push({ text: match[0], url: match[0] })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex) })
  }

  return segments.length > 0 ? segments : [{ text }]
}
</script>

<template>
  <component
    :is="isDesktop ? SideDrawer : BottomSheet"
    :title="sheetTitle"
    :collapsed="sheetCollapsed"
    :back-label="props.showBack && isDesktop ? t('tours.infoSheet.backToTours') : undefined"
    :show-back="props.showBack && !isDesktop ? true : undefined"
    @close="emit('close')"
    @back="emit('back')"
  >
    <!-- ── Edit mode ────────────────────────────────────────────────────── -->
    <template v-if="mode === 'edit'">
      <p v-if="saveError" class="save-error">
        {{ saveError }}
      </p>
      <TourForm
        :submit-label="t('tours.infoSheet.saveLabel')"
        :allow-goal-edit="true"
        :current-goal="pendingGoal"
        :initial-draft="tour"
        :initial-elevation="pendingElevation"
        :initial-name="pendingSuggestedName"
        :initial-start-point="pendingStartPoint"
        :initial-end-point="pendingEndPoint"
        :disabled="isPicking"
        @submit="handleEditSubmit"
        @cancel="cancelEdit"
        @pick-point="emit('pickPoint', $event)"
      />
    </template>

    <!-- ── View mode ───────────────────────────────────────────────────── -->
    <template v-else>
      <div class="details">
        <!-- Completion toggle (owner only) -->
        <button
          v-if="isOwner"
          type="button"
          class="completion-toggle action-btn"
          :class="{ 'completion-toggle--done': tour.completed }"
          :aria-pressed="tour.completed"
          @click="toggleCompleted"
        >
          <span v-if="tour.completed" class="material-symbols-outlined">check_circle</span>
          <span v-else class="material-symbols-outlined">radio_button_unchecked</span>
          {{
            tour.completed
              ? t('tours.infoSheet.completedBtn')
              : t('tours.infoSheet.completeTourBtn')
          }}
        </button>

        <!-- Tour type -->
        <div v-if="tour.tourType" class="detail-row">
          <span class="detail-icon material-symbols-outlined">{{
            TOUR_TYPE_ICONS[tour.tourType]
          }}</span>
          <span>{{ t(`tours.type.${TOUR_TYPE_I18N_KEYS[tour.tourType]}` as any) }}</span>
        </div>

        <!-- Planned date -->
        <div v-if="formattedDate" class="detail-row">
          <span class="detail-icon material-symbols-outlined">calendar_today</span>
          <span>{{ formattedDate }}</span>
        </div>

        <!-- Goal coordinates -->
        <div class="detail-row">
          <span class="detail-icon material-symbols-outlined">location_on</span>
          <span class="coords">{{ coordinates }}</span>
        </div>

        <!-- Elevation -->
        <div v-if="formattedElevation" class="detail-row">
          <span class="detail-icon material-symbols-outlined">landscape</span>
          <span>{{ formattedElevation }}</span>
        </div>

        <!-- Start / end points -->
        <template v-if="startPointText">
          <div class="detail-row">
            <span class="detail-icon material-symbols-outlined">home</span>
            <span class="coords">{{ startPointText }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-icon material-symbols-outlined">flag</span>
            <span v-if="isRoundTrip" class="round-trip-hint">{{
              t('tours.infoSheet.roundTrip')
            }}</span>
            <span v-else class="coords">{{ endPointText }}</span>
          </div>
        </template>

        <!-- Seasons -->
        <div v-if="tour.seasons && tour.seasons.length > 0" class="detail-row align-start">
          <span class="detail-icon material-symbols-outlined">wb_sunny</span>
          <div class="season-tags">
            <span v-for="season in tour.seasons" :key="season" class="season-tag">
              {{ t(`tours.season.${season}` as any) }}
            </span>
          </div>
        </div>

        <!-- Description -->
        <div v-if="tour.description" class="detail-row align-start">
          <span class="detail-icon material-symbols-outlined">description</span>
          <p class="description-text">
            <template v-for="(segment, i) in linkifyText(tour.description)" :key="i">
              <a
                v-if="segment.url"
                :href="segment.url"
                target="_blank"
                rel="noopener noreferrer"
                class="description-link"
              >{{ segment.text }}</a>
              <template v-else>
                {{ segment.text }}
              </template>
            </template>
          </p>
        </div>

        <!-- Equipment -->
        <div v-if="tour.equipment" class="detail-row align-start">
          <span class="detail-icon material-symbols-outlined">hardware</span>
          <p class="detail-text">
            {{ tour.equipment }}
          </p>
        </div>

        <!-- Notes -->
        <div v-if="tour.notes" class="detail-row align-start">
          <span class="detail-icon material-symbols-outlined">sticky_note_2</span>
          <p class="detail-text">
            {{ tour.notes }}
          </p>
        </div>

        <!-- GPX track indicator -->
        <div v-if="tour.gpxTrack" class="detail-row">
          <span class="detail-icon material-symbols-outlined">route</span>
          <span class="gpx-label">{{ t('tours.infoSheet.gpxTrackAvailable') }}</span>
        </div>

        <!-- Partners -->
        <div v-if="partners.length > 0" class="detail-row align-start">
          <span class="detail-icon material-symbols-outlined">group</span>
          <div class="partner-chips-section">
            <div class="partner-chips">
              <ContactChip
                v-for="partner in partners"
                :key="partner.id"
                :contact="partner"
                :selected="false"
                mode="action"
                @open="openContactMenu"
              />
            </div>
            <button
              v-if="partners.length > 1"
              type="button"
              class="group-sms-btn"
              data-testid="group-sms-btn"
              :title="t('tours.infoSheet.messageAll')"
              @click="showGroupSmsDialog = true"
            >
              <span class="material-symbols-outlined">sms</span>
              {{ t('tours.infoSheet.messageAll') }}
            </button>
          </div>
        </div>

        <!-- Contact action menu -->
        <ContactActionMenu
          v-if="activeMenuContact"
          :contact="activeMenuContact"
          :anchor-rect="activeChipRect"
          @close="closeContactMenu"
          @edit-contact="handleEditContact"
        />

        <!-- Group SMS dialog -->
        <GroupSmsConfirmDialog
          v-if="showGroupSmsDialog"
          :partners="partners"
          @confirm="showGroupSmsDialog = false"
          @cancel="showGroupSmsDialog = false"
        />
      </div>
    </template>

    <template v-if="mode === 'view' && isOwner" #footer>
      <div class="view-actions">
        <div class="edit-delete-row">
          <button
            v-if="deleteState === 'idle'"
            type="button"
            class="action-btn"
            data-testid="edit-btn"
            @click="enterEditMode"
          >
            <span class="material-symbols-outlined">edit</span>
            {{ t('tours.infoSheet.editBtn') }}
          </button>

          <template v-if="deleteState === 'confirm'">
            <span class="delete-confirm-text">{{ t('tours.infoSheet.deleteConfirmText') }}</span>
            <div class="delete-confirm-row">
              <button type="button" class="cancel-btn" @click="deleteState = 'idle'">
                {{ t('tours.infoSheet.cancelBtn') }}
              </button>
              <button type="button" class="delete-confirm-btn" @click="confirmDelete">
                {{ t('tours.infoSheet.deleteBtn') }}
              </button>
            </div>
          </template>
          <button
            v-else
            type="button"
            class="action-btn action-btn--danger"
            :disabled="deleteState === 'loading'"
            @click="deleteState = 'confirm'"
          >
            <span class="material-symbols-outlined">delete</span>
            {{
              deleteState === 'loading'
                ? t('tours.infoSheet.deletingBtn')
                : t('tours.infoSheet.deleteBtn')
            }}
          </button>
        </div>
        <p v-if="deleteError" class="delete-error">
          {{ deleteError }}
        </p>
      </div>
    </template>
  </component>
</template>

<style scoped>
/* ── View mode ──────────────────────────────────────────────────────────────── */
.details {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.view-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--spacing-sm);
}

.edit-delete-row {
  display: flex;
  justify-content: end;
  align-items: center;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-md);
  border: 1.5px solid var(--color-outline-variant);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-on-surface-variant);
  transition:
    background-color 0.15s,
    border-color 0.15s;
}

.action-btn:hover:not(:disabled) {
  background-color: var(--color-surface-variant);
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-btn--danger {
  border-color: var(--color-error);
  color: var(--color-error);
}

.action-btn--danger:hover:not(:disabled) {
  background-color: color-mix(in srgb, var(--color-error) 8%, transparent);
}

.action-btn .material-symbols-outlined {
  font-size: 16px;
}

.delete-confirm-row {
  display: flex;
  justify-content: end;
  align-items: center;
  gap: var(--spacing-sm);
}

.delete-confirm-text {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-error);
}

.cancel-btn {
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: 10px;
  border: 1px solid var(--color-outline-variant);
  color: var(--color-on-surface-variant);
  font-size: var(--font-size-sm);
  transition: background-color 0.15s;
}

.cancel-btn:hover {
  background-color: var(--color-surface-variant);
}

.delete-confirm-btn {
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: 10px;
  background-color: var(--color-error);
  color: white;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  transition: opacity 0.15s;
}

.delete-confirm-btn:hover {
  opacity: 0.85;
}

.delete-error {
  font-size: var(--font-size-sm);
  color: var(--color-error);
}

.completion-toggle--done {
  border-color: var(--color-success);
  color: var(--color-success);
}

.completion-toggle--done:hover {
  background-color: transparent;
}

.detail-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  color: var(--color-on-surface-variant);
  font-size: var(--font-size-base);
}

.detail-row.align-start {
  align-items: flex-start;
}

.detail-icon {
  flex-shrink: 0;
  font-size: 20px;
  color: var(--color-outline);
}

.coords {
  font-family: monospace;
  font-size: var(--font-size-sm);
}

.round-trip-hint {
  font-size: var(--font-size-sm);
  font-style: italic;
  color: var(--color-outline);
}

.season-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.season-tag {
  padding: 2px var(--spacing-sm);
  border-radius: 4px;
  font-size: var(--font-size-sm);
  background-color: color-mix(in srgb, var(--color-primary) 12%, transparent);
  color: var(--color-primary);
  font-weight: var(--font-weight-medium);
}

.description-text {
  font-size: var(--font-size-base);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.description-link {
  color: var(--color-primary);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.detail-text {
  font-size: var(--font-size-base);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.gpx-label {
  font-size: var(--font-size-sm);
  color: var(--color-primary);
  font-weight: var(--font-weight-medium);
}

.partner-chips-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.partner-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.group-sms-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-md);
  border: 1.5px solid var(--color-outline-variant);
  color: var(--color-on-surface-variant);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  align-self: flex-start;
  transition: background-color 0.15s;
}

.group-sms-btn:hover {
  background-color: var(--color-surface-variant);
}

.group-sms-btn .material-symbols-outlined {
  font-size: 18px;
}

/* ── Edit mode ──────────────────────────────────────────────────────────────── */
.save-error {
  font-size: var(--font-size-sm);
  color: var(--color-error);
  padding: 0 var(--spacing-xl);
  margin-bottom: calc(-1 * var(--spacing-md));
}
</style>
