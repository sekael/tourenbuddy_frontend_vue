import type {
  FriendRequest,
  Friendship,
} from '@/features/friendships/data/models/friendship-schemas'
import type { FriendshipRepository } from '@/features/friendships/domain/repositories/friendship-repository'
import { supabase } from '@/core/utils/supabase'
import {
  friendRequestSchema,
  friendshipSchema,
} from '@/features/friendships/data/models/friendship-schemas'

function mapRequest(row: Record<string, unknown>): FriendRequest {
  return friendRequestSchema.parse({
    id: row.id,
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    status: row.status,
    createdAt: row.created_at,
    respondedAt: row.responded_at ?? null,
  })
}

function mapFriendship(row: Record<string, unknown>): Friendship {
  return friendshipSchema.parse({
    userAId: row.user_a_id,
    userBId: row.user_b_id,
    createdAt: row.created_at,
    requestId: row.request_id ?? null,
  })
}

export class FriendshipRepositoryImpl implements FriendshipRepository {
  async sendRequest(toUserId: string): Promise<FriendRequest> {
    const { data, error } = await supabase
      .from('friend_requests')
      .insert({ to_user_id: toUserId })
      .select()
      .single()
    if (error)
      throw new Error(error.message)
    return mapRequest(data as Record<string, unknown>)
  }

  async accept(requestId: string): Promise<void> {
    const { error } = await supabase.rpc('accept_friend_request', { p_request_id: requestId })
    if (error)
      throw new Error(error.message)
  }

  async deny(requestId: string): Promise<void> {
    const { error } = await supabase
      .from('friend_requests')
      .update({ status: 'denied', responded_at: new Date().toISOString() })
      .eq('id', requestId)
    if (error)
      throw new Error(error.message)
  }

  async cancel(requestId: string): Promise<void> {
    const { error } = await supabase
      .from('friend_requests')
      .update({ status: 'cancelled' })
      .eq('id', requestId)
    if (error)
      throw new Error(error.message)
  }

  async listIncoming(): Promise<FriendRequest[]> {
    const { data, error } = await supabase
      .from('friend_requests')
      .select()
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    if (error)
      throw new Error(error.message)
    const rows = data as Record<string, unknown>[]
    return rows.map(mapRequest)
  }

  async listOutgoing(): Promise<FriendRequest[]> {
    const { data, error } = await supabase
      .from('friend_requests')
      .select()
      .order('created_at', { ascending: false })
    if (error)
      throw new Error(error.message)
    const rows = data as Record<string, unknown>[]
    // RLS returns only rows where caller is sender or recipient;
    // we filter client-side for outgoing (from_user_id = caller handled via store)
    return rows.map(mapRequest)
  }

  async listFriendships(): Promise<Friendship[]> {
    const { data, error } = await supabase
      .from('friendships')
      .select()
      .order('created_at', { ascending: false })
    if (error)
      throw new Error(error.message)
    const rows = data as Record<string, unknown>[]
    return rows.map(mapFriendship)
  }

  async findUserByPhone(phone: string): Promise<string | null> {
    const { data, error } = await supabase.rpc('find_user_by_phone', { p_phone: phone })
    if (error)
      throw new Error(error.message)
    return (data as string | null) ?? null
  }

  async findUsersByPhones(phones: string[]): Promise<Array<{ phone: string, userId: string }>> {
    if (phones.length === 0)
      return []
    const { data, error } = await supabase.rpc('find_users_by_phones', { p_phones: phones })
    if (error)
      throw new Error(error.message)
    const rows = data as Array<{ phone: string, user_id: string }> | null
    return (rows ?? []).map(r => ({ phone: r.phone, userId: r.user_id }))
  }

  async findPhonesByUserIds(userIds: string[]): Promise<Array<{ userId: string, phone: string }>> {
    if (userIds.length === 0)
      return []
    const { data, error } = await supabase.rpc('find_phones_by_user_ids', { p_user_ids: userIds })
    if (error)
      throw new Error(error.message)
    const rows = data as Array<{ user_id: string, phone: string }> | null
    return (rows ?? []).map(r => ({ userId: r.user_id, phone: r.phone }))
  }

  async removeFriendship(otherUserId: string): Promise<void> {
    const { error } = await supabase.rpc('remove_friendship', { p_other_user_id: otherUserId })
    if (error)
      throw new Error(error.message)
  }
}
