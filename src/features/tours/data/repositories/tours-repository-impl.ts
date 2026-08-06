import type { Visibility } from '@/features/tours/data/models/visibility'
import type { Tour, TourDraft } from '@/features/tours/domain/entities/tour'
import type { ToursRepository } from '@/features/tours/domain/repositories/tours-repository'
import { supabase } from '@/core/utils/supabase'
import { friendTourRowSchema, tourRowSchema } from '@/features/tours/data/models/tour-schema'

export class ToursRepositoryImpl implements ToursRepository {
  async listToursForUser(userId: string): Promise<Tour[]> {
    const { data, error } = await supabase.from('tours_view').select('*').eq('user_id', userId)

    if (error)
      throw new Error(error.message)

    return (data ?? []).map(row => tourRowSchema.parse(row))
  }

  async listFriendTours(): Promise<Tour[]> {
    // RLS + the security_invoker view scope rows to friends' friends-visible tours.
    const { data, error } = await supabase.from('friend_tours_view').select('*')

    if (error)
      throw new Error(error.message)

    return (data ?? []).map(row => friendTourRowSchema.parse(row))
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
      p_gpx_filepath: draft.gpxFilepath ?? null,
      p_description: draft.description ?? null,
      p_seasons: draft.seasons ?? null,
      p_start_point: draft.startPoint
        ? `POINT(${draft.startPoint.lng} ${draft.startPoint.lat})`
        : null,
      p_end_point: draft.endPoint ? `POINT(${draft.endPoint.lng} ${draft.endPoint.lat})` : null,
      p_start_point_name: draft.startPointName ?? null,
      p_start_point_elevation: draft.startPointElevation ?? null,
      p_end_point_name: draft.endPointName ?? null,
      p_end_point_elevation: draft.endPointElevation ?? null,
      p_equipment: draft.equipment ?? null,
      p_notes: draft.notes ?? null,
      p_visibility: draft.visibility ?? null,
    })

    if (error)
      throw new Error(error.message)
  }

  async updateTour(
    id: string,
    draft: TourDraft,
    goal: { lng: number, lat: number },
  ): Promise<boolean> {
    const { data, error } = await supabase.rpc('update_tour_full', {
      p_id: id,
      p_planned_date: draft.plannedDate?.toISOString().split('T')[0] ?? null,
      p_name: draft.name ?? null,
      p_goal: `POINT(${goal.lng} ${goal.lat})`,
      p_partner_ids: draft.partnerIds,
      p_tour_type: draft.tourType ?? null,
      p_elevation: draft.elevation ?? null,
      p_gpx_filepath: draft.gpxFilepath ?? null,
      p_description: draft.description ?? null,
      p_seasons: draft.seasons ?? null,
      p_start_point: draft.startPoint
        ? `POINT(${draft.startPoint.lng} ${draft.startPoint.lat})`
        : null,
      p_end_point: draft.endPoint ? `POINT(${draft.endPoint.lng} ${draft.endPoint.lat})` : null,
      p_start_point_name: draft.startPointName ?? null,
      p_start_point_elevation: draft.startPointElevation ?? null,
      p_end_point_name: draft.endPointName ?? null,
      p_end_point_elevation: draft.endPointElevation ?? null,
      p_equipment: draft.equipment ?? null,
      p_notes: draft.notes ?? null,
      p_visibility: draft.visibility ?? null,
    })

    if (error)
      throw new Error(error.message)

    // update_tour_full returns false when the row is gone (update-only, no resurrect).
    return data === true
  }

  async patchCompleted(id: string, completed: boolean): Promise<void> {
    const { error } = await supabase.from('tours').update({ completed }).eq('id', id)
    if (error)
      throw new Error(error.message)
  }

  async patchVisibility(id: string, visibility: Visibility): Promise<void> {
    // Owner-only; enforced by the tours_update_own RLS policy.
    const { error } = await supabase.from('tours').update({ visibility }).eq('id', id)
    if (error)
      throw new Error(error.message)
  }

  async deleteTour(id: string): Promise<void> {
    const { error } = await supabase.from('tours').delete().eq('id', id)

    if (error)
      throw new Error(error.message)
  }
}
