<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseIcon from '@/core/components/base-icon.vue'
import ErrorSnackbar from '@/core/components/error-snackbar.vue'
import { useIsDesktop } from '@/core/composables/use-is-desktop'
import { offlineBlockedAt } from '@/core/offline/mutate'
import { isOnline } from '@/core/offline/use-online-status'

// Global offline surface (change: offline-app-cache-sync): a persistent pill while
// offline (so every route signals cached data), plus a transient notice each time a
// mutation is blocked offline (the `mutate` seam bumps `offlineBlockedAt`).
const { t } = useI18n({ useScope: 'global' })
const isDesktop = useIsDesktop()

const noticeVisible = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

watch(offlineBlockedAt, () => {
  noticeVisible.value = true
  if (timer)
    clearTimeout(timer)
  timer = setTimeout(() => {
    noticeVisible.value = false
  }, 4000)
})
</script>

<template>
  <Transition name="offline-pill">
    <div v-if="!isOnline" class="offline-pill" :class="{ 'offline-pill--desktop': isDesktop }" role="status">
      <BaseIcon name="cloud_off" size="sm" />
      <span>{{ t('offline.indicator') }}</span>
    </div>
  </Transition>

  <ErrorSnackbar
    :visible="noticeVisible"
    :message="t('offline.actionUnavailable')"
    @dismiss="noticeVisible = false"
  />
</template>

<style scoped>
.offline-pill {
  position: fixed;
  /* Clear the top app-bar / sheet header (Save button lives there) on mobile — the
     desktop variant overrides `top` to sit bottom-left. */
  top: calc(var(--spacing-sm) + var(--safe-top, 0px) + 3.5rem);
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
  z-index: 300;
  max-width: 90vw;
}

.offline-pill-enter-active,
.offline-pill-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.offline-pill-enter-from,
.offline-pill-leave-to {
  opacity: 0;
  transform: translate(-50%, -100%);
}

/* Desktop: the top-center pill overlaps the top-nav back/help controls. Anchor it
   bottom-left instead — clear of the top nav and the bottom-right FAB, and the
   transient offline notice keeps its own bottom-center slot. */
.offline-pill--desktop {
  top: auto;
  left: var(--spacing-md);
  bottom: calc(var(--spacing-md) + var(--safe-bottom, 0px));
  transform: none;
  /* Below the transient offline notice (ErrorSnackbar, z-index 200) so a blocked-
     action snackbar overlapping the bottom-left pill renders on top of it. */
  z-index: 190;
}

.offline-pill--desktop.offline-pill-enter-from,
.offline-pill--desktop.offline-pill-leave-to {
  transform: translateY(100%);
}
</style>
