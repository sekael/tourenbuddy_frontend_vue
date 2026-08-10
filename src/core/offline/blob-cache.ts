import { getCached, putCached } from '@/core/offline/entity-cache'
import { isOnline } from '@/core/offline/use-online-status'

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
