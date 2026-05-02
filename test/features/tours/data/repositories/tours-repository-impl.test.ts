import type { TourDraft } from '@/features/tours/domain/entities/tour'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToursRepositoryImpl } from '@/features/tours/data/repositories/tours-repository-impl'

const mockRpc = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/core/utils/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

const baseDraft: TourDraft = {
  name: 'Test Tour',
  plannedDate: null,
  partnerIds: [],
  tourType: null,
  elevation: null,
  gpxTrack: null,
  description: null,
  seasons: null,
  startPoint: null,
  endPoint: null,
  startPointName: null,
  startPointElevation: null,
  endPointName: null,
  endPointElevation: null,
  equipment: null,
  notes: null,
}
const goal = { lng: 8.2, lat: 46.8 }

describe('toursRepositoryImpl: new RPC params', () => {
  let repo: ToursRepositoryImpl

  beforeEach(() => {
    vi.clearAllMocks()
    repo = new ToursRepositoryImpl()
  })

  describe('createTourWithPartners', () => {
    it('passes null metadata params when draft has no start/end names', async () => {
      mockRpc.mockResolvedValue({ error: null })
      await repo.createTourWithPartners('id-1', baseDraft, goal)
      expect(mockRpc).toHaveBeenCalledWith(
        'create_tour_full',
        expect.objectContaining({
          p_start_point_name: null,
          p_start_point_elevation: null,
          p_end_point_name: null,
          p_end_point_elevation: null,
        }),
      )
    })

    it('passes metadata when draft has start/end names and elevations', async () => {
      mockRpc.mockResolvedValue({ error: null })
      const draft: TourDraft = {
        ...baseDraft,
        startPointName: 'Grindelwald',
        startPointElevation: 1034,
        endPointName: 'Kleine Scheidegg',
        endPointElevation: 2061,
      }
      await repo.createTourWithPartners('id-1', draft, goal)
      expect(mockRpc).toHaveBeenCalledWith(
        'create_tour_full',
        expect.objectContaining({
          p_start_point_name: 'Grindelwald',
          p_start_point_elevation: 1034,
          p_end_point_name: 'Kleine Scheidegg',
          p_end_point_elevation: 2061,
        }),
      )
    })

    it('throws when RPC returns an error', async () => {
      mockRpc.mockResolvedValue({ error: { message: 'permission denied' } })
      await expect(repo.createTourWithPartners('id-1', baseDraft, goal)).rejects.toThrow(
        'permission denied',
      )
    })
  })

  describe('updateTour', () => {
    it('passes null metadata params when draft has no start/end names', async () => {
      mockRpc.mockResolvedValue({ error: null })
      await repo.updateTour('id-1', baseDraft, goal)
      expect(mockRpc).toHaveBeenCalledWith(
        'update_tour_full',
        expect.objectContaining({
          p_start_point_name: null,
          p_start_point_elevation: null,
          p_end_point_name: null,
          p_end_point_elevation: null,
        }),
      )
    })

    it('passes metadata when draft has start/end names', async () => {
      mockRpc.mockResolvedValue({ error: null })
      const draft: TourDraft = {
        ...baseDraft,
        startPointName: 'Lauterbrunnen',
        startPointElevation: 796,
        endPointName: null,
        endPointElevation: null,
      }
      await repo.updateTour('id-1', draft, goal)
      expect(mockRpc).toHaveBeenCalledWith(
        'update_tour_full',
        expect.objectContaining({
          p_start_point_name: 'Lauterbrunnen',
          p_start_point_elevation: 796,
          p_end_point_name: null,
          p_end_point_elevation: null,
        }),
      )
    })
  })
})
