import type { SpeedDialMenuItem } from '../components/map-speed-dial-menu.vue'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePwaUpdate } from '@/core/composables/use-pwa-update'
import { useFriendshipsStore } from '@/features/friendships/presentation/stores/friendships-store'
import { useMapStore } from '@/features/map/presentation/stores/map-store'
import { useInboxStore } from '@/features/notifications/presentation/stores/inbox-store'

export type OverlayView = 'closed' | 'menu' | 'map-layers' | 'legend'

export function useMapOverlay(emit: {
  (e: 'openProfile'): void
  (e: 'openContacts'): void
  (e: 'openFeedback'): void
  (e: 'openOfflineMap'): void
  (e: 'openInbox'): void
}) {
  const { t } = useI18n({ useScope: 'global' })

  const mapStore = useMapStore()
  const friendshipsStore = useFriendshipsStore()
  const { isPickingLocation, isDrawingRegion, currentStyleIndex, activeOverlays } = storeToRefs(mapStore)
  const { incomingRequests } = storeToRefs(friendshipsStore)
  const { attentionCount: inboxCount } = storeToRefs(useInboxStore())
  const { updateAvailable } = usePwaUpdate()

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
    // Always enabled: offline only the panel's base-map section is disabled.
    { id: 'map-layers', icon: 'layers', label: t('map.overlay.mapLayers') },
    { id: 'offline-map', icon: 'download_for_offline', label: t('map.overlay.offlineMap') },
    {
      id: 'profile',
      icon: 'account_circle',
      label: t('map.overlay.profile'),
      // The tooltip is also the accessible name: the dot alone is aria-hidden.
      tooltip: updateAvailable.value ? t('map.overlay.profileUpdateAvailable') : t('map.overlay.profileTooltip'),
      dot: updateAvailable.value,
    },
    {
      id: 'contacts',
      icon: 'group',
      label: t('map.overlay.contacts'),
      // A dot, not a count: each request is already an inbox entry, counted there.
      dot: pendingIncomingCount.value > 0,
      tooltip: t('map.overlay.contactsTooltip'),
    },
    // Nearest the trigger: the one count the trigger mirrors (friend requests included).
    { id: 'inbox', icon: 'notifications', label: t('map.overlay.inbox'), badge: inboxCount.value },
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
    else if (id === 'map-layers') {
      view.value = 'map-layers'
    }
    else if (id === 'offline-map') {
      view.value = 'closed'
      emit('openOfflineMap')
    }
    else if (id === 'inbox') {
      view.value = 'closed'
      emit('openInbox')
    }
    else if (id === 'feedback') {
      view.value = 'closed'
      emit('openFeedback')
    }
  }

  // A base pick closes the panel; overlay toggles keep it open (handled by the store).
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
    activeOverlays,
    inboxCount,
    pendingIncomingCount,
    updateAvailable,
    menuItems,
    mapStore,
    onMenuSelect,
    selectStyle,
  }
}
