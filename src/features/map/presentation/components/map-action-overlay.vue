<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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
const overlayEl = ref<HTMLElement | null>(null)

// Base-map options unfold from the "Change base map" item that opened them, rather
// than the menu collapsing and the options reappearing above the trigger. Pre-flush
// so the item is measured while the menu is still rendered. The anchor is kept while
// the panel leaves (so it doesn't jump) and dropped when the panel is opened directly.
const baseMapAnchor = ref<{ top: number, right: number } | null>(null)
watch(view, (next, prev) => {
  if (next !== 'base-map')
    return
  const item = prev === 'menu' ? overlayEl.value?.querySelector('[data-tour="menu-base-map"]') : null
  const rect = item?.getBoundingClientRect()
  baseMapAnchor.value = rect ? { top: rect.top, right: window.innerWidth - rect.right } : null
}, { flush: 'pre' })
const baseMapAnchorStyle = computed(() => baseMapAnchor.value
  ? { '--anchor-top': `${baseMapAnchor.value.top}px`, '--anchor-right': `${baseMapAnchor.value.right}px` }
  : undefined)
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
  <div v-if="!isPickingLocation && !isDrawingRegion" ref="overlayEl" class="overlay" @keydown.esc="closeMenu">
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

    <Transition name="dial">
      <MapSpeedDialMenu
        v-if="view === 'menu'"
        ref="menuRef"
        :items="menuItems"
        @select="onMenuSelect"
      />
    </Transition>

    <Transition name="dial">
      <MapBaseMapPanel
        v-if="view === 'base-map'"
        :class="{ anchored: baseMapAnchor }"
        :style="baseMapAnchorStyle"
        :current-style-index="currentStyleIndex"
        @select="selectStyle"
      />
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
   from the trigger one after another, nearest first; base-map options opened from
   "Change base map" drop from that item, top first. Closing is one quiet fade —
   the menu that gives way to the base-map options fades in place. The items
   animate on mount (they mount only when a menu opens) rather than under
   `dial-enter-active`: the Transition root has no transition of its own, so Vue
   would drop that class after one frame and cut the animation short. */
.overlay :deep(.item-row) {
  animation: dial-rise var(--motion-duration-medium) var(--motion-ease-emphasized) both;
  animation-delay: calc(var(--ri) * 40ms);
}

.anchored :deep(.item-row) {
  animation-name: dial-drop;
  animation-delay: calc(var(--i) * 40ms);
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

@keyframes dial-drop {
  from {
    opacity: 0;
    transform: translateY(calc(-1 * var(--motion-offset))) scale(0.96);
  }
}

/* Base-map options pinned where "Change base map" sat */
.anchored {
  position: fixed;
  top: var(--anchor-top);
  right: var(--anchor-right);
}

:deep(.trigger--overlay-active .fab) {
  opacity: 0.45;
  cursor: default;
}

@media (orientation: landscape) and (max-height: 500px) {
  /* The arc layout has no vertical stack to pin to — the panel stays in flow. */
  .anchored {
    position: static;
  }

  /* Menu fans as a quarter-circle arc around the trigger so it doesn't overlap
     the bottom-center tour action pill. Trigger stays at bottom-right. */
  .overlay {
    flex-direction: column;
    align-items: flex-end;
  }
}
</style>
