<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMapOverlay } from '../composables/use-map-overlay'
import MapBaseMapPanel from './map-base-map-panel.vue'
import MapSpeedDialMenu from './map-speed-dial-menu.vue'
import SpeedDialTrigger from './speed-dial-trigger.vue'

const props = defineProps<{ bearing?: number }>()

const emit = defineEmits<{
  openProfile: []
  openContacts: []
  openTours: []
  openFeedback: []
  resetBearing: []
}>()

const { t } = useI18n({ useScope: 'global' })
const {
  view,
  isOpen,
  isPickingLocation,
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
</script>

<template>
  <div v-if="!isPickingLocation" class="overlay" @keydown.esc="closeMenu">
    <div v-if="isOpen" class="backdrop" aria-hidden="true" @click="closeMenu" />

    <button
      v-if="showCompass"
      class="compass-fab"
      :title="t('map.overlay.compassTooltip')"
      @click="emit('resetBearing')"
    >
      <span
        class="material-symbols-outlined compass-icon"
        :style="{ transform: `rotate(${iconRotation}deg)` }"
      >explore</span>
    </button>

    <Transition name="panel">
      <MapSpeedDialMenu
        v-if="view === 'menu'"
        ref="menuRef"
        :items="menuItems"
        @select="onMenuSelect"
      />
    </Transition>

    <Transition name="panel">
      <MapBaseMapPanel
        v-if="view === 'base-map'"
        :current-style-index="currentStyleIndex"
        @select="selectStyle"
      />
    </Transition>

    <SpeedDialTrigger
      :is-open="isOpen"
      :has-badge="pendingIncomingCount > 0"
      :title-open="t('map.overlay.menuClose')"
      :title-closed="t('map.overlay.menuOpen')"
      @toggle="toggleMenu"
    />
  </div>
</template>

<style scoped>
.overlay {
  position: absolute;
  bottom: var(--spacing-xxl);
  right: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  align-items: flex-end;
  z-index: 10;
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
  border: 1px solid rgba(203, 213, 225, 0.5);
  box-shadow: var(--shadow-md);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-fab-on-surface);
  align-self: flex-end;
  transition:
    box-shadow 0.2s,
    transform 0.15s;
}

.compass-fab:hover {
  background-color: color-mix(in srgb, var(--color-fab-surface-strong) 85%, transparent);
  box-shadow: var(--shadow-lg);
  transform: translateY(-1px);
}

.compass-icon {
  transition: transform 0.15s ease-out;
}

.panel-enter-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
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

@media (orientation: landscape) and (max-height: 500px) {
  .overlay {
    flex-direction: row;
    align-items: flex-end;
  }

  .panel-enter-from,
  .panel-leave-to {
    opacity: 0;
    transform: translateX(8px) scale(0.97);
  }
}
</style>
