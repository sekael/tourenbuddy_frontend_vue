<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/core/components/base-button.vue'
import BottomSheet from '@/core/components/bottom-sheet.vue'
import DialogWindow from '@/core/components/dialog-window.vue'
import { fadeOut, useExitAnimation } from '@/core/composables/use-exit-animation'
import { useIsDesktop } from '@/core/composables/use-is-desktop'

// Change: add-native-backend (account-deletion). Names what goes; the owner runs the call.
const props = defineProps<{ deleting: boolean, error: string | null }>()
const emit = defineEmits<{ confirm: [], cancel: [] }>()

function cancel() {
  if (!props.deleting)
    emit('cancel')
}

const { t } = useI18n({ useScope: 'global' })
const isDesktop = useIsDesktop()

const hostEl = ref<HTMLElement | null>(null)
useExitAnimation(hostEl, fadeOut)
</script>

<template>
  <Teleport to="body">
    <!-- Desktop: centered modal. While deleting, it cannot be dismissed. -->
    <DialogWindow v-if="isDesktop" :title="t('user.profile.deleteAccount.title')" @close="cancel">
      <div class="body">
        <p>{{ t('user.profile.deleteAccount.body') }}</p>
        <p class="hint">
          {{ t('user.profile.deleteAccount.hint') }}
        </p>
        <p v-if="error" class="error" role="alert">
          {{ error }}
        </p>
      </div>
      <div class="actions">
        <BaseButton type="button" variant="secondary" size="sm" :disabled="deleting" @click="emit('cancel')">
          {{ t('user.shared.cancelBtn') }}
        </BaseButton>
        <BaseButton type="button" variant="danger" size="sm" :disabled="deleting" data-testid="delete-account-confirm" @click="emit('confirm')">
          {{ deleting ? t('user.profile.deleteAccount.deleting') : t('user.profile.deleteAccount.confirmBtn') }}
        </BaseButton>
      </div>
    </DialogWindow>

    <!-- Mobile: bottom sheet stacked above the profile sheet. -->
    <div v-else ref="hostEl" class="sheet-host sheet-host--modal" @click.self="cancel">
      <BottomSheet :title="t('user.profile.deleteAccount.title')" fit-content @close="cancel">
        <div class="body">
          <p>{{ t('user.profile.deleteAccount.body') }}</p>
          <p class="hint">
            {{ t('user.profile.deleteAccount.hint') }}
          </p>
          <p v-if="error" class="error" role="alert">
            {{ error }}
          </p>
        </div>
        <div class="actions">
          <BaseButton type="button" variant="secondary" size="sm" :disabled="deleting" @click="emit('cancel')">
            {{ t('user.shared.cancelBtn') }}
          </BaseButton>
          <BaseButton type="button" variant="danger" size="sm" :disabled="deleting" data-testid="delete-account-confirm" @click="emit('confirm')">
            {{ deleting ? t('user.profile.deleteAccount.deleting') : t('user.profile.deleteAccount.confirmBtn') }}
          </BaseButton>
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

.body p {
  margin: 0;
}

.hint {
  color: var(--color-on-surface-variant);
  font-size: var(--font-size-sm);
}

.error {
  color: var(--color-error);
  font-size: var(--font-size-sm);
}

.actions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: 0 var(--spacing-md) var(--spacing-md);
}

@media (min-width: 600px) {
  .actions {
    flex-direction: row;
    justify-content: flex-end;
  }
}

.sheet-host--modal {
  z-index: 60;
}
</style>
