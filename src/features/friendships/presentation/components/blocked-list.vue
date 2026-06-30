<script setup lang="ts">
import type { UserBlock } from '@/features/friendships/data/models/user-block-schemas'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/core/components/base-button.vue'
import BaseIcon from '@/core/components/base-icon.vue'
import { useSnackbar } from '@/core/composables/use-snackbar'
import { BlockCooldownError } from '@/core/exceptions'
import { formatPhoneForDisplay } from '@/core/utils/phone-normalize'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'
import { useUserBlocksStore } from '@/features/friendships/presentation/stores/user-blocks-store'

const { t } = useI18n({ useScope: 'global' })
const store = useUserBlocksStore()
const contactsStore = useContactsStore()
const { contacts } = storeToRefs(contactsStore)
const snackbar = useSnackbar()

const activeBlocks = computed(() => store.activeBlocks)

function cooldownRemainingHours(block: UserBlock): number {
  const endMs = new Date(block.lastBlockedAt).getTime() + 48 * 60 * 60 * 1000
  const remainingMs = endMs - Date.now()
  return remainingMs > 0 ? Math.ceil(remainingMs / (1000 * 60 * 60)) : 0
}

function isInCooldown(block: UserBlock): boolean {
  return cooldownRemainingHours(block) > 0
}

function displayName(block: UserBlock): string {
  const info = store.blockedUserInfo.get(block.blockedUserId)
  const phone = info?.phone ?? null

  if (phone) {
    const contact = contacts.value.find(c =>
      c.contactMethods.some(m => m.methodType === 'phone' && m.value === phone),
    )
    if (contact) {
      const name = `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim()
      if (name)
        return name
    }
  }

  const profileName = `${info?.firstName ?? ''} ${info?.lastName ?? ''}`.trim()
  if (profileName)
    return profileName

  return phone ? (formatPhoneForDisplay(phone) || phone) : '—'
}

function blockedSinceLabel(block: UserBlock): string {
  return t('blocks.blockedSince', {
    date: new Date(block.firstBlockedAt).toLocaleDateString(),
  })
}

async function handleUnblock(block: UserBlock) {
  try {
    await store.unblock(block.blockedUserId)
    snackbar.show(t('blocks.snackbar.unblockSuccess'))
  }
  catch (err) {
    if (err instanceof BlockCooldownError) {
      const hours = Math.ceil(err.remainingSeconds / 3600)
      snackbar.show(t('blocks.snackbar.cooldownError', { hours }))
    }
  }
}
</script>

<template>
  <div class="blocked-list">
    <div v-if="activeBlocks.length === 0" class="empty-state">
      {{ t('blocks.emptyState') }}
    </div>
    <ul v-else class="block-items">
      <li v-for="block in activeBlocks" :key="block.blockedUserId" class="block-row">
        <div class="block-info">
          <BaseIcon name="block" class="block-icon" />
          <div class="block-user-block">
            <span class="block-user">{{ displayName(block) }}</span>
            <span class="block-since">{{ blockedSinceLabel(block) }}</span>
          </div>
        </div>
        <div class="block-actions">
          <span v-if="isInCooldown(block)" class="cooldown-label">
            {{ t('blocks.cooldown.remaining', { hours: cooldownRemainingHours(block) }) }}
          </span>
          <BaseButton
            type="button"
            variant="secondary"
            size="sm"
            :disabled="isInCooldown(block)"
            @click="handleUnblock(block)"
          >
            {{ t('blocks.unblockAction') }}
          </BaseButton>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.blocked-list {
  display: flex;
  flex-direction: column;
}

.empty-state {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
  padding: var(--spacing-md) 0;
}

.block-items {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.block-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-outline-variant);
  background-color: var(--color-surface);
}

.block-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-width: 0;
}

.block-icon {
  color: var(--color-on-surface-variant);
  flex-shrink: 0;
}

.block-user-block {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.block-user {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.block-since {
  font-size: var(--font-size-xs);
  color: var(--color-on-surface-variant);
}

.block-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--spacing-xxs);
  flex-shrink: 0;
}

.cooldown-label {
  font-size: var(--font-size-xs);
  color: var(--color-on-surface-variant);
}

/* Unblock uses shared BaseButton (secondary). */
</style>
