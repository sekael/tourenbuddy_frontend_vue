import type { SupabaseClient } from '@supabase/supabase-js'
import type * as Y from 'yjs'
import { SupabaseProvider } from '@supabase-labs/y-supabase'

export const PRESENCE_CHANNEL_NAME = 'presence:friend-cursors'

export function createPresenceChannel(
  supabase: SupabaseClient,
  doc: Y.Doc,
  channelName: string = PRESENCE_CHANNEL_NAME,
): SupabaseProvider {
  return new SupabaseProvider(channelName, doc, supabase, {
    awareness: true,
    reconnectDelay: 1000,
    maxReconnectDelay: 30000,
  })
}

export function destroyPresenceChannel(provider: SupabaseProvider): void {
  provider.destroy()
}
