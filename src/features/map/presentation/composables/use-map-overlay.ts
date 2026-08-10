import type { SpeedDialMenuItem } from '../components/map-speed-dial-menu.vue'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { isOnline } from '@/core/offline/use-online-status'
import { useFriendshipsStore } from '@/features/friendships/presentation/stores/friendships-store'
import { useMapStore } from '@/features/map/presentation/stores/map-store'

export type OverlayView = 'closed' | 'menu' | 'base-map'

export function useMapOverlay(emit: {
  (e: 'openProfile'): void
  (e: 'openContacts'): void
  (e: 'openFeedback'): void
  (e: 'openOfflineMap'): void
}) {
  const { t } = useI18n({ useScope: 'global' })

  const mapStore = useMapStore()
  const friendshipsStore = useFriendshipsStore()
  const { isPickingLocation, isDrawingRegion, currentStyleIndex } = storeToRefs(mapStore)
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
    // Switching base map (Classic isn't cached) is network-only — greyed offline.
    { id: 'base-map', icon: 'map', label: t('map.overlay.changeBaseMap'), disabled: !isOnline.value },
    { id: 'offline-map', icon: 'download_for_offline', label: t('map.overlay.offlineMap') },
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
  ])

  function onMenuSelect(id: string) {
    if (id === 'contacts') {
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
    else if (id === 'offline-map') {
      view.value = 'closed'
      emit('openOfflineMap')
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
    isDrawingRegion,
    currentStyleIndex,
    pendingIncomingCount,
    menuItems,
    mapStore,
    onMenuSelect,
    selectStyle,
  }
}
