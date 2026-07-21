<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import AdaptiveOverlay from '@/core/components/adaptive-overlay.vue'
import BaseButton from '@/core/components/base-button.vue'
import BaseIcon from '@/core/components/base-icon.vue'
import { formatBytes } from '@/core/utils/format-bytes'
import { SWITZERLAND_BBOX } from '@/features/map/data/services/offline-tile-service'
import { useOfflineMapStore } from '../stores/offline-map-store'

const emit = defineEmits<{ close: [], startDraw: [], downloadWhole: [bbox: [number, number, number, number]] }>()

const { t } = useI18n({ useScope: 'global' })
const store = useOfflineMapStore()
const { regions, usage, quota, usedRatio, durableStorageAvailable } = storeToRefs(store)

onMounted(() => store.loadRegions())
</script>

<template>
  <AdaptiveOverlay :title="t('offlineMap.manage.title')" @close="emit('close')">
    <div class="body">
      <p v-if="!durableStorageAvailable" class="install-hint">
        {{ t('offlineMap.manage.installHint') }}
      </p>

      <div class="usage">
        <div class="bar">
          <div class="fill" :style="{ width: `${Math.min(100, usedRatio * 100)}%` }" />
        </div>
        <span class="usage-label">
          {{ t('offlineMap.manage.usage', { used: formatBytes(usage), total: formatBytes(quota) }) }}
        </span>
      </div>

      <ul v-if="regions.length" class="regions">
        <li v-for="r in regions" :key="r.id" class="region">
          <div class="region-info">
            <span class="region-name">{{ r.label }}</span>
            <span class="region-meta">{{ formatBytes(r.bytes) }} · z{{ r.minZoom }}–{{ r.maxZoom }}</span>
          </div>
          <button
            type="button"
            class="delete"
            :aria-label="t('offlineMap.manage.delete')"
            @click="store.deleteRegion(r.id)"
          >
            <BaseIcon name="delete" />
          </button>
        </li>
      </ul>
      <p v-else class="empty">
        {{ t('offlineMap.manage.empty') }}
      </p>

      <p class="tip">
        {{ t('offlineMap.manage.tip') }}
      </p>

      <div class="cta">
        <BaseButton variant="primary" @click="emit('startDraw')">
          {{ t('offlineMap.manage.drawRegion') }}
        </BaseButton>
        <BaseButton variant="secondary" @click="emit('downloadWhole', SWITZERLAND_BBOX)">
          {{ t('offlineMap.manage.wholeMap') }}
        </BaseButton>
      </div>
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

.install-hint {
  margin: 0;
  padding: var(--spacing-sm);
  border-radius: var(--radius-md);
  background-color: var(--color-surface-variant, #e2e8f0);
  font-size: var(--font-size-sm);
}

.usage {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxs);
}

.bar {
  height: 8px;
  border-radius: var(--radius-sm);
  background-color: var(--color-surface-variant, #e2e8f0);
  overflow: hidden;
}

.fill {
  height: 100%;
  background-color: var(--color-accent, #2563eb);
}

.usage-label {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}

.regions {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.region {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-sm);
  border-radius: var(--radius-md);
  background-color: var(--color-surface-variant, #f1f5f9);
}

.region-info {
  display: flex;
  flex-direction: column;
}

.region-name {
  font-weight: var(--font-weight-medium);
}

.region-meta {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}

.delete {
  color: var(--color-danger, #dc2626);
  padding: var(--spacing-xs);
}

.empty,
.tip {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}

.cta {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}
</style>
