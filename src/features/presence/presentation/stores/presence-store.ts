import type { SupabaseProvider } from '@supabase-labs/y-supabase'
import type { Awareness } from 'y-protocols/awareness'
import type { FriendCursor } from '@/features/presence/domain/entities/friend-cursor'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'
import * as Y from 'yjs'
import { useLogger } from '@/core/logging/use-logger'
import { supabase } from '@/core/utils/supabase'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
import { useFriendshipsStore } from '@/features/friendships/presentation/stores/friendships-store'
import { parseAwarenessState } from '@/features/presence/data/models/awareness-schema'
import { colorForUserId, PRESENCE_PALETTE } from '@/features/presence/data/presence-palette'
import { createPresenceChannel, destroyPresenceChannel } from '@/features/presence/data/services/presence-channel'

function normalizePeerColor(userId: string, broadcastColor: string): string {
  if ((PRESENCE_PALETTE as readonly string[]).includes(broadcastColor))
    return broadcastColor
  return colorForUserId(userId)
}

export const usePresenceStore = defineStore('presence', () => {
  const logger = useLogger('PresenceStore')
  const authStore = useAuthStore()
  const friendshipsStore = useFriendshipsStore()

  const doc = shallowRef<Y.Doc | null>(null)
  const provider = shallowRef<SupabaseProvider | null>(null)
  const friendCursors = ref(new Map<string, FriendCursor>())

  /** Number of mounted map layers requesting presence (typically 0 or 1). */
  const mapSessionCount = ref(0)

  let awareness: Awareness | null = null
  let offAwarenessChange: (() => void) | null = null

  const isPhoneVerified = computed(() => authStore.currentUser?.phone_confirmed_at != null)

  const isPresenceEligible = computed(
    () =>
      authStore.isAuthenticated
      && isPhoneVerified.value
      && friendshipsStore.friendUserIds.size > 0,
  )

  const shouldConnect = computed(() => isPresenceEligible.value && mapSessionCount.value > 0)

  function pruneNonFriends() {
    const friends = friendshipsStore.friendUserIds
    const next = new Map(friendCursors.value)
    let changed = false
    for (const id of next.keys()) {
      if (!friends.has(id)) {
        next.delete(id)
        changed = true
      }
    }
    if (changed)
      friendCursors.value = next
  }

  function syncFromAwareness() {
    if (!awareness)
      return
    const selfId = authStore.currentUser?.id ?? null
    const friends = friendshipsStore.friendUserIds
    const next = new Map<string, FriendCursor>()

    for (const [clientId, rawState] of awareness.getStates()) {
      if (clientId === awareness.clientID)
        continue
      const parsed = parseAwarenessState(rawState)
      if (!parsed)
        continue
      const uid = parsed.user.id
      if (selfId && uid === selfId)
        continue
      if (!friends.has(uid))
        continue
      if (parsed.cursor == null)
        continue
      const color = normalizePeerColor(uid, parsed.user.color)
      next.set(uid, {
        userId: uid,
        displayName: parsed.user.name,
        color,
        lon: parsed.cursor.lon,
        lat: parsed.cursor.lat,
        updatedAt: parsed.cursor.t,
      })
    }
    friendCursors.value = next
  }

  function teardownProvider() {
    if (offAwarenessChange && awareness) {
      offAwarenessChange()
      offAwarenessChange = null
    }
    try {
      awareness?.setLocalState(null)
    }
    catch {
      // ignore teardown races
    }
    awareness = null
    if (provider.value) {
      destroyPresenceChannel(provider.value)
      provider.value = null
    }
    doc.value = null
    friendCursors.value = new Map()
  }

  function connect() {
    if (provider.value)
      return
    try {
      const ydoc = new Y.Doc()
      const p = createPresenceChannel(supabase, ydoc)
      doc.value = ydoc
      provider.value = p
      awareness = p.getAwareness()
      if (!awareness) {
        logger.error('SupabaseProvider has no awareness instance')
        teardownProvider()
        return
      }
      const onAwarenessChange = () => {
        syncFromAwareness()
      }
      awareness.on('change', onAwarenessChange)
      offAwarenessChange = () => {
        awareness?.off('change', onAwarenessChange)
      }
      syncFromAwareness()
    }
    catch (err) {
      logger.error('Failed to start presence provider', err)
      teardownProvider()
    }
  }

  watch(
    shouldConnect,
    (on) => {
      if (on)
        connect()
      else
        teardownProvider()
    },
    { immediate: true },
  )

  watch(
    () => Array.from(friendshipsStore.friendUserIds).sort().join(','),
    () => {
      pruneNonFriends()
      syncFromAwareness()
    },
  )

  function attachMapSession() {
    mapSessionCount.value++
  }

  function detachMapSession() {
    mapSessionCount.value = Math.max(0, mapSessionCount.value - 1)
    setLocalCursor(null)
  }

  function setLocalCursor(coords: { lon: number, lat: number } | null) {
    if (!awareness)
      return
    if (coords == null) {
      awareness.setLocalStateField('cursor', null)
      return
    }
    awareness.setLocalStateField('cursor', {
      lon: coords.lon,
      lat: coords.lat,
      t: Date.now(),
    })
  }

  function setLocalIdentity(payload: { id: string, name: string, color: string }) {
    if (!awareness)
      return
    awareness.setLocalStateField('user', {
      id: payload.id,
      name: payload.name,
      color: payload.color,
    })
  }

  return {
    doc,
    provider,
    friendCursors,
    mapSessionCount,
    isPresenceEligible,
    attachMapSession,
    detachMapSession,
    setLocalCursor,
    setLocalIdentity,
    /** Stops the Yjs provider (e.g. tests). Map detach uses `detachMapSession` + eligibility watch. */
    disconnect: teardownProvider,
  }
})
