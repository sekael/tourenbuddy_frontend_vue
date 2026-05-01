<script setup lang="ts">
import BottomSheet from '@/core/components/bottom-sheet.vue'
import DialogWindow from '@/core/components/dialog-window.vue'
import { useIsDesktop } from '@/core/composables/use-is-desktop'

const props = defineProps<{
  title?: string
  ariaLabel?: string
  collapsed?: boolean
  showBack?: boolean
}>()

const emit = defineEmits<{ close: []; back: [] }>()

const isDesktop = useIsDesktop()
</script>

<template>
  <BottomSheet
    v-if="!isDesktop"
    :title="props.title"
    :aria-label="props.ariaLabel"
    :collapsed="props.collapsed"
    :show-back="props.showBack"
    @close="emit('close')"
    @back="emit('back')"
  >
    <slot />
  </BottomSheet>

  <DialogWindow
    v-else
    :title="props.title"
    :aria-label="props.ariaLabel"
    :collapsed="props.collapsed"
    :show-back="props.showBack"
    @close="emit('close')"
    @back="emit('back')"
  >
    <slot />
  </DialogWindow>
</template>
