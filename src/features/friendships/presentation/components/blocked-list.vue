<script setup lang="ts">
import type { UserBlock } from '@/features/friendships/data/models/user-block-schemas'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSnackbar } from '@/core/composables/use-snackbar'
import { BlockCooldownError } from '@/core/exceptions'
import { useFriendshipsStore } from '@/features/friendships/presentation/stores/friendships-store'
import { useUserBlocksStore } from '@/features/friendships/presentation/stores/user-blocks-store'

const { t } = useI18n({ useScope: 'global' })
const store = useUserBlocksStore()
const friendsStore = useFriendshipsStore()
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
  const names = friendsStore.userIdToNamesMap.get(block.blockedUserId)
  if (names) {
    const name = `${names.firstName ?? ''} ${names.lastName ?? ''}`.trim()
    if (name)
      return name
  }
  const phone = friendsStore.userIdToPhoneMap.get(block.blockedUserId)
  return phone ?? block.blockedUserId
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
          <span class="material-symbols-outlined block-icon">block</span>
          <div class="block-user-block">
            <span class="block-user">{{ displayName(block) }}</span>
            <span class="block-since">{{ blockedSinceLabel(block) }}</span>
          </div>
        </div>
        <div class="block-actions">
          <span v-if="isInCooldown(block)" class="cooldown-label">
            {{ t('blocks.cooldown.remaining', { hours: cooldownRemainingHours(block) }) }}
          </span>
          <button
            type="button"
            class="action-btn"
            :disabled="isInCooldown(block)"
            @click="handleUnblock(block)"
          >
            {{ t('blocks.unblockAction') }}
          </button>
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
  font-size: 20px;
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
  font-size: var(--font-size-xs, 11px);
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
  font-size: var(--font-size-xs, 11px);
  color: var(--color-on-surface-variant);
}

.action-btn {
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  border: 1.5px solid var(--color-outline-variant);
  color: var(--color-on-surface-variant);
  transition: background-color 0.15s;
  white-space: nowrap;
}

.action-btn:hover:not(:disabled) {
  background-color: var(--color-surface-variant);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
