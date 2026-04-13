import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { suggestTourName } from '@/features/tours/data/services/swisstopo-name-service'

describe('suggestTourName', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should return the feature label on success', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          results: [{ attrs: { label: 'Rigi Kulm', detail: 'Schwyz' } }],
        }),
        { status: 200 },
      ),
    )

    const result = await suggestTourName({ lng: 8.4845, lat: 47.0564 })
    expect(result).toBe('Rigi Kulm')
  })

  it('should strip HTML tags from the label', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          results: [{ attrs: { label: '<b>Matterhorn</b>' } }],
        }),
        { status: 200 },
      ),
    )

    const result = await suggestTourName({ lng: 7.6589, lat: 45.9763 })
    expect(result).toBe('Matterhorn')
  })

  it('should return null when results are empty', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ results: [] }), { status: 200 }),
    )

    const result = await suggestTourName({ lng: 8.0, lat: 46.5 })
    expect(result).toBeNull()
  })

  it('should return null when label is missing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ results: [{ attrs: {} }] }), { status: 200 }),
    )

    const result = await suggestTourName({ lng: 8.0, lat: 46.5 })
    expect(result).toBeNull()
  })

  it('should return null on non-OK HTTP response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Not Found', { status: 404 }))

    const result = await suggestTourName({ lng: 8.0, lat: 46.5 })
    expect(result).toBeNull()
  })

  it('should return null on network error', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network failure'))

    const result = await suggestTourName({ lng: 8.0, lat: 46.5 })
    expect(result).toBeNull()
  })

  it('should return null on timeout (AbortError)', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(Object.assign(new DOMException('Aborted', 'AbortError')))

    const result = await suggestTourName({ lng: 8.0, lat: 46.5 })
    expect(result).toBeNull()
  })
})
