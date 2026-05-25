import type { AllowedMimeType } from '@/features/tours/data/models/tour-attachment'
import type { TourAttachment } from '@/features/tours/domain/entities/tour-attachment'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLogger } from '@/core/logging/use-logger'
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

  async function load(tourId: string) {
    loading.value = true
    error.value = null
    try {
      attachmentsByTour.value[tourId] = await repository.list(tourId)
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load attachments'
      logger.error('load attachments failed', err)
    }
    finally {
      loading.value = false
    }
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

  /** Stage files for a draft tour (create-flow). Replaces previous staged list. */
  function stage(draftId: string, files: File[]) {
    const current = stagedByDraft.value[draftId] ?? []
    const validationError = validateBatch(files, current.length)
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

    error.value = null
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
  }

  async function remove(attachment: TourAttachment) {
    try {
      await repository.remove(attachment)
      const list = attachmentsByTour.value[attachment.tourId] ?? []
      attachmentsByTour.value[attachment.tourId] = list.filter(a => a.id !== attachment.id)
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete attachment'
      logger.error('remove attachment failed', err)
    }
  }

  async function reorder(tourId: string, orderedIds: string[]) {
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
  }

  async function getViewUrl(storagePath: string): Promise<string> {
    return repository.getViewUrl(storagePath)
  }

  async function getDownloadUrl(storagePath: string, originalFilename: string): Promise<string> {
    return repository.getDownloadUrl(storagePath, originalFilename)
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
    load,
    stage,
    add,
    commitStaged,
    remove,
    reorder,
    getViewUrl,
    getDownloadUrl,
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
