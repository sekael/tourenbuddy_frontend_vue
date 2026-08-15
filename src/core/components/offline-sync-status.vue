<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseIcon from '@/core/components/base-icon.vue'
import BottomSheet from '@/core/components/bottom-sheet.vue'
import { savedOfflineAt } from '@/core/offline/mutate'
import {
  deadLetters,
  discardDeadLettered,
  pendingCount,
  refreshQueueStatus,
  retryDeadLettered,
} from '@/core/offline/queue-status'
import { drainedAt } from '@/core/offline/replay'

// Section 8 UI: a DURABLE pending-sync indicator (reads the queue on every launch, even
// offline, so unsynced work is always visible — DC7), a transient "saved offline" toast,
// and a dead-letter review surface (retry / discard).
const { t } = useI18n({ useScope: 'global' })

// Refresh on launch and whenever an enqueue or a drain changes the queue.
onMounted(refreshQueueStatus)
watch([savedOfflineAt, drainedAt], refreshQueueStatus)

// Transient "saved offline" toast, driven by the enqueue signal.
const savedToast = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null
watch(savedOfflineAt, (v) => {
  if (v === 0)
    return
  savedToast.value = true
  if (timer)
    clearTimeout(timer)
  timer = setTimeout(() => {
    savedToast.value = false
  }, 3000)
})

const reviewOpen = ref(false)
</script>

<template>
  <!-- Saved-offline toast -->
  <Transition name="sync-toast">
    <div v-if="savedToast" class="sync-toast" role="status">
      <BaseIcon name="schedule" size="sm" />
      <span>{{ t('offlineSync.savedOffline') }}</span>
    </div>
  </Transition>

  <!-- Durable pending-sync pill -->
  <Transition name="sync-toast">
    <div v-if="pendingCount > 0" class="sync-pill" role="status">
      <BaseIcon name="sync_alt" size="sm" />
      <span>{{ t('offlineSync.pendingCount', { count: pendingCount }) }}</span>
    </div>
  </Transition>

  <!-- Dead-letter banner -->
  <Transition name="sync-toast">
    <button v-if="deadLetters.length > 0" class="sync-deadletter" @click="reviewOpen = true">
      <BaseIcon name="warning" size="sm" />
      <span>{{ t('offlineSync.deadLetter.banner', { count: deadLetters.length }) }}</span>
      <span class="review">{{ t('offlineSync.deadLetter.review') }}</span>
    </button>
  </Transition>

  <BottomSheet
    v-if="reviewOpen"
    :title="t('offlineSync.deadLetter.title')"
    fit-content
    @close="reviewOpen = false"
  >
    <ul class="deadletter-list">
      <li v-for="entry in deadLetters" :key="entry.entityId" class="deadletter-item">
        <div class="meta">
          <span class="what">{{ t('offlineSync.deadLetter.entry', { kind: entry.kind, op: entry.op }) }}</span>
          <span v-if="entry.deadReason === 'conflict'" class="reason">
            {{ t('offlineSync.conflictLost') }}
          </span>
        </div>
        <div class="actions">
          <button class="retry" @click="retryDeadLettered(entry.entityId)">
            <BaseIcon name="sync_alt" size="sm" />
            {{ t('offlineSync.deadLetter.retry') }}
          </button>
          <button class="discard" @click="discardDeadLettered(entry.entityId)">
            <BaseIcon name="delete" size="sm" />
            {{ t('offlineSync.deadLetter.discard') }}
          </button>
        </div>
      </li>
    </ul>
  </BottomSheet>
</template>

<style scoped>
.sync-toast,
.sync-pill {
  position: fixed;
  bottom: calc(var(--spacing-xl) + var(--safe-bottom, 0px));
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-lg);
  background: var(--color-slate-800, #1e293b);
  color: white;
  font-size: 0.8125rem;
  font-weight: 500;
  box-shadow: var(--shadow-md);
  z-index: 210;
  max-width: 90vw;
}

/* Pending pill sits just above the saved toast slot so both can show at once. */
.sync-pill {
  bottom: calc(var(--spacing-xl) + var(--safe-bottom, 0px) + 3rem);
}

.sync-deadletter {
  position: fixed;
  bottom: calc(var(--spacing-xl) + var(--safe-bottom, 0px) + 6rem);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-md);
  border: none;
  border-radius: var(--radius-lg);
  background: var(--color-amber-600, #d97706);
  color: white;
  font-size: 0.8125rem;
  font-weight: 500;
  box-shadow: var(--shadow-md);
  z-index: 210;
  max-width: 90vw;
  cursor: pointer;
}

.sync-deadletter .review {
  text-decoration: underline;
}

.deadletter-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.deadletter-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  background: var(--color-slate-100, #f1f5f9);
}

.deadletter-item .meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.deadletter-item .reason {
  font-size: 0.75rem;
  color: var(--color-amber-700, #b45309);
}

.deadletter-item .actions {
  display: flex;
  gap: var(--spacing-xs);
}

.deadletter-item button {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xxs);
  padding: var(--spacing-xxs) var(--spacing-sm);
  border: 1px solid var(--color-slate-300, #cbd5e1);
  border-radius: var(--radius-sm);
  background: white;
  font-size: 0.8125rem;
  cursor: pointer;
}

.deadletter-item .discard {
  color: var(--color-red-600, #dc2626);
}

.sync-toast-enter-active,
.sync-toast-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.sync-toast-enter-from,
.sync-toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 100%);
}
</style>
