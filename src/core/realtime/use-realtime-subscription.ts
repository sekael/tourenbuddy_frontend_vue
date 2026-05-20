/**
 * Generic Supabase Realtime primitive for postgres_changes subscriptions.
 *
 * IMPORTANT: never call notification dispatch from `onChange` — Realtime is
 * UI-sync only. Notification dispatch belongs exclusively in store actions.
 */
import type { RealtimeChannel, RealtimePostgresChangesFilter } from '@supabase/supabase-js'
import { effectScope, onScopeDispose, ref, watch } from 'vue'
import { supabase } from '@/core/utils/supabase'

export interface PostgresChangesBinding {
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
  table: string
  filter?: string
}

export interface RealtimeSubscriptionOptions {
  key: () => string | null
  enabled: () => boolean
  bindings: () => PostgresChangesBinding[]
  onChange: () => void
  onSubscribed?: () => void
}

// Module-level registry: one channel per key, refcounted across consumers
const registry = new Map<string, { channel: RealtimeChannel, refcount: number }>()

// Module-singleton TOKEN_REFRESHED listener — keep channels auth-fresh
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED' && session) {
    supabase.realtime.setAuth(session.access_token)
  }
})

function releaseChannel(key: string) {
  const entry = registry.get(key)
  if (!entry)
    return
  entry.refcount -= 1
  if (entry.refcount <= 0) {
    supabase.removeChannel(entry.channel)
    registry.delete(key)
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
  debounced.flush = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
      fn()
    }
  }
  return debounced
}

export function useRealtimeSubscription(opts: RealtimeSubscriptionOptions) {
  const status = ref<string>('idle')
  let currentKey: string | null = null

  const debouncedOnChange = debounce(opts.onChange, 150)

  const scope = effectScope()

  function stop() {
    debouncedOnChange.cancel()
    if (currentKey !== null) {
      releaseChannel(currentKey)
      currentKey = null
    }
    scope.stop()
  }

  scope.run(() => {
    onScopeDispose(stop)

    watch(
      [opts.key, opts.enabled],
      ([key, enabled]) => {
        // Tear down previous channel if key changed or disabled
        if (currentKey !== null && (currentKey !== key || !enabled)) {
          releaseChannel(currentKey)
          currentKey = null
          status.value = 'idle'
        }

        if (!enabled || !key)
          return

        // Check if channel already registered (dedupe by key)
        const existing = registry.get(key)
        if (existing) {
          existing.refcount += 1
          currentKey = key
          status.value = 'shared'
          return
        }

        // Create new channel
        const channel = supabase.channel(key)
        for (const binding of opts.bindings()) {
          channel.on(
            'postgres_changes',
            {
              event: binding.event,
              schema: 'public',
              table: binding.table,
              ...(binding.filter ? { filter: binding.filter } : {}),
            } as RealtimePostgresChangesFilter<'postgres_changes'>,
            () => debouncedOnChange(),
          )
        }

        channel.subscribe((s) => {
          status.value = s
          if (s === 'SUBSCRIBED')
            opts.onSubscribed?.()
        })

        registry.set(key, { channel, refcount: 1 })
        currentKey = key
      },
      { immediate: true },
    )
  })

  return { status, stop }
}

/** Test-only: clear registry and remove all channels. */
export function __resetRealtimeRegistry() {
  for (const [, entry] of registry) {
    supabase.removeChannel(entry.channel)
  }
  registry.clear()
}
