<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { ref } from 'vue'
import { SWISSTOPO_STYLES } from '@/features/map/data/swisstopo-styles'
import { useMapStore } from '@/features/map/presentation/stores/map-store'

const mapStore = useMapStore()
const { currentStyleIndex } = storeToRefs(mapStore)

const isOpen = ref(false)

function selectStyle(index: number) {
  mapStore.setStyleIndex(index)
  isOpen.value = false
}
</script>

<template>
  <div class="picker-wrapper">
    <button
      class="fab"
      :class="{ active: isOpen }"
      title="Change map style"
      @click="isOpen = !isOpen"
    >
      🗺
    </button>

    <Transition name="menu">
      <div v-if="isOpen" class="menu">
        <button
          v-for="(style, index) in SWISSTOPO_STYLES"
          :key="index"
          class="menu-item"
          :class="{ selected: currentStyleIndex === index }"
          @click="selectStyle(index)"
        >
          <span class="check">{{ currentStyleIndex === index ? '✓' : '' }}</span>
          {{ style.label }}
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.picker-wrapper {
  position: relative;
}

.fab {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: var(--color-surface);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  transition: box-shadow 0.2s;
}

.fab:hover,
.fab.active {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.menu {
  position: absolute;
  bottom: calc(100% + var(--spacing-sm));
  right: 0;
  background-color: var(--color-surface);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  min-width: 160px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  width: 100%;
  padding: var(--spacing-md) var(--spacing-lg);
  font-size: var(--font-size-base);
  color: var(--color-on-surface);
  text-align: left;
}

.menu-item:hover {
  background-color: var(--color-surface-variant);
}

.menu-item.selected {
  color: var(--color-primary);
  font-weight: var(--font-weight-medium);
}

.check {
  width: 16px;
  color: var(--color-primary);
  font-weight: var(--font-weight-bold);
}

.menu-enter-active,
.menu-leave-active {
  transition:
    opacity 0.15s,
    transform 0.15s;
}

.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(4px);
}
</style>
