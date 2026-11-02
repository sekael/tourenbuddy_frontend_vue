<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import BaseIcon from '@/core/components/base-icon.vue'
import { pace } from '@/core/composables/use-pace'

/**
 * The user's pace beside a time taken at it — tortoise or hare and the percent — whenever it is off
 * the standard, so a time never changes unexplained.
 */
const { t } = useI18n({ useScope: 'global' })
</script>

<template>
  <span v-if="pace !== 100" class="pace-note" data-testid="pace-note">
    <BaseIcon :name="pace < 100 ? 'snail' : 'cruelty_free'" size="xs" class="pace-icon" />
    <span class="visually-hidden">{{ t('tours.route.pace') }}</span>
    {{ pace }}&nbsp;%
  </span>
</template>

<style scoped>
.pace-icon {
  vertical-align: -0.2em;
}
</style>
