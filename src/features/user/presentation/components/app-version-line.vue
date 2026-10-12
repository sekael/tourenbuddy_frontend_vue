<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { appVersionLabel } from '@/core/utils/app-version'

const { t } = useI18n({ useScope: 'global' })
const version = appVersionLabel()
</script>

<template>
  <p class="version" data-testid="app-version">
    {{ t('user.profile.version', { version }) }}
  </p>
</template>

<style scoped>
.version {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
  text-align: center;
}
</style>
