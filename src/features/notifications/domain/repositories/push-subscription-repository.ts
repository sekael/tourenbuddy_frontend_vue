export interface PushSubscriptionData {
  endpoint: string
  p256dh: string
  auth: string
  userAgent: string
}

export interface PushSubscriptionRepository {
  upsertSubscription: (userId: string, data: PushSubscriptionData) => Promise<void>
  removeSubscription: (endpoint: string) => Promise<void>
}
