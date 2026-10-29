<script setup lang="ts">
import type { Contact } from '@/features/contacts/domain/entities/contact'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/core/components/base-button.vue'
import BaseIcon from '@/core/components/base-icon.vue'
import { useSnackbar } from '@/core/composables/use-snackbar'
import { useContactBlocked } from '@/features/contacts/presentation/composables/use-contact-blocked'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'
import BlockConfirmDialog from '@/features/friendships/presentation/components/block-confirm-dialog.vue'
import { useFriendshipsStore } from '@/features/friendships/presentation/stores/friendships-store'
import { useUserBlocksStore } from '@/features/friendships/presentation/stores/user-blocks-store'

/** The contact detail's footer: Delete · Block · Edit, confirmations in place of the row. */
const props = defineProps<{
  contact: Contact
  linkedFriendUserId?: string | null
}>()
const emit = defineEmits<{ edit: [], deleted: [] }>()

const { t } = useI18n({ useScope: 'global' })
const store = useContactsStore()
const friendshipsStore = useFriendshipsStore()
const { friendUserIds } = storeToRefs(friendshipsStore)
const blocksStore = useUserBlocksStore()
const snackbar = useSnackbar()

const isBlocked = useContactBlocked(() => props.contact, () => props.linkedFriendUserId)
const canBlock = computed(() => !!props.linkedFriendUserId && !isBlocked.value)

// ── Delete ───────────────────────────────────────────────────────────────────
const deleteState = ref<'idle' | 'confirm' | 'loading'>('idle')
const deleteError = ref<string | null>(null)
const relationships = ref<{ hasPending: boolean, hasFriendship: boolean } | null>(null)

async function requestDelete() {
  deleteState.value = 'confirm'
  relationships.value = (await store.relationshipsForContact(props.contact.id)) ?? null
}

async function confirmDelete() {
  deleteError.value = null
  deleteState.value = 'loading'
  try {
    if (props.linkedFriendUserId)
      await friendshipsStore.removeFriendship(props.linkedFriendUserId)
    await store.deleteContact(props.contact.id)
    emit('deleted')
  }
  catch (err) {
    deleteError.value = err instanceof Error ? err.message : t('contacts.detailView.deleteFailed')
    deleteState.value = 'idle'
  }
}

const deleteWarning = computed(() => {
  const r = relationships.value
  if (r?.hasFriendship && r.hasPending)
    return 'deleteFriendAndPendingWarning'
  if (r?.hasFriendship || props.linkedFriendUserId)
    return 'deleteFriendWarning'
  return r?.hasPending ? 'deletePendingWarning' : null
})

// ── Block ────────────────────────────────────────────────────────────────────
const blockConfirmOpen = ref(false)

async function confirmBlock(reportReason: string | null) {
  // Capture before awaiting: blocking ends the friendship, so the parent's refetch
  // clears `linkedFriendUserId` while `block()` is still in flight.
  const target = props.linkedFriendUserId
  if (!target)
    return
  blockConfirmOpen.value = false
  try {
    await blocksStore.block(target)
    snackbar.show(t('blocks.snackbar.blockSuccess'))
    if (reportReason !== null) {
      await blocksStore.report(target, reportReason)
      snackbar.show(t('blocks.snackbar.reportSuccess'))
    }
  }
  catch {
    snackbar.show(t('blocks.snackbar.sendRequestFailed'))
  }
}
</script>

<template>
  <div class="detail-actions">
    <BlockConfirmDialog
      v-if="blockConfirmOpen && canBlock"
      :has-friendship="friendUserIds.has(linkedFriendUserId!)"
      @cancel="blockConfirmOpen = false"
      @confirm="confirmBlock"
    />

    <div v-else-if="deleteState === 'confirm'" class="delete-confirm" role="group" :aria-label="t('contacts.detailView.deleteConfirm')">
      <p class="delete-confirm-text">
        {{ t('contacts.detailView.deleteConfirm') }}
      </p>
      <p v-if="deleteWarning" class="delete-friend-warning">
        <BaseIcon name="warning" class="warn-icon" />
        {{ t(`contacts.detailView.${deleteWarning}`) }}
      </p>
      <div class="delete-confirm-row">
        <BaseButton type="button" variant="secondary" size="sm" data-testid="delete-cancel-btn" @click="deleteState = 'idle'">
          {{ t('contacts.shared.cancelBtn') }}
        </BaseButton>
        <BaseButton type="button" variant="danger" size="sm" data-testid="delete-confirm-btn" @click="confirmDelete">
          {{ t('contacts.detailView.deleteBtn') }}
        </BaseButton>
      </div>
    </div>

    <template v-else>
      <p v-if="deleteError" class="error-text">
        {{ deleteError }}
      </p>
      <div class="action-row">
        <BaseButton
          type="button"
          variant="danger-outline"
          size="sm"
          data-testid="delete-btn"
          :disabled="deleteState === 'loading'"
          @click="requestDelete"
        >
          {{ deleteState === 'loading' ? t('contacts.detailView.deletingBtn') : t('contacts.detailView.deleteAction') }}
        </BaseButton>
        <BaseButton v-if="canBlock" type="button" variant="danger-outline" size="sm" data-testid="block-btn" @click="blockConfirmOpen = true">
          {{ t('blocks.blockAction') }}
        </BaseButton>
        <BaseButton type="button" variant="secondary" size="sm" data-testid="edit-contact-btn" @click="emit('edit')">
          {{ t('contacts.detailView.editBtn') }}
        </BaseButton>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* Edit rests in the neutral tonal container, as in the tour detail's footer. */
.detail-actions {
  --color-secondary-container: var(--color-neutral-container);
  --color-secondary-container-hover: var(--color-neutral-container-hover);
  --color-on-secondary-container: var(--color-on-surface);

  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.action-row {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  gap: var(--spacing-xs);
}

/* Equal thirds, text labels: all three fit a 360px phone in German. Glove-sized. */
.action-row > .base-button {
  min-height: 44px;
  padding-inline: var(--spacing-xs);
}

.delete-confirm {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.delete-confirm-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-sm);
}

.delete-confirm-text {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-error);
}

.delete-friend-warning {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-xxs);
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}

.warn-icon {
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--color-warning);
}

.error-text {
  font-size: var(--font-size-sm);
  color: var(--color-error);
  text-align: end;
}
</style>
