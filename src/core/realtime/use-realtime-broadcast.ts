/**
 * Primitive for Supabase Broadcast (server-to-client, private channel) subscriptions.
 *
 * Mirrors use-realtime-subscription conventions: module-level registry (one channel
 * per topic, refcounted), page-visibility battery-pause, singleton TOKEN_REFRESHED
 * setAuth handler. Transport is private broadcast, not postgres_changes.
 *
 * IMPORTANT: never dispatch notifications from onMessage — Realtime is UI-sync only.
 */
import type { RealtimeChannel } from '@supabase/supabase-js'
import { effectScope, onScopeDispose, ref, watch } from 'vue'
import { supabase } from '@/core/utils/supabase'

export interface RealtimeBroadcastOptions {
  topic: () => string | null
  enabled: () => boolean
  event: string
  onMessage: () => void
  onSubscribed?: () => void
}

const registry = new Map<string, { channel: RealtimeChannel, refcount: number }>()

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED' && session) {
    supabase.realtime.setAuth(session.access_token)
  }
})

const pageVisible = ref<boolean>(
  typeof document === 'undefined' || document.visibilityState !== 'hidden',
)
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    pageVisible.value = document.visibilityState !== 'hidden'
  })
}

function releaseChannel(topic: string) {
  const entry = registry.get(topic)
  if (!entry)
    return
  entry.refcount -= 1
  if (entry.refcount <= 0) {
    supabase.removeChannel(entry.channel)
    registry.delete(topic)
  }
}

function debounce(fn: () => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | null = null
  const debounced = () => {
    if (timer !== null)
      clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      fn()
    }, ms)
  }
  debounced.cancel = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }
  return debounced
}

export function useRealtimeBroadcast(opts: RealtimeBroadcastOptions) {
  const status = ref<string>('idle')
  let currentTopic: string | null = null

  const debouncedOnMessage = debounce(opts.onMessage, 150)

  const scope = effectScope()

  function stop() {
    debouncedOnMessage.cancel()
    if (currentTopic !== null) {
      releaseChannel(currentTopic)
      currentTopic = null
    }
    scope.stop()
  }

  scope.run(() => {
    onScopeDispose(stop)

    watch(
      [opts.topic, opts.enabled, pageVisible],
      ([topic, enabled, visible]) => {
        const active = enabled && visible
        if (currentTopic !== null && (currentTopic !== topic || !active)) {
          releaseChannel(currentTopic)
          currentTopic = null
          status.value = visible ? 'idle' : 'paused'
        }

        if (!active || !topic)
          return

        const existing = registry.get(topic)
        if (existing) {
          existing.refcount += 1
          currentTopic = topic
          status.value = 'shared'
          return
        }

        const channel = supabase.channel(topic, { config: { private: true } })
        channel.on('broadcast', { event: opts.event }, () => debouncedOnMessage())

        channel.subscribe((s) => {
          status.value = s
          if (s === 'SUBSCRIBED')
            opts.onSubscribed?.()
        })

        registry.set(topic, { channel, refcount: 1 })
        currentTopic = topic
      },
      { immediate: true },
    )
  })

  return { status, stop }
}

/** Test-only: clear registry and remove all channels. */
export function __resetRealtimeBroadcastRegistry() {
  for (const [, entry] of registry) {
    supabase.removeChannel(entry.channel)
  }
  registry.clear()
}
