import type { PushSubscriptionData, PushSubscriptionRepository } from '../../domain/repositories/push-subscription-repository'
import { supabase } from '@/core/utils/supabase'

export class PushSubscriptionRepositoryImpl implements PushSubscriptionRepository {
  async upsertSubscription(userId: string, data: PushSubscriptionData): Promise<void> {
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: userId,
          endpoint: data.endpoint,
          p256dh: data.p256dh,
          auth: data.auth,
          user_agent: data.userAgent,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' },
      )

    if (error)
      throw new Error(error.message)
  }

  async removeSubscription(endpoint: string): Promise<void> {
    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint)

    if (error)
      throw new Error(error.message)
  }
}
