import type { Mock } from 'vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadCachedBlob } from '@/core/offline/blob-cache'
import { getCached, putCached } from '@/core/offline/entity-cache'
import { isOnline } from '@/core/offline/use-online-status'

vi.mock('@/core/offline/entity-cache', () => ({
  getCached: vi.fn(),
  putCached: vi.fn(),
  clearCached: vi.fn(),
}))

const getCachedMock = getCached as Mock
const putCachedMock = putCached as Mock

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
