<script setup lang="ts">
import type { TourType } from '@/features/tours/data/models/tour-type'
import type { Tour, TourDraft } from '@/features/tours/domain/entities/tour'
import type { TourAttachment } from '@/features/tours/domain/entities/tour-attachment'
import { storeToRefs } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/core/components/base-button.vue'
import BaseIcon from '@/core/components/base-icon.vue'
import BaseTooltip from '@/core/components/base-tooltip.vue'
import BottomSheet from '@/core/components/bottom-sheet.vue'
import FullScreenPage from '@/core/components/full-screen-page.vue'
import SideDrawer from '@/core/components/side-drawer.vue'
import { useIsDesktop } from '@/core/composables/use-is-desktop'
import { useLogger } from '@/core/logging/use-logger'
import { clearOfflineWriteError } from '@/core/offline/mutate'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
import ContactActionMenu from '@/features/contacts/presentation/components/contact-action-menu.vue'
import ContactChip from '@/features/contacts/presentation/components/contact-chip.vue'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'
import { resolveFriendName } from '@/features/friendships/domain/resolve-friend-name'
import { useFriendDisplayName } from '@/features/friendships/presentation/composables/use-friend-display-name'
import { useFriendshipsStore } from '@/features/friendships/presentation/stores/friendships-store'
import { useMapStore } from '@/features/map/presentation/stores/map-store'
import CollisionNotice from '@/features/tour-links/presentation/components/collision-notice.vue'
import LinkEditWarningDialog from '@/features/tour-links/presentation/components/link-edit-warning-dialog.vue'
import LinkRequestBanner from '@/features/tour-links/presentation/components/link-request-banner.vue'
import LinkedWithSection from '@/features/tour-links/presentation/components/linked-with-section.vue'
import { useTourLinksStore } from '@/features/tour-links/presentation/stores/tour-links-store'
import { TOUR_TYPE_I18N_KEYS, TOUR_TYPE_ICONS } from '@/features/tours/data/models/tour-type'
import { downloadOriginal } from '@/features/tours/data/services/gpx-storage-service'
import { COLLISION_RADIUS_M } from '@/features/tours/domain/collision'
import { isSameGoal } from '@/features/tours/domain/distance'
import TourAttachmentViewer from '@/features/tours/presentation/components/tour-attachment-viewer.vue'
import TourAttachmentsStrip from '@/features/tours/presentation/components/tour-attachments-strip.vue'
import TourForm from '@/features/tours/presentation/components/tour-form.vue'
import TourSuggestionHistorySheet from '@/features/tours/presentation/components/tour-suggestion-history-sheet.vue'
import TourSuggestionReviewSheet from '@/features/tours/presentation/components/tour-suggestion-review-sheet.vue'
import {
  buildSuggestionItems,
  pendingGoalFrom,
  seedDraftFromPending,
} from '@/features/tours/presentation/composables/use-suggestion-diff'
import { useTourAttachmentsStore } from '@/features/tours/presentation/stores/tour-attachments-store'
import { useTourSuggestionsStore } from '@/features/tours/presentation/stores/tour-suggestions-store'
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
  /** Which pick type is active — drives the collapsed header label in edit mode. */
  activePickType?: 'goal' | 'start' | 'end' | null
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
  tourTypeChange: [tourType: TourType | null]
  startPointChange: [point: { lng: number, lat: number } | null]
  endPointChange: [point: { lng: number, lat: number } | null]
}>()

const { t, locale } = useI18n({ useScope: 'global' })

const contactsStore = useContactsStore()
const toursStore = useToursStore()
const mapStore = useMapStore()
const authStore = useAuthStore()
const attachmentsStore = useTourAttachmentsStore()
const tourLinksStore = useTourLinksStore()
const friendshipsStore = useFriendshipsStore()
const { siblingsByTourId, requestsByTourId, groupIdByTourId } = storeToRefs(tourLinksStore)
const { tours, friendTours } = storeToRefs(toursStore)
const { contacts } = storeToRefs(contactsStore)
const { isPickingLocation } = storeToRefs(mapStore)
const { currentUser } = storeToRefs(authStore)
const isDesktop = useIsDesktop()
const log = useLogger('tour-info-sheet')

const isPicking = computed(() => isPickingLocation.value)

const isOwner = computed(() => !!currentUser.value && currentUser.value.id === props.tour.userId)

// ── View/edit mode ───────────────────────────────────────────────────────────
// `suggest` composes a proposal on a friend's tour; `review` adjudicates (owner) or shows
// your own pending proposal (author); `history` is the retained record (change:
// tour-suggestions).
const mode = ref<'view' | 'edit' | 'suggest' | 'review' | 'history'>('view')
/** IDs of attachments that existed when edit mode was entered — used for cancel rollback. */
const editBaseAttachmentIds = ref<Set<string>>(new Set())

// Pending goal/points during edit — updated reactively via editPickedPoint prop
const pendingGoal = ref<{ lng: number, lat: number }>({ ...props.tour.goal })
const pendingStartPoint = ref<{ lng: number, lat: number } | null>(null)
const pendingEndPoint = ref<{ lng: number, lat: number } | null>(null)
// Elevation/name updated from Swisstopo after a goal re-pick in edit mode
const pendingElevation = ref<number | null>(null)
const pendingSuggestedName = ref<string | null>(null)
const pendingStartPointMeta = ref<{ name: string | null, elevation: number | null } | null>(null)
const pendingEndPointMeta = ref<{ name: string | null, elevation: number | null } | null>(null)

function enterEditMode() {
  // Clean slate: any prior offline-write error is dismissed so it never resurfaces on the
  // next edit (it re-appears only if THIS edit fails again).
  clearOfflineWriteError()
  pendingGoal.value = { ...props.tour.goal }
  pendingStartPoint.value = null
  pendingEndPoint.value = null
  pendingElevation.value = null
  pendingSuggestedName.value = null
  pendingStartPointMeta.value = null
  pendingEndPointMeta.value = null
  // Snapshot attachment IDs before edit so cancel can rollback newly added ones
  editBaseAttachmentIds.value = new Set(
    (attachmentsStore.attachmentsByTour[props.tour.id] ?? []).map(a => a.id),
  )
  mode.value = 'edit'
  emit('editModeChange', true)
}

async function cancelEdit() {
  // Remove any attachments added during this edit session
  const current = attachmentsStore.attachmentsByTour[props.tour.id] ?? []
  const toRemove = current.filter(a => !editBaseAttachmentIds.value.has(a.id))
  for (const att of toRemove) {
    await attachmentsStore.remove(att)
  }
  clearOfflineWriteError()
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
      pendingStartPointMeta.value = {
        name: pick.suggestedName ?? null,
        elevation: pick.elevation ?? null,
      }
    }
    else {
      pendingEndPoint.value = pick.location
      pendingEndPointMeta.value = {
        name: pick.suggestedName ?? null,
        elevation: pick.elevation ?? null,
      }
    }
    emit('pointConsumed')
  },
)

// ── Tour link group / pending request derivation (early — used by edit gate) ─
const linkSiblings = computed(() => siblingsByTourId.value.get(props.tour.id) ?? [])
const linkPendingRequests = computed(() => requestsByTourId.value.get(props.tour.id) ?? [])
const isLinked = computed(() => groupIdByTourId.value.has(props.tour.id))

// Edit-warning dialog: shown when owner submits an edit that would either evict
// the tour from its group (tour_type changed, visibility flipped from friends,
// or goal moved >COLLISION_RADIUS_M from any sibling) OR invalidate the predicate
// for any pending link request involving this tour. Confirm proceeds with
// submit; cancel rolls back.
const editWarningPending = ref<null | (() => Promise<void>)>(null)
const editWarningMode = ref<'linked' | 'pending-outgoing' | 'pending-incoming' | 'pending-mixed'>('linked')
const editWarningPendingCount = ref(0)

// "Verknüpft mit" full list takes over the sheet body when the user taps the
// "+N weitere" pill. Back returns to the tour details inside the same sheet —
// no nested overlay (avoids the stacked bottom-sheet broken on mobile).
const linksView = ref(false)
watch(() => props.tour.id, () => {
  linksView.value = false
})

function navigateToSibling(siblingId: string) {
  linksView.value = false
  mapStore.selectTour(siblingId)
}

// Shared by the edit save and the suggestion submit below.
const saveError = ref<string | null>(null)
const isSaving = ref(false)

// ── Suggestions (change: tour-suggestions) ───────────────────────────────────
const suggestionsStore = useTourSuggestionsStore()

/** Only a marked partner on a friend's tour may suggest — the same gate as detail read. */
const canSuggest = computed(() => props.tour.isFriendTour && props.tour.isPartner === true)

/** Owner-side review workload for THIS tour, from the one feature-wide query (D15). */
const pendingSuggestionCount = computed(
  () => suggestionsStore.pendingCountByTour[props.tour.id] ?? 0,
)

/** Author-side: the viewer's own unresolved proposal on this friend tour. */
const myPendingSuggestions = computed(() => suggestionsStore.myPendingFor(props.tour.id))

const suggestBatchId = ref<string | null>(null)
const suggestSeedDraft = ref<TourDraft | null>(null)

/**
 * Enter suggest mode. Revising (D12) reopens the form seeded with the author's OWN pending
 * values and reuses the SAME batch id, so one idempotent reconciling call updates the
 * batch in place rather than stacking a second proposal on the owner.
 */
function enterSuggestMode(batchId?: string) {
  clearOfflineWriteError()
  const pending = batchId ? myPendingSuggestions.value.filter(s => s.batchId === batchId) : []
  suggestBatchId.value = batchId ?? uuidv4()
  suggestSeedDraft.value = seedDraftFromPending(props.tour, pending)

  const goal = pendingGoalFrom(pending)
  pendingGoal.value = goal ? { lng: goal.lng, lat: goal.lat } : { ...props.tour.goal }
  pendingElevation.value = goal?.elevation ?? null
  pendingStartPoint.value = null
  pendingEndPoint.value = null
  pendingSuggestedName.value = null
  pendingStartPointMeta.value = null
  pendingEndPointMeta.value = null

  // The partner needs the owner's attachments loaded to propose a removal against them.
  void attachmentsStore.load(props.tour.id)
  mode.value = 'suggest'
  emit('editModeChange', true)
}

function cancelSuggest() {
  suggestBatchId.value = null
  suggestSeedDraft.value = null
  mode.value = 'view'
  emit('editModeChange', false)
}

/**
 * Turn the submitted draft into one batch. The scalar diff is pure (`buildSuggestionItems`);
 * the binary ops are appended here because only the host can upload a staged blob (D9) and
 * only it knows which existing attachments were marked for removal.
 */
async function handleSuggestSubmit(
  draft: TourDraft,
  // The GPX outcome is already in `draft.gpxFilepath` (null when removed), so the diff
  // reads it there rather than from this flag.
  _gpxRemoved: boolean,
  _preUploadedTourId: string | null,
  draftId: string,
  proposedRemovals: string[],
) {
  if (mapStore.isPickingLocation)
    return

  const batchId = suggestBatchId.value
  if (!batchId)
    return

  saveError.value = null
  isSaving.value = true
  try {
    // Upload first: a staged blob has no `storagePath` until it lands in the suggester's
    // own prefix (D9), and the diff stays pure by never seeing the File itself.
    const addedAttachments = []
    for (const file of attachmentsStore.stagedByDraft[draftId] ?? []) {
      addedAttachments.push({
        // Distinct target per add — without it every add in the batch shares a NULL
        // target and the pending-row unique index keeps only the last (see
        // SuggestionBinaryOps.addedAttachments.id).
        id: crypto.randomUUID(),
        storagePath: await suggestionsStore.uploadStaged('tour-attachments', props.tour.id, file),
        mimeType: file.type,
        sizeBytes: file.size,
        originalFilename: file.name,
      })
    }

    const items = buildSuggestionItems(props.tour, draft, pendingGoal.value, {
      addedAttachments,
      removedAttachmentIds: proposedRemovals,
    })

    const isRevision = myPendingSuggestions.value.some(s => s.batchId === batchId)
    await suggestionsStore.submitBatch(props.tour.id, batchId, items, isRevision)

    if (suggestionsStore.error) {
      saveError.value = suggestionsStore.error
      return
    }
    attachmentsStore.clearStaged(draftId)
    cancelSuggest()
  }
  catch (err) {
    saveError.value = err instanceof Error ? err.message : t('tours.infoSheet.saveFailed')
  }
  finally {
    isSaving.value = false
  }
}

// ── Edit save ────────────────────────────────────────────────────────────────

async function handleEditSubmit(draft: TourDraft, gpxRemoved: boolean) {
  if (mapStore.isPickingLocation) {
    log.debug('Ignoring edit submit while location picker is active')
    return
  }

  // Soft-gate: if this edit would evict the tour from its group OR invalidate
  // pending link requests, ask first.
  const breakage = wouldBreakLink(draft, pendingGoal.value)
  if (breakage) {
    editWarningMode.value = breakage.mode
    editWarningPendingCount.value = breakage.pendingCount
    editWarningPending.value = () => performEditSubmit(draft, gpxRemoved)
    return
  }
  await performEditSubmit(draft, gpxRemoved)
}

/** True if applying the edit to a linked tour would break the group invariant. */
function wouldEvict(draft: TourDraft, newGoal: { lng: number, lat: number }): boolean {
  const t1 = props.tour
  if (draft.tourType !== t1.tourType)
    return true
  const effectiveVisibility = draft.visibility ?? t1.visibility
  if (t1.visibility === 'friends' && effectiveVisibility !== 'friends')
    return true
  // Goal change: mirror the server-side eviction rule. The DB trigger evicts
  // iff the new goal sits outside COLLISION_RADIUS_M of ANY sibling. Compute
  // here so we don't warn the user for tiny nudges that the group would absorb.
  const moved = newGoal.lng !== t1.goal.lng || newGoal.lat !== t1.goal.lat
  if (!moved)
    return false
  for (const sibId of linkSiblings.value) {
    const sib = tours.value.find(t => t.id === sibId) ?? friendTours.value.find(t => t.id === sibId)
    if (!sib)
      continue // sibling out of scope (RLS, friendship gap) — be conservative, skip
    if (!isSameGoal(newGoal, sib.goal, COLLISION_RADIUS_M))
      return true
  }
  return false
}

/**
 * Pending requests that would lose the collision predicate after this edit,
 * split by direction (this tour as initiator = outgoing, as target = incoming).
 * Mirror of fn_collision_predicate: same non-null tour_type, both visibility=friends,
 * within COLLISION_RADIUS_M of the counterpart tour's goal.
 */
function pendingRequestsBrokenBy(
  draft: TourDraft,
  newGoal: { lng: number, lat: number },
): { outgoing: number, incoming: number } {
  const result = { outgoing: 0, incoming: 0 }
  if (linkPendingRequests.value.length === 0)
    return result
  const t1 = props.tour
  const effectiveType = draft.tourType ?? t1.tourType
  const effectiveVisibility = draft.visibility ?? t1.visibility

  for (const req of linkPendingRequests.value) {
    const isOutgoing = req.initiatorTourId === t1.id
    const otherId = isOutgoing ? req.targetTourId : req.initiatorTourId
    const other = tours.value.find(t => t.id === otherId) ?? friendTours.value.find(t => t.id === otherId)
    let broken = false
    if (effectiveVisibility !== 'friends') {
      broken = true
    }
    else if (!other) {
      // Counterpart out of scope (RLS) — be conservative: assume predicate still holds.
      broken = false
    }
    else if (effectiveType == null || other.tourType == null || effectiveType !== other.tourType) {
      broken = true
    }
    else if (other.visibility !== 'friends') {
      broken = true
    }
    else if (!isSameGoal(newGoal, other.goal, COLLISION_RADIUS_M)) {
      broken = true
    }
    if (broken) {
      if (isOutgoing)
        result.outgoing++
      else
        result.incoming++
    }
  }
  return result
}

/** Combined gate: eviction wins ('linked'); falls back to pending-request invalidation. */
function wouldBreakLink(
  draft: TourDraft,
  newGoal: { lng: number, lat: number },
): {
  mode: 'linked' | 'pending-outgoing' | 'pending-incoming' | 'pending-mixed'
  pendingCount: number
} | null {
  if (isLinked.value && wouldEvict(draft, newGoal))
    return { mode: 'linked', pendingCount: 0 }
  const broken = pendingRequestsBrokenBy(draft, newGoal)
  const total = broken.outgoing + broken.incoming
  if (total === 0)
    return null
  if (broken.outgoing > 0 && broken.incoming > 0)
    return { mode: 'pending-mixed', pendingCount: total }
  if (broken.outgoing > 0)
    return { mode: 'pending-outgoing', pendingCount: broken.outgoing }
  return { mode: 'pending-incoming', pendingCount: broken.incoming }
}

async function performEditSubmit(draft: TourDraft, gpxRemoved: boolean) {
  saveError.value = null
  isSaving.value = true
  try {
    await toursStore.updateTour(props.tour.id, draft, pendingGoal.value, gpxRemoved)
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

async function confirmEditWarning() {
  const fn = editWarningPending.value
  editWarningPending.value = null
  if (fn)
    await fn()
}

function cancelEditWarning() {
  editWarningPending.value = null
}

async function handleDownloadGpx() {
  if (!props.tour.gpxFilepath)
    return
  try {
    await downloadOriginal(props.tour.gpxFilepath, `${props.tour.name ?? 'track'}.gpx`)
  }
  catch (err) {
    log.error('GPX download failed', err)
  }
}

// ── Completion toggle ────────────────────────────────────────────────────────
async function toggleCompleted() {
  await toursStore.setCompleted(props.tour.id, !props.tour.completed)
}

// ── Visibility toggle (owner only) ──────────────────────────────────────────
async function toggleVisibility() {
  const next = props.tour.visibility === 'private' ? 'friends' : 'private'
  // friends → private will (a) evict from a group via the server trigger, or
  // (b) invalidate pending requests where this tour is involved. Surface the
  // appropriate warning before proceeding.
  if (next === 'private') {
    if (isLinked.value) {
      editWarningMode.value = 'linked'
      editWarningPendingCount.value = 0
      editWarningPending.value = () => toursStore.setVisibility(props.tour.id, 'private')
      return
    }
    if (linkPendingRequests.value.length > 0) {
      let outgoing = 0
      let incoming = 0
      for (const req of linkPendingRequests.value) {
        if (req.initiatorTourId === props.tour.id)
          outgoing++
        else
          incoming++
      }
      editWarningMode.value
        = outgoing > 0 && incoming > 0
          ? 'pending-mixed'
          : outgoing > 0 ? 'pending-outgoing' : 'pending-incoming'
      editWarningPendingCount.value = linkPendingRequests.value.length
      editWarningPending.value = () => toursStore.setVisibility(props.tour.id, 'private')
      return
    }
  }
  await toursStore.setVisibility(props.tour.id, next)
}

// ── Attachment viewer ────────────────────────────────────────────────────────
const viewerAttachments = ref<TourAttachment[]>([])
const viewerStartIndex = ref(0)
const viewerOpen = ref(false)

function openViewer(attachments: TourAttachment[], startIndex: number) {
  viewerAttachments.value = attachments
  viewerStartIndex.value = startIndex
  viewerOpen.value = true
}

// ── Delete ───────────────────────────────────────────────────────────────────
const deleteState = ref<'idle' | 'confirm' | 'loading'>('idle')
const deleteError = ref<string | null>(null)

async function confirmDelete() {
  deleteError.value = null
  deleteState.value = 'loading'
  try {
    // Queue-form delete: online it deletes; offline it enqueues and removes the tour
    // optimistically. Both resolve with the tour already gone from the UI, so close
    // the sheet either way (the queued delete replays on reconnect).
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
const sheetCollapsed = computed(
  () => isPicking.value && (mode.value === 'edit' || mode.value === 'suggest'),
)

// On mobile, an active edit takes a full-screen page (no map, no drag) — except
// while a location pick is active, where the sheet collapses to reveal the map.
const editAsPage = computed(
  () => !isDesktop.value && (mode.value === 'edit' || mode.value === 'suggest') && !isPicking.value,
)
const editFormRef = ref<{ cancel: () => void } | null>(null)

function handleSheetClose() {
  // In page mode the top-bar cancel returns to view mode and runs the form's
  // cleanup (rolls back attachments added this session); otherwise dismiss.
  if (editAsPage.value)
    editFormRef.value?.cancel()
  else
    emit('close')
}
const sheetTitle = computed(() => {
  if (sheetCollapsed.value) {
    if (props.activePickType === 'start')
      return t('tours.picker.startTitle')
    if (props.activePickType === 'end')
      return t('tours.picker.endTitle')
    return t('tours.picker.goalTitle')
  }
  if (linksView.value)
    return t('tourLinks.linkedWithHeader')
  if (mode.value === 'suggest')
    return `${t('tours.suggestions.suggestTitlePrefix')}: ${displayName.value}`
  if (mode.value === 'review')
    return t('tours.suggestions.reviewTitle')
  if (mode.value === 'history')
    return t('tours.suggestions.historyTitle')
  return mode.value === 'edit'
    ? `${t('tours.infoSheet.editTitlePrefix')}: ${displayName.value}`
    : displayName.value
})

const sheetShowBack = computed(() => {
  // linksView wins on both viewports — its back returns to tour details.
  if (linksView.value)
    return true
  if (mode.value === 'review' || mode.value === 'history')
    return true
  return props.showBack && !isDesktop.value ? true : undefined
})
const sheetBackLabel = computed(() => {
  if (linksView.value && isDesktop.value)
    return t('tourLinks.linkedWithHeader')
  // The desktop drawer renders its back button ONLY when a label is set — without this the
  // review/history views would offer nothing but Close, which discards the whole drawer.
  if ((mode.value === 'review' || mode.value === 'history') && isDesktop.value)
    return displayName.value
  return props.showBack && isDesktop.value ? t('tours.infoSheet.backToTours') : undefined
})

function handleSheetBack() {
  if (linksView.value) {
    linksView.value = false
    return
  }
  // Review/history are in-sheet views, not routes — back returns to the tour details.
  if (mode.value === 'review' || mode.value === 'history') {
    mode.value = 'view'
    return
  }
  emit('back')
}

const formattedDate = computed(() => {
  const start = props.tour.plannedDate
  if (!start)
    return null
  const fmt = new Intl.DateTimeFormat(locale.value, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  // formatRange collapses the shared parts per locale ("25.–27. August 2026" / "August
  // 25 – 27, 2026") — no hand-built separator, no i18n key for it.
  const end = props.tour.endDate
  return end ? fmt.formatRange(start, end) : fmt.format(start)
})

const partners = computed(() => contacts.value.filter(c => props.tour.partnerIds.includes(c.id)))

// Friend tours name their owner by the viewer's OWN contact for them, gated so the name
// renders once in final form. Owner identity is not part of what non-partner gating
// withholds — friend_tours_view exposes user_id to every permitted reader.
const { displayName: ownerName, isResolved: ownerResolved } = useFriendDisplayName(
  () => (props.tour.isFriendTour ? props.tour.userId : null),
)

// Friend tours surface partners contact-name-first, falling back to the server-resolved
// profile name: a friend tour's partners are the OWNER's partners, and the viewer need
// not be connected to them — find_phones_by_user_ids is friendship-gated, so for an
// unconnected partner there is no phone to match and the profile name is the only name
// available. Render read-only — no contact action menu, no group SMS. Populated only
// when the viewer is a partner; gated to [] otherwise by friend_tours_view.
const friendPartnerNames = computed(() =>
  props.tour.isFriendTour
    ? (props.tour.partnerNames ?? [])
        .map((p) => {
          if (p.userId === currentUser.value?.id)
            return t('tours.infoSheet.partnerSelf')
          const contactName = resolveFriendName(
            p.userId,
            friendshipsStore.userIdToPhoneMap,
            phone => contactsStore.findContactByMethodValue('phone', phone),
          )
          return contactName ?? [p.firstName, p.lastName].filter(Boolean).join(' ').trim()
        })
        .filter(Boolean)
    : [],
)

// Warm the phone map for the partner list in ONE batched lookup. Partners resolve
// reactively (null → name) rather than behind a settle gate: the no-flip guarantee is for
// the owner, where the name is the row's identity; a partner pill already renders
// progressively today and gating it would add a layout cost per pill.
watch(
  () => props.tour.partnerNames?.map(p => p.userId) ?? [],
  (ids) => {
    if (ids.length > 0)
      void friendshipsStore.ensurePhones(ids)
  },
  { immediate: true },
)

// Partner contacts the owner added that resolve to no registered user — surfaced
// to partner-viewers only (0 otherwise, gated server-side) as a single generic
// "and X more" pill so the roster's true size is hinted without leaking identity.
const unresolvedPartnerCount = computed(() =>
  props.tour.isFriendTour ? (props.tour.unresolvedPartnerCount ?? 0) : 0,
)

// ── Contact action menu ──────────────────────────────────────────────────────
const activeMenuContactId = ref<string | null>(null)
const activeMenuContact = computed(() =>
  activeMenuContactId.value
    ? (partners.value.find(c => c.id === activeMenuContactId.value) ?? null)
    : null,
)
const activeChipRect = ref<DOMRect | null>(null)

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
    return false
  return s.lng === e.lng && s.lat === e.lat
})

const isOneWayToGoal = computed(() => {
  return !!props.tour.startPoint && !props.tour.endPoint
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
    :is="editAsPage ? FullScreenPage : isDesktop ? SideDrawer : BottomSheet" :title="sheetTitle"
    :fit-content="!isDesktop && !editAsPage" :collapsed="sheetCollapsed" :back-label="sheetBackLabel"
    :show-back="editAsPage ? false : sheetShowBack" @close="handleSheetClose" @back="handleSheetBack"
  >
    <!-- ── Edit mode ────────────────────────────────────────────────────── -->
    <template v-if="mode === 'edit'">
      <p v-if="saveError" class="save-error">
        {{ saveError }}
      </p>
      <TourForm
        ref="editFormRef" form-id="tour-edit-form" :embedded="editAsPage"
        :submit-label="t('tours.infoSheet.saveLabel')" :allow-goal-edit="true" :current-goal="pendingGoal"
        :initial-draft="tour" :tour-id="tour.id" :initial-elevation="pendingElevation"
        :initial-name="pendingSuggestedName" :initial-start-point="pendingStartPoint"
        :initial-end-point="pendingEndPoint" :initial-start-point-meta="pendingStartPointMeta"
        :initial-end-point-meta="pendingEndPointMeta" :disabled="isPicking"
        @submit="(d, r) => handleEditSubmit(d, r)" @cancel="cancelEdit" @pick-point="emit('pickPoint', $event)"
        @tour-type-change="emit('tourTypeChange', $event)"
        @start-point-change="emit('startPointChange', $event)"
        @end-point-change="emit('endPointChange', $event)"
      />
    </template>

    <!-- ── Suggest mode (partner on a friend's tour) ───────────────────── -->
    <template v-else-if="mode === 'suggest'">
      <p v-if="saveError" class="save-error">
        {{ saveError }}
      </p>
      <TourForm
        ref="editFormRef" form-id="tour-suggest-form" mode="suggest" :embedded="editAsPage"
        :submit-label="t('tours.suggestions.submitBtn')" :allow-goal-edit="true" :current-goal="pendingGoal"
        :initial-draft="suggestSeedDraft" :tour-id="tour.id" :initial-elevation="pendingElevation"
        :initial-name="pendingSuggestedName" :initial-start-point="pendingStartPoint"
        :initial-end-point="pendingEndPoint" :initial-start-point-meta="pendingStartPointMeta"
        :initial-end-point-meta="pendingEndPointMeta" :disabled="isPicking"
        @submit="handleSuggestSubmit" @cancel="cancelSuggest" @pick-point="emit('pickPoint', $event)"
        @tour-type-change="emit('tourTypeChange', $event)"
        @start-point-change="emit('startPointChange', $event)"
        @end-point-change="emit('endPointChange', $event)"
      />
    </template>

    <!-- ── Suggestion review / history ─────────────────────────────────── -->
    <template v-else-if="mode === 'review'">
      <TourSuggestionReviewSheet
        :tour="tour" :mode="isOwner ? 'owner' : 'author'"
        @revise="enterSuggestMode($event)"
      />
    </template>

    <template v-else-if="mode === 'history'">
      <TourSuggestionHistorySheet :tour="tour" :mode="isOwner ? 'owner' : 'author'" />
    </template>

    <!-- ── Linked-tours full-list mode ─────────────────────────────────── -->
    <template v-else-if="linksView">
      <LinkedWithSection :siblings="linkSiblings" :full-list="true" @open-tour="navigateToSibling" />
    </template>

    <!-- ── View mode ───────────────────────────────────────────────────── -->
    <template v-else>
      <div class="details">
        <!-- Tour link group siblings + pending link requests + collision notice -->
        <LinkedWithSection :siblings="linkSiblings" @open-tour="navigateToSibling" @view-all="linksView = true" />
        <LinkRequestBanner v-for="req in linkPendingRequests" :key="req.id" :request="req" />
        <CollisionNotice v-if="isOwner" :own-tour-id="tour.id" />

        <!-- Completion toggle (owner only) -->
        <button
          v-if="isOwner" type="button" class="completion-toggle action-btn"
          :class="{ 'completion-toggle--done': tour.completed }" :aria-pressed="tour.completed"
          @click="toggleCompleted"
        >
          <BaseIcon v-if="tour.completed" name="check_circle" />
          <BaseIcon v-else name="radio_button_unchecked" />
          {{
            tour.completed
              ? t('tours.infoSheet.completedBtn')
              : t('tours.infoSheet.completeTourBtn')
          }}
        </button>

        <!-- Visibility toggle (owner only) -->
        <button
          v-if="isOwner" type="button" class="visibility-toggle action-btn" :class="tour.visibility === 'private'
            ? 'visibility-toggle--private'
            : 'visibility-toggle--friends'
          " :aria-pressed="tour.visibility === 'private'" @click="toggleVisibility"
        >
          <BaseIcon :name="tour.visibility === 'private' ? 'lock' : 'group'" />
          {{
            tour.visibility === 'private'
              ? t('tours.infoSheet.visibilityMakeFriends')
              : t('tours.infoSheet.visibilityMakePrivate')
          }}
        </button>

        <!-- Owner (friend tours only) -->
        <div v-if="tour.isFriendTour" class="detail-row">
          <BaseTooltip :text="t('tours.infoSheet.iconTooltipOwner')">
            <BaseIcon name="person" class="detail-icon" />
          </BaseTooltip>
          <span v-if="ownerResolved">{{ t('tours.infoSheet.createdByLabel', { name: ownerName }) }}</span>
          <span v-else class="owner-skeleton" aria-hidden="true" />
        </div>

        <!-- Tour type -->
        <div v-if="tour.tourType" class="detail-row">
          <BaseTooltip :text="t('tours.infoSheet.iconTooltipType')">
            <BaseIcon :name="TOUR_TYPE_ICONS[tour.tourType]" class="detail-icon" />
          </BaseTooltip>
          <span>{{ t(`tours.type.${TOUR_TYPE_I18N_KEYS[tour.tourType]}` as any) }}</span>
        </div>

        <!-- Planned date -->
        <div v-if="formattedDate" class="detail-row">
          <BaseTooltip :text="t('tours.infoSheet.iconTooltipDate')">
            <BaseIcon name="calendar_today" class="detail-icon" />
          </BaseTooltip>
          <span>{{ formattedDate }}</span>
        </div>

        <!-- Goal coordinates -->
        <div class="detail-row">
          <BaseTooltip :text="t('tours.infoSheet.iconTooltipGoal')">
            <BaseIcon name="location_on" class="detail-icon" />
          </BaseTooltip>
          <span class="coords">{{ coordinates }}</span>
        </div>

        <!-- Elevation -->
        <div v-if="formattedElevation" class="detail-row">
          <BaseTooltip :text="t('tours.infoSheet.iconTooltipElevation')">
            <BaseIcon name="landscape" class="detail-icon" />
          </BaseTooltip>
          <span>{{ formattedElevation }}</span>
        </div>

        <!-- Start / end points -->
        <template v-if="startPointText">
          <div class="detail-row">
            <BaseTooltip :text="t('tours.infoSheet.iconTooltipStartPoint')">
              <BaseIcon name="home" class="detail-icon" />
            </BaseTooltip>
            <span v-if="tour.startPointName" class="point-meta">
              {{ tour.startPointName }}
              <span v-if="tour.startPointElevation != null" class="point-elevation">
                {{ tour.startPointElevation }} m
              </span>
            </span>
            <span v-else class="coords">{{ startPointText }}</span>
          </div>
          <div v-if="isOneWayToGoal" class="detail-row">
            <BaseTooltip :text="t('tours.infoSheet.iconTooltipEndPoint')">
              <BaseIcon name="directions" class="detail-icon" />
            </BaseTooltip>
            <span class="round-trip-hint">{{ t('tours.infoSheet.oneWayToGoalIndicator') }}</span>
          </div>
          <div v-else class="detail-row">
            <BaseTooltip :text="t('tours.infoSheet.iconTooltipEndPoint')">
              <BaseIcon name="flag" class="detail-icon" />
            </BaseTooltip>
            <span v-if="isRoundTrip" class="round-trip-hint">{{
              t('tours.infoSheet.roundTrip')
            }}</span>
            <template v-else>
              <span v-if="tour.endPointName" class="point-meta">
                {{ tour.endPointName }}
                <span v-if="tour.endPointElevation != null" class="point-elevation">
                  {{ tour.endPointElevation }} m
                </span>
              </span>
              <span v-else class="coords">{{ endPointText }}</span>
            </template>
          </div>
        </template>

        <!-- Seasons -->
        <div v-if="tour.seasons && tour.seasons.length > 0" class="detail-row align-start">
          <BaseTooltip :text="t('tours.infoSheet.iconTooltipSeasons')">
            <BaseIcon name="wb_sunny" class="detail-icon" />
          </BaseTooltip>
          <div class="season-tags">
            <span v-for="season in tour.seasons" :key="season" class="season-tag">
              {{ t(`tours.season.${season}` as any) }}
            </span>
          </div>
        </div>

        <!-- Description -->
        <div v-if="tour.description" class="detail-row align-start">
          <BaseTooltip :text="t('tours.infoSheet.iconTooltipDescription')">
            <BaseIcon name="description" class="detail-icon" />
          </BaseTooltip>
          <p class="description-text">
            <template v-for="(segment, i) in linkifyText(tour.description)" :key="i">
              <a
                v-if="segment.url" :href="segment.url" target="_blank" rel="noopener noreferrer"
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
          <BaseTooltip :text="t('tours.infoSheet.iconTooltipEquipment')">
            <BaseIcon name="hardware" class="detail-icon" />
          </BaseTooltip>
          <p class="detail-text">
            {{ tour.equipment }}
          </p>
        </div>

        <!-- Notes -->
        <div v-if="tour.notes" class="detail-row align-start">
          <BaseTooltip :text="t('tours.infoSheet.iconTooltipNotes')">
            <BaseIcon name="sticky_note_2" class="detail-icon" />
          </BaseTooltip>
          <p class="detail-text">
            {{ tour.notes }}
          </p>
        </div>

        <!-- GPX track download -->
        <div v-if="tour.gpxFilepath" class="detail-row">
          <BaseTooltip :text="t('tours.infoSheet.iconTooltipGpxTrack')">
            <BaseIcon name="route" class="detail-icon" />
          </BaseTooltip>
          <BaseButton variant="secondary" size="sm" class="gpx-download-btn" @click="handleDownloadGpx">
            <BaseIcon name="download" />
            {{ t('tours.infoSheet.downloadGpxBtn') }}
          </BaseButton>
        </div>

        <!-- Attachments strip -->
        <TourAttachmentsStrip :tour-id="tour.id" @open-viewer="openViewer" />

        <!-- Partners -->
        <div v-if="partners.length > 0" class="detail-row">
          <BaseTooltip :text="t('tours.infoSheet.iconTooltipPartners')">
            <BaseIcon name="group" class="detail-icon" />
          </BaseTooltip>
          <div class="partner-chips-section">
            <div class="partner-chips">
              <ContactChip
                v-for="partner in partners" :key="partner.id" :contact="partner" :selected="false"
                mode="action" @open="openContactMenu"
              />
            </div>
          </div>
        </div>

        <!-- Partners on a friend's tour (read-only registered-user names) -->
        <div
          v-if="tour.isFriendTour && (friendPartnerNames.length > 0 || unresolvedPartnerCount > 0)"
          class="detail-row"
        >
          <BaseTooltip :text="t('tours.infoSheet.iconTooltipPartners')">
            <BaseIcon name="group" class="detail-icon" />
          </BaseTooltip>
          <div class="partner-chips">
            <span v-for="(name, i) in friendPartnerNames" :key="i" class="friend-partner-chip">{{
              name
            }}</span>
            <span v-if="unresolvedPartnerCount > 0" class="friend-partner-chip friend-partner-chip--more">
              {{ t('tours.infoSheet.morePartners', { count: unresolvedPartnerCount }) }}
            </span>
          </div>
        </div>

        <!--
          Suggestions live at the BOTTOM (owner review workload, or the partner's own
          proposal, D15): they are actions on the tour, not facts about it, so they belong
          after the detail rows rather than crowding the header.
        -->
        <div v-if="isOwner || canSuggest" class="suggestion-actions">
          <button
            v-if="isOwner && pendingSuggestionCount > 0" type="button" class="action-btn suggestion-entry"
            data-testid="review-suggestions-btn" @click="mode = 'review'"
          >
            <BaseIcon name="feedback" />
            {{ t('tours.suggestions.pendingCount', { count: pendingSuggestionCount }) }}
          </button>
          <button
            v-if="canSuggest && myPendingSuggestions.length > 0" type="button"
            class="action-btn suggestion-entry" data-testid="my-suggestions-btn" @click="mode = 'review'"
          >
            <BaseIcon name="feedback" />
            {{ t('tours.suggestions.yourPendingCount', { count: myPendingSuggestions.length }) }}
          </button>
          <!--
            One pending proposal per suggester at a time. While theirs is open the only
            route in is "your proposal" → revise, which reopens the SAME batch (D12);
            starting a fresh one would upsert over every field they already proposed.
          -->
          <button
            v-if="canSuggest && myPendingSuggestions.length === 0" type="button"
            class="action-btn suggestion-entry" data-testid="suggest-btn" @click="enterSuggestMode()"
          >
            <BaseIcon name="edit" />
            {{ t('tours.suggestions.suggestBtn') }}
          </button>
          <button
            v-if="isOwner || canSuggest" type="button" class="action-btn suggestion-entry"
            data-testid="suggestion-history-btn" @click="mode = 'history'"
          >
            <BaseIcon name="schedule" />
            {{ t('tours.suggestions.historyBtn') }}
          </button>
        </div>

        <!-- Contact action menu -->
        <ContactActionMenu
          v-if="activeMenuContact" :contact="activeMenuContact" :anchor-rect="activeChipRect"
          @close="closeContactMenu" @edit-contact="handleEditContact"
        />
      </div>
    </template>

    <!-- Full-screen edit page: Save lives in the top app bar (above keyboard). -->
    <!-- Full-screen edit/suggest page: the submit lives in the top app bar (above the
         keyboard), targeting whichever form is mounted. -->
    <template v-if="editAsPage && (mode === 'edit' || mode === 'suggest')" #page-action>
      <BaseButton
        type="submit" :form="mode === 'edit' ? 'tour-edit-form' : 'tour-suggest-form'"
        variant="primary" size="md"
      >
        {{ mode === 'edit' ? t('tours.infoSheet.saveLabel') : t('tours.suggestions.submitBtn') }}
      </BaseButton>
    </template>

    <template v-if="mode === 'view' && isOwner && !linksView" #footer>
      <div class="view-actions">
        <div class="edit-delete-row">
          <BaseButton v-if="deleteState === 'idle'" variant="secondary" size="sm" data-testid="edit-btn" @click="enterEditMode">
            <BaseIcon name="edit" />
            {{ t('tours.infoSheet.editBtn') }}
          </BaseButton>
          <template v-if="deleteState === 'confirm'">
            <span class="delete-confirm-text">{{ t('tours.infoSheet.deleteConfirmText') }}</span>
            <span v-if="isLinked && linkSiblings.length > 0" class="delete-confirm-text delete-confirm-text--link">
              {{ t('tourLinks.deleteUnlinkWarning', { count: linkSiblings.length }) }}
            </span>
            <div class="delete-confirm-row">
              <BaseButton variant="secondary" size="sm" data-testid="delete-cancel-btn" @click="deleteState = 'idle'">
                {{ t('tours.infoSheet.cancelBtn') }}
              </BaseButton>
              <BaseButton variant="danger" size="sm" data-testid="delete-confirm-btn" @click="confirmDelete">
                {{ t('tours.infoSheet.deleteBtn') }}
              </BaseButton>
            </div>
          </template>
          <BaseButton
            v-else
            variant="danger-outline"
            size="sm"
            data-testid="delete-btn"
            :disabled="deleteState === 'loading'"
            @click="deleteState = 'confirm'"
          >
            <BaseIcon name="delete" />
            {{
              deleteState === 'loading'
                ? t('tours.infoSheet.deletingBtn')
                : t('tours.infoSheet.deleteBtn')
            }}
          </BaseButton>
        </div>
        <p v-if="deleteError" class="delete-error">
          {{ deleteError }}
        </p>
      </div>
    </template>

    <!-- Attachment viewer uses Teleport internally; placing here keeps single root -->
    <TourAttachmentViewer
      v-if="viewerOpen" :attachments="viewerAttachments" :start-index="viewerStartIndex"
      @close="viewerOpen = false"
    />

    <LinkEditWarningDialog
      v-if="editWarningPending" :linked-count="linkSiblings.length"
      :pending-count="editWarningPendingCount" :mode="editWarningMode" @confirm="confirmEditWarning"
      @cancel="cancelEditWarning"
    />
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

/* The divider spans the full surface: negative margins cancel the host's inline padding
   (published by the drawer/sheet as --surface-pad-*), then the padding is re-applied
   inside so the buttons stay aligned with the detail rows above. */
.suggestion-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-xs);
  margin-top: var(--spacing-xs);
  margin-left: calc(-1 * var(--surface-pad-left, 0px));
  margin-right: calc(-1 * var(--surface-pad-right, 0px));
  padding: var(--spacing-sm) var(--surface-pad-right, 0px) 0 var(--surface-pad-left, 0px);
  border-top: 1px solid var(--color-outline-variant);
}

.action-btn:hover:not(:disabled) {
  background-color: var(--color-surface-variant);
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-btn .base-icon {
  font-size: 16px;
}

/* Equal-width cancel/confirm (point 7). 1fr 1fr sizes both to the wider button
   regardless of available width — flex:1 collapses here because the footer row
   is shrink-wrapped (no free space to distribute). */
.delete-confirm-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-sm);
}

.delete-confirm-text {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-error);
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

.visibility-toggle--friends {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.visibility-toggle--friends:hover {
  background-color: transparent;
}

.visibility-toggle--private {
  border-color: var(--color-error);
  color: var(--color-error);
}

.visibility-toggle--private:hover {
  background-color: transparent;
}

.detail-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  color: var(--color-on-surface-variant);
  font-size: var(--font-size-base);
}

/* Flex items default to min-width: auto (their own content's width), which lets
   a long unbroken value (coordinates, a place name, a partner chip row) push
   the row past the sheet's width instead of wrapping. Constrain every row's
   value cell so it shrinks to the available width and wraps there. */
.detail-row > *:not(.detail-icon) {
  min-width: 0;
  overflow-wrap: break-word;
}

.detail-row.align-start {
  align-items: flex-start;
}

.detail-icon {
  flex-shrink: 0;
  color: var(--color-outline);
}

/* Same line box as the resolved owner text, so the swap causes no reflow. Fill derives
   from the row's own color — blends on both themes without a new token. */
.owner-skeleton {
  min-height: 1em;
  width: 12ch;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, currentcolor 10%, transparent);
  animation: owner-skeleton-pulse 1.6s ease-in-out infinite;
}

@keyframes owner-skeleton-pulse {
  0%,
  100% {
    opacity: 0.5;
  }
  50% {
    opacity: 0.8;
  }
}

@media (prefers-reduced-motion: reduce) {
  .owner-skeleton {
    animation: none;
  }
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

.point-meta {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.point-elevation {
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

/* BaseButton (secondary) provides the look; keep the 44px touch target. */
.gpx-download-btn {
  min-height: 44px;
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

.friend-partner-chip {
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  background-color: var(--color-surface-variant);
  color: var(--color-on-surface);
}

.friend-partner-chip--more {
  background-color: transparent;
  border: 1px dashed var(--color-outline-variant);
  color: var(--color-on-surface-variant);
  font-style: italic;
}

/* ── Edit mode ──────────────────────────────────────────────────────────────── */
.save-error {
  font-size: var(--font-size-sm);
  color: var(--color-error);
  /* Align with the sheet's content inset (now md, was xl). */
  padding: 0 var(--spacing-md);
  margin-bottom: calc(-1 * var(--spacing-md));
}
</style>
