<script setup lang="ts">
import type { LocationResult } from '@/features/map/data/services/swisstopo-search-service'
import { useI18n } from 'vue-i18n'
import BaseIcon from '@/core/components/base-icon.vue'

defineProps<{
  results: LocationResult[]
  failed: boolean
}>()

const emit = defineEmits<{
  choose: [result: LocationResult]
}>()

const { t } = useI18n({ useScope: 'global' })
</script>

<template>
  <div class="search-results" role="listbox" :aria-label="t('tours.picker.search.label')">
    <p v-if="failed" class="search-message">
      <BaseIcon name="warning" size="sm" />
      {{ t('tours.picker.search.error') }}
    </p>
    <p v-else-if="results.length === 0" class="search-message">
      <BaseIcon name="search_off" size="sm" />
      {{ t('tours.picker.search.noResults') }}
    </p>
    <button
      v-for="(result, i) in results" v-else :key="`${result.origin}-${result.lng}-${result.lat}-${i}`"
      type="button" role="option" aria-selected="false" class="search-result" @click="emit('choose', result)"
    >
      <span class="result-pin">
        <BaseIcon name="location_on" size="sm" />
      </span>
      <span class="result-text">
        <span class="result-name">{{ result.name }}</span>
        <span class="result-meta">
          {{ [result.kind ?? t(`tours.picker.search.origin.${result.origin}` as any), result.region].filter(Boolean).join(' · ') }}
        </span>
      </span>
    </button>
  </div>
</template>

<style scoped>
/* Frosted card matching the search pill; rows are inset tiles, not ruled lines. */
.search-results {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: min(50dvh, 360px);
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  padding: var(--spacing-xxs);
  border: 1px solid color-mix(in srgb, var(--color-outline-variant) 70%, transparent);
  border-radius: var(--radius-md);
  background-color: color-mix(in srgb, var(--color-background) 94%, transparent);
  backdrop-filter: blur(16px) saturate(1.6);
  -webkit-backdrop-filter: blur(16px) saturate(1.6);
  box-shadow: var(--shadow-lg);
}

.search-message {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  margin: 0;
  padding: var(--spacing-sm) var(--spacing-md);
  color: var(--color-on-surface-variant);
}

.search-message .base-icon {
  flex-shrink: 0;
  margin-top: 2px;
}

.search-result {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-shrink: 0;
  padding: var(--spacing-xs) var(--spacing-sm);
  border: none;
  border-radius: var(--input-radius);
  background: none;
  text-align: start;
  cursor: pointer;
  color: var(--color-on-surface);
  transition: background-color var(--motion-duration-short) var(--motion-ease-standard);
}

@media (hover: hover) {
  .search-result:hover {
    background-color: var(--color-surface-variant);
  }
}

.search-result:active,
.search-result:focus-visible {
  background-color: var(--color-surface-variant);
}

.result-pin {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-round);
  background-color: var(--chip-selected-bg);
  color: var(--color-primary);
}

.result-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.result-name {
  font-weight: var(--font-weight-medium);
}

.result-meta {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}
</style>
