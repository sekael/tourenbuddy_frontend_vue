<script setup lang="ts">
import type { LocationResult } from '@/features/map/data/services/swisstopo-search-service'
import { useI18n } from 'vue-i18n'

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
      {{ t('tours.picker.search.error') }}
    </p>
    <p v-else-if="results.length === 0" class="search-message">
      {{ t('tours.picker.search.noResults') }}
    </p>
    <button
      v-for="(result, i) in results" v-else :key="`${result.origin}-${result.lng}-${result.lat}-${i}`"
      type="button" role="option" aria-selected="false" class="search-result" @click="emit('choose', result)"
    >
      <span class="result-name">{{ result.name }}</span>
      <span class="result-meta">
        {{ [result.kind ?? t(`tours.picker.search.origin.${result.origin}` as any), result.region].filter(Boolean).join(' · ') }}
      </span>
    </button>
  </div>
</template>

<style scoped>
.search-results {
  display: flex;
  flex-direction: column;
  max-height: min(50dvh, 360px);
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: var(--spacing-xs) 0;
  border-radius: var(--radius-md);
  background-color: var(--color-surface);
  box-shadow: var(--shadow-md);
}

.search-message {
  margin: 0;
  padding: var(--spacing-sm) var(--spacing-md);
  color: var(--color-on-surface-variant);
}

.search-result {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: var(--spacing-sm) var(--spacing-md);
  border: none;
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

.result-name {
  font-weight: var(--font-weight-medium);
}

.result-meta {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}
</style>
