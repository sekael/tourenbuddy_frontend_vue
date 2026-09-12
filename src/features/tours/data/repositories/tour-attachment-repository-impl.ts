import type { TourAttachment } from '@/features/tours/domain/entities/tour-attachment'
import type {
  AttachmentRowInput,
  NewAttachmentInput,
  TourAttachmentRepository,
} from '@/features/tours/domain/repositories/tour-attachment-repository'
import { uploadWithProgress } from '@/core/utils/storage-upload'
import { supabase } from '@/core/utils/supabase'
import { tourAttachmentRowSchema } from '@/features/tours/data/models/tour-attachment'

const BUCKET = 'tour-attachments'
const SIGNED_URL_TTL = 300 // 5 min

function extFromMime(mime: string): string {
  if (mime === 'image/png')
    return 'png'
  if (mime === 'image/jpeg')
    return 'jpg'
  return 'pdf'
}

/**
 * The object key for an attachment. Exported so callers can mint it BEFORE uploading and
 * cache the picked bytes under it (design D2) — never upserted, one uuid per upload.
 */
export function attachmentStoragePath(
  userId: string,
  tourId: string,
  attachmentId: string,
  mimeType: string,
): string {
  return `${userId}/${tourId}/${attachmentId}.${extFromMime(mimeType)}`
}

export class SupabaseTourAttachmentRepository implements TourAttachmentRepository {
  async list(tourId: string): Promise<TourAttachment[]> {
    const { data, error } = await supabase
      .from('tour_attachments')
      .select('*')
      .eq('tour_id', tourId)
      .order('sort_order', { ascending: true })

    if (error)
      throw new Error(error.message)

    return (data ?? []).map(row => tourAttachmentRowSchema.parse(row))
  }

  async uploadObject(input: NewAttachmentInput): Promise<string> {
    const { file, mimeType, tourId, userId, id, signal, onProgress } = input
    const storagePath = attachmentStoragePath(userId, tourId, id, mimeType)

    await uploadWithProgress(BUCKET, storagePath, file, { contentType: mimeType, signal, onProgress })

    return storagePath
  }

  async insertRow(input: AttachmentRowInput): Promise<TourAttachment> {
    const { data, error } = await supabase
      .from('tour_attachments')
      .insert({
        id: input.id,
        tour_id: input.tourId,
        user_id: input.userId,
        storage_path: input.storagePath,
        mime_type: input.mimeType,
        size_bytes: input.sizeBytes,
        original_filename: input.originalFilename,
        sort_order: 9999, // DB trigger will not reorder; client does via reorder()
      })
      .select()
      .single()

    if (error)
      throw new Error(error.message)

    return tourAttachmentRowSchema.parse(data)
  }

  async add(input: NewAttachmentInput): Promise<TourAttachment> {
    const { file, mimeType, tourId, userId, id } = input
    const storagePath = await this.uploadObject(input)

    try {
      return await this.insertRow({
        id,
        tourId,
        userId,
        storagePath,
        mimeType,
        sizeBytes: file.size,
        originalFilename: file.name,
      })
    }
    catch (err) {
      // Best-effort orphan cleanup
      await this.removeObject(storagePath)
      throw err
    }
  }

  async remove(attachment: TourAttachment): Promise<void> {
    const { error } = await supabase
      .from('tour_attachments')
      .delete()
      .eq('id', attachment.id)

    if (error)
      throw new Error(error.message)

    // Best-effort storage cleanup (row cascade already removes logical record)
    await this.removeObject(attachment.storagePath)
  }

  async removeObject(storagePath: string): Promise<void> {
    await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {})
  }

  async reorder(tourId: string, orderedIds: string[]): Promise<void> {
    const { error } = await supabase.rpc('update_attachment_order', {
      p_tour_id: tourId,
      p_ordered_ids: orderedIds,
    })

    if (error)
      throw new Error(error.message)
  }

  async getViewUrl(storagePath: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL)

    if (error || !data?.signedUrl)
      throw new Error(error?.message ?? 'Failed to get signed URL')

    return data.signedUrl
  }

  async getDownloadUrl(storagePath: string, originalFilename: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL, {
        download: originalFilename,
      })

    if (error || !data?.signedUrl)
      throw new Error(error?.message ?? 'Failed to get download URL')

    return data.signedUrl
  }
}
