<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BottomSheet from '@/core/components/bottom-sheet.vue'
import DialogWindow from '@/core/components/dialog-window.vue'
import { useIsDesktop } from '@/core/composables/use-is-desktop'

const props = withDefaults(defineProps<{
  /** Number of friend sibling tours the current tour is linked with. */
  linkedCount: number
  /** Number of pending requests that would be invalidated. */
  pendingCount?: number
  /**
   * 'linked' = tour is in a group;
   * 'pending-outgoing' = only outgoing pending requests affected (user initiated);
   * 'pending-incoming' = only incoming pending requests affected (others initiated);
   * 'pending-mixed' = both directions involved.
   */
  mode?: 'linked' | 'pending-outgoing' | 'pending-incoming' | 'pending-mixed'
}>(), { pendingCount: 0, mode: 'linked' })

const emit = defineEmits<{ confirm: [], cancel: [] }>()

const { t } = useI18n({ useScope: 'global' })
const isDesktop = useIsDesktop()

const title = computed(() => {
  if (props.mode === 'linked')
    return t('tourLinks.editWarningTitle')
  if (props.mode === 'pending-outgoing')
    return t('tourLinks.editWarningPendingTitle')
  // incoming + mixed: frame around incoming requests to this tour
  return t('tourLinks.editWarningIncomingTitle')
})

const body = computed(() => {
  if (props.mode === 'linked')
    return t('tourLinks.editWarningBody', { count: props.linkedCount })
  if (props.mode === 'pending-outgoing')
    return t('tourLinks.editWarningPendingBody', { count: props.pendingCount })
  return t('tourLinks.editWarningIncomingBody', { count: props.pendingCount })
})

const proceedLabel = computed(() => {
  if (props.mode === 'linked')
    return t('tourLinks.editWarningProceedBtn')
  return t('tourLinks.editWarningProceedPendingBtn')
})
</script>

<template>
  <Teleport to="body">
    <!-- Desktop: centered modal. -->
    <DialogWindow v-if="isDesktop" :title="title" @close="emit('cancel')">
      <div class="body">
        <p>{{ body }}</p>
        <p class="hint">
          {{ t('tourLinks.editWarningHint') }}
        </p>
      </div>
      <div class="actions">
        <button type="button" class="btn" @click="emit('cancel')">
          {{ t('tours.infoSheet.cancelBtn') }}
        </button>
        <button type="button" class="btn btn--danger" @click="emit('confirm')">
          {{ proceedLabel }}
        </button>
      </div>
    </DialogWindow>

    <!-- Mobile/PWA: bottom sheet stacked above the edit sheet. -->
    <div v-else class="sheet-container" @click.self="emit('cancel')">
      <BottomSheet :title="title" fit-content @close="emit('cancel')">
        <div class="body">
          <p>{{ body }}</p>
          <p class="hint">
            {{ t('tourLinks.editWarningHint') }}
          </p>
        </div>
        <div class="actions">
          <button type="button" class="btn" @click="emit('cancel')">
            {{ t('tours.infoSheet.cancelBtn') }}
          </button>
          <button type="button" class="btn btn--danger" @click="emit('confirm')">
            {{ proceedLabel }}
          </button>
        </div>
      </BottomSheet>
    </div>
  </Teleport>
</template>

<style scoped>
.body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
}

.hint {
  color: var(--color-on-surface-variant);
  font-size: var(--font-size-sm);
  margin: 0;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: 0 var(--spacing-md) var(--spacing-md);
}

/* Desktop dialog: conventional row, actions bottom-right. */
@media (min-width: 600px) {
  .actions {
    flex-direction: row;
    justify-content: flex-end;
  }
}

.btn {
  padding: var(--spacing-xs) var(--spacing-md);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-sm);
  background: transparent;
  cursor: pointer;
}

.btn--danger {
  background: var(--color-error);
  color: var(--color-on-error);
  border-color: var(--color-error);
}

/* Mobile bottom-sheet backdrop. Teleported to body, z-index above the edit
   sheet (sheet-container z-index 50) so the warning stacks on top. */
.sheet-container {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 60;
  background: rgba(15, 23, 42, 0.35);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
}
</style>
