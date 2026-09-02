import type { AllowedMimeType } from '@/features/tours/data/models/tour-attachment'
import type { TourAttachment } from '@/features/tours/domain/entities/tour-attachment'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLogger } from '@/core/logging/use-logger'
import { loadCachedBlob } from '@/core/offline/blob-cache'
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
import { SupabaseTourAttachmentRepository } from '@/features/tours/data/repositories/tour-attachment-repository-impl'

const repository = new SupabaseTourAttachmentRepository()

export type AttachmentError
  = | { code: 'heic_unsupported' }
    | { code: 'invalid_type', mimeType: string }
    | { code: 'too_large', sizeBytes: number }
    | { code: 'limit_reached', remaining: number, selected: number }

export const useTourAttachmentsStore = defineStore('tourAttachments', () => {
  const logger = useLogger('TourAttachmentsStore')
  const authStore = useAuthStore()
  const { t } = useI18n({ useScope: 'global' })

  /** Loaded attachments keyed by tourId */
  const attachmentsByTour = ref<Record<string, TourAttachment[]>>({})
  /** Files staged for create-flow (keyed by draftId) */
  const stagedByDraft = ref<Record<string, File[]>>({})
  const loading = ref(false)
  const error = ref<string | null>(null)
  /** Tracks which tour's attachments are currently loaded (for realtime refetch targeting). */
  const currentTourId = ref<string | null>(null)

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
    try {
      // Hydrate from cache, then (online) refetch (design D3). Offline this uses the
      // cached list and makes no request — so opening a tour to edit offline no longer
      // surfaces a "failed to load attachments" error.
      await cachedLoad(
        `attachments:${tourId}`,
        () => repository.list(tourId),
        (result) => { attachmentsByTour.value[tourId] = result },
      )
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load attachments'
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

  /**
   * Stage files for a draft tour (create-flow) or a suggestion (D9).
   *
   * `baseCount` is what the tour ALREADY holds and keeps — zero while creating, but in
   * suggest mode the owner's existing attachments minus the ones this batch proposes to
   * remove. Without it the cap is measured against the staged list alone, so a partner
   * could propose four adds onto a tour already holding four and only find out when the
   * owner's accept hit the server-side cap.
   */
  function stage(draftId: string, files: File[], baseCount = 0) {
    const current = stagedByDraft.value[draftId] ?? []
    const validationError = validateBatch(files, current.length + baseCount)
    if (validationError) {
      error.value = errorMessage(validationError)
      return
    }
    error.value = null
    stagedByDraft.value[draftId] = [...current, ...files]
  }

  /** Upload staged files after tourId exists; clears staging on completion. */
  async function commitStaged(draftId: string, tourId: string) {
    const files = stagedByDraft.value[draftId]
    if (!files || files.length === 0)
      return

    const userId = authStore.currentUser?.id
    if (!userId)
      return

    loading.value = true
    error.value = null

    try {
      const results = await Promise.all(
        files.map(file =>
          repository.add({
            file,
            mimeType: file.type as AllowedMimeType,
            tourId,
            userId,
          }),
        ),
      )
      attachmentsByTour.value[tourId] = [...(attachmentsByTour.value[tourId] ?? []), ...results]
      delete stagedByDraft.value[draftId]
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to upload staged attachments'
      logger.error('commitStaged failed', err)
    }
    finally {
      loading.value = false
    }
  }

  /** Add files to an existing tour (edit-flow). */
  async function add(tourId: string, files: File[]) {
    const userId = authStore.currentUser?.id
    if (!userId)
      return

    const current = attachmentsByTour.value[tourId] ?? []
    const validationError = validateBatch(files, current.length)
    if (validationError) {
      error.value = errorMessage(validationError)
      return
    }

    // Blocked offline (design D5): the seam drops the write and signals the global
    // "unavailable offline" notice. Clear any prior error first so the picker banner
    // doesn't linger; offline never sets a new one.
    error.value = null
    return mutate(async () => {
      loading.value = true
      try {
        const results = await Promise.all(
          files.map(file =>
            repository.add({
              file,
              mimeType: file.type as AllowedMimeType,
              tourId,
              userId,
            }),
          ),
        )
        attachmentsByTour.value[tourId] = [...current, ...results]
      }
      catch (err) {
        error.value = err instanceof Error ? err.message : 'Failed to add attachment'
        logger.error('add attachment failed', err)
      }
      finally {
        loading.value = false
      }
    })
  }

  async function remove(attachment: TourAttachment) {
    error.value = null
    return mutate(async () => {
      try {
        await repository.remove(attachment)
        const list = attachmentsByTour.value[attachment.tourId] ?? []
        attachmentsByTour.value[attachment.tourId] = list.filter(a => a.id !== attachment.id)
      }
      catch (err) {
        error.value = err instanceof Error ? err.message : 'Failed to delete attachment'
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
      }
      catch (err) {
        error.value = err instanceof Error ? err.message : 'Failed to reorder attachments'
        logger.error('reorder attachments failed', err)
      }
    })
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
   * (keyed on the stable storage path). Online it caches the bytes on first view;
   * offline it serves the cached copy. Callers own the returned object URL and must
   * `URL.revokeObjectURL` it when done. Throws when the bytes were never cached and
   * we're offline.
   */
  async function getViewUrl(storagePath: string): Promise<string> {
    const blob = await loadCachedBlob(storagePath, () => fetchBlob(storagePath))
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
    currentTourId.value = null
    error.value = null
  }

  function clearStaged(draftId: string) {
    delete stagedByDraft.value[draftId]
  }

  /** Reorder staged files for create-flow by moving item at fromIndex to toIndex. */
  function stageReorder(draftId: string, fromIndex: number, toIndex: number) {
    const staged = [...(stagedByDraft.value[draftId] ?? [])]
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || toIndex >= staged.length)
      return
    const [moved] = staged.splice(fromIndex, 1)
    staged.splice(toIndex, 0, moved)
    stagedByDraft.value[draftId] = staged
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
    loading,
    error,
    currentTourId,
    load,
    stage,
    add,
    commitStaged,
    remove,
    reorder,
    getViewUrl,
    getDownloadUrl,
    clear,
    clearCurrent,
    clearStaged,
    stageReorder,
    // Exported for tests
    validateBatch,
    ALLOWED_MIME_TYPES,
    HEIC_MIME_TYPES,
    MAX_ATTACHMENT_SIZE_BYTES,
    MAX_ATTACHMENTS_PER_TOUR,
  }
})
