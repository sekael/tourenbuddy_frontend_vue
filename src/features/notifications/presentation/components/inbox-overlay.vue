<script setup lang="ts">
import type { InboxNotification } from '../../domain/entities/inbox-notification'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AdaptiveOverlay from '@/core/components/adaptive-overlay.vue'
import BaseButton from '@/core/components/base-button.vue'
import BaseIcon from '@/core/components/base-icon.vue'
import { useInboxStore } from '../stores/inbox-store'
import InboxItem from './inbox-item.vue'

const emit = defineEmits<{ close: [], open: [entry: InboxNotification] }>()

const { t } = useI18n({ useScope: 'global' })
const store = useInboxStore()
const { entries, hasMore, isLoading, error } = storeToRefs(store)

const hasUnread = computed(() => entries.value.some(e => !e.readAt))
// Two-step, inline (like attachment delete): clearing is irreversible.
const confirmingClear = ref(false)

function clearAll() {
  confirmingClear.value = false
  store.clearAll()
}

// Entries are static records: a tap opens the subject where acting happens (no inline
// actions, D7). The host decides where that is; reading is recorded here.
function open(entry: InboxNotification) {
  store.markRead(entry.id)
  emit('open', entry)
}

onMounted(() => {
  if (entries.value.length === 0)
    store.load()
})
</script>

<template>
  <AdaptiveOverlay :title="t('inbox.title')" fit-content @close="emit('close')">
    <template #header-actions>
      <BaseButton
        v-if="hasUnread" variant="primary-outline" size="sm"
        data-testid="mark-all-read" @click="store.markAllRead()"
      >
        {{ t('inbox.markAllRead') }}
      </BaseButton>
    </template>

    <div class="content">
      <p v-if="error && entries.length === 0" class="empty">
        {{ t('inbox.loadError') }}
      </p>
      <p v-else-if="!isLoading && entries.length === 0" class="empty" data-testid="inbox-empty">
        <BaseIcon name="notifications" size="xl" class="empty-icon" />
        {{ t('inbox.empty') }}
      </p>
      <ul v-else class="list">
        <InboxItem
          v-for="entry in entries" :key="entry.id" :entry="entry" :stale="store.staleReason(entry)"
          @open="open(entry)" @delete="store.remove(entry.id)"
        />
      </ul>
      <BaseButton
        v-if="hasMore" variant="secondary" class="more" :disabled="isLoading"
        data-testid="load-more" @click="store.loadMore()"
      >
        {{ t('inbox.loadMore') }}
      </BaseButton>
      <div v-if="entries.length > 0" class="clear" :class="{ 'clear--confirm': confirmingClear }">
        <BaseButton
          v-if="!confirmingClear" variant="text" size="sm" data-testid="clear-inbox"
          @click="confirmingClear = true"
        >
          {{ t('inbox.clearAll') }}
        </BaseButton>
        <template v-else>
          <span class="clear-question">{{ t('inbox.clearConfirm') }}</span>
          <BaseButton variant="secondary" size="sm" @click="confirmingClear = false">
            {{ t('inbox.cancel') }}
          </BaseButton>
          <BaseButton variant="danger" size="sm" data-testid="clear-inbox-confirm" @click="clearAll">
            {{ t('inbox.clearAllConfirm') }}
          </BaseButton>
        </template>
      </div>
    </div>
  </AdaptiveOverlay>
</template>

<style scoped>
.content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding-bottom: var(--spacing-md);
}
.list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxs);
  margin: 0;
  padding: 0;
}
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  margin: 0;
  padding: var(--spacing-lg) 0;
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}
.empty-icon {
  color: var(--color-outline-variant);
}
.more {
  align-self: center;
}
.clear {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  padding-top: var(--spacing-sm);
  border-top: 1px solid var(--divider-color);
}
.clear-question {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}
</style>
