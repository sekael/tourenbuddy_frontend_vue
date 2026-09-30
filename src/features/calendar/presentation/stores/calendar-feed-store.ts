import type { CalendarFeed, CalendarSettings } from '@/features/calendar/domain/repositories/calendar-feed-repository'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { env } from '@/core/constants/env'
import { useLogger } from '@/core/logging/use-logger'
import { feedUrlSchema } from '@/features/calendar/data/models/calendar-feed'
import { SupabaseCalendarFeedRepository } from '@/features/calendar/data/repositories/calendar-feed-repository-impl'
import { CalendarFeedError } from '@/features/calendar/domain/repositories/calendar-feed-repository'
import { useAvailabilityStore } from '@/features/calendar/presentation/stores/availability-store'

const repository = new SupabaseCalendarFeedRepository()

export type WindowSettings = Omit<CalendarSettings, 'feedToken'>

function minutes(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Mirrors the `user_calendar_settings` check constraints, so the UI rejects before the request. */
export function isSatisfiable({ coreStart, coreEnd, minFreeMinutes }: WindowSettings): boolean {
  const span = minutes(coreEnd) - minutes(coreStart)
  return span > 0 && minFreeMinutes > 0 && minFreeMinutes <= span
}

// ponytail: online-only like tour attachments (DC10) — offline, a write fails with the generic
// message. Queue through mutate() if users ask for offline feed edits.
export const useCalendarFeedStore = defineStore('calendarFeed', () => {
  const logger = useLogger('CalendarFeedStore')
  const { t } = useI18n({ useScope: 'global' })
  // Resolved lazily: creating the availability store starts realtime channels and a friends
  // fetch, which the profile sheet (where this store lives) must not trigger just by opening.
  const reloadAvailability = () => useAvailabilityStore().load()

  const feeds = ref<CalendarFeed[]>([])
  const settings = ref<CalendarSettings | null>(null)
  const loading = ref(false)
  const syncing = ref(false)
  const error = ref<string | null>(null)

  const hasFeeds = computed(() => feeds.value.length > 0)
  const outboundUrl = computed(() => settings.value && env.VITE_NOTIFY_HOOK_URL
    ? `${env.VITE_NOTIFY_HOOK_URL}/calendar/${settings.value.feedToken}.ics`
    : null)

  /** Any failure → localized text. Raw database text never reaches the UI. */
  function fail(err: unknown) {
    logger.error('Calendar sync action failed', err)
    const code = err instanceof CalendarFeedError ? err.code : 'unknown'
    error.value = t(`calendar.sync.errors.${code}`)
  }

  /** Feeds only — cheap enough for the Planned page, which just needs `hasFeeds`. */
  async function loadFeeds() {
    try {
      feeds.value = await repository.listFeeds()
    }
    catch (err) {
      fail(err)
    }
  }

  /** Feeds + settings, for the settings section. */
  async function load() {
    loading.value = true
    error.value = null
    try {
      const [f, s] = await Promise.all([repository.listFeeds(), repository.getSettings()])
      feeds.value = f
      settings.value = s
    }
    catch (err) {
      fail(err)
    }
    finally {
      loading.value = false
    }
  }

  /** On-demand Worker sync, then refresh per-feed status and own availability. */
  async function sync() {
    syncing.value = true
    error.value = null
    try {
      await repository.triggerSync()
    }
    catch (err) {
      fail(err)
    }
    finally {
      syncing.value = false
    }
    // Even after a failed trigger: a feed error from an earlier run may have changed. Neither
    // reload assigns on failure, so loaded feeds are never clobbered.
    await Promise.all([loadFeeds(), reloadAvailability()])
  }

  /** Validate + add a feed, then sync so the result shows now, not in six hours. */
  async function addFeed(rawUrl: string, label: string): Promise<boolean> {
    error.value = null
    const parsed = feedUrlSchema.safeParse(rawUrl)
    if (!parsed.success) {
      error.value = t('calendar.sync.errors.invalid_url')
      return false
    }
    try {
      await repository.addFeed(parsed.data, label.trim() || null)
    }
    catch (err) {
      fail(err)
      return false
    }
    // sync() reloads feeds + availability itself.
    await sync()
    return true
  }

  /**
   * Remove a feed; resync if others remain, otherwise `reloadAvailability()` (the DB trigger
   * cleared the calendar days).
   */
  async function removeFeed(id: string): Promise<void> {
    error.value = null
    try {
      await repository.removeFeed(id)
    }
    catch (err) {
      fail(err)
      return
    }
    feeds.value = feeds.value.filter(f => f.id !== id)
    // Last feed: the DB trigger already dropped the calendar days; a sync would find no feeds.
    if (hasFeeds.value)
      await sync()
    else
      await reloadAvailability()
  }

  async function relabelFeed(id: string, label: string) {
    error.value = null
    const next = label.trim() || null
    try {
      await repository.relabelFeed(id, next)
      feeds.value = feeds.value.map(f => (f.id === id ? { ...f, label: next } : f))
    }
    catch (err) {
      fail(err)
    }
  }

  /** Rejects an unsatisfiable window before the request; resyncs so the new rule applies now. */
  async function saveSettings(next: WindowSettings): Promise<boolean> {
    error.value = null
    if (!isSatisfiable(next)) {
      error.value = t('calendar.sync.errors.invalid_window')
      return false
    }
    try {
      await repository.updateSettings(next)
      settings.value = { ...settings.value!, ...next }
    }
    catch (err) {
      fail(err)
      return false
    }
    if (hasFeeds.value)
      await sync()
    return true
  }

  async function regenerateToken() {
    error.value = null
    try {
      const feedToken = await repository.regenerateToken()
      settings.value = { ...settings.value!, feedToken }
    }
    catch (err) {
      fail(err)
    }
  }

  return {
    feeds,
    settings,
    loading,
    syncing,
    error,
    hasFeeds,
    outboundUrl,
    load,
    loadFeeds,
    sync,
    addFeed,
    removeFeed,
    relabelFeed,
    saveSettings,
    regenerateToken,
  }
})
