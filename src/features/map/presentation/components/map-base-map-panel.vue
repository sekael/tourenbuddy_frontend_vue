<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import BaseIcon from '@/core/components/base-icon.vue'
import { SWISSTOPO_STYLES } from '@/features/map/data/swisstopo-styles'

const props = defineProps<{ currentStyleIndex: number }>()
const emit = defineEmits<{ select: [index: number] }>()
const { t } = useI18n({ useScope: 'global' })
</script>

<template>
  <div role="menu" class="panel" data-tour="basemap">
    <button
      v-for="(style, idx) in SWISSTOPO_STYLES"
      :key="idx"
      role="menuitem"
      class="item"
      :class="{ selected: props.currentStyleIndex === idx }"
      @click="emit('select', idx)"
    >
      <span class="label">{{ t(style.labelKey) }}</span>
      <span class="icon-wrap">
        <BaseIcon :name="props.currentStyleIndex === idx ? 'check' : 'map'" class="icon" />
      </span>
    </button>
  </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--spacing-xs);
}

.item {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-lg);
  background-color: color-mix(in srgb, var(--color-fab-surface) 85%, transparent);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(203, 213, 225, 0.5);
  box-shadow: var(--shadow-sm);
  color: var(--color-fab-on-surface);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color 0.15s,
    box-shadow 0.15s,
    transform 0.15s;
}

.item:hover {
  background-color: color-mix(in srgb, var(--color-fab-surface-strong) 85%, transparent);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.item.selected {
  background-color: color-mix(in srgb, var(--color-fab-surface-strong) 90%, transparent);
  font-weight: var(--font-weight-semibold);
}

.label {
  flex: 1;
}

.icon-wrap {
  width: 24px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon {
  font-size: 20px;
}
</style>
