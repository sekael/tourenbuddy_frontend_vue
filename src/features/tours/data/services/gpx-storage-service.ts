import type { UploadOptions } from '@/core/utils/storage-upload'
import { uploadWithProgress } from '@/core/utils/storage-upload'
import { supabase } from '@/core/utils/supabase'

const BUCKET = 'tour-gpx'
const SIGNED_URL_EXPIRES_IN = 3600

/** Deterministic storage key for a tour's GPX — mintable client-side (offline) before upload. */
export function gpxStorageKey(userId: string, tourId: string): string {
  return `${userId}/${tourId}.gpx`
}

/**
 * Upload GPX bytes to an already-known key (used by offline replay, where the key was minted
 * at pick-time).
 *
 * Routed through the shared XHR transport so one upload path exists app-wide and the picker
 * can show real progress instead of an indeterminate spinner. `upsert` is not optional here
 * the way it is for attachments: the key is stable (`<uid>/<tourId>.gpx`), so every replace
 * overwrites. The signed upload URL carries it as the `x-upsert` header, and an overwrite
 * needs an UPDATE storage policy on top of INSERT — `tour-gpx owner update` in
 * `20260510064254_storage_buckets_and_policies.sql` provides it.
 *
 * `opts` is deliberately narrowed: `contentType` and `upsert` are properties of the GPX key
 * itself, not of a single call, so no caller may override them.
 */
export async function uploadGpxToKey(
  key: string,
  file: Blob,
  opts: Pick<UploadOptions, 'signal' | 'onProgress'> = {},
): Promise<void> {
  await uploadWithProgress(BUCKET, key, file, {
    // Spread FIRST: the two fixed fields must win over anything a caller passes.
    ...opts,
    contentType: 'application/gpx+xml',
    upsert: true,
  })
}

export async function uploadGpx(
  userId: string,
  tourId: string,
  file: File,
  opts: Pick<UploadOptions, 'signal' | 'onProgress'> = {},
): Promise<string> {
  const key = gpxStorageKey(userId, tourId)
  await uploadGpxToKey(key, file, opts)
  return key
}

export async function removeGpx(filepath: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([filepath])
  if (error)
    throw new Error(error.message)
}

export async function getSignedUrl(filepath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filepath, SIGNED_URL_EXPIRES_IN)
  if (error || !data?.signedUrl)
    throw new Error(error?.message ?? 'Failed to get signed URL')
  return data.signedUrl
}

export async function downloadOriginal(filepath: string, fallbackName: string): Promise<void> {
  const signedUrl = await getSignedUrl(filepath)
  const a = document.createElement('a')
  a.href = signedUrl
  a.download = fallbackName
  a.rel = 'noopener noreferrer'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
