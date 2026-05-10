import type { Map as MapLibreMap } from 'maplibre-gl'
import { storeToRefs } from 'pinia'
import { onScopeDispose, watch } from 'vue'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
import { colorForUserId } from '@/features/presence/data/presence-palette'
import { usePresenceStore } from '@/features/presence/presentation/stores/presence-store'
import { useUserProfileStore } from '@/features/user/presentation/stores/user-profile-store'

const IDLE_MS = 30_000
const THROTTLE_MS = 50

function buildDisplayName(params: {
  firstName: string | null
  lastName: string | null
  email: string | null
}): string {
  const parts = [params.firstName, params.lastName].filter(Boolean) as string[]
  if (parts.length > 0)
    return parts.join(' ').slice(0, 64)
  if (params.email) {
    const local = params.email.split('@')[0]
    if (local)
      return local.slice(0, 64)
  }
  return 'You'
}

/**
 * Binds pointer → map lon/lat → presence store, and keeps local Awareness `user` in sync.
 * Call from a component scope so `onScopeDispose` runs when the map layer unmounts.
 */
export function useLocalCursorSource(getMap: () => MapLibreMap | null) {
  const presenceStore = usePresenceStore()
  const authStore = useAuthStore()
  const userProfileStore = useUserProfileStore()
  const { fullProfile } = storeToRefs(userProfileStore)

  let canvas: HTMLElement | null = null
  let idleTimer: ReturnType<typeof setTimeout> | null = null
  let throttleTimer: ReturnType<typeof setTimeout> | null = null
  let lastThrottleEmit = 0
  let pendingPoint: { m: MapLibreMap, x: number, y: number } | null = null

  function clearIdleTimer() {
    if (idleTimer != null) {
      clearTimeout(idleTimer)
      idleTimer = null
    }
  }

  function scheduleIdleClear() {
    clearIdleTimer()
    idleTimer = setTimeout(() => {
      presenceStore.setLocalCursor(null)
      idleTimer = null
    }, IDLE_MS)
  }

  function flushCursor(m: MapLibreMap, x: number, y: number) {
    const lngLat = m.unproject({ x, y })
    presenceStore.setLocalCursor({ lon: lngLat.lng, lat: lngLat.lat })
    scheduleIdleClear()
  }

  function scheduleThrottledEmit(m: MapLibreMap, x: number, y: number) {
    pendingPoint = { m, x, y }
    const now = Date.now()
    const elapsed = now - lastThrottleEmit
    if (elapsed >= THROTTLE_MS) {
      lastThrottleEmit = now
      flushCursor(m, x, y)
      pendingPoint = null
      if (throttleTimer != null) {
        clearTimeout(throttleTimer)
        throttleTimer = null
      }
      return
    }
    if (throttleTimer != null)
      return
    throttleTimer = setTimeout(() => {
      throttleTimer = null
      if (pendingPoint) {
        lastThrottleEmit = Date.now()
        flushCursor(pendingPoint.m, pendingPoint.x, pendingPoint.y)
        pendingPoint = null
      }
    }, THROTTLE_MS - elapsed)
  }

  function onPointerMove(ev: PointerEvent) {
    const m = getMap()
    if (!m || ev.pointerType !== 'mouse' || !(ev.target instanceof HTMLElement))
      return
    scheduleThrottledEmit(m, ev.offsetX, ev.offsetY)
  }

  function onPointerLeave() {
    clearIdleTimer()
    if (throttleTimer != null) {
      clearTimeout(throttleTimer)
      throttleTimer = null
    }
    pendingPoint = null
    presenceStore.setLocalCursor(null)
  }

  function pushLocalIdentity() {
    const user = authStore.currentUser
    if (!user)
      return
    const fp = fullProfile.value
    const name = buildDisplayName({
      firstName: fp?.firstName ?? null,
      lastName: fp?.lastName ?? null,
      email: fp?.email ?? user.email ?? null,
    })
    presenceStore.setLocalIdentity({
      id: user.id,
      name,
      color: colorForUserId(user.id),
    })
  }

  watch(
    [() => authStore.currentUser?.id, fullProfile],
    () => {
      pushLocalIdentity()
    },
    { immediate: true, deep: true },
  )

  watch(
    () => getMap(),
    (m, _prev) => {
      if (canvas) {
        canvas.removeEventListener('pointermove', onPointerMove)
        canvas.removeEventListener('pointerleave', onPointerLeave)
        canvas = null
      }
      clearIdleTimer()
      if (throttleTimer != null) {
        clearTimeout(throttleTimer)
        throttleTimer = null
      }
      pendingPoint = null
      presenceStore.setLocalCursor(null)
      if (!m)
        return
      const c = m.getCanvas()
      canvas = c
      c.addEventListener('pointermove', onPointerMove)
      c.addEventListener('pointerleave', onPointerLeave)
    },
    { immediate: true },
  )

  onScopeDispose(() => {
    if (canvas) {
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerleave', onPointerLeave)
      canvas = null
    }
    clearIdleTimer()
    if (throttleTimer != null) {
      clearTimeout(throttleTimer)
      throttleTimer = null
    }
    pendingPoint = null
    presenceStore.setLocalCursor(null)
  })
}
