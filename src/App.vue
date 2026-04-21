<script setup lang="ts">
import { watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import PwaInstallBanner from '@/core/components/pwa-install-banner.vue'

const { locale } = useI18n({ useScope: 'global' })
watchEffect(() => {
  document.documentElement.lang = locale.value
})
</script>

<template>
  <RouterView />
  <PwaInstallBanner />
</template>
