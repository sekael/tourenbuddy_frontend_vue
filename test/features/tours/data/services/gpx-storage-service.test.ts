import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  downloadOriginal,
  getSignedUrl,
  removeGpx,
  uploadGpx,
} from '@/features/tours/data/services/gpx-storage-service'

const { mockUpload, mockRemove, mockCreateSignedUrl } = vi.hoisted(() => ({
  mockUpload: vi.fn(),
  mockRemove: vi.fn(),
  mockCreateSignedUrl: vi.fn(),
}))

vi.mock('@/core/utils/supabase', () => ({
  supabase: {
    storage: {
      from: vi.fn().mockReturnValue({
        upload: mockUpload,
        remove: mockRemove,
        createSignedUrl: mockCreateSignedUrl,
      }),
    },
  },
}))

describe('gpxStorageService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('uploadGpx', () => {
    it('returns the user-prefixed key on success', async () => {
      mockUpload.mockResolvedValue({ error: null })
      const file = new File(['gpx-content'], 'track.gpx')
      const result = await uploadGpx('user-123', 'tour-abc', file)
      expect(result).toBe('user-123/tour-abc.gpx')
      expect(mockUpload).toHaveBeenCalledWith(
        'user-123/tour-abc.gpx',
        file,
        expect.objectContaining({ upsert: true }),
      )
    })

    it('throws when upload fails', async () => {
      mockUpload.mockResolvedValue({ error: { message: 'storage full' } })
      const file = new File(['gpx-content'], 'track.gpx')
      await expect(uploadGpx('user-123', 'tour-abc', file)).rejects.toThrow('storage full')
    })
  })

  describe('removeGpx', () => {
    it('removes the given filepath directly', async () => {
      mockRemove.mockResolvedValue({ error: null })
      await removeGpx('user-123/tour-abc.gpx')
      expect(mockRemove).toHaveBeenCalledWith(['user-123/tour-abc.gpx'])
    })

    it('throws when remove fails', async () => {
      mockRemove.mockResolvedValue({ error: { message: 'not found' } })
      await expect(removeGpx('user-123/tour-abc.gpx')).rejects.toThrow('not found')
    })
  })

  describe('getSignedUrl', () => {
    it('returns signed URL on success', async () => {
      mockCreateSignedUrl.mockResolvedValue({
        data: { signedUrl: 'https://example.com/signed?token=abc' },
        error: null,
      })
      const url = await getSignedUrl('tour-abc.gpx')
      expect(url).toBe('https://example.com/signed?token=abc')
    })

    it('throws when signed URL request fails', async () => {
      mockCreateSignedUrl.mockResolvedValue({
        data: null,
        error: { message: 'RLS denied' },
      })
      await expect(getSignedUrl('tour-abc.gpx')).rejects.toThrow('RLS denied')
    })

    it('throws when signedUrl is missing from response', async () => {
      mockCreateSignedUrl.mockResolvedValue({ data: {}, error: null })
      await expect(getSignedUrl('tour-abc.gpx')).rejects.toThrow('Failed to get signed URL')
    })
  })

  describe('downloadOriginal', () => {
    it('throws when signed URL request fails (403)', async () => {
      mockCreateSignedUrl.mockResolvedValue({ data: null, error: { message: '403 forbidden' } })
      await expect(downloadOriginal('tour-abc.gpx', 'my-tour.gpx')).rejects.toThrow('403 forbidden')
    })
  })
})
