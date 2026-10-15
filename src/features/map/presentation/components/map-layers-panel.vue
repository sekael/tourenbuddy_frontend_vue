<script setup lang="ts">
import type { TrailOverlayId } from '@/features/map/data/trail-overlays'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { isOnline } from '@/core/offline/use-online-status'
import { SWISSTOPO_STYLES } from '@/features/map/data/swisstopo-styles'
import { TRAIL_OVERLAYS } from '@/features/map/data/trail-overlays'
import LayerTile from './layer-tile.vue'

const props = defineProps<{ currentStyleIndex: number, activeOverlays: TrailOverlayId[] }>()
const emit = defineEmits<{ selectStyle: [index: number], toggleOverlay: [id: TrailOverlayId] }>()
const { t } = useI18n({ useScope: 'global' })

// The panel replaces the menu: hand focus to the current base map (or the first
// overlay offline, when the base tiles are disabled).
const panelEl = ref<HTMLElement | null>(null)
onMounted(() => panelEl.value?.querySelector<HTMLElement>('button:not(:disabled)')?.focus())

// Radio-group keys: arrows move the choice within the base maps.
function onBaseKeydown(e: KeyboardEvent) {
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
  if (!step)
    return
  e.preventDefault()
  const n = SWISSTOPO_STYLES.length
  const next = (props.currentStyleIndex + step + n) % n
  emit('selectStyle', next)
}
</script>

<template>
  <div ref="panelEl" class="panel fab-glass" data-tour="map-layers">
    <section>
      <h3 id="map-layers-base" class="heading">
        {{ t('map.layers.baseMap') }}
      </h3>
      <p v-if="!isOnline" class="hint">
        {{ t('map.layers.needsConnection') }}
      </p>
      <div class="tiles" role="radiogroup" aria-labelledby="map-layers-base" @keydown="onBaseKeydown">
        <LayerTile
          v-for="(style, idx) in SWISSTOPO_STYLES" :key="style.style" role="radio"
          :aria-checked="props.currentStyleIndex === idx" :tabindex="props.currentStyleIndex === idx ? 0 : -1"
          :label="t(style.labelKey)" :thumbnail="style.thumbnail" :selected="props.currentStyleIndex === idx"
          :disabled="!isOnline" @select="emit('selectStyle', idx)"
        />
      </div>
    </section>
    <section>
      <h3 class="heading">
        {{ t('map.layers.overlays.title') }}
      </h3>
      <div class="tiles">
        <LayerTile
          v-for="overlay in TRAIL_OVERLAYS" :key="overlay.id"
          :aria-pressed="props.activeOverlays.includes(overlay.id)" :label="t(overlay.labelKey)"
          :thumbnail="overlay.thumbnail" :icon="overlay.icon" :selected="props.activeOverlays.includes(overlay.id)"
          @select="emit('toggleOverlay', overlay.id)"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border-radius: var(--radius-lg);
  /* The speed-dial overlay passes taps through; the card itself must catch them
     so a tap between tiles doesn't close the menu. */
  pointer-events: auto;
  max-width: calc(100vw - 2 * var(--spacing-lg));
  animation: panel-unfold var(--motion-duration-medium) var(--motion-ease-emphasized) backwards;
}

.heading {
  margin: 0 0 var(--spacing-xs);
  color: var(--color-fab-on-surface);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.hint {
  margin: 0 0 var(--spacing-xs);
  color: var(--color-fab-on-surface);
  font-size: var(--font-size-xs);
  opacity: 0.8;
}

.tiles {
  display: flex;
  gap: var(--spacing-sm);
}

@keyframes panel-unfold {
  from {
    opacity: 0;
    transform: translateY(var(--motion-offset)) scale(0.96);
  }
}

@media (prefers-reduced-motion: reduce) {
  .panel {
    animation: none;
  }
}
</style>
