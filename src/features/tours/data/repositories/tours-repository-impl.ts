import type { Tour, TourDraft } from '@/features/tours/domain/entities/tour'
import type { ToursRepository } from '@/features/tours/domain/repositories/tours-repository'
import { supabase } from '@/core/utils/supabase'
import { tourRowSchema } from '@/features/tours/data/models/tour-schema'

export class ToursRepositoryImpl implements ToursRepository {
  async listToursForUser(userId: string): Promise<Tour[]> {
    const { data, error } = await supabase.from('tours_view').select('*').eq('user_id', userId)

    if (error) throw new Error(error.message)

    return (data ?? []).map((row) => tourRowSchema.parse(row))
  }

  async createTourWithPartners(
    id: string,
    draft: TourDraft,
    goal: { lng: number; lat: number },
  ): Promise<void> {
    const { error } = await supabase.rpc('create_tour_with_partners', {
      p_id: id,
      p_planned_date: draft.plannedDate?.toISOString().split('T')[0] ?? null,
      p_name: draft.name ?? null,
      p_goal: `POINT(${goal.lng} ${goal.lat})`,
      p_partner_ids: draft.partnerIds,
    })

    if (error) throw new Error(error.message)
  }
}
