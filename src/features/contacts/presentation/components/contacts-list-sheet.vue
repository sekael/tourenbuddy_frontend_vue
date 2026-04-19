<script setup lang="ts">
import type { Contact } from '@/features/contacts/domain/entities/contact'
import type { PhoneEntry } from '@/features/contacts/presentation/stores/contacts-store'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import AdaptiveOverlay from '@/core/components/adaptive-overlay.vue'
import {
  formatPhoneDisplay,
  getPrimaryPhone,
  resolveContactName,
  resolveFullName,
} from '@/features/contacts/domain/entities/contact'
import { useContactPicker } from '@/features/contacts/presentation/composables/use-contact-picker'
import { useVCardImport } from '@/features/contacts/presentation/composables/use-vcard-import'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'
import ContactDetailView from './contact-detail-view.vue'
import ContactForm from './contact-form.vue'

type ViewState = 'list' | 'detail' | 'add'

const emit = defineEmits<{ close: [] }>()

const contactsStore = useContactsStore()
const { contacts, isLoading } = storeToRefs(contactsStore)

const viewState = ref<ViewState>('list')
const selectedContact = ref<Contact | null>(null)

const sheetTitle = computed(() => {
  if (viewState.value === 'add')
    return 'Add Contact'
  if (viewState.value === 'detail')
    return null
  return 'Contacts'
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
    addError.value = err instanceof Error ? err.message : 'Failed to add contact'
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
}

async function handleContactPickerImport() {
  isAddLoading.value = true
  addError.value = null
  try {
    const picked = await pickContacts()
    await processImportedContacts(picked)
  }
  catch (err) {
    addError.value = err instanceof Error ? err.message : 'Import failed'
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
    addError.value = err instanceof Error ? err.message : 'File import failed'
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
}
</script>

<template>
  <AdaptiveOverlay :title="sheetTitle ?? undefined" @close="handleClose">
    <!-- List view -->
    <div v-if="viewState === 'list'" class="list-view">
      <button type="button" class="add-contact-btn" @click="openAdd">
        <span class="material-symbols-outlined">person_add</span>
        Add contact
      </button>

      <div v-if="isLoading" class="loading-text">
        Loading…
      </div>

      <div v-else-if="contacts.length === 0" class="empty-state">
        <span class="material-symbols-outlined empty-icon">group</span>
        <p class="empty-text">
          No contacts yet.
        </p>
        <p class="empty-sub">
          Add contacts to use them as tour partners.
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
            <span class="contact-name">{{ resolveContactName(contact) }}</span>
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
        @back="backToList"
        @deleted="handleContactDeleted"
      />
    </div>

    <!-- Add contact view -->
    <div v-else-if="viewState === 'add'" class="add-view">
      <!-- Import results -->
      <div v-if="addViewState === 'import-results'" class="results-view">
        <p class="results-summary">
          {{ importResults.filter((r) => r.status === 'imported').length }} imported
          <template v-if="importResults.some((r) => r.status === 'skipped')">
            · {{ importResults.filter((r) => r.status === 'skipped').length }} skipped
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
                ⚠ Couldn't add invalid phone number: {{ result.rawPhoneNumbers[0]
                }}{{
                  result.rawPhoneNumbers.length > 1
                    ? ` +${result.rawPhoneNumbers.length - 1} more`
                    : ''
                }}
              </span>
            </div>
            <span
              class="result-badge"
              :class="result.status === 'imported' ? 'badge-imported' : 'badge-skipped'"
            >
              {{ result.status === 'imported' ? 'Imported' : 'Skipped' }}
            </span>
          </li>
        </ul>
        <div class="results-actions">
          <button type="button" class="add-manual-link" @click="switchAddToForm">
            <span class="material-symbols-outlined">add</span>
            Add another manually
          </button>
          <button type="button" class="done-btn" @click="backToList">
            Done
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
            Import from file
          </button>
          <button
            v-if="isContactPickerSupported"
            type="button"
            class="import-btn"
            :disabled="isAddLoading"
            @click="handleContactPickerImport"
          >
            <span class="material-symbols-outlined">contacts</span>
            Import from contacts
          </button>
          <input
            ref="fileInput"
            type="file"
            accept=".vcf,.vcard"
            class="file-input-hidden"
            @change="handleFileChange"
          >
        </div>

        <div class="divider" />

        <p v-if="addError" class="error-text">
          {{ addError }}
        </p>

        <ContactForm
          submit-label="Add Contact"
          :is-loading="isAddLoading"
          @submit="handleAddSubmit"
          @cancel="backToList"
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
  align-self: flex-start;
  transition: background-color 0.15s;
}

.add-contact-btn:hover {
  background-color: var(--color-surface-variant);
}

.add-contact-btn .material-symbols-outlined {
  font-size: 18px;
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

.contact-name {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-on-surface);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
