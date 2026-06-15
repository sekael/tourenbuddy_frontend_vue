<script setup lang="ts">
import BottomSheet from '@/core/components/bottom-sheet.vue'
import DialogWindow from '@/core/components/dialog-window.vue'
import { useIsDesktop } from '@/core/composables/use-is-desktop'

// fitContent defaults to true: every adaptive-overlay sheet fits its content on
// mobile unless a consumer explicitly opts back into snap with :fit-content="false".
const props = withDefaults(
  defineProps<{
    title?: string
    ariaLabel?: string
    collapsed?: boolean
    showBack?: boolean
    fitContent?: boolean
  }>(),
  {
    fitContent: true,
  },
)

const emit = defineEmits<{ close: [], back: [] }>()

const isDesktop = useIsDesktop()
</script>

<template>
  <BottomSheet
    v-if="!isDesktop"
    :title="props.title"
    :aria-label="props.ariaLabel"
    :collapsed="props.collapsed"
    :show-back="props.showBack"
    :fit-content="props.fitContent"
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
