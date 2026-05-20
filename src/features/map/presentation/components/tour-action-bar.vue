<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import BaseTooltip from '@/core/components/base-tooltip.vue'

defineProps<{
  visible: boolean
  toursDisabled: boolean
  addTourDisabled: boolean
  addTourTooltip?: string
}>()

const emit = defineEmits<{ tours: [], addTour: [] }>()

const { t } = useI18n({ useScope: 'global' })
</script>

<template>
  <Transition name="pill">
    <div v-if="visible" class="pill" role="group">
      <button
        class="segment segment--tours"
        :disabled="toursDisabled"
        :aria-disabled="toursDisabled"
        @click="emit('tours')"
      >
        <span class="material-symbols-outlined" aria-hidden="true">location_on</span>
        <span class="segment-label">{{ t('map.actionBar.myTours') }}</span>
      </button>

      <div class="divider" aria-hidden="true" />

      <BaseTooltip :text="addTourTooltip ?? t('map.overlay.addTourTooltip')">
        <button
          class="segment segment--add"
          :disabled="addTourDisabled"
          :aria-disabled="addTourDisabled"
          :aria-label="t('map.actionBar.addTourAriaLabel')"
          @click="emit('addTour')"
        >
          <span class="material-symbols-outlined" aria-hidden="true">add_location_alt</span>
        </button>
      </BaseTooltip>
    </div>
  </Transition>
</template>

<style scoped>
.pill {
  position: absolute;
  bottom: calc(var(--spacing-3xl) + env(safe-area-inset-bottom, 0px));
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  display: flex;
  align-items: stretch;
  height: 52px;
  border-radius: 26px;
  background-color: color-mix(in srgb, var(--color-fab-surface) 85%, transparent);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--color-fab-border);
  box-shadow: var(--shadow-md);
  overflow: hidden;
  pointer-events: auto;
  white-space: nowrap;
}

.segment {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  padding: 0 var(--spacing-lg);
  color: var(--color-fab-on-surface);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  transition: background-color 0.15s;
}

.segment:hover:not(:disabled) {
  background-color: color-mix(in srgb, var(--color-fab-surface-strong) 40%, transparent);
}

.segment:disabled {
  opacity: 0.45;
  cursor: default;
}

.segment--add {
  padding: 0 var(--spacing-md);
}

.segment-label {
  line-height: 1;
}

.divider {
  width: 1px;
  background-color: var(--color-outline-variant);
  align-self: stretch;
  flex-shrink: 0;
}

.pill-enter-active,
.pill-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.pill-enter-from,
.pill-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}
</style>
