import type { Season } from '@/features/tours/data/models/season'
import type { TourType } from '@/features/tours/data/models/tour-type'
import type { Tour } from '@/features/tours/domain/entities/tour'
import { computed, reactive, ref } from 'vue'
import { resolveContactName } from '@/features/contacts/domain/entities/contact'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'
import { useToursStore } from '@/features/tours/presentation/stores/tours-store'

export type CompletionFilter = 'all' | 'done' | 'open'

export interface TourFilters {
  partnerIds: Set<string>
  tourTypes: Set<TourType>
  seasons: Set<Season>
  dateRange: { from: Date | null, to: Date | null }
  completion: CompletionFilter
}

export function useTourFilters() {
  const toursStore = useToursStore()
  const contactsStore = useContactsStore()

  const searchQuery = ref('')

  const filters = reactive<TourFilters>({
    partnerIds: new Set(),
    tourTypes: new Set(),
    seasons: new Set(),
    dateRange: { from: null, to: null },
    completion: 'all',
  })

  function resolvePartnerNames(tour: Tour): string[] {
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

    const { from, to } = filters.dateRange
    if (from || to) {
      if (!tour.plannedDate)
        return false
      if (from && tour.plannedDate < from)
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
    toursStore.tours.filter(t => matchesSearch(t) && matchesFilters(t)),
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

  function clearAll() {
    searchQuery.value = ''
    filters.partnerIds = new Set()
    filters.tourTypes = new Set()
    filters.seasons = new Set()
    filters.dateRange.from = null
    filters.dateRange.to = null
    filters.completion = 'all'
  }

  return { searchQuery, filters, filteredTours, activeFilterCount, clearAll }
}
