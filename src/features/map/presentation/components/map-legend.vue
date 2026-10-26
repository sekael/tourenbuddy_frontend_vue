<script setup lang="ts">
import type { TourType } from '@/features/tours/data/models/tour-type'
import { useI18n } from 'vue-i18n'
import BaseIcon from '@/core/components/base-icon.vue'
import { cssFill, TOUR_TYPE_COLORS, TOUR_TYPE_I18N_KEYS } from '@/features/tours/data/models/tour-type'
import { FALLBACK_COLOR } from './pie-marker'

const { t } = useI18n({ useScope: 'global' })

// One row per marker colour, named by the activities wearing it — derived from the palette, so
// a palette change can't leave the legend behind (D11).
const typesByColour = new Map<string, TourType[]>()
for (const [type, color] of Object.entries(TOUR_TYPE_COLORS) as [TourType, string][])
  typesByColour.set(color, [...(typesByColour.get(color) ?? []), type])
const colourRows = [...typesByColour].map(([color, types]) => ({
  color,
  label: types.map(type => t(`tours.type.${TOUR_TYPE_I18N_KEYS[type]}`)).join(', '),
}))
const splitFill = cssFill(colourRows.slice(0, 2).map(r => r.color))
const clusterFill = `conic-gradient(${colourRows.map((r, i) => `${r.color} ${(i * 100) / colourRows.length}% ${((i + 1) * 100) / colourRows.length}%`).join(', ')})`
</script>

<template>
  <ul class="legend">
    <li v-for="row in colourRows" :key="row.color">
      <span class="dot" :style="{ background: row.color }" />{{ row.label }}
    </li>
    <li><span class="dot" :style="{ background: splitFill }" />{{ t('map.legend.multi') }}</li>
    <li><span class="dot" :style="{ background: FALLBACK_COLOR }" />{{ t('map.legend.none') }}</li>
    <li>
      <span class="badge badge--done"><BaseIcon name="check" /></span>{{ t('map.legend.done') }}
    </li>
    <li>
      <span class="badge"><BaseIcon name="group" /></span>{{ t('map.legend.friend') }}
    </li>
    <li>
      <span class="badge"><BaseIcon name="link" /></span>{{ t('map.legend.linked') }}
    </li>
    <li>
      <span class="cluster" :style="{ background: clusterFill }"><span>3</span></span>{{ t('map.legend.cluster') }}
    </li>
    <li><span class="chain" />{{ t('map.legend.chain') }}</li>
  </ul>
</template>

<style scoped>
.legend {
  display: grid;
  gap: var(--spacing-xxs);
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--color-fab-on-surface);
  font-size: var(--font-size-xs);
  line-height: 1.3;

  & li {
    display: flex;
    gap: var(--spacing-xs);
    align-items: center;
  }
}

/* Every symbol sits in the same 20 px slot so the labels line up. */
.dot,
.badge,
.cluster,
.chain {
  flex: none;
  width: 20px;
  height: 20px;
}

.dot {
  border: 1.5px solid var(--white);
  border-radius: var(--radius-round);
  box-shadow: var(--shadow-control);
}

.badge {
  display: grid;
  place-items: center;
  border: 1.5px solid var(--white);
  border-radius: var(--radius-round);
  background: var(--white);
  color: #1f2937;
  font-size: 12px;
  box-shadow: var(--shadow-control);
}

.badge--done {
  background: #15803d;
  color: var(--white);
}

.cluster {
  display: grid;
  place-items: center;
  border: 1.5px solid var(--white);
  border-radius: var(--radius-round);
  box-shadow: var(--shadow-control);

  & span {
    display: grid;
    place-items: center;
    width: 10px;
    height: 10px;
    border-radius: var(--radius-round);
    background: var(--white);
    color: #1c1917;
    font-size: 8px;
    font-weight: var(--font-weight-semibold);
  }
}

.chain {
  height: 4px;
  background: radial-gradient(circle, #1f2937 1.8px, transparent 2px) 0 50% / 7px 4px repeat-x;
  opacity: 0.75;
}
</style>
