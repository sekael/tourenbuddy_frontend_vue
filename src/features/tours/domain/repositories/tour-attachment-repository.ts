import type { AllowedMimeType } from '@/features/tours/data/models/tour-attachment'
import type { TourAttachment } from '@/features/tours/domain/entities/tour-attachment'

export interface NewAttachmentInput {
  file: File
  mimeType: AllowedMimeType
  tourId: string
  userId: string
}

export interface TourAttachmentRepository {
  list: (tourId: string) => Promise<TourAttachment[]>
  add: (input: NewAttachmentInput) => Promise<TourAttachment>
  remove: (attachment: TourAttachment) => Promise<void>
  reorder: (tourId: string, orderedIds: string[]) => Promise<void>
  getViewUrl: (storagePath: string) => Promise<string>
  getDownloadUrl: (storagePath: string, originalFilename: string) => Promise<string>
}
