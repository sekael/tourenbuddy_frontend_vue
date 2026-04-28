<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AdaptiveOverlay from '@/core/components/adaptive-overlay.vue'
import { useSnackbar } from '@/core/composables/use-snackbar'
import { formatPhoneForDisplay } from '@/core/utils/phone-normalize'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'
import { useFriendshipsStore } from '@/features/friendships/presentation/stores/friendships-store'

const emit = defineEmits<{ close: [], back: [] }>()

const { t } = useI18n({ useScope: 'global' })
const store = useFriendshipsStore()
const { incomingRequests, outgoingRequests, isLoading, userIdToPhoneMap } = storeToRefs(store)
const contactsStore = useContactsStore()
const { contacts } = storeToRefs(contactsStore)
const snackbar = useSnackbar()

function phoneFor(userId: string): string {
  const e164 = userIdToPhoneMap.value.get(userId)
  return e164 ? formatPhoneForDisplay(e164) : userId
}

async function resolveRequestPhones() {
  const ids = [
    ...incomingRequests.value.map(r => r.fromUserId),
    ...outgoingRequests.value.map(r => r.toUserId),
  ]
  await store.findPhonesByUserIds([...new Set(ids)])
}

onMounted(resolveRequestPhones)
watch([incomingRequests, outgoingRequests], resolveRequestPhones)

async function maybeCreateContactForFriend(userId: string) {
  const phone = userIdToPhoneMap.value.get(userId)
  if (!phone)
    return
  const alreadyExists = contacts.value.some(c =>
    c.contactMethods.some(m => m.methodType === 'phone' && m.value === phone),
  )
  if (alreadyExists)
    return
  const displayPhone = formatPhoneForDisplay(phone) || phone
  await contactsStore.addContact(displayPhone, null, null, [{ value: phone, isPrimary: true }])
  snackbar.show(t('friendships.contactCreated'))
}

async function handleAccept(requestId: string) {
  const req = incomingRequests.value.find(r => r.id === requestId)
  try {
    await store.accept(requestId)
    if (req)
      await maybeCreateContactForFriend(req.fromUserId)
  }
  catch {
    snackbar.show(`${t('friendships.accept')} failed`)
  }
}

async function handleDeny(requestId: string) {
  try {
    await store.deny(requestId)
  }
  catch {
    snackbar.show(`${t('friendships.deny')} failed`)
  }
}

async function handleCancel(requestId: string) {
  try {
    await store.cancel(requestId)
  }
  catch {
    snackbar.show(`${t('friendships.cancel')} failed`)
  }
}
</script>

<template>
  <AdaptiveOverlay :title="t('friendships.friendsListLink')" show-back @close="emit('close')" @back="emit('back')">
    <div class="content">
      <div class="deny-rights-note">
        <span class="material-symbols-outlined note-icon">info</span>
        <p class="note-text">
          {{ t('friendships.inboxDenyRightsNote') }}
        </p>
      </div>

      <div v-if="isLoading" class="loading-text">
        {{ t('contacts.list.loading') }}
      </div>

      <template v-else>
        <section class="section">
          <h2 class="section-title">
            {{ t('friendships.requestFrom') }}
          </h2>

          <div v-if="incomingRequests.length === 0" class="empty-state">
            {{ t('friendships.inboxEmpty') }}
          </div>

          <ul v-else class="request-list">
            <li v-for="req in incomingRequests" :key="req.id" class="request-row">
              <div class="request-info">
                <span class="material-symbols-outlined request-icon">person</span>
                <span class="request-user">{{ phoneFor(req.fromUserId) }}</span>
              </div>
              <div class="request-actions">
                <button type="button" class="action-btn action-btn--deny" @click="handleDeny(req.id)">
                  {{ t('friendships.deny') }}
                </button>
                <button type="button" class="action-btn action-btn--accept" @click="handleAccept(req.id)">
                  {{ t('friendships.accept') }}
                </button>
              </div>
            </li>
          </ul>
        </section>

        <section class="section">
          <h2 class="section-title">
            {{ t('friendships.requestTo') }}
          </h2>

          <div v-if="outgoingRequests.length === 0" class="empty-state">
            {{ t('friendships.inboxEmpty') }}
          </div>

          <ul v-else class="request-list">
            <li v-for="req in outgoingRequests" :key="req.id" class="request-row">
              <div class="request-info">
                <span class="material-symbols-outlined request-icon">person</span>
                <span class="request-user">{{ phoneFor(req.toUserId) }}</span>
              </div>
              <button type="button" class="action-btn action-btn--cancel" @click="handleCancel(req.id)">
                {{ t('friendships.cancel') }}
              </button>
            </li>
          </ul>
        </section>
      </template>
    </div>
  </AdaptiveOverlay>
</template>

<style scoped>
.content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}

.deny-rights-note {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  background-color: color-mix(in srgb, var(--color-primary) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-primary) 20%, transparent);
}

.note-icon {
  font-size: 20px;
  color: var(--color-primary);
  flex-shrink: 0;
  margin-top: 1px;
}

.note-text {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
  line-height: 1.5;
}

.loading-text {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
  text-align: center;
}

.section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.section-title {
  font-size: var(--font-size-xs, 11px);
  font-weight: var(--font-weight-semibold);
  color: var(--color-on-surface-variant);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.empty-state {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
  padding: var(--spacing-md) 0;
}

.request-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.request-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-outline-variant);
  background-color: var(--color-surface);
}

.request-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-width: 0;
}

.request-icon {
  font-size: 20px;
  color: var(--color-on-surface-variant);
  flex-shrink: 0;
}

.request-user {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.request-actions {
  display: flex;
  gap: var(--spacing-sm);
  flex-shrink: 0;
}

.action-btn {
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  transition: background-color 0.15s;
  white-space: nowrap;
}

.action-btn--accept {
  border: 1.5px solid var(--color-primary);
  color: var(--color-primary);
}

.action-btn--accept:hover {
  background-color: color-mix(in srgb, var(--color-primary) 10%, transparent);
}

.action-btn--deny {
  border: 1.5px solid var(--color-outline-variant);
  color: var(--color-on-surface-variant);
}

.action-btn--deny:hover {
  background-color: var(--color-surface-variant);
}

.action-btn--cancel {
  border: 1.5px solid var(--color-outline-variant);
  color: var(--color-on-surface-variant);
}

.action-btn--cancel:hover {
  background-color: var(--color-surface-variant);
}
</style>
