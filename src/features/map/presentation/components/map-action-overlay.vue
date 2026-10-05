<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseIcon from '@/core/components/base-icon.vue'
import BaseTooltip from '@/core/components/base-tooltip.vue'
import { useMapOverlay } from '../composables/use-map-overlay'
import MapBaseMapPanel from './map-base-map-panel.vue'
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
  pendingIncomingCount,
  menuItems,
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
// path (open the speed-dial menu, then the base-map switcher) — both live
// inside this component's `view`, not the page-level overlay set.
function openMenu() {
  if (!isPickingLocation.value)
    view.value = 'menu'
}

function openBaseMap() {
  if (!isPickingLocation.value)
    view.value = 'base-map'
}

defineExpose({ isOpen, closeMenu, openMenu, openBaseMap })
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

    <!-- Base-map options unfold beside "Change base map"; the menu stays open but
         inert behind them, and everything closes together. -->
    <Transition name="dial">
      <MapSpeedDialMenu
        v-if="isOpen"
        ref="menuRef"
        :items="menuItems"
        :expanded="view === 'base-map' ? 'base-map' : null"
        @select="onMenuSelect"
      >
        <MapBaseMapPanel
          v-if="view === 'base-map'"
          class="unfolded"
          :current-style-index="currentStyleIndex"
          @select="selectStyle"
        />
      </MapSpeedDialMenu>
    </Transition>

    <SpeedDialTrigger
      :is-open="isOpen"
      :has-badge="pendingIncomingCount > 0"
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
  bottom: calc(var(--spacing-3xl) + var(--safe-bottom));
  right: calc(var(--spacing-lg) + var(--safe-right));
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  align-items: flex-end;
  z-index: 15;
  /* Only the controls and the backdrop take taps: a tap anywhere else — gaps,
     inert menu items behind the base-map options — lands on the backdrop (open)
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

.compass-fab:hover {
  background-color: var(--color-fab-glass-strong);
}

.compass-fab:active:not(:disabled) {
  transform: scale(var(--press-scale));
}

.compass-icon {
  transition: transform var(--motion-duration-short) var(--motion-ease-standard);
}

/* Expanding menus unfold from where they were opened: the speed-dial items rise
   from the trigger one after another, nearest first; base-map options slide out
   of "Change base map", top first. Closing is one quiet fade. The items animate
   on mount (they mount only when a menu opens) rather than under
   `dial-enter-active`: the Transition root has no transition of its own, so Vue
   would drop that class after one frame and cut the animation short. */
.overlay :deep(.item-row) {
  animation: dial-rise var(--motion-duration-medium) var(--motion-ease-emphasized) backwards;
  animation-delay: calc(var(--ri) * var(--motion-stagger));
}

.unfolded :deep(.item-row) {
  animation-name: dial-unfold;
  animation-delay: calc(var(--i) * var(--motion-stagger));
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

@keyframes dial-unfold {
  from {
    opacity: 0;
    transform: translateX(var(--motion-offset)) scale(0.96);
  }
}

/* Options column beside the item that opened it, centred on it */
.unfolded {
  position: absolute;
  top: 50%;
  right: calc(100% + var(--spacing-sm));
  translate: 0 -50%;
}

:deep(.trigger--overlay-active .fab) {
  opacity: 0.45;
  cursor: default;
}

@media (orientation: landscape) and (max-height: 500px) {
  /* On the arc the next item sits below-left: grow the options upward from the
     item's centre so they clear it. */
  .unfolded {
    top: auto;
    bottom: 50%;
    translate: none;
  }

  /* Menu fans as a quarter-circle arc around the trigger so it doesn't overlap
     the bottom-center tour action pill. Trigger stays at bottom-right. */
  .overlay {
    flex-direction: column;
    align-items: flex-end;
  }
}
</style>
