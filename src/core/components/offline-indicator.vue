<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseIcon from '@/core/components/base-icon.vue'
import ErrorSnackbar from '@/core/components/error-snackbar.vue'
import { offlineBlockedAt, offlineWriteError } from '@/core/offline/mutate'
import { isOnline } from '@/core/offline/use-online-status'

// Global offline surface (change: offline-app-cache-sync). The PERSISTENT indicator is
// now icon-only and pinned bottom-left, so it never covers the tour list / creation pill
// (the centered pill did). The explanatory text shows once, briefly, as a snackbar each
// time we drop offline; a blocked mutation still raises its own transient notice.
const { t } = useI18n({ useScope: 'global' })

// Transient explanatory snackbar, shown each time connectivity drops.
const explainVisible = ref(false)
let explainTimer: ReturnType<typeof setTimeout> | null = null
watch(isOnline, (online) => {
  if (online)
    return
  explainVisible.value = true
  if (explainTimer)
    clearTimeout(explainTimer)
  explainTimer = setTimeout(() => {
    explainVisible.value = false
  }, 4000)
})

// Blocked-action notice (a mutation attempted while offline).
const noticeVisible = ref(false)
let noticeTimer: ReturnType<typeof setTimeout> | null = null
watch(offlineBlockedAt, () => {
  noticeVisible.value = true
  if (noticeTimer)
    clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => {
    noticeVisible.value = false
  }, 4000)
})

// Offline-write failure (IndexedDB unavailable / full / unserializable value). The `mutate`
// seam swallows the raw error into `offlineWriteError` (an i18n key); surface it understandably.
const writeErrorVisible = ref(false)
let writeErrorTimer: ReturnType<typeof setTimeout> | null = null
watch(offlineWriteError, (key) => {
  if (!key) {
    writeErrorVisible.value = false
    return
  }
  writeErrorVisible.value = true
  if (writeErrorTimer)
    clearTimeout(writeErrorTimer)
  writeErrorTimer = setTimeout(() => {
    writeErrorVisible.value = false
  }, 5000)
})
</script>

<template>
  <!-- Persistent, icon-only offline chip (bottom-left) — minimal footprint. -->
  <Transition name="chip">
    <div v-if="!isOnline" class="offline-chip" role="status" :aria-label="t('offline.indicator')">
      <BaseIcon name="cloud_off" size="sm" />
    </div>
  </Transition>

  <!-- Transient explanatory snackbar, once per offline transition. -->
  <Transition name="chip">
    <div v-if="explainVisible" class="offline-snackbar" role="status">
      <BaseIcon name="cloud_off" size="sm" />
      <span>{{ t('offline.indicator') }}</span>
    </div>
  </Transition>

  <ErrorSnackbar
    :visible="noticeVisible"
    :message="t('offline.actionUnavailable')"
    @dismiss="noticeVisible = false"
  />

  <ErrorSnackbar
    :visible="writeErrorVisible"
    :message="offlineWriteError ? t(offlineWriteError) : ''"
    @dismiss="writeErrorVisible = false"
  />
</template>

<style scoped>
/* Bottom-left, clear of the top nav and the bottom-right FAB. Sits BELOW the sync
   chip (offline-sync-status stacks above it) and below the transient snackbar. */
.offline-chip {
  position: fixed;
  left: var(--spacing-md);
  bottom: calc(var(--spacing-md) + var(--safe-bottom, 0px));
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xs);
  border-radius: var(--radius-lg);
  background: var(--color-slate-800, #1e293b);
  color: white;
  box-shadow: var(--shadow-md);
  z-index: 190;
}

/* Bottom-center snackbar carrying the explanatory text (shown briefly only). */
.offline-snackbar {
  position: fixed;
  left: 50%;
  bottom: calc(var(--spacing-xl) + var(--safe-bottom, 0px));
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

.chip-enter-active,
.chip-leave-active {
  transition: opacity 0.2s ease;
}

.chip-enter-from,
.chip-leave-to {
  opacity: 0;
}
</style>
