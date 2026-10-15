<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseIcon from '@/core/components/base-icon.vue'
import BottomSheet from '@/core/components/bottom-sheet.vue'
import SideDrawer from '@/core/components/side-drawer.vue'
import { useIsDesktop } from '@/core/composables/use-is-desktop'
import { trailTitle } from '../composables/trail-title'
import { useMapStore } from '../stores/map-store'
import TrailCandidateList from './trail-candidate-list.vue'

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n({ useScope: 'global' })
const isDesktop = useIsDesktop()
const mapStore = useMapStore()
const { trailCard } = storeToRefs(mapStore)

const selected = computed(() => trailCard.value?.candidates.find(c => c.id === trailCard.value?.selectedId) ?? null)
const route = computed(() => selected.value?.route ?? null)
/** Back to the list only when the details were opened from one. */
const fromList = computed(() => selected.value !== null && (trailCard.value?.candidates.length ?? 0) > 1)
const title = computed(() => selected.value
  ? trailTitle(selected.value, t)
  : t('map.trail.listTitle', { count: (trailCard.value?.candidates.length ?? 0) + (trailCard.value?.more ?? 0) }))
</script>

<template>
  <component
    :is="isDesktop ? SideDrawer : BottomSheet" v-if="trailCard" :title="title" fit-content
    :show-back="fromList" :back-label="fromList ? t('map.trail.backToList') : undefined"
    @close="emit('close')" @back="mapStore.selectTrail(null)"
  >
    <div class="body">
      <TrailCandidateList
        v-if="!selected" :candidates="trailCard.candidates" :more="trailCard.more"
        @select="mapStore.selectTrail"
      />
      <template v-else-if="route">
        <p v-if="route.name" class="name">
          {{ route.name }}
        </p>
        <div class="facts">
          <span v-if="route.difficulty" class="chip">{{ route.difficulty }}</span>
          <span v-if="route.ascentTime" class="fact">
            <BaseIcon name="schedule" size="sm" />{{ route.ascentTime }}
          </span>
          <span v-if="route.ascentM != null" class="fact">↑ {{ t('map.trail.metres', { value: route.ascentM }) }}</span>
          <span v-if="route.descentM != null" class="fact">↓ {{ t('map.trail.metres', { value: route.descentM }) }}</span>
        </div>
        <a v-if="route.sacUrl" class="sac" :href="route.sacUrl" target="_blank" rel="noopener">
          {{ t('map.trail.openSac') }}
          <BaseIcon name="open_in_new" size="sm" />
        </a>
      </template>
      <p v-else class="no-info">
        {{ t('map.trail.noInfo') }}
      </p>
      <p class="credit">
        © swisstopo
      </p>
    </div>
  </component>
</template>

<style scoped>
.body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding-bottom: var(--spacing-md);
}

.name,
.facts,
.sac,
.no-info,
.credit {
  margin: 0;
  padding: 0 var(--spacing-md);
}

.name {
  color: var(--color-on-surface-variant);
}

.facts {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-sm) var(--spacing-md);
}

.fact {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xxs);
}

.chip {
  padding: var(--spacing-xxs) var(--spacing-xs);
  border-radius: var(--radius-pill);
  background-color: var(--color-secondary-container);
  color: var(--color-on-secondary-container);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

.sac {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xxs);
  color: var(--color-primary);
  font-weight: var(--font-weight-medium);
}

.no-info {
  color: var(--color-on-surface-variant);
}

.credit {
  font-size: var(--font-size-xs);
  color: var(--color-on-surface-variant);
}
</style>
