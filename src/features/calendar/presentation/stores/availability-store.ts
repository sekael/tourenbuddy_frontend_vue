import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useLogger } from '@/core/logging/use-logger'
import { SupabaseAvailabilityRepository } from '@/features/calendar/data/repositories/availability-repository-impl'
import { todayKey } from '@/features/calendar/domain/calendar-dates'

const repository = new SupabaseAvailabilityRepository()

export const useAvailabilityStore = defineStore('availability', () => {
  const logger = useLogger('AvailabilityStore')

  // Saved own availability (dayKeys), drives the view-mode overlay.
  const savedDays = ref<Set<string>>(new Set())
  // In-edit working selection; the baseline is the set captured on enterEdit.
  const workingDays = ref<Set<string>>(new Set())
  let baseline = new Set<string>()

  const editing = ref(false)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  // What the calendar renders as available: the live working set while editing,
  // otherwise the saved set.
  const displayDays = computed(() => (editing.value ? workingDays.value : savedDays.value))

  /** Load own future availability — call on Planned view mount. */
  async function load() {
    loading.value = true
    error.value = null
    try {
      const days = await repository.listOwnFrom(todayKey())
      savedDays.value = new Set(days)
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load availability'
      logger.error('Failed to load availability', err)
    }
    finally {
      loading.value = false
    }
  }

  /** Enter edit mode, seeding the working set from what's already loaded. */
  function enterEdit() {
    baseline = new Set(savedDays.value)
    workingDays.value = new Set(savedDays.value)
    editing.value = true
  }

  /** Toggle a day in the working set. Callers gate selectability (future-only). */
  function toggleDay(key: string) {
    if (workingDays.value.has(key))
      workingDays.value.delete(key)
    else
      workingDays.value.add(key)
  }

  /** Discard the in-progress edit (Cancel, or navigating away). */
  function cancel() {
    editing.value = false
    workingDays.value = new Set()
  }

  /**
   * Persist the edit as a diff (added/removed vs the pre-edit baseline) via one
   * atomic RPC, then leave edit mode. On failure edit mode stays open with the
   * working set intact so the user can retry without redoing their selection.
   */
  async function save() {
    error.value = null
    const added = [...workingDays.value].filter(day => !baseline.has(day))
    const removed = [...baseline].filter(day => !workingDays.value.has(day))
    if (added.length === 0 && removed.length === 0) {
      editing.value = false
      return
    }

    saving.value = true
    try {
      await repository.applyDiff(added, removed)
      await load() // reconcile with what actually persisted
      editing.value = false
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to save availability'
      logger.error('Failed to save availability', err)
    }
    finally {
      saving.value = false
    }
  }

  return {
    savedDays,
    workingDays,
    displayDays,
    editing,
    loading,
    saving,
    error,
    load,
    enterEdit,
    toggleDay,
    cancel,
    save,
  }
})
