import type { AvailabilityRepository } from '@/features/calendar/domain/repositories/availability-repository'
import { supabase } from '@/core/utils/supabase'
import { availabilityRowSchema } from '@/features/calendar/data/models/availability'

export class SupabaseAvailabilityRepository implements AvailabilityRepository {
  async listOwnFrom(fromDate: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('user_availability')
      .select('user_id, date')
      .gte('date', fromDate)
      .order('date', { ascending: true })

    if (error)
      throw new Error(error.message)

    return (data ?? []).map(row => availabilityRowSchema.parse(row).date)
  }

  async applyDiff(added: string[], removed: string[]): Promise<void> {
    // Single transactional RPC — never two separate insert/delete calls, which
    // could leave availability half-applied. RLS still gates writes to auth.uid().
    const { error } = await supabase.rpc('apply_availability_diff', { added, removed })

    if (error)
      throw new Error(error.message)
  }
}
