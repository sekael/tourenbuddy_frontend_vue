<script setup lang="ts">
import type { WriteQueueEntry } from '@/core/offline/write-queue'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AdaptiveOverlay from '@/core/components/adaptive-overlay.vue'
import BaseIcon from '@/core/components/base-icon.vue'
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
const { t, te } = useI18n({ useScope: 'global' })

// Refresh on launch and whenever an enqueue or a drain changes the queue.
onMounted(refreshQueueStatus)
watch([savedOfflineAt, drainedAt], refreshQueueStatus)

// The persistent pill is icon+count only (bottom-left) so it never covers the tour list.
// The "N waiting to be synced" text shows briefly as a snackbar only on the FIRST pending
// change (queue 0 → >0); once something is already queued, later changes just bump the
// icon+count chip. This keeps the text from re-firing on every single edit.
const pendingText = ref(false)
let pendingTimer: ReturnType<typeof setTimeout> | null = null
watch(pendingCount, (n, prev) => {
  if (prev === 0 && n > 0) {
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

// Dead-letter banner collapses to an icon; hover (desktop) or tap (mobile) expands it to
// text + review. Expansion is sticky for 5s regardless of pointer position, so the label
// doesn't vanish the instant the cursor drifts off.
const deadLetterExpanded = ref(false)
let expandTimer: ReturnType<typeof setTimeout> | null = null
function expandDeadLetter() {
  deadLetterExpanded.value = true
  if (expandTimer)
    clearTimeout(expandTimer)
  expandTimer = setTimeout(() => {
    deadLetterExpanded.value = false
  }, 5000)
}
onUnmounted(() => {
  if (expandTimer)
    clearTimeout(expandTimer)
})

// core/ never imports feature domain types (layering), so read the entity name structurally
// from the queued payload / pre-edit snapshot: `name` (tour), `displayName` or first+last (contact).
function readName(o: unknown): string | null {
  if (!o || typeof o !== 'object')
    return null
  const r = o as Record<string, unknown>
  if (typeof r.name === 'string' && r.name.trim())
    return r.name.trim()
  if (typeof r.displayName === 'string' && r.displayName.trim())
    return r.displayName.trim()
  const first = typeof r.firstName === 'string' ? r.firstName.trim() : ''
  const last = typeof r.lastName === 'string' ? r.lastName.trim() : ''
  return `${first} ${last}`.trim() || null
}

function entityName(entry: WriteQueueEntry): string | null {
  const p = entry.payload as Record<string, unknown> | null
  // create/update wrap the entity (`{ draft }` tour, `{ contact }`); delete carries only baseSnapshot.
  for (const candidate of [p?.draft, p?.contact, entry.baseSnapshot]) {
    const name = readName(candidate)
    if (name)
      return name
  }
  return null
}

// Human-readable action, e.g. "Update tour Piz Buin" / "Delete contact Anna" — never "tour (update)".
function entryLabel(entry: WriteQueueEntry): string {
  const kindKey = `offlineSync.deadLetter.kind.${entry.kind}`
  const kindLabel = te(kindKey) ? t(kindKey) : entry.kind
  const name = entityName(entry)
  const entity = name ? `${kindLabel} ${name}` : kindLabel
  return t(`offlineSync.deadLetter.op.${entry.op}`, { entity })
}

// Why it failed — also gates the Retry button: only a transient outage can flip on retry.
function reasonText(entry: WriteQueueEntry): string | null {
  if (entry.deadReason === 'conflict')
    return t('offlineSync.conflictLost')
  if (entry.deadReason === 'transient')
    return t('offlineSync.deadLetter.transientReason')
  if (entry.deadReason === 'permanent')
    return t('offlineSync.deadLetter.permanentReason')
  return null
}
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

  <!-- Dead-letter banner: bottom-left, collapsed to a warning icon. Hover (desktop) or
       tap (mobile) expands it to the message + review action. Hidden while the review
       surface is open so it never floats over the desktop dialog. -->
  <Transition name="sync-toast">
    <div
      v-if="deadLetters.length > 0 && !reviewOpen"
      class="sync-deadletter"
      :class="{ 'sync-deadletter--expanded': deadLetterExpanded }"
      role="status"
      @click="expandDeadLetter"
      @mouseenter="expandDeadLetter"
    >
      <BaseIcon name="warning" size="sm" />
      <span class="dl-body">
        <span class="dl-text">{{ t('offlineSync.deadLetter.banner', { count: deadLetters.length }) }}</span>
        <button type="button" class="dl-review" @click.stop="reviewOpen = true">
          {{ t('offlineSync.deadLetter.review') }}
        </button>
      </span>
    </div>
  </Transition>

  <!-- Review surface: AdaptiveOverlay = bottom sheet on mobile, centered dialog on desktop
       (same primitive as contacts / friend requests). Teleported to body over every route
       surface. The host is a fixed, bottom-anchored scrim on mobile; on desktop it collapses
       to `display: contents` so DialogWindow self-centers with its own backdrop. -->
  <Teleport to="body">
    <div v-if="reviewOpen" class="review-host" @click.self="reviewOpen = false">
      <AdaptiveOverlay
        :title="t('offlineSync.deadLetter.title')"
        @close="reviewOpen = false"
      >
        <p v-if="deadLetters.length === 0" class="deadletter-empty">
          {{ t('offlineSync.deadLetter.empty') }}
        </p>
        <ul v-else class="deadletter-list">
          <li v-for="entry in deadLetters" :key="entry.entityId" class="deadletter-item">
            <div class="meta">
              <span class="what">{{ entryLabel(entry) }}</span>
              <span v-if="reasonText(entry)" class="reason">
                {{ reasonText(entry) }}
              </span>
            </div>
            <div class="actions">
              <!-- Retry only for a transient outage — a conflict/permanent failure re-fails identically. -->
              <button v-if="entry.deadReason === 'transient'" class="retry" @click="retryDeadLettered(entry.entityId)">
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
      </AdaptiveOverlay>
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

/* Collapsed = a warning icon anchored in the bottom-left corner (the offline-chip slot,
   z-index above it so it wins the rare offline+dead-letter overlap). Expanding raises it
   above the bottom action pill AND reveals the text/button — both animate together.
   // ponytail: corner overlap with the offline/pending chips is left as-is — after the
   // drain-connectivity fix, being offline WITH a dead letter is rare and transient. */
.sync-deadletter {
  position: fixed;
  bottom: calc(var(--spacing-md) + var(--safe-bottom, 0px));
  left: var(--spacing-md);
  display: flex;
  align-items: center;
  gap: 0;
  padding: var(--spacing-xs);
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
  transition:
    bottom 0.28s cubic-bezier(0.4, 0, 0.2, 1),
    padding 0.28s cubic-bezier(0.4, 0, 0.2, 1);
}

.sync-deadletter--expanded {
  bottom: calc(var(--spacing-md) + var(--safe-bottom, 0px) + 6rem);
  padding: var(--spacing-xs) var(--spacing-md);
}

/* Text + review action, clipped to zero width until the banner expands. */
.sync-deadletter .dl-body {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  max-width: 0;
  opacity: 0;
  overflow: hidden;
  white-space: nowrap;
  transition:
    max-width 0.25s ease,
    opacity 0.2s ease;
}

.sync-deadletter--expanded .dl-body {
  max-width: 70vw;
  opacity: 1;
}

.sync-deadletter .dl-text {
  margin-left: var(--spacing-xs);
}

.sync-deadletter .dl-review {
  color: white;
  text-decoration: underline;
  cursor: pointer;
}

/* Fixed, bottom-anchored scrim host for the mobile bottom sheet. Above every route
   surface (offline chips sit at ~210; routes/sheets well below 400). On desktop it
   collapses to `display: contents` so DialogWindow self-centers with its own backdrop. */
.review-host {
  position: fixed;
  inset: 0;
  z-index: 400;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: var(--color-backdrop-strong, rgba(15, 23, 42, 0.45));
}

@media (min-width: 600px) {
  .review-host {
    display: contents;
  }
}

.deadletter-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.deadletter-empty {
  padding: var(--spacing-md) 0;
  font-size: 0.875rem;
  color: var(--color-slate-500, #64748b);
  text-align: center;
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
