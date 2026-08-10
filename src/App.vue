<script setup lang="ts">
import { onMounted, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import OfflineIndicator from '@/core/components/offline-indicator.vue'
import PwaInstallBanner from '@/core/components/pwa-install-banner.vue'
import UpdatePrompt from '@/core/components/update-prompt.vue'
import { confirmConnectivity } from '@/core/offline/use-online-status'

const { locale } = useI18n({ useScope: 'global' })
watchEffect(() => {
  document.documentElement.lang = locale.value
})

// Correct a stuck "online" signal on a cold offline boot (navigator.onLine can
// lie when the SW serves the shell offline). Downgrade-only; safe if truly online.
onMounted(confirmConnectivity)
</script>

<template>
  <RouterView />
  <OfflineIndicator />
  <PwaInstallBanner />
  <UpdatePrompt />
</template>
