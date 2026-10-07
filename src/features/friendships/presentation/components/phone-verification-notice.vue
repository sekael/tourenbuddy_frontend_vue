<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AdaptiveOverlay from '@/core/components/adaptive-overlay.vue'
import BaseButton from '@/core/components/base-button.vue'
import BaseIcon from '@/core/components/base-icon.vue'
import { fadeOut, useExitAnimation } from '@/core/composables/use-exit-animation'
import { useIsDesktop } from '@/core/composables/use-is-desktop'

const emit = defineEmits<{ acknowledged: [], close: [] }>()

const { t } = useI18n({ useScope: 'global' })
const isDesktop = useIsDesktop()

// The modal sheet is unmounted by its owner: fade it (and its scrim) out.
const hostEl = ref<HTMLElement | null>(null)
useExitAnimation(hostEl, fadeOut)
const acknowledged = ref(false)
</script>

<template>
  <Teleport to="body">
    <div v-if="!isDesktop" ref="hostEl" class="sheet-host sheet-host--modal" @click.self="emit('close')">
      <AdaptiveOverlay
        :title="t('friendships.verificationNotice.title')"
        @close="emit('close')"
      >
        <div class="notice-content">
          <div class="notice-body">
            <BaseIcon name="privacy_tip" class="notice-icon" />
            <p class="notice-text">
              {{ t('friendships.verificationNotice.body') }}
            </p>
          </div>

          <label class="checkbox-row">
            <input v-model="acknowledged" type="checkbox" class="checkbox">
            <span class="checkbox-label">{{ t('friendships.verificationNotice.acknowledge') }}</span>
          </label>

          <BaseButton
            type="button"
            variant="primary"
            :disabled="!acknowledged"
            @click="emit('acknowledged')"
          >
            {{ t('friendships.verificationNotice.sendCodeBtn') }}
          </BaseButton>
        </div>
      </AdaptiveOverlay>
    </div>

    <AdaptiveOverlay
      v-else
      :title="t('friendships.verificationNotice.title')"
      @close="emit('close')"
    >
      <div class="notice-content">
        <div class="notice-body">
          <BaseIcon name="privacy_tip" class="notice-icon" />
          <p class="notice-text">
            {{ t('friendships.verificationNotice.body') }}
          </p>
        </div>

        <label class="checkbox-row">
          <input v-model="acknowledged" type="checkbox" class="checkbox">
          <span class="checkbox-label">{{ t('friendships.verificationNotice.acknowledge') }}</span>
        </label>

        <BaseButton
          type="button"
          variant="primary"
          :disabled="!acknowledged"
          @click="emit('acknowledged')"
        >
          {{ t('friendships.verificationNotice.acknowledge') }}
        </BaseButton>
      </div>
    </AdaptiveOverlay>
  </Teleport>
</template>

<style scoped>
.sheet-host--modal {
  z-index: 120;
}

.notice-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.notice-body {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  background-color: color-mix(in srgb, var(--color-primary) 8%, transparent);
}

.notice-icon {
  font-size: 24px;
  color: var(--color-primary);
  flex-shrink: 0;
}

.notice-text {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
  line-height: 1.6;
}

.checkbox-row {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  cursor: pointer;
}

.checkbox {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  margin-top: 2px;
  accent-color: var(--color-primary);
}

.checkbox-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-on-surface);
  line-height: 1.4;
}

/* Confirm uses shared BaseButton (primary). */
</style>
