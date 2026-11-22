import type { TermsGate, TermsStatus } from '../../domain/terms'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useLogger } from '@/core/logging/use-logger'
import { getCached, putCached } from '@/core/offline/entity-cache'
import { replayQueue } from '@/core/offline/replay'
import { supabase } from '@/core/utils/supabase'
import { acceptTerms, fetchTermsStatus } from '../../data/terms-repository'
import { TERMS_VERSION, termsGate } from '../../domain/terms'

const TIMEOUT_MS = 5000

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)),
  ])
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

/**
 * The terms gate (change: add-terms-acceptance): whether the signed-in user may use the app. The
 * last confirmed status is cached per user, so an accepted user is never locked out offline; the
 * server's answer replaces it as soon as it arrives.
 */
export const useTermsStore = defineStore('terms', () => {
  const logger = useLogger('TermsStore')
  /** `loading` until the first answer (the cache's or the server's). */
  const gate = ref<TermsGate | 'loading'>('loading')
  /** Nothing confirmed and the server unreachable: accepting needs a connection. */
  const offline = ref(false)
  const accepting = ref(false)
  const failed = ref(false)

  function apply(status: TermsStatus) {
    gate.value = termsGate(TERMS_VERSION, status)
  }

  async function check(): Promise<void> {
    const uid = await currentUserId()
    if (!uid)
      return
    if (gate.value === 'loading') {
      const cached = await getCached<TermsStatus>(`terms:${uid}`).catch(() => undefined)
      if (cached && gate.value === 'loading')
        apply(cached)
    }
    try {
      const status = await withTimeout(fetchTermsStatus())
      if ((await currentUserId()) !== uid)
        return
      await putCached(`terms:${uid}`, status).catch(() => {})
      apply(status)
      offline.value = false
    }
    catch (err) {
      logger.warn('Terms status unavailable', err)
      if (gate.value === 'loading')
        gate.value = 'accept'
      offline.value = true
    }
  }

  async function accept(): Promise<void> {
    const uid = await currentUserId()
    if (!uid || accepting.value)
      return
    accepting.value = true
    failed.value = false
    try {
      const status = await acceptTerms(TERMS_VERSION)
      await putCached(`terms:${uid}`, status).catch(() => {})
      apply(status)
      offline.value = false
      // Edits saved offline before the acceptance go out now.
      if (gate.value === 'pass')
        void replayQueue().catch(() => {})
    }
    catch (err) {
      logger.warn('Accepting the terms failed', err)
      failed.value = true
      // The version in force may have moved on: the next answer shows the right page.
      await check()
    }
    finally {
      accepting.value = false
    }
  }

  function clear() {
    gate.value = 'loading'
    offline.value = false
    accepting.value = false
    failed.value = false
  }

  return { gate, offline, accepting, failed, check, accept, clear }
})
