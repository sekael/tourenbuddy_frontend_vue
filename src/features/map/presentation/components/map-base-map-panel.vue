<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { SWISSTOPO_STYLES } from '@/features/map/data/swisstopo-styles'
import SpeedDialItem from './speed-dial-item.vue'

const props = defineProps<{ currentStyleIndex: number }>()
const emit = defineEmits<{ select: [index: number] }>()
const { t } = useI18n({ useScope: 'global' })

// The item that opened the options goes inert: hand focus to the current choice.
const panelEl = ref<HTMLElement | null>(null)
onMounted(() => panelEl.value?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus())
</script>

<template>
  <div ref="panelEl" role="menu" class="panel" data-tour="basemap">
    <SpeedDialItem
      v-for="(style, idx) in SWISSTOPO_STYLES"
      :key="idx"
      role="menuitemradio"
      :aria-checked="props.currentStyleIndex === idx"
      :class="{ selected: props.currentStyleIndex === idx }"
      :style="{ '--i': idx, '--ri': SWISSTOPO_STYLES.length - 1 - idx }"
      :icon="props.currentStyleIndex === idx ? 'check' : 'map'"
      :label="t(style.labelKey)"
      @select="emit('select', idx)"
    />
  </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--spacing-xs);
}
</style>
