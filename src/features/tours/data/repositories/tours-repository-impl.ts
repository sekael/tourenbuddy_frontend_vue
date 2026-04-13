import type { Tour, TourDraft } from '@/features/tours/domain/entities/tour'
import type { ToursRepository } from '@/features/tours/domain/repositories/tours-repository'
import { supabase } from '@/core/utils/supabase'
import { tourRowSchema } from '@/features/tours/data/models/tour-schema'

export class ToursRepositoryImpl implements ToursRepository {
  async listToursForUser(userId: string): Promise<Tour[]> {
    const { data, error } = await supabase.from('tours_view').select('*').eq('user_id', userId)

    if (error)
      throw new Error(error.message)

    return (data ?? []).map(row => tourRowSchema.parse(row))
  }

  async createTourWithPartners(
    id: string,
    draft: TourDraft,
    goal: { lng: number, lat: number },
  ): Promise<void> {
    const { error } = await supabase.rpc('create_tour_full', {
      p_id: id,
      p_planned_date: draft.plannedDate?.toISOString().split('T')[0] ?? null,
      p_name: draft.name ?? null,
      p_goal: `POINT(${goal.lng} ${goal.lat})`,
      p_partner_ids: draft.partnerIds,
      p_tour_type: draft.tourType ?? null,
      p_elevation: draft.elevation ?? null,
      p_gpx_track: draft.gpxTrack ?? null,
      p_description: draft.description ?? null,
      p_seasons: draft.seasons ?? null,
      p_start_point: draft.startPoint
        ? `POINT(${draft.startPoint.lng} ${draft.startPoint.lat})`
        : null,
      p_end_point: draft.endPoint ? `POINT(${draft.endPoint.lng} ${draft.endPoint.lat})` : null,
      p_equipment: draft.equipment ?? null,
      p_notes: draft.notes ?? null,
    })

    if (error)
      throw new Error(error.message)
  }
}
