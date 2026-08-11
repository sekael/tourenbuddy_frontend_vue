import type { Mock } from 'vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cacheBlob,
  clearPendingUpload,
  isPendingUpload,
  loadCachedBlob,
  markPendingUpload,
} from '@/core/offline/blob-cache'
import { clearCached, getCached, putCached } from '@/core/offline/entity-cache'
import { isOnline } from '@/core/offline/use-online-status'

vi.mock('@/core/offline/entity-cache', () => ({
  getCached: vi.fn(),
  putCached: vi.fn(),
  clearCached: vi.fn(),
}))

const getCachedMock = getCached as Mock
const putCachedMock = putCached as Mock
const clearCachedMock = clearCached as Mock

describe('loadCachedBlob (edges)', () => {
  const blob = new Blob(['x'])

  beforeEach(() => {
    vi.clearAllMocks()
    isOnline.value = true
    putCachedMock.mockResolvedValue(undefined)
  })

  it('offline: serves the cached blob without fetching', async () => {
    isOnline.value = false
    getCachedMock.mockResolvedValue(blob)
    const fetchFresh = vi.fn()

    const result = await loadCachedBlob('path/a.png', fetchFresh)

    expect(result).toBe(blob)
    expect(fetchFresh).not.toHaveBeenCalled()
    expect(putCachedMock).not.toHaveBeenCalled()
  })

  it('offline with nothing cached: returns undefined', async () => {
    isOnline.value = false
    getCachedMock.mockResolvedValue(undefined)

    expect(await loadCachedBlob('path/a.png', vi.fn())).toBeUndefined()
  })

  it('online: fetches fresh, caches under the blob: prefix, returns it', async () => {
    const fetchFresh = vi.fn().mockResolvedValue(blob)

    const result = await loadCachedBlob('path/a.png', fetchFresh)

    expect(result).toBe(blob)
    expect(putCachedMock).toHaveBeenCalledWith('blob:path/a.png', blob)
  })

  it('online but fetch fails: falls through to the cached copy', async () => {
    const fetchFresh = vi.fn().mockRejectedValue(new Error('network'))
    getCachedMock.mockResolvedValue(blob)

    expect(await loadCachedBlob('path/a.png', fetchFresh)).toBe(blob)
    expect(putCachedMock).not.toHaveBeenCalled()
  })

  it('cache read throwing degrades to undefined, not a throw', async () => {
    isOnline.value = false
    getCachedMock.mockRejectedValue(new Error('idb gone'))

    expect(await loadCachedBlob('path/a.png', vi.fn())).toBeUndefined()
  })
})

describe('offline-staged blob markers', () => {
  const blob = new Blob(['gpx'])

  beforeEach(() => {
    vi.clearAllMocks()
    putCachedMock.mockResolvedValue(undefined)
    clearCachedMock.mockResolvedValue(undefined)
  })

  it('stages the display blob and pending mark under distinct prefixes', async () => {
    await cacheBlob('u/t.gpx', blob)
    await markPendingUpload('u/t.gpx')

    expect(putCachedMock).toHaveBeenCalledWith('blob:u/t.gpx', blob)
    expect(putCachedMock).toHaveBeenCalledWith('pending-upload:u/t.gpx', true)
  })

  it('reports NOT pending for a blob merely cached for display (no mark written)', async () => {
    // getCached('pending-upload:…') → undefined ⇒ display-only cache, not an offline stage.
    getCachedMock.mockResolvedValue(undefined)
    expect(await isPendingUpload('u/t.gpx')).toBe(false)
  })

  it('reports pending only when the mark is exactly true', async () => {
    getCachedMock.mockResolvedValue(true)
    expect(await isPendingUpload('u/t.gpx')).toBe(true)
  })

  it('clears the pending mark by its prefixed key', async () => {
    await clearPendingUpload('u/t.gpx')
    expect(clearCachedMock).toHaveBeenCalledWith('pending-upload:u/t.gpx')
  })
})
