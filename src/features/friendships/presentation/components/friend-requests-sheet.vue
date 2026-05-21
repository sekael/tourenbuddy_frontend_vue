<script setup lang="ts">
import type { FriendRequest } from '@/features/friendships/data/models/friendship-schemas'
import { storeToRefs } from 'pinia'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AdaptiveOverlay from '@/core/components/adaptive-overlay.vue'
import { useSnackbar } from '@/core/composables/use-snackbar'
import { formatPhoneForDisplay } from '@/core/utils/phone-normalize'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'
import BlockConfirmDialog from '@/features/friendships/presentation/components/block-confirm-dialog.vue'
import BlockedList from '@/features/friendships/presentation/components/blocked-list.vue'
import { useFriendshipsStore } from '@/features/friendships/presentation/stores/friendships-store'
import { useUserBlocksStore } from '@/features/friendships/presentation/stores/user-blocks-store'

const emit = defineEmits<{ close: [], back: [] }>()

const { t } = useI18n({ useScope: 'global' })
const store = useFriendshipsStore()
const { incomingRequests, outgoingRequests, isLoading, userIdToPhoneMap, userIdToNamesMap } = storeToRefs(store)
const contactsStore = useContactsStore()
const { contacts } = storeToRefs(contactsStore)
const snackbar = useSnackbar()
const blocksStore = useUserBlocksStore()

type Tab = 'pending' | 'blocked'
const activeTab = ref<Tab>('pending')

function phoneFor(userId: string): string {
  const e164 = userIdToPhoneMap.value.get(userId)
  return e164 ? formatPhoneForDisplay(e164) : userId
}

function displayNameFor(req: FriendRequest, direction: 'incoming' | 'outgoing'): string | null {
  if (direction === 'incoming') {
    const entry = userIdToNamesMap.value.get(req.fromUserId)
    if (!entry)
      return null
    const name = `${entry.firstName ?? ''} ${entry.lastName ?? ''}`.trim()
    return name || null
  }
  // outgoing: use sender's local contact matched by recipient phone
  const phone = userIdToPhoneMap.value.get(req.toUserId)
  if (!phone)
    return null
  const contact = contacts.value.find(c =>
    c.contactMethods.some(m => m.methodType === 'phone' && m.value === phone),
  )
  if (!contact)
    return null
  const name = `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim()
  return name || null
}

async function resolveRequestInfo() {
  const phoneIds = [
    ...incomingRequests.value.map(r => r.fromUserId),
    ...outgoingRequests.value.map(r => r.toUserId),
  ]
  await store.findPhonesByUserIds([...new Set(phoneIds)])
  await store.getNamesByUserIds([...new Set(incomingRequests.value.map(r => r.fromUserId))])
}

// Refetch friend requests whenever the sheet mounts or the contacts list changes
// (deleting a contact triggers a DB cleanup of pending requests via trigger).
watch(
  contacts,
  async () => {
    await store.fetchAll()
  },
  { immediate: true },
)
watch([incomingRequests, outgoingRequests], resolveRequestInfo, { immediate: true })

async function maybeCreateContactForFriend(userId: string) {
  const phone = userIdToPhoneMap.value.get(userId)
  if (!phone)
    return
  const alreadyExists = contacts.value.some(c =>
    c.contactMethods.some(m => m.methodType === 'phone' && m.value === phone),
  )
  if (alreadyExists)
    return

  const namesEntry = userIdToNamesMap.value.get(userId)
  const firstName = namesEntry?.firstName?.trim()
  const lastName = namesEntry?.lastName?.trim() || null
  const displayPhone = formatPhoneForDisplay(phone) || phone

  if (firstName) {
    await contactsStore.addContact(firstName, lastName, null, [{ value: phone, isPrimary: true }])
  }
  else {
    await contactsStore.addContact(displayPhone, null, null, [{ value: phone, isPrimary: true }])
  }
  snackbar.show(t('friendships.contactCreated'))
}

const confirmingRequestId = ref<string | null>(null)
const isAccepting = ref(false)

const blockingRequest = ref<FriendRequest | null>(null)

function startBlock(req: FriendRequest) {
  blockingRequest.value = req
}

function cancelBlock() {
  blockingRequest.value = null
}

async function handleBlockConfirm(reportReason: string | null) {
  const req = blockingRequest.value
  if (!req)
    return
  blockingRequest.value = null
  try {
    await blocksStore.block(req.fromUserId)
    snackbar.show(t('blocks.snackbar.blockSuccess'))
    if (reportReason !== null) {
      await blocksStore.report(req.fromUserId, reportReason)
      snackbar.show(t('blocks.snackbar.reportSuccess'))
    }
  }
  catch {
    snackbar.show(t('blocks.snackbar.sendRequestFailed'))
  }
}

function startAcceptConfirm(requestId: string) {
  confirmingRequestId.value = requestId
}

function cancelAcceptConfirm() {
  confirmingRequestId.value = null
}

async function handleAccept(requestId: string) {
  const req = incomingRequests.value.find(r => r.id === requestId)
  isAccepting.value = true
  try {
    await store.accept(requestId)
    if (req) {
      await store.getNamesByUserIds([req.fromUserId])
      await maybeCreateContactForFriend(req.fromUserId)
    }
    confirmingRequestId.value = null
  }
  catch {
    snackbar.show(`${t('friendships.accept')} failed`)
  }
  finally {
    isAccepting.value = false
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
  <AdaptiveOverlay
    :title="t('friendships.friendsListLink')"
    show-back
    @close="emit('close')"
    @back="emit('back')"
  >
    <div class="content">
      <div class="tab-bar">
        <button
          type="button"
          class="tab-btn"
          :class="{ 'tab-btn--active': activeTab === 'pending' }"
          @click="activeTab = 'pending'"
        >
          {{ t('friendships.friendsListLink') }}
        </button>
        <button
          type="button"
          class="tab-btn"
          :class="{ 'tab-btn--active': activeTab === 'blocked' }"
          @click="activeTab = 'blocked'"
        >
          {{ t('blocks.tabLabel') }}
        </button>
      </div>

      <template v-if="activeTab === 'pending'">
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
                <template v-if="confirmingRequestId === req.id">
                  <div class="confirm-content">
                    <p class="confirm-text">
                      {{ t('friendships.acceptConfirm') }}
                    </p>
                    <p class="confirm-warning">
                      <span class="material-symbols-outlined warn-icon">warning</span>
                      {{ t('friendships.acceptWarning') }}
                    </p>
                    <div class="confirm-actions">
                      <button
                        type="button"
                        class="action-btn action-btn--cancel"
                        :disabled="isAccepting"
                        @click="cancelAcceptConfirm"
                      >
                        {{ t('friendships.cancel') }}
                      </button>
                      <button
                        type="button"
                        class="action-btn action-btn--accept"
                        :disabled="isAccepting"
                        @click="handleAccept(req.id)"
                      >
                        {{ isAccepting ? t('friendships.acceptingBtn') : t('friendships.accept') }}
                      </button>
                    </div>
                  </div>
                </template>
                <template v-else>
                  <div class="request-info">
                    <span class="material-symbols-outlined request-icon">person</span>
                    <div class="request-user-block">
                      <template v-if="displayNameFor(req, 'incoming')">
                        <span class="request-user">{{ displayNameFor(req, 'incoming') }}</span>
                        <span class="request-phone-sub">{{ phoneFor(req.fromUserId) }}</span>
                      </template>
                      <span v-else class="request-user">{{ phoneFor(req.fromUserId) }}</span>
                    </div>
                  </div>
                  <div class="request-actions">
                    <button
                      type="button"
                      class="action-btn action-btn--deny"
                      @click="handleDeny(req.id)"
                    >
                      {{ t('friendships.deny') }}
                    </button>
                    <button
                      type="button"
                      class="action-btn action-btn--block"
                      @click="startBlock(req)"
                    >
                      {{ t('blocks.blockAction') }}
                    </button>
                    <button
                      type="button"
                      class="action-btn action-btn--accept"
                      @click="startAcceptConfirm(req.id)"
                    >
                      {{ t('friendships.accept') }}
                    </button>
                  </div>
                </template>
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
                  <div class="request-user-block">
                    <template v-if="displayNameFor(req, 'outgoing')">
                      <span class="request-user">{{ displayNameFor(req, 'outgoing') }}</span>
                      <span class="request-phone-sub">{{ phoneFor(req.toUserId) }}</span>
                    </template>
                    <span v-else class="request-user">{{ phoneFor(req.toUserId) }}</span>
                  </div>
                </div>
                <button
                  type="button"
                  class="action-btn action-btn--cancel"
                  @click="handleCancel(req.id)"
                >
                  {{ t('friendships.cancel') }}
                </button>
              </li>
            </ul>
          </section>
        </template>
      </template>

      <template v-else>
        <BlockedList />
      </template>
    </div>

    <BlockConfirmDialog
      v-if="blockingRequest"
      :has-friendship="false"
      @cancel="cancelBlock"
      @confirm="handleBlockConfirm"
    />
  </AdaptiveOverlay>
</template>

<style scoped>
.content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}

.tab-bar {
  display: flex;
  gap: var(--spacing-xs);
  border-bottom: 1px solid var(--color-outline-variant);
  margin-bottom: calc(-1 * var(--spacing-md));
}

.tab-btn {
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-on-surface-variant);
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition:
    color 0.15s,
    border-color 0.15s;
}

.tab-btn--active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.action-btn--block {
  border: 1.5px solid color-mix(in srgb, var(--color-error, #dc2626) 60%, transparent);
  color: var(--color-error, #dc2626);
}

.action-btn--block:hover {
  background-color: color-mix(in srgb, var(--color-error, #dc2626) 10%, transparent);
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

.request-user-block {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.request-user {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.request-phone-sub {
  font-size: var(--font-size-xs, 11px);
  color: var(--color-on-surface-variant);
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

.confirm-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  width: 100%;
}

.confirm-text {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-on-surface);
}

.confirm-warning {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}

.warn-icon {
  font-size: 14px;
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--color-warning, #f59e0b);
}

.confirm-actions {
  display: flex;
  gap: var(--spacing-sm);
  justify-content: flex-end;
}
</style>
