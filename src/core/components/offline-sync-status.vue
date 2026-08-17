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
// offline, so unsynced work is always visible — DC7) and a dead-letter review surface
// (retry / discard). The enqueue itself surfaces via the transient pending-count snackbar.
const { t } = useI18n({ useScope: 'global' })

// Refresh on launch and whenever an enqueue or a drain changes the queue.
onMounted(refreshQueueStatus)
watch([savedOfflineAt, drainedAt], refreshQueueStatus)

// The persistent pill is now icon+count only (bottom-left) so it never covers the
// tour list. The "N waiting to be synced" text shows briefly as a snackbar whenever the
// pending count grows; it then collapses to the icon+count chip.
const pendingText = ref(false)
let pendingTimer: ReturnType<typeof setTimeout> | null = null
watch(pendingCount, (n, prev) => {
  if (n > 0 && n !== prev) {
    pendingText.value = true
    if (pendingTimer)
      clearTimeout(pendingTimer)
    pendingTimer = setTimeout(() => {
      pendingText.value = false
    }, 4000)
  }
  else if (n === 0) {
    pendingText.value = false
  }
})

const reviewOpen = ref(false)
</script>

<template>
  <!-- Durable pending-sync chip: icon + count only (bottom-left, above the offline chip). -->
  <Transition name="sync-toast">
    <div
      v-if="pendingCount > 0"
      class="sync-chip"
      role="status"
      :aria-label="t('offlineSync.pendingCount', { count: pendingCount })"
    >
      <BaseIcon name="sync_alt" size="sm" />
      <span class="sync-count">{{ pendingCount }}</span>
    </div>
  </Transition>

  <!-- Transient pending text, shown briefly whenever the pending count grows. -->
  <Transition name="sync-toast">
    <div v-if="pendingText" class="sync-toast sync-toast--pending" role="status">
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

  <!-- BottomSheet is unpositioned (width:100%); it needs a fixed, bottom-anchored host or
       it renders in flow behind the full-screen route page. Teleport to body so no route's
       `position: fixed` / stacking context can bury it, and back it with a click-to-close scrim. -->
  <Teleport to="body">
    <div v-if="reviewOpen" class="review-scrim" @click="reviewOpen = false">
      <div class="review-host" @click.stop>
        <BottomSheet
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
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.sync-toast {
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

/* Pending-text snackbar sits just above the saved toast slot so both can show at once. */
.sync-toast--pending {
  bottom: calc(var(--spacing-xl) + var(--safe-bottom, 0px) + 3rem);
}

/* Persistent icon+count chip, bottom-left, stacked just above the offline chip
   (offline-indicator anchors at --spacing-md; +3rem clears it). */
.sync-chip {
  position: fixed;
  left: var(--spacing-md);
  bottom: calc(var(--spacing-md) + var(--safe-bottom, 0px) + 3rem);
  display: flex;
  align-items: center;
  gap: var(--spacing-xxs);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-lg);
  background: var(--color-slate-800, #1e293b);
  color: white;
  font-size: 0.8125rem;
  font-weight: 600;
  box-shadow: var(--shadow-md);
  z-index: 191;
}

.sync-count {
  font-variant-numeric: tabular-nums;
}

.sync-deadletter {
  position: fixed;
  bottom: calc(var(--spacing-md) + var(--safe-bottom, 0px) + 6rem);
  left: var(--spacing-md);
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

/* Fixed, bottom-anchored modal host for the review sheet + a click-to-close scrim.
   Above every route surface (the offline chips sit at ~190; routes/sheets well below 400). */
.review-scrim {
  position: fixed;
  inset: 0;
  z-index: 400;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: var(--color-backdrop-strong, rgba(15, 23, 42, 0.45));
}

.review-host {
  width: 100%;
  max-width: var(--bottom-sheet-max-width, 480px);
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

/* Left-anchored chips/banner have no translateX base — slide straight up instead. */
.sync-chip.sync-toast-enter-from,
.sync-chip.sync-toast-leave-to,
.sync-deadletter.sync-toast-enter-from,
.sync-deadletter.sync-toast-leave-to {
  opacity: 0;
  transform: translateY(100%);
}
</style>
