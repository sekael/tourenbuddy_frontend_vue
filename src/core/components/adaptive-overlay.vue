<script setup lang="ts">
import BottomSheet from '@/core/components/bottom-sheet.vue'
import DialogWindow from '@/core/components/dialog-window.vue'
import { useIsDesktop } from '@/core/composables/use-is-desktop'

const props = defineProps<{
  title?: string
  ariaLabel?: string
  collapsed?: boolean
}>()

const emit = defineEmits<{ close: [] }>()

const isDesktop = useIsDesktop()
</script>

<template>
  <BottomSheet
    v-if="!isDesktop"
    :title="props.title"
    :aria-label="props.ariaLabel"
    :collapsed="props.collapsed"
    @close="emit('close')"
  >
    <slot />
  </BottomSheet>

  <DialogWindow
    v-else
    :title="props.title"
    :aria-label="props.ariaLabel"
    :collapsed="props.collapsed"
    @close="emit('close')"
  >
    <slot />
  </DialogWindow>
</template>
