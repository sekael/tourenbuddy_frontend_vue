<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseIcon from '@/core/components/base-icon.vue'
import BaseTooltip from '@/core/components/base-tooltip.vue'
import { useMapOverlay } from '../composables/use-map-overlay'
import MapLayersPanel from './map-layers-panel.vue'
import MapLegend from './map-legend.vue'
import MapSpeedDialMenu from './map-speed-dial-menu.vue'
import SpeedDialTrigger from './speed-dial-trigger.vue'

const props = defineProps<{
  bearing?: number
  overlayActive?: boolean
}>()

const emit = defineEmits<{
  openProfile: []
  openContacts: []
  openFeedback: []
  openOfflineMap: []
  openInbox: []
  resetBearing: []
  dismissOverlay: []
}>()

const { t } = useI18n({ useScope: 'global' })
const {
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
} = useMapOverlay(emit)

const menuRef = ref<InstanceType<typeof MapSpeedDialMenu> | null>(null)
const iconRotation = computed(() => -(props.bearing ?? 0))
const showCompass = computed(() => Math.abs(props.bearing ?? 0) > 0.5)

async function toggleMenu() {
  if (props.overlayActive) {
    emit('dismissOverlay')
    return
  }
  if (isOpen.value) {
    view.value = 'closed'
  }
  else {
    view.value = 'menu'
    await menuRef.value?.focusFirst()
  }
}

function closeMenu() {
  view.value = 'closed'
}

// Imperative openers for the onboarding tour to demonstrate the navigation
// path (open the speed-dial menu, then the map layers panel) — both live
// inside this component's `view`, not the page-level overlay set.
function openMenu() {
  if (!isPickingLocation.value)
    view.value = 'menu'
}

function openMapLayers() {
  if (!isPickingLocation.value)
    view.value = 'map-layers'
}

defineExpose({ isOpen, closeMenu, openMenu, openMapLayers })
</script>

<template>
  <div v-if="!isPickingLocation && !isDrawingRegion" class="overlay" @keydown.esc="closeMenu">
    <div v-if="isOpen" class="backdrop" aria-hidden="true" @click="closeMenu" />

    <BaseTooltip v-if="showCompass" :text="t('map.overlay.compassTooltip')">
      <button
        class="compass-fab fab-glass"
        @click="emit('resetBearing')"
      >
        <BaseIcon
          name="explore"
          class="compass-icon"
          :style="{ transform: `rotate(${iconRotation}deg)` }"
        />
      </button>
    </BaseTooltip>

    <!-- The legend one tap away on the map (it is also in the layers panel), bottom left, in
         the tour bar's row: a control above the menu button hid map labels (round 4). -->
    <div v-if="!isOpen && !overlayActive" class="legend-anchor">
      <BaseTooltip :text="t('map.legend.open')">
        <button
          class="legend-fab fab-glass"
          :aria-label="t('map.legend.open')"
          data-testid="legend-fab"
          @click="view = 'legend'"
        >
          <BaseIcon name="info" />
        </button>
      </BaseTooltip>
    </div>

    <!-- The layers panel takes the menu's place, right above the trigger: within
         thumb reach, full width on phones. The trigger closes either. -->
    <Transition name="dial" mode="out-in">
      <MapSpeedDialMenu
        v-if="view === 'menu'"
        ref="menuRef"
        :items="menuItems"
        @select="onMenuSelect"
      />
      <MapLayersPanel
        v-else-if="view === 'map-layers'"
        :current-style-index="currentStyleIndex"
        :active-overlays="activeOverlays"
        @select-style="selectStyle"
        @toggle-overlay="mapStore.toggleOverlay"
      />
      <section v-else-if="view === 'legend'" class="legend-panel fab-glass" :aria-label="t('map.legend.title')">
        <h3 class="legend-heading">
          {{ t('map.legend.title') }}
        </h3>
        <MapLegend />
      </section>
    </Transition>

    <SpeedDialTrigger
      :is-open="isOpen"
      :count="inboxCount"
      :dot="pendingIncomingCount > 0 || updateAvailable"
      :title-open="t('map.overlay.menuClose')"
      :title-closed="t('map.overlay.menuOpen')"
      :class="{ 'trigger--overlay-active': overlayActive }"
      @toggle="toggleMenu"
    />
  </div>
</template>

<style scoped>
.overlay {
  /* fixed (not absolute) so position tracks the visual viewport in mobile
     browsers — keeps the speed-dial above Android system nav and Brave/Chrome
     bottom chrome, not buried under page-root 100lvh. */
  position: fixed;
  /* Docked at the screen edge, level with the location picker: floating higher, the controls
     blocked a band of live map (objectives) instead of the edge. */
  bottom: calc(var(--spacing-lg) + var(--safe-bottom));
  right: calc(var(--spacing-lg) + var(--safe-right));
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  align-items: flex-end;
  z-index: 15;
  /* Only the controls and the backdrop take taps: a tap anywhere else — gaps,
     the space beside the layers panel — lands on the backdrop (open)
     or the map (closed). */
  pointer-events: none;
}

.overlay :deep(button) {
  pointer-events: auto;
}

.backdrop {
  position: fixed;
  inset: 0;
  z-index: -1;
  background: transparent;
  pointer-events: auto;
}

.legend-anchor {
  position: fixed;
  left: calc(var(--spacing-lg) + var(--safe-left));
  /* Centred on the 52 px tour bar. */
  bottom: calc(var(--spacing-lg) + var(--safe-bottom) + 6px);
}

.legend-fab {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.legend-panel {
  position: fixed;
  left: calc(var(--spacing-lg) + var(--safe-left));
  bottom: calc(var(--spacing-lg) + var(--safe-bottom) + 52px + var(--spacing-sm));
  padding: var(--spacing-md);
  border-radius: var(--radius-lg);
  pointer-events: auto;
  max-width: min(320px, calc(100vw - 2 * var(--spacing-lg)));
  max-height: calc(100dvh - 160px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
  overflow-y: auto;
  animation: dial-rise var(--motion-duration-medium) var(--motion-ease-emphasized) backwards;
}

.legend-heading {
  margin: 0 0 var(--spacing-xs);
  color: var(--color-fab-on-surface);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.compass-fab {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: flex-end;
  transition:
    background-color var(--motion-duration-medium) var(--motion-ease-standard),
    transform var(--motion-duration-short) var(--motion-ease-spring);
}

@media (hover: hover) {
  .compass-fab:hover {
    background-color: var(--color-fab-glass-strong);
  }
}

.compass-fab:active {
  background-color: var(--color-fab-glass-strong);
}

.compass-fab:active:not(:disabled) {
  transform: scale(var(--press-scale));
}

.compass-icon {
  transition: transform var(--motion-duration-short) var(--motion-ease-standard);
}

/* Expanding menus unfold from where they were opened: the speed-dial items rise
   from the trigger one after another, nearest first; the layers panel rises in
   their place. Closing is one quiet fade. The items animate
   on mount (they mount only when a menu opens) rather than under
   `dial-enter-active`: the Transition root has no transition of its own, so Vue
   would drop that class after one frame and cut the animation short. */
.overlay :deep(.item-row) {
  animation: dial-rise var(--motion-duration-medium) var(--motion-ease-emphasized) backwards;
  animation-delay: calc(var(--ri) * var(--motion-stagger));
}

.dial-leave-active {
  transition: opacity var(--motion-duration-short) var(--motion-ease-standard);
}

.dial-leave-to {
  opacity: 0;
}

@keyframes dial-rise {
  from {
    opacity: 0;
    transform: translateY(var(--motion-offset)) scale(0.96);
  }
}

:deep(.trigger--overlay-active .fab) {
  opacity: 0.45;
  cursor: default;
}

@media (orientation: landscape) and (max-height: 500px) {
  /* Menu fans as a quarter-circle arc around the trigger so it doesn't overlap
     the bottom-center tour action pill. Trigger stays at bottom-right. */
  .overlay {
    flex-direction: column;
    align-items: flex-end;
  }
}
</style>
