<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { formatPace, pace } from '@/core/composables/use-pace'

/** The user's pace beside a time taken at it, as a small factor badge ("1.2×"), only off the standard. */
const { t } = useI18n({ useScope: 'global' })
</script>

<template>
  <span v-if="pace !== 1" class="pace-badge" :title="t('tours.route.pace')" data-testid="pace-badge">
    <span class="visually-hidden">{{ t('tours.route.pace') }}</span>
    {{ formatPace(pace) }}
  </span>
</template>

<style scoped>
.pace-badge {
  display: inline-block;
  padding: 0 0.45em;
  border-radius: var(--radius-pill);
  background: var(--color-surface-variant);
  color: var(--color-on-surface-variant);
  font-size: 0.8em;
  font-weight: var(--font-weight-semibold);
  line-height: 1.5;
  white-space: nowrap;
}
</style>
