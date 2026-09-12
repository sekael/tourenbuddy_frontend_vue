import type { AllowedMimeType } from '@/features/tours/data/models/tour-attachment'
import type { TourAttachment } from '@/features/tours/domain/entities/tour-attachment'
import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLogger } from '@/core/logging/use-logger'
import { cacheBlob, evictCachedBlob, loadCachedBlob, peekCachedBlob } from '@/core/offline/blob-cache'
import { cachedLoad } from '@/core/offline/cached-load'
import { mutate } from '@/core/offline/mutate'
import { useRealtimeSubscription } from '@/core/realtime/use-realtime-subscription'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
import {
  ALLOWED_MIME_TYPES,
  HEIC_MIME_TYPES,
  MAX_ATTACHMENT_SIZE_BYTES,
  MAX_ATTACHMENTS_PER_TOUR,
} from '@/features/tours/data/models/tour-attachment'
import {
  attachmentStoragePath,
  SupabaseTourAttachmentRepository,
} from '@/features/tours/data/repositories/tour-attachment-repository-impl'

const repository = new SupabaseTourAttachmentRepository()

export type AttachmentError
  = | { code: 'heic_unsupported' }
    | { code: 'invalid_type', mimeType: string }
    | { code: 'too_large', sizeBytes: number }
    | { code: 'limit_reached', remaining: number, selected: number }

/**
 * A file being uploaded right now (design D4). Store state, not component state: the picker
 * renders rows, the strip renders them for a create-flow batch, and the form gates Save on
 * `uploading` — and the transfer must survive the sheet unmounting, since an attachment row
 * does not depend on the tour save.
 *
 * NOT folded into `attachments`: a pending file has no row, so it cannot be reordered (the
 * RPC takes real ids) or removed, and would need excluding from the drag handler, the delete
 * confirm and the suggestion diff. It IS counted against the cap.
 */
export interface PendingUpload {
  /** The minted attachment id — the same id the persisted row will carry. */
  id: string
  /** Real tour id (edit) or the pre-minted one (create, design D5). */
  tourId: string
  /** Create flow only: the draft this upload belongs to. */
  draftId?: string
  /** Post-deduplication (design D8) — the name that will persist. */
  filename: string
  storagePath: string
  mimeType: AllowedMimeType
  sizeBytes: number
  /** 0..1 */
  progress: number
  status: 'uploading' | 'failed'
  cancel: () => void
}

/** A create-flow file already in Storage, waiting only for its row (design D5). */
interface PreUploaded {
  id: string
  storagePath: string
  mimeType: AllowedMimeType
  sizeBytes: number
  originalFilename: string
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

/** `image.jpg` → `image1.jpg` when taken; a free name is returned untouched (design D8). */
function uniqueFilename(taken: Set<string>, name: string): string {
  if (!taken.has(name))
    return name
  const dot = name.lastIndexOf('.')
  const base = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ''
  let n = 1
  while (taken.has(`${base}${n}${ext}`))
    n++
  return `${base}${n}${ext}`
}

/** Copy of `list` with the item at `from` moved to `to`; out-of-range moves are a no-op. */
function moved<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length)
    return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

function renamed(file: File, filename: string): File {
  return filename === file.name ? file : new File([file], filename, { type: file.type })
}

export const useTourAttachmentsStore = defineStore('tourAttachments', () => {
  const logger = useLogger('TourAttachmentsStore')
  const authStore = useAuthStore()
  const { t } = useI18n({ useScope: 'global' })

  /** Loaded attachments keyed by tourId */
  const attachmentsByTour = ref<Record<string, TourAttachment[]>>({})
  /** Files staged for suggest-mode (keyed by draftId) — see `stage()`. */
  const stagedByDraft = ref<Record<string, File[]>>({})
  /** Create-flow files already uploaded, awaiting their row (design D5). */
  const preUploadedByDraft = ref<Record<string, PreUploaded[]>>({})
  /** In-flight / failed uploads keyed by tourId (design D4). */
  const pendingByTour = ref<Record<string, PendingUpload[]>>({})
  const loading = ref(false)
  const error = ref<string | null>(null)
  /** Tracks which tour's attachments are currently loaded (for realtime refetch targeting). */
  const currentTourId = ref<string | null>(null)
  /**
   * Bumped by every successful write (design D1). `load()` captures it before the fetch and
   * discards a result whose sequence moved — PostgREST answers the snapshot it saw, so on a
   * slow link a `list()` issued before an insert can otherwise resolve after it and blank the
   * fresh row. Mirrors the `friendTours` guard in `tours-store.ts`.
   */
  const writeSeq = ref(0)

  /** A failed upload is settled, so it must NOT block Save (design D6). */
  const uploading = computed(() =>
    Object.values(pendingByTour.value).some(list => list.some(p => p.status === 'uploading')),
  )

  const channelKey = computed(() => {
    const uid = authStore.currentUser?.id
    return authStore.isAuthenticated && uid ? `tour-attachments-${uid}` : null
  })

  useRealtimeSubscription({
    key: () => channelKey.value,
    enabled: () => authStore.isAuthenticated,
    bindings: () => {
      const uid = authStore.currentUser?.id
      if (!uid)
        return []
      return [
        { event: '*', table: 'tour_attachments', filter: `user_id=eq.${uid}` },
        // An accepted attachment suggestion inserts the row under the TOUR OWNER's
        // user_id, so the suggester's own filter above never sees it. Their suggestion
        // row does flip status in the same transaction — take that as the cue to
        // refetch the open tour's attachments (realtime filters cannot join, D8).
        { event: 'UPDATE', table: 'tour_suggestion', filter: `suggester_id=eq.${uid}` },
      ]
    },
    onChange: () => refetchCurrent(),
    // MANDATORY (architecture rule): a hidden tab tears the channel down, so inserts in
    // that window are lost. Every (re-)subscribe refetches the open tour.
    onSubscribed: () => refetchCurrent(),
  })

  function refetchCurrent() {
    if (currentTourId.value)
      void load(currentTourId.value)
  }

  watch(
    () => authStore.isAuthenticated,
    (authed) => {
      if (!authed)
        clear()
    },
  )

  async function load(tourId: string) {
    currentTourId.value = tourId
    loading.value = true
    error.value = null
    // Captured BEFORE the fetch; compared inside the assign callback rather than around the
    // await, because `cachedLoad` also paints from cache on a cold load and that paint must
    // survive (design D1).
    const seq = writeSeq.value
    try {
      // Hydrate from cache, then (online) refetch (design D3). Offline this uses the
      // cached list and makes no request — so opening a tour to edit offline no longer
      // surfaces a "failed to load attachments" error.
      await cachedLoad(
        `attachments:${tourId}`,
        () => repository.list(tourId),
        (result) => {
          if (seq !== writeSeq.value)
            return // a write landed while we were reading — it wins
          attachmentsByTour.value[tourId] = result
        },
      )
    }
    catch (err) {
      error.value = t('tours.attachments.loadFailed')
      logger.error('load attachments failed', err)
    }
    finally {
      loading.value = false
    }
  }

  function clearCurrent() {
    currentTourId.value = null
  }

  /**
   * Validate a batch of files against current count.
   * Returns error or null.
   */
  function validateBatch(files: File[], currentCount: number): AttachmentError | null {
    for (const file of files) {
      if ((HEIC_MIME_TYPES as readonly string[]).includes(file.type)) {
        return { code: 'heic_unsupported' }
      }

      if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
        return { code: 'invalid_type', mimeType: file.type }
      }

      if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
        return { code: 'too_large', sizeBytes: file.size }
      }
    }

    if (currentCount + files.length > MAX_ATTACHMENTS_PER_TOUR) {
      return {
        code: 'limit_reached',
        remaining: MAX_ATTACHMENTS_PER_TOUR - currentCount,
        selected: files.length,
      }
    }

    return null
  }

  /** Files the tour already holds or is about to (design D7) — what the cap is measured against. */
  function occupiedCount(tourId: string | null, draftId?: string): number {
    const persisted = tourId ? (attachmentsByTour.value[tourId] ?? []).length : 0
    const pending = tourId ? (pendingByTour.value[tourId] ?? []).length : 0
    const preUploaded = draftId ? (preUploadedByDraft.value[draftId] ?? []).length : 0
    const staged = draftId ? (stagedByDraft.value[draftId] ?? []).length : 0
    // No double counting: an entry moves out of `pendingByTour` and into
    // `preUploadedByDraft` in one synchronous step when it settles.
    return persisted + pending + preUploaded + staged
  }

  /** Every filename the tour holds, has staged, has pre-uploaded, or is uploading (design D8). */
  function takenNames(tourId: string | null, draftId?: string): Set<string> {
    const names = new Set<string>()
    if (tourId) {
      for (const a of attachmentsByTour.value[tourId] ?? [])
        names.add(a.originalFilename)
      for (const p of pendingByTour.value[tourId] ?? [])
        names.add(p.filename)
    }
    if (draftId) {
      for (const f of stagedByDraft.value[draftId] ?? [])
        names.add(f.name)
      for (const p of preUploadedByDraft.value[draftId] ?? [])
        names.add(p.originalFilename)
    }
    return names
  }

  /**
   * Stage files for a suggestion (D9) — a non-owner cannot write `tour_attachments`, so the
   * bytes wait in memory until the parent uploads them to the staging prefix.
   *
   * `baseCount` is what the tour ALREADY holds and keeps — the owner's existing attachments
   * minus the ones this batch proposes to remove. Without it the cap is measured against the
   * staged list alone, so a partner could propose four adds onto a tour already holding four
   * and only find out when the owner's accept hit the server-side cap.
   */
  function stage(draftId: string, files: File[], baseCount = 0) {
    const current = stagedByDraft.value[draftId] ?? []
    const validationError = validateBatch(files, current.length + baseCount)
    if (validationError) {
      error.value = errorMessage(validationError)
      return
    }
    error.value = null
    // Deduplicate at pick time so the name shown while staging is the name that persists.
    const taken = takenNames(null, draftId)
    const named = files.map((f) => {
      const name = uniqueFilename(taken, f.name)
      taken.add(name)
      return renamed(f, name)
    })
    stagedByDraft.value[draftId] = [...current, ...named]
  }

  // ── Uploading ────────────────────────────────────────────────────────────────
  function addPending(entry: PendingUpload): PendingUpload {
    const list = pendingByTour.value[entry.tourId] ?? []
    pendingByTour.value[entry.tourId] = [...list, entry]
    // Return the reactive proxy, not the raw literal — progress writes must be observed.
    return pendingByTour.value[entry.tourId].at(-1)!
  }

  function dropPending(entry: PendingUpload) {
    const list = pendingByTour.value[entry.tourId] ?? []
    pendingByTour.value[entry.tourId] = list.filter(p => p.id !== entry.id)
  }

  function findPending(id: string): PendingUpload | undefined {
    for (const list of Object.values(pendingByTour.value)) {
      const hit = list.find(p => p.id === id)
      if (hit)
        return hit
    }
    return undefined
  }

  /**
   * Upload one file, settling on its own — no `Promise.all` over the batch, since one
   * failure must not abort its siblings (design D6).
   */
  async function runUpload(entry: PendingUpload, file: File, userId: string) {
    const controller = new AbortController()
    entry.cancel = () => controller.abort()
    entry.status = 'uploading'
    entry.progress = 0

    const input = {
      id: entry.id,
      file,
      mimeType: entry.mimeType,
      tourId: entry.tourId,
      userId,
      signal: controller.signal,
      onProgress: (fraction: number) => { entry.progress = fraction },
    }

    try {
      if (entry.draftId) {
        // Create flow: the object lands now, the row only after the tours row exists (FK),
        // so an abandoned draft can never leave rows behind.
        await repository.uploadObject(input)
        preUploadedByDraft.value[entry.draftId] = [
          ...(preUploadedByDraft.value[entry.draftId] ?? []),
          {
            id: entry.id,
            storagePath: entry.storagePath,
            mimeType: entry.mimeType,
            sizeBytes: entry.sizeBytes,
            originalFilename: entry.filename,
          },
        ]
      }
      else {
        const row = await repository.add(input)
        attachmentsByTour.value[entry.tourId] = [
          ...(attachmentsByTour.value[entry.tourId] ?? []),
          row,
        ]
        writeSeq.value++
      }
      dropPending(entry)
    }
    catch (err) {
      if (isAbortError(err)) {
        // A cancel is not a failure: no banner, no error log, siblings untouched.
        dropPending(entry)
        void discardObject(entry.storagePath)
        return
      }
      entry.status = 'failed'
      await reportFailure(err, entry.tourId)
    }
  }

  /** Best-effort teardown of an object + its cached bytes (cancel, dismiss, abandoned draft). */
  async function discardObject(storagePath: string) {
    await evictCachedBlob(storagePath).catch(() => {})
    await repository.removeObject(storagePath).catch(() => {})
  }

  /** Mint id + path, cache the bytes, register the pending row, and start the transfer. */
  async function startUpload(
    tourId: string,
    userId: string,
    file: File,
    filename: string,
    draftId?: string,
  ) {
    const id = uuidv4()
    const mimeType = file.type as AllowedMimeType
    const storagePath = attachmentStoragePath(userId, tourId, id, mimeType)
    // Cache BEFORE uploading so the picker/strip paint from local bytes immediately (D2).
    // NOT `markPendingUpload` — that marker means "upload on write-queue replay", and
    // attachments have no replay handler (DC10); marking would strand a phantom key.
    await cacheBlob(storagePath, file).catch(() => {})

    const entry = addPending({
      id,
      tourId,
      draftId,
      filename,
      storagePath,
      mimeType,
      sizeBytes: file.size,
      progress: 0,
      status: 'uploading',
      cancel: () => {},
    })

    await runUpload(entry, renamed(file, filename), userId)
  }

  /** Add files to an existing tour (edit-flow). */
  async function add(tourId: string, files: File[]) {
    const userId = authStore.currentUser?.id
    if (!userId)
      return

    const validationError = validateBatch(files, occupiedCount(tourId))
    if (validationError) {
      error.value = errorMessage(validationError)
      return
    }

    // Blocked offline (design D5): the seam drops the write and signals the global
    // "unavailable offline" notice. Clear any prior error first so the picker banner
    // doesn't linger; offline never sets a new one.
    error.value = null
    return mutate(async () => {
      const taken = takenNames(tourId)
      await Promise.all(files.map((file) => {
        const filename = uniqueFilename(taken, file.name)
        taken.add(filename)
        return startUpload(tourId, userId, file, filename)
      }))
    })
  }

  /**
   * Create-flow pick (design D5): upload NOW to the pre-minted tour id, exactly as the GPX
   * flow does, so Save waits for the bytes instead of uploading them after the insert.
   */
  async function preUpload(draftId: string, tourId: string, files: File[], baseCount = 0) {
    const userId = authStore.currentUser?.id
    if (!userId)
      return

    const validationError = validateBatch(files, occupiedCount(tourId, draftId) + baseCount)
    if (validationError) {
      error.value = errorMessage(validationError)
      return
    }

    error.value = null
    return mutate(async () => {
      const taken = takenNames(tourId, draftId)
      await Promise.all(files.map((file) => {
        const filename = uniqueFilename(taken, file.name)
        taken.add(filename)
        return startUpload(tourId, userId, file, filename, draftId)
      }))
    })
  }

  /** Re-upload a failed file from its cached bytes — no re-pick (design D6). */
  async function retryUpload(id: string) {
    const entry = findPending(id)
    const userId = authStore.currentUser?.id
    if (!entry || !userId || entry.status !== 'failed')
      return
    const blob = await peekCachedBlob(entry.storagePath)
    if (!blob) {
      // The bytes are gone (cache evicted); there is nothing to retry from.
      error.value = t('tours.attachments.uploadFailed')
      return
    }
    error.value = null
    await runUpload(entry, new File([blob], entry.filename, { type: entry.mimeType }), userId)
  }

  /** Drop a failed upload: evict its bytes and remove the row (design D6). */
  async function dismissUpload(id: string) {
    const entry = findPending(id)
    if (!entry)
      return
    dropPending(entry)
    await discardObject(entry.storagePath)
  }

  /** Insert rows for the create-flow files already in Storage (design D5). */
  async function commitStaged(draftId: string, tourId: string) {
    const uploaded = preUploadedByDraft.value[draftId]
    if (!uploaded || uploaded.length === 0)
      return

    const userId = authStore.currentUser?.id
    if (!userId)
      return

    loading.value = true
    error.value = null

    try {
      const rows = []
      for (const file of uploaded) {
        rows.push(await repository.insertRow({
          id: file.id,
          tourId,
          userId,
          storagePath: file.storagePath,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
          originalFilename: file.originalFilename,
        }))
      }
      attachmentsByTour.value[tourId] = [...(attachmentsByTour.value[tourId] ?? []), ...rows]
      writeSeq.value++
      delete preUploadedByDraft.value[draftId]
    }
    catch (err) {
      await reportFailure(err, tourId)
    }
    finally {
      loading.value = false
    }
  }

  /**
   * Abandoned create draft: remove every pre-uploaded object and its cached bytes, and abort
   * anything still in flight. No rows exist yet, so this is the whole teardown (design D5).
   */
  async function discardDraft(draftId: string, tourId: string | null) {
    if (tourId) {
      for (const entry of [...(pendingByTour.value[tourId] ?? [])]) {
        if (entry.draftId !== draftId)
          continue
        entry.cancel()
        dropPending(entry)
        void discardObject(entry.storagePath)
      }
    }
    const uploaded = preUploadedByDraft.value[draftId] ?? []
    delete preUploadedByDraft.value[draftId]
    delete stagedByDraft.value[draftId]
    await Promise.all(uploaded.map(f => discardObject(f.storagePath)))
  }

  async function remove(attachment: TourAttachment) {
    error.value = null
    return mutate(async () => {
      try {
        await repository.remove(attachment)
        const list = attachmentsByTour.value[attachment.tourId] ?? []
        attachmentsByTour.value[attachment.tourId] = list.filter(a => a.id !== attachment.id)
        writeSeq.value++
      }
      catch (err) {
        error.value = t('tours.infoSheet.deleteFailed')
        logger.error('remove attachment failed', err)
      }
    })
  }

  async function reorder(tourId: string, orderedIds: string[]) {
    error.value = null
    return mutate(async () => {
      try {
        await repository.reorder(tourId, orderedIds)
        const list = attachmentsByTour.value[tourId] ?? []
        const byId = Object.fromEntries(list.map(a => [a.id, a]))
        attachmentsByTour.value[tourId] = orderedIds
          .filter(id => byId[id])
          .map((id, idx) => ({ ...byId[id], sortOrder: idx }))
        writeSeq.value++
      }
      catch (err) {
        error.value = t('tours.infoSheet.saveFailed')
        logger.error('reorder attachments failed', err)
      }
    })
  }

  /**
   * Turn a repository failure into user-facing text (design D7). A cap rejection is ALWAYS
   * recomputed from a fresh list — the count that produced it may have been stale, which is
   * exactly how the reported "at most 5 attachments" exception surfaced on an empty tour.
   * Raw database text never reaches the UI.
   */
  async function reportFailure(err: unknown, tourId: string) {
    logger.error('attachment upload failed', err)
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('tour_attachment_limit_exceeded')) {
      await load(tourId)
      const count = (attachmentsByTour.value[tourId] ?? []).length
      error.value = t('tours.attachments.limitRemaining', {
        remaining: Math.max(0, MAX_ATTACHMENTS_PER_TOUR - count),
        selected: 1,
      })
      return
    }
    error.value = t('tours.attachments.uploadFailed')
  }

  /** Fetch an attachment's bytes via a fresh signed URL (used only when online). */
  async function fetchBlob(storagePath: string): Promise<Blob> {
    const signedUrl = await repository.getViewUrl(storagePath)
    const res = await fetch(signedUrl)
    if (!res.ok)
      throw new Error(`HTTP ${res.status}`)
    return res.blob()
  }

  /**
   * Object URL for viewing/downloading an attachment, backed by the offline blob cache
   * (keyed on the stable storage path). Cache-first (design D2): a hit issues NO request at
   * all, so re-opening a tour costs no bandwidth and a picked file paints from the bytes
   * cached at pick time. Sound because attachment paths are immutable — never upserted.
   * Callers own the returned object URL and must `URL.revokeObjectURL` it when done.
   */
  async function getViewUrl(storagePath: string): Promise<string> {
    const blob = await loadCachedBlob(storagePath, () => fetchBlob(storagePath), {
      preferCache: true,
    })
    if (!blob)
      throw new Error('Attachment unavailable offline')
    return URL.createObjectURL(blob)
  }

  async function getDownloadUrl(storagePath: string, _originalFilename: string): Promise<string> {
    return getViewUrl(storagePath)
  }

  function clear() {
    attachmentsByTour.value = {}
    stagedByDraft.value = {}
    preUploadedByDraft.value = {}
    pendingByTour.value = {}
    currentTourId.value = null
    error.value = null
  }

  function clearStaged(draftId: string) {
    delete stagedByDraft.value[draftId]
  }

  /**
   * Reorder a draft's files by moving item at fromIndex to toIndex. Create mode reorders the
   * PRE-UPLOADED list (design D5 — its bytes are already in Storage); suggest mode reorders
   * the in-memory staged files. Order is what `commitStaged` inserts as `sort_order`.
   */
  function stageReorder(draftId: string, fromIndex: number, toIndex: number) {
    const preUploaded = preUploadedByDraft.value[draftId]
    if (preUploaded?.length) {
      preUploadedByDraft.value[draftId] = moved(preUploaded, fromIndex, toIndex)
      return
    }
    const staged = stagedByDraft.value[draftId]
    if (staged?.length)
      stagedByDraft.value[draftId] = moved(staged, fromIndex, toIndex)
  }

  /** Drop one create-flow file before the tour exists: no row to delete, just the object. */
  async function discardPreUploaded(draftId: string, id: string) {
    const list = preUploadedByDraft.value[draftId] ?? []
    const target = list.find(f => f.id === id)
    if (!target)
      return
    preUploadedByDraft.value[draftId] = list.filter(f => f.id !== id)
    await discardObject(target.storagePath)
  }

  function errorMessage(e: AttachmentError): string {
    switch (e.code) {
      case 'heic_unsupported':
        return t('tours.attachments.heicUnsupported')
      case 'invalid_type':
        return t('tours.attachments.invalidType')
      case 'too_large':
        return t('tours.attachments.tooLarge')
      case 'limit_reached':
        return t('tours.attachments.limitRemaining', {
          remaining: e.remaining,
          selected: e.selected,
        })
    }
  }

  return {
    attachmentsByTour,
    stagedByDraft,
    preUploadedByDraft,
    pendingByTour,
    uploading,
    loading,
    error,
    currentTourId,
    load,
    stage,
    add,
    preUpload,
    retryUpload,
    dismissUpload,
    commitStaged,
    discardDraft,
    discardPreUploaded,
    remove,
    reorder,
    getViewUrl,
    getDownloadUrl,
    clear,
    clearCurrent,
    clearStaged,
    stageReorder,
    occupiedCount,
    // Exported for tests
    validateBatch,
    writeSeq,
    ALLOWED_MIME_TYPES,
    HEIC_MIME_TYPES,
    MAX_ATTACHMENT_SIZE_BYTES,
    MAX_ATTACHMENTS_PER_TOUR,
  }
})
