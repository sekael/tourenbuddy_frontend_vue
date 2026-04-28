<script setup lang="ts">
import type { Contact } from '@/features/contacts/domain/entities/contact'
import type { PhoneEntry } from '@/features/contacts/presentation/stores/contacts-store'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AdaptiveOverlay from '@/core/components/adaptive-overlay.vue'
import { normalizePhone } from '@/core/utils/phone-normalize'
import {
  formatPhoneDisplay,
  getPrimaryPhone,
  resolveContactName,
  resolveFullName,
} from '@/features/contacts/domain/entities/contact'
import { useContactFriendshipMap } from '@/features/contacts/presentation/composables/use-contact-friendship-map'
import { useContactPicker } from '@/features/contacts/presentation/composables/use-contact-picker'
import { useVCardImport } from '@/features/contacts/presentation/composables/use-vcard-import'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'
import ConnectPrompt from '@/features/friendships/presentation/components/connect-prompt.vue'
import { useDismissedConnectPrompts } from '@/features/friendships/presentation/composables/use-dismissed-connect-prompts'
import { useFriendshipsStore } from '@/features/friendships/presentation/stores/friendships-store'
import ContactDetailView from './contact-detail-view.vue'
import ContactForm from './contact-form.vue'

const props = defineProps<{
  /** When provided, auto-opens detail view for the given contact id. */
  initialContactId?: string | null
}>()

const emit = defineEmits<{ close: [], openFriendRequests: [] }>()

const { t } = useI18n({ useScope: 'global' })

type ViewState = 'list' | 'detail' | 'add'

const contactsStore = useContactsStore()
const { contacts, isLoading } = storeToRefs(contactsStore)
const friendshipsStore = useFriendshipsStore()
const {
  friendUserIds,
  outgoingRequests,
  isPhoneVerified: callerPhoneVerified,
  incomingRequests,
} = storeToRefs(friendshipsStore)

const pendingIncomingCount = computed(
  () => incomingRequests.value.filter(r => r.status === 'pending').length,
)

function goToFriendRequests() {
  emit('openFriendRequests')
}

const viewState = ref<ViewState>('list')
const selectedContact = ref<Contact | null>(null)

// Auto-open detail view when initialContactId is provided
watch(
  [() => props.initialContactId, contacts],
  ([id]) => {
    if (id && viewState.value === 'list') {
      const target = contacts.value.find(c => c.id === id)
      if (target) {
        selectedContact.value = target
        viewState.value = 'detail'
      }
    }
  },
  { immediate: true },
)

const sheetTitle = computed(() => {
  if (viewState.value === 'add')
    return t('contacts.addDialog.title')
  if (viewState.value === 'detail')
    return null
  return t('contacts.list.title')
})

// Keep selectedContact in sync after store edits
const liveContact = computed(() =>
  selectedContact.value
    ? (contacts.value.find(c => c.id === selectedContact.value!.id) ?? null)
    : null,
)

// Navigate back to list when selected contact is deleted from the store
watch(liveContact, (contact) => {
  if (viewState.value === 'detail' && !contact) {
    viewState.value = 'list'
    selectedContact.value = null
  }
})

// ── Add contact state ────────────────────────────────────────────────────────
interface ImportResult {
  firstName: string
  lastName: string | null
  primaryPhone: string | null
  extraPhoneCount: number
  rawPhoneNumbers: string[]
  status: 'imported' | 'skipped'
}

const { isSupported: isContactPickerSupported, pickContacts } = useContactPicker()
const { parseVCardFile } = useVCardImport()

const addViewState = ref<'form' | 'import-results'>('form')
const importResults = ref<ImportResult[]>([])
const addError = ref<string | null>(null)
const isAddLoading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

// ── Connect prompt state (declared early to avoid hoisting issues) ─────────
const manualPromptUserId = ref<string | null>(null)
const manualPromptDismissed = ref(false)
// Per-row matched user IDs from import batch lookup
const importRowMatches = ref<string[][]>([])

// Reactive phone→userId map + friend icon derivation (reacts to friendship changes)
const { contactFriendIds: friendContactIds, phoneToUserIdMap } = useContactFriendshipMap(contacts)

// ── Linked friend for detail view (drives delete disclaimer) ─────────────────
const detailLinkedFriendUserId = computed<string | null>(() => {
  if (!liveContact.value)
    return null
  for (const method of liveContact.value.contactMethods.filter(m => m.methodType === 'phone')) {
    const norm = normalizePhone(method.value)
    const phone = norm.ok ? norm.e164 : method.value
    const uid = phoneToUserIdMap.value.get(phone)
    if (uid && friendUserIds.value.has(uid))
      return uid
  }
  return null
})

// ── Connect prompt for existing contact detail view ──────────────────────────
const { isDismissed: isConnectDismissed, dismiss: dismissConnect } = useDismissedConnectPrompts()

const detailViewMatchedUserId = computed<string | null>(() => {
  if (!liveContact.value || !callerPhoneVerified.value)
    return null
  for (const method of liveContact.value.contactMethods.filter(m => m.methodType === 'phone')) {
    const norm = normalizePhone(method.value)
    const phone = norm.ok ? norm.e164 : method.value
    const uid = phoneToUserIdMap.value.get(phone)
    if (!uid || friendUserIds.value.has(uid))
      continue
    const hasPending = outgoingRequests.value.some(r => r.toUserId === uid && r.status === 'pending')
    if (!hasPending)
      return uid
  }
  return null
})

// ── Navigation ───────────────────────────────────────────────────────────────
function openDetail(contact: Contact) {
  selectedContact.value = contact
  viewState.value = 'detail'
}

function openAdd() {
  addError.value = null
  importResults.value = []
  addViewState.value = 'form'
  viewState.value = 'add'
}

function backToList() {
  viewState.value = 'list'
  selectedContact.value = null
}

function handleContactDeleted() {
  viewState.value = 'list'
  selectedContact.value = null
}

function handleClose() {
  if (viewState.value !== 'list') {
    backToList()
    return
  }
  emit('close')
}

function isDuplicate(first: string, last: string | null): boolean {
  return contacts.value.some(
    c =>
      c.firstName.toLowerCase() === first.toLowerCase()
      && (c.lastName ?? '').toLowerCase() === (last ?? '').toLowerCase(),
  )
}

async function handleAddSubmit(data: {
  firstName: string
  lastName: string | null
  displayName: string | null
  phones: PhoneEntry[]
}) {
  isAddLoading.value = true
  addError.value = null
  try {
    await contactsStore.addContact(data.firstName, data.lastName, data.displayName, data.phones)
    backToList()
  }
  catch (err) {
    addError.value = err instanceof Error ? err.message : t('contacts.addDialog.addError')
  }
  finally {
    isAddLoading.value = false
  }
}

async function processImportedContacts(
  items: Array<{
    firstName: string
    lastName: string | null
    phones: PhoneEntry[]
    rawPhoneNumbers?: string[]
  }>,
) {
  const results: ImportResult[] = []
  for (const item of items) {
    const primaryPhone
      = item.phones.find(p => p.isPrimary)?.value ?? item.phones[0]?.value ?? null
    const rawPhoneNumbers = item.rawPhoneNumbers ?? []
    if (isDuplicate(item.firstName, item.lastName)) {
      results.push({
        firstName: item.firstName,
        lastName: item.lastName,
        primaryPhone,
        extraPhoneCount: Math.max(0, item.phones.length - 1),
        rawPhoneNumbers,
        status: 'skipped',
      })
      continue
    }
    await contactsStore.addContact(item.firstName, item.lastName, null, item.phones, 'import')
    results.push({
      firstName: item.firstName,
      lastName: item.lastName,
      primaryPhone,
      extraPhoneCount: Math.max(0, item.phones.length - 1),
      rawPhoneNumbers,
      status: 'imported',
    })
  }
  importResults.value = results
  addViewState.value = 'import-results'

  // Batch discovery for connect prompts (only when caller phone is verified)
  if (callerPhoneVerified.value) {
    const uniquePhones = [
      ...new Set(items.flatMap(i => i.phones.map(p => p.value)).filter(Boolean)),
    ]
    if (uniquePhones.length > 0) {
      const matches = await friendshipsStore.findUsersByPhones(uniquePhones)
      const newMap = new Map(phoneToUserIdMap.value)
      for (const m of matches) newMap.set(m.phone, m.userId)
      phoneToUserIdMap.value = newMap
      // Build per-row match sets
      importRowMatches.value = results.map((r) => {
        if (!r.primaryPhone)
          return []
        const match = phoneToUserIdMap.value.get(r.primaryPhone)
        return match && !friendUserIds.value.has(match) ? [match] : []
      })
    }
  }
}

async function handleContactPickerImport() {
  isAddLoading.value = true
  addError.value = null
  try {
    const picked = await pickContacts()
    await processImportedContacts(picked)
  }
  catch (err) {
    addError.value = err instanceof Error ? err.message : t('contacts.addDialog.importError')
  }
  finally {
    isAddLoading.value = false
  }
}

function handleFileImportClick() {
  fileInput.value?.click()
}

async function handleFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file)
    return
  isAddLoading.value = true
  addError.value = null
  try {
    const parsed = await parseVCardFile(file)
    await processImportedContacts(parsed)
  }
  catch (err) {
    addError.value = err instanceof Error ? err.message : t('contacts.addDialog.fileImportError')
  }
  finally {
    isAddLoading.value = false
    if (fileInput.value)
      fileInput.value.value = ''
  }
}

function switchAddToForm() {
  addViewState.value = 'form'
  importResults.value = []
  addError.value = null
  manualPromptUserId.value = null
  manualPromptDismissed.value = false
}

// ── Connect prompt for manual form ──────────────────────────────────────────
let manualPhoneDebounce: ReturnType<typeof setTimeout> | null = null

async function lookupPhoneForPrompt(phone: string) {
  if (!callerPhoneVerified.value) {
    manualPromptUserId.value = null
    return
  }
  const result = normalizePhone(phone)
  if (!result.ok) {
    manualPromptUserId.value = null
    return
  }
  const uid = await friendshipsStore.findUserByPhone(result.e164)
  if (!uid || friendUserIds.value.has(uid)) {
    manualPromptUserId.value = null
    return
  }
  // Check no pending outgoing request
  const hasPending = friendshipsStore.outgoingRequests.some(
    r => r.toUserId === uid && r.status === 'pending',
  )
  manualPromptUserId.value = hasPending ? null : uid
}

function onFormPhoneInput(phone: string) {
  manualPromptDismissed.value = false
  if (manualPhoneDebounce)
    clearTimeout(manualPhoneDebounce)
  manualPhoneDebounce = setTimeout(() => lookupPhoneForPrompt(phone), 400)
}
</script>

<template>
  <AdaptiveOverlay :title="sheetTitle ?? undefined" @close="handleClose">
    <!-- List view -->
    <div v-if="viewState === 'list'" class="list-view">
      <div class="list-actions-row">
        <button type="button" class="add-contact-btn" @click="openAdd">
          <span class="material-symbols-outlined">person_add</span>
          {{ t('contacts.list.addBtn') }}
        </button>
        <button
          v-if="callerPhoneVerified"
          type="button"
          class="friend-requests-btn"
          @click="goToFriendRequests"
        >
          <span class="material-symbols-outlined">group</span>
          {{ t('friendships.friendsListLink') }}
          <span v-if="pendingIncomingCount > 0" class="badge">{{ pendingIncomingCount }}</span>
        </button>
      </div>

      <div v-if="isLoading" class="loading-text">
        {{ t('contacts.list.loading') }}
      </div>

      <div v-else-if="contacts.length === 0" class="empty-state">
        <span class="material-symbols-outlined empty-icon">group</span>
        <p class="empty-text">
          {{ t('contacts.list.emptyTitle') }}
        </p>
        <p class="empty-sub">
          {{ t('contacts.list.emptySubtitle') }}
        </p>
      </div>

      <ul v-else class="contacts-list">
        <li
          v-for="contact in contacts"
          :key="contact.id"
          class="contact-row"
          @click="openDetail(contact)"
        >
          <div class="contact-avatar">
            {{ resolveContactName(contact)[0]?.toUpperCase() }}
          </div>
          <div class="contact-info">
            <span class="contact-name-row">
              <span class="contact-name">{{ resolveContactName(contact) }}</span>
              <span
                v-if="friendContactIds.has(contact.id)"
                class="material-symbols-outlined friend-icon"
                :title="t('friendships.tooltip')"
              >group</span>
            </span>
            <span v-if="contact.displayName" class="contact-subtitle">
              {{ resolveFullName(contact) }}
            </span>
            <span v-else-if="getPrimaryPhone(contact)" class="contact-subtitle">
              {{ formatPhoneDisplay(getPrimaryPhone(contact)!) }}
            </span>
          </div>
          <span class="material-symbols-outlined row-arrow">chevron_right</span>
        </li>
      </ul>
    </div>

    <!-- Detail / edit view -->
    <div v-else-if="viewState === 'detail' && liveContact">
      <ContactDetailView
        :contact="liveContact"
        :linked-friend-user-id="detailLinkedFriendUserId"
        @back="backToList"
        @deleted="handleContactDeleted"
      />
      <ConnectPrompt
        v-if="detailViewMatchedUserId && liveContact && !isConnectDismissed(liveContact.id)"
        :matched-user-id="detailViewMatchedUserId"
        class="detail-connect-prompt"
        @sent="liveContact && dismissConnect(liveContact.id)"
        @dismissed="liveContact && dismissConnect(liveContact.id)"
      />
    </div>

    <!-- Add contact view -->
    <div v-else-if="viewState === 'add'" class="add-view">
      <!-- Import results -->
      <div v-if="addViewState === 'import-results'" class="results-view">
        <p class="results-summary">
          {{ importResults.filter((r) => r.status === 'imported').length }}
          {{ t('contacts.list.imported') }}
          <template v-if="importResults.some((r) => r.status === 'skipped')">
            · {{ importResults.filter((r) => r.status === 'skipped').length }}
            {{ t('contacts.list.skipped') }}
          </template>
        </p>
        <ul class="results-list">
          <li v-for="(result, i) in importResults" :key="i" class="result-item">
            <div class="result-info">
              <span class="result-name">{{ result.firstName }}{{ result.lastName ? ` ${result.lastName}` : '' }}</span>
              <span v-if="result.primaryPhone" class="result-phone">
                <span class="material-symbols-outlined star-icon-sm">star</span>
                {{ formatPhoneDisplay(result.primaryPhone) }}
                <span v-if="result.extraPhoneCount > 0" class="extra-phones">+{{ result.extraPhoneCount }} more</span>
              </span>
              <span
                v-if="result.rawPhoneNumbers.length > 0"
                class="result-phone result-phone-warning"
                :title="`Couldn't parse: ${result.rawPhoneNumbers.join(', ')}`"
              >
                ⚠ {{ t('contacts.list.invalidPhoneWarning') }}: {{ result.rawPhoneNumbers[0]
                }}{{
                  result.rawPhoneNumbers.length > 1
                    ? ` +${result.rawPhoneNumbers.length - 1} more`
                    : ''
                }}
              </span>
              <template v-if="importRowMatches[i]">
                <ConnectPrompt
                  v-for="uid in importRowMatches[i]"
                  :key="uid"
                  :matched-user-id="uid"
                  @dismissed="importRowMatches[i] = importRowMatches[i]!.filter((u) => u !== uid)"
                />
              </template>
            </div>
            <span
              class="result-badge"
              :class="result.status === 'imported' ? 'badge-imported' : 'badge-skipped'"
            >
              {{
                result.status === 'imported'
                  ? t('contacts.list.importedLabel')
                  : t('contacts.list.skippedLabel')
              }}
            </span>
          </li>
        </ul>
        <div class="results-actions">
          <button type="button" class="add-manual-link" @click="switchAddToForm">
            <span class="material-symbols-outlined">add</span>
            {{ t('contacts.list.addManuallyBtn') }}
          </button>
          <button type="button" class="done-btn" @click="backToList">
            {{ t('contacts.addDialog.doneBtn') }}
          </button>
        </div>
      </div>

      <!-- Add form -->
      <div v-else class="form-wrapper">
        <div class="import-actions">
          <button
            type="button"
            class="import-btn"
            :disabled="isAddLoading"
            @click="handleFileImportClick"
          >
            <span class="material-symbols-outlined">upload_file</span>
            {{ t('contacts.addDialog.importFileBtn') }}
          </button>
          <button
            v-if="isContactPickerSupported"
            type="button"
            class="import-btn"
            :disabled="isAddLoading"
            @click="handleContactPickerImport"
          >
            <span class="material-symbols-outlined">contacts</span>
            {{ t('contacts.addDialog.importContactsBtn') }}
          </button>
          <input
            ref="fileInput"
            type="file"
            accept=".vcf,.vcard"
            class="file-input-hidden"
            @change="handleFileChange"
          ><!-- no multiple attribute: single file only -->
        </div>

        <div class="divider" />

        <p v-if="addError" class="error-text">
          {{ addError }}
        </p>

        <ContactForm
          :submit-label="t('contacts.addDialog.title')"
          :is-loading="isAddLoading"
          @submit="handleAddSubmit"
          @cancel="backToList"
          @phone-change="onFormPhoneInput"
        />
        <ConnectPrompt
          v-if="manualPromptUserId && !manualPromptDismissed"
          :matched-user-id="manualPromptUserId"
          @sent="manualPromptDismissed = true"
          @dismissed="manualPromptDismissed = true"
        />
      </div>
    </div>
  </AdaptiveOverlay>
</template>

<style scoped>
/* ── List view ── */
.list-view {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.list-actions-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.add-contact-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-md);
  border: 1.5px solid var(--color-outline-variant);
  color: var(--color-on-surface-variant);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  transition: background-color 0.15s;
}

.add-contact-btn:hover {
  background-color: var(--color-surface-variant);
}

.add-contact-btn .material-symbols-outlined {
  font-size: 18px;
}

.friend-requests-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-md);
  border: 1.5px solid var(--color-outline-variant);
  color: var(--color-on-surface-variant);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  transition: background-color 0.15s;
}

.friend-requests-btn:hover {
  background-color: var(--color-surface-variant);
}

.friend-requests-btn .material-symbols-outlined {
  font-size: 18px;
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 9999px;
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
}

.loading-text {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
  text-align: center;
  padding: var(--spacing-xl) 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xl) 0;
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  color: var(--color-outline-variant);
}

.empty-text {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-on-surface-variant);
}

.empty-sub {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
  opacity: 0.7;
}

.contacts-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.contact-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color 0.15s;
}

.contact-row:hover {
  background-color: var(--color-surface-variant);
}

.contact-avatar {
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

.contact-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.contact-name-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.contact-name {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-on-surface);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.friend-icon {
  font-size: 16px;
  color: #f97316;
  flex-shrink: 0;
}

.contact-subtitle {
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

.detail-connect-prompt {
  margin-top: var(--spacing-md);
}

/* ── Add view ── */
.add-view {
  display: flex;
  flex-direction: column;
}

.form-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.import-actions {
  display: flex;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.import-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-md);
  border: 1.5px solid var(--color-outline-variant);
  color: var(--color-on-surface-variant);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  transition: background-color 0.2s;
}

.import-btn:hover:not(:disabled) {
  background-color: var(--color-surface-variant);
}

.import-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.import-btn .material-symbols-outlined {
  font-size: 18px;
}

.file-input-hidden {
  display: none;
}

.divider {
  height: 1px;
  background-color: var(--color-outline-variant);
}

.error-text {
  color: var(--color-error);
  font-size: var(--font-size-sm);
}

/* ── Import results ── */
.results-view {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.results-summary {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-on-surface-variant);
}

.results-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  max-height: 280px;
  overflow-y: auto;
}

.result-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-sm);
  background-color: var(--color-surface-variant);
}

.result-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.result-name {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-on-surface);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-phone {
  font-size: var(--font-size-xs, 11px);
  color: var(--color-on-surface-variant);
  display: flex;
  align-items: center;
  gap: 3px;
}

.result-phone-warning {
  color: var(--color-error);
}

.star-icon-sm {
  font-size: 12px;
  color: var(--color-primary);
  font-variation-settings: 'FILL' 1;
}

.extra-phones {
  opacity: 0.7;
}

.result-badge {
  flex-shrink: 0;
  padding: 2px var(--spacing-sm);
  border-radius: 9999px;
  font-size: var(--font-size-xs, 11px);
  font-weight: var(--font-weight-medium);
}

.badge-imported {
  background-color: color-mix(in srgb, var(--color-primary) 12%, transparent);
  color: var(--color-primary);
}

.badge-skipped {
  background-color: var(--color-surface-variant);
  border: 1px solid var(--color-outline-variant);
  color: var(--color-on-surface-variant);
}

.results-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
}

.add-manual-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  transition: opacity 0.15s;
}

.add-manual-link:hover {
  opacity: 0.75;
}

.add-manual-link .material-symbols-outlined {
  font-size: 16px;
}

.done-btn {
  padding: var(--spacing-sm) var(--spacing-lg);
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  border-radius: 12px;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  transition: background-color 0.2s;
}

.done-btn:hover {
  background-color: var(--color-primary-dark);
}
</style>
