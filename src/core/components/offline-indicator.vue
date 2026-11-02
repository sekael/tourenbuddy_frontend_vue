<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { sessionUnverified } from '@/core/auth/session-trust'
import BaseIcon from '@/core/components/base-icon.vue'
import ErrorSnackbar from '@/core/components/error-snackbar.vue'
import { useSnackbarSlot } from '@/core/composables/use-snackbar'
import { offlineBlockedAt, offlineWriteError } from '@/core/offline/mutate'
import { pendingCount } from '@/core/offline/queue-status'
import { isOnline } from '@/core/offline/use-online-status'

// Global offline surface (change: ios-status-bar-offline-bar). The PERSISTENT status is a slim
// bar at the top that takes its own band (safe-area.css), so it never covers a control the way the
// floating corner chips did: offline, or changes still waiting to sync, with their count. A
// blocked mutation or a failed offline write still raises its own transient notice.
const { t } = useI18n({ useScope: 'global' })

// A session restored from storage without a successful token refresh: we're serving
// cached data on an unproven session, which reads as "offline" to the user even when the
// device claims connectivity (change: auth-session-restore-redirect, design D7).
const degraded = computed(() => !isOnline.value || sessionUnverified.value)

const barText = computed(() => {
  const count = pendingCount.value
  if (degraded.value && count > 0)
    return t('offline.bar.waiting', { count })
  if (degraded.value)
    return sessionUnverified.value ? t('offline.bar.unverified') : t('offline.bar.offline')
  return count > 0 ? t('offlineSync.pendingCount', { count }) : ''
})
// The last text and icon stay while the band closes, so the bar doesn't empty before it shrinks.
const shown = ref({ text: '', icon: 'cloud_off' })
watch([barText, degraded], ([text, off]) => {
  if (text)
    shown.value = { text, icon: off ? 'cloud_off' : 'sync_alt' }
}, { immediate: true })

// Blocked-action notice (a mutation attempted while offline).
const noticeVisible = ref(false)
const claimNotice = useSnackbarSlot(() => noticeVisible.value = false)
let noticeTimer: ReturnType<typeof setTimeout> | null = null
watch(offlineBlockedAt, () => {
  claimNotice()
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
const claimWriteError = useSnackbarSlot(() => writeErrorVisible.value = false)
let writeErrorTimer: ReturnType<typeof setTimeout> | null = null
watch(offlineWriteError, (key) => {
  if (!key) {
    writeErrorVisible.value = false
    return
  }
  claimWriteError()
  writeErrorVisible.value = true
  if (writeErrorTimer)
    clearTimeout(writeErrorTimer)
  writeErrorTimer = setTimeout(() => {
    writeErrorVisible.value = false
  }, 5000)
})
</script>

<template>
  <!-- Always in the DOM, so the live region announces each change of its text. -->
  <div class="offline-bar" :class="{ 'offline-bar--on': barText }" role="status">
    <BaseIcon :name="shown.icon" size="sm" />
    <span class="offline-bar-text">{{ shown.text }}</span>
  </div>

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
/* Under the system status bar, full width; its height is the band safe-area.css opens for it, so
   the bar grows and shrinks with the space the page gives up. */
.offline-bar {
  position: fixed;
  top: env(safe-area-inset-top, 0px);
  left: 0;
  right: 0;
  height: var(--offline-bar-height);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  padding: 0 calc(var(--spacing-md) + var(--safe-right)) 0 calc(var(--spacing-md) + var(--safe-left));
  background: var(--color-inverse-surface);
  color: var(--color-on-inverse-surface);
  font-size: 0.8125rem;
  font-weight: var(--font-weight-medium);
  z-index: 190;
}

/* Its words hide (also from screen readers) once the band has closed; the bar itself stays visible,
   as the strip iOS colors the status bar from (safe-area.css). */
.offline-bar:not(.offline-bar--on) > * {
  visibility: hidden;
  transition: visibility 0s var(--motion-duration-medium);
}

.offline-bar-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
