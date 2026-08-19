import { clearCached, getCached, putCached } from '@/core/offline/entity-cache'
import { isOnline } from '@/core/offline/use-online-status'

/**
 * Stage a blob (e.g. a GPX track picked offline) under its stable storage key BEFORE it
 * exists in Supabase Storage, so it renders immediately from the same cache the online
 * display path reads (`loadCachedBlob`) and can be uploaded on write-queue replay.
 */
export function cacheBlob(key: string, blob: Blob): Promise<IDBValidKey> {
  return putCached(`blob:${key}`, blob)
}

/** Read a staged/cached blob by storage key (no network) — the bytes to upload on replay. */
export function peekCachedBlob(key: string): Promise<Blob | undefined> {
  return getCached<Blob>(`blob:${key}`)
}

/** Drop a staged blob (offline GPX removed/cancelled before it was ever uploaded). */
export function evictCachedBlob(key: string): Promise<undefined> {
  return clearCached(`blob:${key}`)
}

/**
 * Mark a storage key as holding bytes staged offline that still need uploading — the
 * signal that distinguishes an offline pick (upload on replay) from a blob merely cached
 * for display after an online view (already in Storage). Cleared once the upload lands.
 */
export function markPendingUpload(key: string): Promise<IDBValidKey> {
  return putCached(`pending-upload:${key}`, true)
}

export async function isPendingUpload(key: string): Promise<boolean> {
  return (await getCached<boolean>(`pending-upload:${key}`)) === true
}

export function clearPendingUpload(key: string): Promise<undefined> {
  return clearCached(`pending-upload:${key}`)
}

/**
 * Offline-capable binary read (change: offline-app-cache-sync). Attachment images /
 * PDFs and GPX tracks live in Supabase Storage behind SHORT-LIVED signed URLs, so the
 * SW's URL-keyed runtime cache can't hold them (the URL rotates every load). Instead
 * cache the raw bytes in the same IndexedDB the entity cache uses, keyed on the STABLE
 * storage path (never the signed URL) under a `blob:` prefix.
 *
 * Populated lazily on view — the first online open of an attachment / track caches its
 * bytes; there is no bulk prefetch (bandwidth). Semantics mirror `cachedLoad`:
 *   - online: fetch fresh, overwrite the cache, return the bytes; on a network failure
 *     fall through to the cached copy rather than erroring.
 *   - offline: serve the cached bytes.
 * Returns `undefined` when neither the network nor the cache can supply them (never
 * viewed online) — callers surface their existing "unavailable" fallback.
 */
export async function loadCachedBlob(
  key: string,
  fetchFresh: () => Promise<Blob>,
): Promise<Blob | undefined> {
  if (isOnline.value) {
    try {
      const blob = await fetchFresh()
      void putCached(`blob:${key}`, blob).catch(() => {})
      return blob
    }
    catch {
      // Network hiccup while nominally online — fall through to the cached copy.
    }
  }
  try {
    return await getCached<Blob>(`blob:${key}`)
  }
  catch {
    return undefined
  }
}
