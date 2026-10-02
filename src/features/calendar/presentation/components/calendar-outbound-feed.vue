<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/core/components/base-button.vue'
import BaseIcon from '@/core/components/base-icon.vue'
import { useCalendarFeedStore } from '@/features/calendar/presentation/stores/calendar-feed-store'

const { t } = useI18n({ useScope: 'global' })
const store = useCalendarFeedStore()
const { outboundUrl } = storeToRefs(store)

const copied = ref(false)
// Two-step in place instead of a modal: the old URL dies immediately (design D9).
const confirming = ref(false)

async function copy() {
  if (!outboundUrl.value)
    return
  await navigator.clipboard.writeText(outboundUrl.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

async function regenerate() {
  confirming.value = false
  await store.regenerateToken()
}
</script>

<template>
  <div v-if="outboundUrl" class="outbound">
    <span class="subtitle">{{ t('calendar.sync.outboundTitle') }}</span>
    <p class="hint">
      {{ t('calendar.sync.outboundHint') }}
    </p>
    <div class="url-row">
      <input class="url" :value="outboundUrl" readonly :aria-label="t('calendar.sync.outboundTitle')" @focus="($event.target as HTMLInputElement).select()">
      <BaseButton variant="secondary" size="sm" @click="copy">
        <BaseIcon name="content_copy" />
        {{ copied ? t('calendar.sync.copied') : t('calendar.sync.copy') }}
      </BaseButton>
    </div>
    <div v-if="confirming" class="confirm" role="alert">
      <span>{{ t('calendar.sync.regenerateConfirm') }}</span>
      <BaseButton variant="text" size="sm" @click="confirming = false">
        {{ t('calendar.availability.cancel') }}
      </BaseButton>
      <BaseButton variant="danger" size="sm" @click="regenerate">
        {{ t('calendar.sync.regenerate') }}
      </BaseButton>
    </div>
    <template v-else>
      <p class="hint">
        {{ t('calendar.sync.regenerateHint') }}
      </p>
      <BaseButton variant="text" size="sm" class="regenerate" @click="confirming = true">
        <BaseIcon name="replay" />
        {{ t('calendar.sync.regenerate') }}
      </BaseButton>
    </template>
  </div>
</template>

<style scoped>
.outbound {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.subtitle {
  font-weight: var(--font-weight-medium);
}

.hint,
.confirm {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}

.url-row,
.confirm {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.url {
  flex: 1;
  min-width: 0;
  padding: var(--spacing-sm);
  border: 1.5px solid var(--color-outline-variant);
  border-radius: var(--radius-sm);
  font: inherit;
  font-size: var(--font-size-sm);
  color: var(--color-on-surface);
  background-color: var(--color-background);
}

.regenerate {
  align-self: flex-start;
}
</style>
