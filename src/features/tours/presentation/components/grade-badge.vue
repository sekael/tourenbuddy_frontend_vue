<script setup lang="ts">
import { useI18n } from 'vue-i18n'

/** A tour's grade as an outlined badge, sized by its context — detail, list row and stage card. */
defineProps<{ grade: string }>()
const { t } = useI18n({ useScope: 'global' })
</script>

<template>
  <span class="grade-badge" data-testid="tour-grade">
    <span class="visually-hidden">{{ t('tours.suggestions.fields.grade') }}</span>
    {{ grade }}
  </span>
</template>

<style scoped>
.grade-badge {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  padding: 0 0.5em;
  border: 1px solid var(--color-outline);
  border-radius: var(--chip-radius);
  color: var(--color-on-surface);
  font-size: 0.85em;
  font-weight: var(--font-weight-semibold);
  line-height: 1.4;
  white-space: nowrap;
}
</style>
