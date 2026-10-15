<script setup lang="ts">
import type { Trail } from '@/features/map/domain/entities/trail'
import { useI18n } from 'vue-i18n'
import BaseIcon from '@/core/components/base-icon.vue'
import { trailTitle } from '../composables/trail-title'

const props = defineProps<{ candidates: Trail[], more: number }>()
const emit = defineEmits<{ select: [id: string] }>()
const { t } = useI18n({ useScope: 'global' })
</script>

<template>
  <ul class="list">
    <li v-for="trail in props.candidates" :key="trail.id">
      <button type="button" class="row" @click="emit('select', trail.id)">
        <BaseIcon name="downhill_skiing" class="icon" />
        <span class="text">
          <span class="title">{{ trailTitle(trail, t) }}</span>
          <span v-if="trail.route?.name" class="sub">{{ trail.route.name }}</span>
        </span>
        <span v-if="trail.route?.difficulty" class="chip">{{ trail.route.difficulty }}</span>
        <BaseIcon name="chevron_right" class="chevron" />
      </button>
    </li>
    <li v-if="props.more > 0" class="more">
      {{ t('map.trail.more', { count: props.more }) }}
    </li>
  </ul>
</template>

<style scoped>
.list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

@media (hover: hover) {
  .row:hover {
    background-color: var(--color-surface-variant);
  }
}

.icon,
.chevron {
  flex-shrink: 0;
  color: var(--color-on-surface-variant);
}

.text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.title {
  font-weight: var(--font-weight-medium);
}

.sub {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chip {
  flex-shrink: 0;
  padding: var(--spacing-xxs) var(--spacing-xs);
  border-radius: var(--radius-pill);
  background-color: var(--color-secondary-container);
  color: var(--color-on-secondary-container);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

.more {
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}
</style>
