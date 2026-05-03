import { supabase } from '@/core/utils/supabase'

const BUCKET = 'tour-gpx'
const SIGNED_URL_EXPIRES_IN = 3600

function objectKey(tourId: string): string {
  return `${tourId}.gpx`
}

export async function uploadGpx(tourId: string, file: File): Promise<string> {
  const key = objectKey(tourId)
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(key, file, { contentType: 'application/gpx+xml', upsert: true })
  if (error)
    throw new Error(error.message)
  return key
}

export async function removeGpx(tourId: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([objectKey(tourId)])
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
