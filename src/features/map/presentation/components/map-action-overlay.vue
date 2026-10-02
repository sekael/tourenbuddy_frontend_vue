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
        class="compass-fab"
        @click="emit('resetBearing')"
      >
        <BaseIcon
          name="explore"
          class="compass-icon"
          :style="{ transform: `rotate(${iconRotation}deg)` }"
        />
      </button>
    </BaseTooltip>

    <Transition :name="view === 'base-map' ? 'menu-fade' : 'panel'">
      <MapSpeedDialMenu
        v-if="view === 'menu'"
        ref="menuRef"
        :items="menuItems"
        @select="onMenuSelect"
      />
    </Transition>

    <Transition :name="baseMapAnchor ? 'unfold' : 'panel'">
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
  background-color: color-mix(in srgb, var(--color-fab-surface) 85%, transparent);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--color-fab-border);
  box-shadow: var(--shadow-md);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-fab-on-surface);
  align-self: flex-end;
  transition:
    box-shadow var(--motion-duration-medium) var(--motion-ease-standard),
    transform var(--motion-duration-short) var(--motion-ease-spring);
}

.compass-fab:hover {
  background-color: color-mix(in srgb, var(--color-fab-surface-strong) 85%, transparent);
  box-shadow: var(--shadow-lg);
  transform: translateY(-1px);
}

/* Keeps the hover lift; adds the variant's press scale (Classic: 1 = unchanged). */
.compass-fab:active:not(:disabled) {
  transform: translateY(-1px) scale(var(--press-scale));
}

.compass-icon {
  transition: transform 0.15s ease-out;
}

.panel-enter-active {
  transition:
    opacity var(--motion-duration-short) var(--motion-ease-standard),
    transform var(--motion-duration-short) var(--motion-ease-spring);
}

.panel-leave-active {
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
}

.panel-enter-from,
.panel-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.97);
}

/* Base-map options pinned where "Change base map" sat; they unfold downward from
   its top-right corner while the rest of the menu fades in place. */
.anchored {
  position: fixed;
  top: var(--anchor-top);
  right: var(--anchor-right);
}

.menu-fade-leave-active {
  transition: opacity var(--motion-duration-short) var(--motion-ease-standard);
}

.menu-fade-leave-to {
  opacity: 0;
}

.unfold-enter-active,
.unfold-leave-active {
  transform-origin: top right;
  transition:
    opacity var(--motion-duration-medium) var(--motion-ease-standard),
    transform var(--motion-duration-medium) var(--motion-ease-emphasized);
}

.unfold-enter-from,
.unfold-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.97);
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

  .panel-enter-from,
  .panel-leave-to {
    opacity: 0;
    transform: scale(0.85);
    transform-origin: bottom right;
  }
}
</style>
