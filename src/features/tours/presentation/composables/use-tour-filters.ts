import type { Ref } from 'vue'
import type { Season } from '@/features/tours/data/models/season'
import type { TourType } from '@/features/tours/data/models/tour-type'
import type { Tour } from '@/features/tours/domain/entities/tour'
import { computed, reactive, ref, watch } from 'vue'
import { resolveContactName } from '@/features/contacts/domain/entities/contact'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'
import { resolveFriendName } from '@/features/friendships/domain/resolve-friend-name'
import { useFriendshipsStore } from '@/features/friendships/presentation/stores/friendships-store'
import { useToursStore } from '@/features/tours/presentation/stores/tours-store'

export type CompletionFilter = 'all' | 'done' | 'open'
/** Which tour collection a filter instance operates on. */
export type TourTab = 'owned' | 'friends'

export interface TourFilters {
  partnerIds: Set<string>
  tourTypes: Set<TourType>
  seasons: Set<Season>
  dateRange: { from: Date | null, to: Date | null }
  completion: CompletionFilter
}

function createFilterState() {
  return {
    searchQuery: ref(''),
    filters: reactive<TourFilters>({
      partnerIds: new Set<string>(),
      tourTypes: new Set<TourType>(),
      seasons: new Set<Season>(),
      dateRange: { from: null as Date | null, to: null as Date | null },
      completion: 'all' as CompletionFilter,
    }),
  }
}

// One persistent state per tab so search/filter on Owned and Friends never bleed
// into each other; module-level so it survives TourListSheet mount/unmount cycles.
const tabStates: Record<TourTab, ReturnType<typeof createFilterState>> = {
  owned: createFilterState(),
  friends: createFilterState(),
}

// The selected tab is module-level too, so returning to the list from a tour
// detail view (which remounts TourListSheet) restores the tab last viewed.
// Persisted to localStorage so the tab survives full reloads / PWA restarts.
const ACTIVE_TAB_STORAGE_KEY = 'tours.list.activeTab'

function readStoredTab(): TourTab {
  try {
    const v = localStorage.getItem(ACTIVE_TAB_STORAGE_KEY)
    if (v === 'owned' || v === 'friends')
      return v
  }
  catch {
    // localStorage unavailable (Safari private mode etc.) — fall through.
  }
  return 'owned'
}

const activeTourTab = ref<TourTab>(readStoredTab())
watch(activeTourTab, (next) => {
  try {
    localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, next)
  }
  catch {
    // ignore
  }
})

export function useActiveTourTab() {
  return activeTourTab
}

export function useTourFilters(tab: TourTab = 'owned') {
  const { searchQuery, filters } = tabStates[tab]
  const toursStore = useToursStore()
  const source: Ref<Tour[]> = computed(() =>
    tab === 'friends' ? toursStore.friendTours : toursStore.tours,
  )
  const contactsStore = useContactsStore()
  const friendshipsStore = useFriendshipsStore()

  const findContactByPhone = (phone: string) =>
    contactsStore.findContactByMethodValue('phone', phone)

  function resolvePartnerNames(tour: Tour): string[] {
    // Friend tours: contact name where the viewer is connected to that partner, else the
    // server-resolved profile name — the same two-step the info sheet displays, so search
    // and display never disagree about what a partner is called.
    if (tour.isFriendTour) {
      return (tour.partnerNames ?? []).map(
        p =>
          resolveFriendName(p.userId, friendshipsStore.userIdToPhoneMap, findContactByPhone)
          ?? [p.firstName, p.lastName].filter(Boolean).join(' '),
      )
    }
    return tour.partnerIds.map((id) => {
      const contact = contactsStore.contacts.find(c => c.id === id)
      if (!contact)
        return ''
      return resolveContactName(contact)
    })
  }

  function matchesSearch(tour: Tour): boolean {
    const q = searchQuery.value.trim().toLowerCase()
    if (!q)
      return true
    if (tour.name && tour.name.toLowerCase().includes(q))
      return true
    // Friend rows display "by <contact name>", so that name must be searchable — read
    // from the same resolver the row renders from, or search finds a visible field
    // nothing matches.
    // ponytail: reads the phone map as-is; a cold map means no owner match. A predicate
    // must stay synchronous, and the rows' own resolution warms the map before a user
    // can type. Await here only if that assumption is ever measured false.
    if (tour.isFriendTour) {
      const owner = resolveFriendName(tour.userId, friendshipsStore.userIdToPhoneMap, findContactByPhone)
      if (owner && owner.toLowerCase().includes(q))
        return true
    }
    return resolvePartnerNames(tour).some(name => name.toLowerCase().includes(q))
  }

  function matchesFilters(tour: Tour): boolean {
    if (filters.partnerIds.size > 0) {
      const hasCommonPartner = tour.partnerIds.some(id => filters.partnerIds.has(id))
      if (!hasCommonPartner)
        return false
    }

    if (filters.tourTypes.size > 0) {
      if (!tour.tourType || !filters.tourTypes.has(tour.tourType))
        return false
    }

    if (filters.seasons.size > 0) {
      if (!tour.seasons || !tour.seasons.some(s => filters.seasons.has(s)))
        return false
    }

    // Span overlap, not start-date containment: "what's happening next week" must find a
    // tour that started the Friday before. Single-day tours collapse to the old behaviour.
    const { from, to } = filters.dateRange
    if (from || to) {
      if (!tour.plannedDate)
        return false
      const end = tour.endDate ?? tour.plannedDate
      if (from && end < from)
        return false
      if (to && tour.plannedDate > to)
        return false
    }

    if (filters.completion === 'done' && !tour.completed)
      return false
    if (filters.completion === 'open' && tour.completed)
      return false

    return true
  }

  const filteredTours = computed<Tour[]>(() =>
    source.value.filter(t => matchesSearch(t) && matchesFilters(t)),
  )

  const activeFilterCount = computed(() => {
    let count = 0
    if (filters.partnerIds.size > 0)
      count++
    if (filters.tourTypes.size > 0)
      count++
    if (filters.seasons.size > 0)
      count++
    if (filters.dateRange.from || filters.dateRange.to)
      count++
    if (filters.completion !== 'all')
      count++
    return count
  })

  function clearFilters() {
    filters.partnerIds = new Set()
    filters.tourTypes = new Set()
    filters.seasons = new Set()
    filters.dateRange.from = null
    filters.dateRange.to = null
    filters.completion = 'all'
  }

  function clearAll() {
    searchQuery.value = ''
    clearFilters()
  }

  return { searchQuery, filters, filteredTours, activeFilterCount, clearFilters, clearAll }
}
