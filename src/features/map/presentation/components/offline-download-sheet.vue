<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AdaptiveOverlay from '@/core/components/adaptive-overlay.vue'
import BaseButton from '@/core/components/base-button.vue'
import { formatBytes } from '@/core/utils/format-bytes'
import { suggestTourName } from '@/features/tours/data/services/swisstopo-name-service'
import { useOfflineMapStore } from '../stores/offline-map-store'

type Bbox = [number, number, number, number]

const props = defineProps<{ bbox: Bbox }>()
const emit = defineEmits<{ close: [], done: [] }>()

const { t } = useI18n({ useScope: 'global' })
const store = useOfflineMapStore()
const { estimate, estimateWarns, estimateBlocks, status, progress } = storeToRefs(store)

const label = ref('')
const running = computed(() => status.value === 'running')
const percent = computed(() =>
  progress.value.total ? Math.round((progress.value.done / progress.value.total) * 100) : 0,
)

/** Prefill the name from the region center (same reverse-geocode as add-location); fall back to coords. */
onMounted(async () => {
  store.updateEstimate(props.bbox)
  const center = { lng: (props.bbox[0] + props.bbox[2]) / 2, lat: (props.bbox[1] + props.bbox[3]) / 2 }
  label.value = (await suggestTourName(center)) ?? `${center.lat.toFixed(3)}, ${center.lng.toFixed(3)}`
})

async function start() {
  const ok = await store.download(label.value.trim() || t('offlineMap.download.untitled'), props.bbox)
  if (ok)
    emit('done')
}
</script>

<template>
  <AdaptiveOverlay :title="t('offlineMap.download.title')" @close="emit('close')">
    <div class="body">
      <label class="field">
        <span class="field-label">{{ t('offlineMap.download.nameLabel') }}</span>
        <input v-model="label" type="text" class="input" :disabled="running">
      </label>

      <p class="size" :class="{ warn: estimateWarns, block: estimateBlocks }">
        {{ t('offlineMap.download.estimate', { size: formatBytes(estimate) }) }}
        <span v-if="estimateBlocks" class="note">{{ t('offlineMap.download.tooLarge') }}</span>
        <span v-else-if="estimateWarns" class="note">{{ t('offlineMap.download.nearQuota') }}</span>
      </p>

      <div v-if="running" class="progress">
        <div class="bar">
          <div class="fill" :style="{ width: `${percent}%` }" />
        </div>
        <span class="pct">{{ percent }}% · {{ formatBytes(progress.bytes) }}</span>
        <BaseButton variant="secondary" @click="store.cancelDownload()">
          {{ t('offlineMap.download.cancel') }}
        </BaseButton>
      </div>

      <BaseButton
        v-else
        variant="primary"
        :disabled="estimateBlocks"
        @click="start"
      >
        {{ t('offlineMap.download.start') }}
      </BaseButton>
    </div>
  </AdaptiveOverlay>
</template>

<style scoped>
.body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxs);
}

.field-label {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}

.input {
  padding: var(--spacing-sm);
  border: 1px solid var(--color-outline, #cbd5e1);
  border-radius: var(--radius-md);
  font: inherit;
}

.size {
  margin: 0;
  color: var(--color-on-surface-variant);
}

.size.warn {
  color: var(--color-warning, #b45309);
}

.size.block {
  color: var(--color-danger, #dc2626);
}

.note {
  display: block;
  font-size: var(--font-size-sm);
}

.progress {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.bar {
  flex: 1;
  height: 8px;
  border-radius: var(--radius-sm);
  background-color: var(--color-surface-variant, #e2e8f0);
  overflow: hidden;
}

.fill {
  height: 100%;
  background-color: var(--color-accent, #2563eb);
  transition: width 0.2s;
}

.pct {
  font-size: var(--font-size-sm);
  white-space: nowrap;
}
</style>
