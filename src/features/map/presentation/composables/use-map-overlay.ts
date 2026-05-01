import type { SpeedDialMenuItem } from '../components/map-speed-dial-menu.vue'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
import { useFriendshipsStore } from '@/features/friendships/presentation/stores/friendships-store'
import { useMapStore } from '@/features/map/presentation/stores/map-store'

export type OverlayView = 'closed' | 'menu' | 'base-map'

export function useMapOverlay(emit: {
  (e: 'openProfile'): void
  (e: 'openContacts'): void
  (e: 'openTours'): void
  (e: 'openFeedback'): void
}) {
  const { t } = useI18n({ useScope: 'global' })

  const mapStore = useMapStore()
  const authStore = useAuthStore()
  const friendshipsStore = useFriendshipsStore()
  const { isPickingLocation, currentStyleIndex } = storeToRefs(mapStore)
  const { isAuthenticated } = storeToRefs(authStore)
  const { incomingRequests } = storeToRefs(friendshipsStore)

  const view = ref<OverlayView>('closed')
  const isOpen = computed(() => view.value !== 'closed')

  const pendingIncomingCount = computed(
    () => incomingRequests.value.filter(r => r.status === 'pending').length,
  )

  watch(isPickingLocation, (val) => {
    if (val)
      view.value = 'closed'
  })

  const menuItems = computed<SpeedDialMenuItem[]>(() => [
    {
      id: 'feedback',
      icon: 'feedback',
      label: t('map.overlay.feedback'),
      tooltip: t('map.overlay.feedbackTooltip'),
    },
    { id: 'base-map', icon: 'map', label: t('map.overlay.changeBaseMap') },
    {
      id: 'profile',
      icon: 'account_circle',
      label: t('map.overlay.profile'),
      tooltip: t('map.overlay.profileTooltip'),
    },
    {
      id: 'contacts',
      icon: 'group',
      label: t('map.overlay.contacts'),
      badge: pendingIncomingCount.value,
      tooltip: t('map.overlay.contactsTooltip'),
    },
    {
      id: 'tours',
      icon: 'location_on',
      label: t('map.overlay.tours'),
      tooltip: t('map.overlay.toursTooltip'),
    },
    {
      id: 'add-tour',
      icon: 'add_location_alt',
      label: t('map.overlay.addTour'),
      disabled: !isAuthenticated.value,
      tooltip: isAuthenticated.value
        ? t('map.overlay.addTourTooltip')
        : t('map.overlay.signInToAddToursTooltip'),
    },
  ])

  function onMenuSelect(id: string) {
    if (id === 'add-tour') {
      view.value = 'closed'
      mapStore.selectTour(null)
      mapStore.setPickingLocation(true)
    }
    else if (id === 'tours') {
      view.value = 'closed'
      emit('openTours')
    }
    else if (id === 'contacts') {
      view.value = 'closed'
      emit('openContacts')
    }
    else if (id === 'profile') {
      view.value = 'closed'
      emit('openProfile')
    }
    else if (id === 'base-map') {
      view.value = 'base-map'
    }
    else if (id === 'feedback') {
      view.value = 'closed'
      emit('openFeedback')
    }
  }

  function selectStyle(index: number) {
    mapStore.setStyleIndex(index)
    view.value = 'closed'
  }

  return {
    view,
    isOpen,
    isPickingLocation,
    currentStyleIndex,
    pendingIncomingCount,
    menuItems,
    mapStore,
    onMenuSelect,
    selectStyle,
  }
}
