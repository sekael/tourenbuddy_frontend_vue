<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { SWISSTOPO_STYLES } from '@/features/map/data/swisstopo-styles'
import { useMapStore } from '@/features/map/presentation/stores/map-store'

const { t } = useI18n()
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
      :title="t('map.styles.pickerTooltip')"
      @click="isOpen = !isOpen"
    >
      <span class="material-symbols-outlined">map</span>
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
          <span class="check material-symbols-outlined">{{
            currentStyleIndex === index ? 'check' : ''
          }}</span>
          {{ t(style.labelKey) }}
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
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background-color: rgba(248, 250, 252, 0.75);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(203, 213, 225, 0.5);
  box-shadow: var(--shadow-md);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-on-surface-variant);
  transition:
    box-shadow 0.2s,
    transform 0.15s;
}

.fab:hover,
.fab.active {
  box-shadow: var(--shadow-lg);
  transform: translateY(-1px);
}

.menu {
  position: absolute;
  bottom: calc(100% + var(--spacing-sm));
  right: 0;
  background-color: rgba(248, 250, 252, 0.9);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  min-width: 160px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  width: 100%;
  padding: var(--spacing-md) var(--spacing-lg);
  font-size: var(--font-size-sm);
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
  width: 20px;
  font-size: 18px;
  color: var(--color-primary);
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
