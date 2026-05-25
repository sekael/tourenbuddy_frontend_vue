import type { TourAttachment } from '@/features/tours/domain/entities/tour-attachment'
import type {
  NewAttachmentInput,
  TourAttachmentRepository,
} from '@/features/tours/domain/repositories/tour-attachment-repository'
import { v4 as uuidv4 } from 'uuid'
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

  async add(input: NewAttachmentInput): Promise<TourAttachment> {
    const { file, mimeType, tourId, userId } = input
    const attachmentId = uuidv4()
    const ext = extFromMime(mimeType)
    const storagePath = `${userId}/${tourId}/${attachmentId}.${ext}`

    // 1. Upload to storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file, { contentType: mimeType })

    if (uploadError)
      throw new Error(uploadError.message)

    // 2. Insert row — cleanup blob on failure
    const { data, error: insertError } = await supabase
      .from('tour_attachments')
      .insert({
        id: attachmentId,
        tour_id: tourId,
        user_id: userId,
        storage_path: storagePath,
        mime_type: mimeType,
        size_bytes: file.size,
        original_filename: file.name,
        sort_order: 9999, // DB trigger will not reorder; client does via reorder()
      })
      .select()
      .single()

    if (insertError) {
      // Best-effort orphan cleanup
      await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {})
      throw new Error(insertError.message)
    }

    return tourAttachmentRowSchema.parse(data)
  }

  async remove(attachment: TourAttachment): Promise<void> {
    const { error } = await supabase
      .from('tour_attachments')
      .delete()
      .eq('id', attachment.id)

    if (error)
      throw new Error(error.message)

    // Best-effort storage cleanup (row cascade already removes logical record)
    await supabase.storage.from(BUCKET).remove([attachment.storagePath]).catch(() => {})
  }

  async reorder(tourId: string, orderedIds: string[]): Promise<void> {
    const { error } = await supabase.rpc('update_attachment_order', {
      tour_id: tourId,
      ordered_ids: orderedIds,
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
