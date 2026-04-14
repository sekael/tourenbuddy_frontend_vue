import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { suggestTourName } from '@/features/tours/data/services/swisstopo-name-service'

function makeIdentifyResponse(results: object[]): Response {
  return new Response(JSON.stringify({ results }), { status: 200 })
}

describe('suggestTourName', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should return the feature name when found within 50 m', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      makeIdentifyResponse([{ attributes: { name: 'Rigi Kulm', objektart: 'Alpiner Gipfel' } }]),
    )

    const result = await suggestTourName({ lng: 8.4845, lat: 47.0564 })
    expect(result).toBe('Rigi Kulm')
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('should fall back to 500 m search when 50 m returns no results', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(makeIdentifyResponse([]))
      .mockResolvedValueOnce(
        makeIdentifyResponse([{ attributes: { name: 'Matterhorn', objektart: 'Gipfel' } }]),
      )

    const result = await suggestTourName({ lng: 7.6589, lat: 45.9763 })
    expect(result).toBe('Matterhorn')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('should pick highest-priority Objektart when multiple results exist', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      makeIdentifyResponse([
        { attributes: { name: 'Berghaus Kulm', objektart: 'Gebäude' } },
        { attributes: { name: 'Rigi Kulm', objektart: 'Alpiner Gipfel' } },
        { attributes: { name: 'Rigi Berggebiet', objektart: 'Gebiet' } },
      ]),
    )

    const result = await suggestTourName({ lng: 8.4845, lat: 47.0564 })
    expect(result).toBe('Rigi Kulm')
  })

  it('should rank Gipfel above Pass above Gletscher', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      makeIdentifyResponse([
        { attributes: { name: 'Grimselpass', objektart: 'Pass' } },
        { attributes: { name: 'Rhonegletscher', objektart: 'Gletscher' } },
        { attributes: { name: 'Bös Fulen', objektart: 'Gipfel' } },
      ]),
    )

    const result = await suggestTourName({ lng: 8.33, lat: 46.57 })
    expect(result).toBe('Bös Fulen')
  })

  it('should fall back to label with HTML stripped when name is absent', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      makeIdentifyResponse([{ attributes: { label: '<b>Flurname Here</b>' } }]),
    )

    const result = await suggestTourName({ lng: 8.0, lat: 46.5 })
    expect(result).toBe('Flurname Here')
  })

  it('should return null when both searches return empty results', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(makeIdentifyResponse([]))
      .mockResolvedValueOnce(makeIdentifyResponse([]))

    const result = await suggestTourName({ lng: 8.0, lat: 46.5 })
    expect(result).toBeNull()
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('should return null when attributes are missing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeIdentifyResponse([{}]))

    const result = await suggestTourName({ lng: 8.0, lat: 46.5 })
    expect(result).toBeNull()
  })

  it('should return null on non-OK HTTP response', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('Not Found', { status: 404 }))

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

  it('should call the identify API with LV95 (sr=2056) and swissnames3d layer', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      makeIdentifyResponse([{ attributes: { name: 'Zürich HB', objektart: 'Gebäude' } }]),
    )

    await suggestTourName({ lng: 8.5402, lat: 47.3777 })

    const url = vi.mocked(fetch).mock.calls[0]![0] as string
    expect(url).toContain('MapServer/identify')
    expect(url).toContain('sr=2056')
    expect(url).toContain('swissnames3d')
    expect(url).toContain('geometry=')
  })
})
