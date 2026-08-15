<script setup lang="ts">
import { onMounted, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import OfflineIndicator from '@/core/components/offline-indicator.vue'
import OfflineSyncStatus from '@/core/components/offline-sync-status.vue'
import PwaInstallBanner from '@/core/components/pwa-install-banner.vue'
import UpdatePrompt from '@/core/components/update-prompt.vue'
import { registerFlushTriggers } from '@/core/offline/flush-triggers'
import { confirmConnectivity } from '@/core/offline/use-online-status'

const { locale } = useI18n({ useScope: 'global' })
watchEffect(() => {
  document.documentElement.lang = locale.value
})

// Correct a stuck "online" signal on a cold offline boot (navigator.onLine can
// lie when the SW serves the shell offline). Downgrade-only; safe if truly online.
onMounted(confirmConnectivity)

// Kickstart a write-queue drain on foreground / regained connectivity (DC7).
onMounted(registerFlushTriggers)
</script>

<template>
  <RouterView />
  <OfflineIndicator />
  <OfflineSyncStatus />
  <PwaInstallBanner />
  <UpdatePrompt />
</template>
