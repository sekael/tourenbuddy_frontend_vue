<script setup lang="ts">
import BottomSheet from '@/core/components/bottom-sheet.vue'
import DialogWindow from '@/core/components/dialog-window.vue'
import FullScreenPage from '@/core/components/full-screen-page.vue'
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
    /**
     * Data-entry mode. On mobile this swaps the bottom sheet for a full-screen
     * page (no map behind, no drag/snap) so the whole screen serves the form
     * and the on-screen keyboard never fights the sheet. Desktop is unaffected.
     */
    page?: boolean
  }>(),
  {
    fitContent: true,
  },
)

const emit = defineEmits<{ close: [], back: [] }>()

const isDesktop = useIsDesktop()
</script>

<template>
  <FullScreenPage
    v-if="!isDesktop && props.page"
    :title="props.title"
    :aria-label="props.ariaLabel"
    :show-back="props.showBack"
    @close="emit('close')"
    @back="emit('back')"
  >
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps ?? {}" />
    </template>
  </FullScreenPage>

  <BottomSheet
    v-else-if="!isDesktop"
    :title="props.title"
    :aria-label="props.ariaLabel"
    :collapsed="props.collapsed"
    :show-back="props.showBack"
    :fit-content="props.fitContent"
    @close="emit('close')"
    @back="emit('back')"
  >
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps ?? {}" />
    </template>
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
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps ?? {}" />
    </template>
  </DialogWindow>
</template>
