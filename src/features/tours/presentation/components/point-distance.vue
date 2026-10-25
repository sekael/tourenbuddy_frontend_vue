<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseIcon from '@/core/components/base-icon.vue'
import { useFormatter } from '@/core/composables/use-formatter'
import { haversineMeters } from '@/core/utils/haversine'

interface LngLat { lng: number, lat: number }

/**
 * How far a start or landing lies from the goal (activity-legs): a search hit in the wrong
 * valley — a commune centre picked as the landing — shows at a glance, and past `FAR_M` it warns.
 * ponytail: one threshold; a cross-country flight that lands farther just reads the warning.
 */
const props = defineProps<{ goal: LngLat, point: LngLat }>()

const FAR_M = 20_000
const { t } = useI18n({ useScope: 'global' })
const { formatDistance } = useFormatter()
const metres = computed(() => haversineMeters([props.goal.lng, props.goal.lat], [props.point.lng, props.point.lat]))
const far = computed(() => metres.value > FAR_M)
</script>

<template>
  <span class="point-distance" :class="{ far }" data-testid="point-distance">
    <BaseIcon v-if="far" name="warning" size="xs" class="icon" />
    {{ t(far ? 'tours.form.farFromGoal' : 'tours.form.fromGoal', { distance: formatDistance(metres) }) }}
  </span>
</template>

<style scoped>
.point-distance {
  display: block;
  font-size: var(--font-size-xs);
  color: var(--color-on-surface-variant);
  white-space: nowrap;
}

.far {
  color: var(--color-warning-text);
  font-weight: var(--font-weight-medium);
}

.icon {
  vertical-align: -2px;
}
</style>
