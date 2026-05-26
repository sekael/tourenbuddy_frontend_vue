<script setup lang="ts">
import type { Tour } from '@/features/tours/domain/entities/tour'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { resolveContactName } from '@/features/contacts/domain/entities/contact'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'
import { useFriendshipsStore } from '@/features/friendships/presentation/stores/friendships-store'

const props = defineProps<{ tour: Tour }>()
const emit = defineEmits<{ click: [] }>()

const { t } = useI18n({ useScope: 'global' })
const contactsStore = useContactsStore()
const friendshipsStore = useFriendshipsStore()

const displayName = computed(() => props.tour.name ?? t('tours.infoSheet.unnamedTour'))

const initial = computed(() => props.tour.name?.[0]?.toUpperCase() ?? '?')

function joinName(first: string | null, last: string | null): string {
  return [first, last].filter(Boolean).join(' ').trim()
}

// Friend tours: surface the owner by profile name (resolved via the friendships
// name map); non-partner viewers see a "limited info" hint instead of full detail.
const ownerLabel = computed(() => {
  if (!props.tour.isFriendTour)
    return null
  const owner = friendshipsStore.userIdToNamesMap.get(props.tour.userId)
  const name = owner ? joinName(owner.firstName, owner.lastName) : ''
  return t('tours.list.ownedByLabel', { name: name || t('tours.list.aFriend') })
})

const partnerSubtitle = computed(() => {
  const names = props.tour.isFriendTour
    ? (props.tour.partnerNames ?? []).map(p => joinName(p.firstName, p.lastName))
    : props.tour.partnerIds.map((id) => {
        const contact = contactsStore.contacts.find(c => c.id === id)
        return contact ? resolveContactName(contact) : null
      })
  const joined = names.filter(Boolean).join(', ')
  return joined || null
})

const isGated = computed(() => props.tour.isFriendTour && props.tour.isPartner === false)
</script>

<template>
  <li class="tour-row" @click="emit('click')">
    <div class="tour-avatar">
      {{ initial }}
      <span v-if="tour.isFriendTour" class="friend-badge material-symbols-outlined">group</span>
    </div>
    <div class="tour-info">
      <span class="tour-name">{{ displayName }}</span>
      <span v-if="ownerLabel" class="tour-owner">{{ ownerLabel }}</span>
      <span v-if="partnerSubtitle" class="tour-subtitle">{{ partnerSubtitle }}</span>
      <span v-else-if="isGated" class="tour-gated">
        <span class="material-symbols-outlined gated-icon">lock</span>
        {{ t('tours.list.limitedInfo') }}
      </span>
    </div>
    <span class="material-symbols-outlined row-arrow">chevron_right</span>
  </li>
</template>

<style scoped>
.tour-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color 0.15s;
}

.tour-row:hover {
  background-color: var(--color-surface-variant);
}

.tour-avatar {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: color-mix(in srgb, var(--color-primary) 16%, transparent);
  color: var(--color-primary);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.friend-badge {
  position: absolute;
  right: -2px;
  bottom: -2px;
  font-size: 14px;
  padding: 2px;
  border-radius: 50%;
  background-color: var(--color-surface);
  color: var(--color-on-surface-variant);
}

.tour-owner {
  font-size: var(--font-size-sm);
  color: var(--color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tour-gated {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}

.gated-icon {
  font-size: 14px;
}

.tour-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.tour-name {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-on-surface);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tour-subtitle {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-arrow {
  font-size: 20px;
  color: var(--color-outline-variant);
  flex-shrink: 0;
}
</style>
