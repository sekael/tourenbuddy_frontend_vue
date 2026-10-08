<script setup lang="ts">
import type { InboxNotification } from '../../domain/entities/inbox-notification'
import { storeToRefs } from 'pinia'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import AdaptiveOverlay from '@/core/components/adaptive-overlay.vue'
import BaseButton from '@/core/components/base-button.vue'
import BaseIconButton from '@/core/components/base-icon-button.vue'
import { useInboxStore } from '../stores/inbox-store'
import InboxItem from './inbox-item.vue'

const emit = defineEmits<{ close: [], open: [entry: InboxNotification] }>()

const { t } = useI18n({ useScope: 'global' })
const store = useInboxStore()
const { entries, hasMore, isLoading, error } = storeToRefs(store)

const hasUnread = computed(() => entries.value.some(e => !e.readAt))

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
      <BaseIconButton
        name="done_all" :label="t('inbox.markAllRead')" :disabled="!hasUnread"
        data-testid="mark-all-read" @click="store.markAllRead()"
      />
    </template>

    <div class="content">
      <p v-if="error && entries.length === 0" class="empty">
        {{ t('inbox.loadError') }}
      </p>
      <p v-else-if="!isLoading && entries.length === 0" class="empty" data-testid="inbox-empty">
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
  margin: 0;
  padding: var(--spacing-lg) 0;
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}
.more {
  align-self: center;
}
</style>
