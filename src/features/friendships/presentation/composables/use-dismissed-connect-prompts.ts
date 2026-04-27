import { ref } from 'vue'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'

function storageKey(userId: string): string {
  return `tb_dismissed_connect_${userId}`
}

function loadFromStorage(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  }
  catch {
    return new Set()
  }
}

function saveToStorage(userId: string, set: Set<string>): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify([...set]))
  }
  catch {}
}

/**
 * Persists per-contact decisions to not send a friend request.
 * Keyed by contact ID — resetting automatically when a contact is deleted and re-added
 * (new UUID). Backed by localStorage, scoped to the current user.
 */
export function useDismissedConnectPrompts() {
  const authStore = useAuthStore()
  const userId = authStore.currentUser?.id ?? 'anon'

  const dismissed = ref<Set<string>>(loadFromStorage(userId))

  function isDismissed(contactId: string): boolean {
    return dismissed.value.has(contactId)
  }

  function dismiss(contactId: string): void {
    const next = new Set(dismissed.value)
    next.add(contactId)
    dismissed.value = next
    saveToStorage(userId, next)
  }

  return { isDismissed, dismiss }
}
