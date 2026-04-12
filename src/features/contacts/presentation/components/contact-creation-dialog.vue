<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { ref } from 'vue'
import BottomSheet from '@/core/components/bottom-sheet.vue'
import { useContactPicker } from '@/features/contacts/presentation/composables/use-contact-picker'
import { useVCardImport } from '@/features/contacts/presentation/composables/use-vcard-import'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'

interface ImportResult {
  firstName: string
  lastName: string | null
  phoneNumber: string | null
  status: 'imported' | 'skipped'
}

const emit = defineEmits<{ close: [] }>()

const contactsStore = useContactsStore()
const { contacts } = storeToRefs(contactsStore)

const { isSupported: isContactPickerSupported, pickContacts } = useContactPicker()
const { parseVCardFile } = useVCardImport()

// View state
const viewState = ref<'form' | 'import-results'>('form')
const importResults = ref<ImportResult[]>([])

// Form fields
const firstName = ref('')
const lastName = ref('')
const displayName = ref('')
const phoneNumber = ref('')
const error = ref<string | null>(null)
const isLoading = ref(false)

const fileInput = ref<HTMLInputElement | null>(null)

function isDuplicate(first: string, last: string | null): boolean {
  return contacts.value.some(
    (c) =>
      c.firstName.toLowerCase() === first.toLowerCase() &&
      (c.lastName ?? '').toLowerCase() === (last ?? '').toLowerCase(),
  )
}

function switchToForm() {
  viewState.value = 'form'
  importResults.value = []
  firstName.value = ''
  lastName.value = ''
  displayName.value = ''
  phoneNumber.value = ''
  error.value = null
}

async function handleSubmit() {
  error.value = null

  if (!firstName.value.trim()) {
    error.value = 'First name is required'
    return
  }

  isLoading.value = true
  try {
    await contactsStore.addContact(
      firstName.value,
      lastName.value || null,
      displayName.value || null,
      phoneNumber.value || null,
    )
    emit('close')
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to add contact'
  } finally {
    isLoading.value = false
  }
}

async function processImportedContacts(
  items: Array<{ firstName: string; lastName: string | null; phoneNumber: string | null }>,
) {
  const results: ImportResult[] = []

  for (const item of items) {
    if (isDuplicate(item.firstName, item.lastName)) {
      results.push({ ...item, status: 'skipped' })
      continue
    }
    await contactsStore.addContact(item.firstName, item.lastName, null, item.phoneNumber)
    results.push({ ...item, status: 'imported' })
  }

  importResults.value = results
  viewState.value = 'import-results'
}

async function handleContactPickerImport() {
  isLoading.value = true
  error.value = null
  try {
    const picked = await pickContacts()
    await processImportedContacts(picked)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Import failed'
  } finally {
    isLoading.value = false
  }
}

function handleFileImportClick() {
  fileInput.value?.click()
}

async function handleFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  isLoading.value = true
  error.value = null
  try {
    const parsed = await parseVCardFile(file)
    await processImportedContacts(parsed)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'File import failed'
  } finally {
    isLoading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}
</script>

<template>
  <BottomSheet title="Add Contact" @close="emit('close')">
    <!-- Import results view -->
    <div v-if="viewState === 'import-results'" class="results-view">
      <p class="results-summary">
        {{ importResults.filter((r) => r.status === 'imported').length }} imported
        <template v-if="importResults.some((r) => r.status === 'skipped')">
          · {{ importResults.filter((r) => r.status === 'skipped').length }} skipped
        </template>
      </p>

      <ul class="results-list">
        <li v-for="(result, i) in importResults" :key="i" class="result-item">
          <div class="result-info">
            <span class="result-name">
              {{ result.firstName }}{{ result.lastName ? ` ${result.lastName}` : '' }}
            </span>
            <span v-if="result.phoneNumber" class="result-phone">{{ result.phoneNumber }}</span>
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
        <button type="button" class="add-manual-link" @click="switchToForm">
          <span class="material-symbols-outlined">add</span>
          Add another manually
        </button>
        <button type="button" class="submit-btn" @click="emit('close')">Done</button>
      </div>
    </div>

    <!-- Form view -->
    <form v-else class="form" @submit.prevent="handleSubmit">
      <div class="import-actions">
        <button
          type="button"
          class="import-btn"
          :disabled="isLoading"
          @click="handleFileImportClick"
        >
          <span class="material-symbols-outlined">upload_file</span>
          Import from file
        </button>
        <button
          v-if="isContactPickerSupported"
          type="button"
          class="import-btn"
          :disabled="isLoading"
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
        />
      </div>

      <div class="divider" />

      <div class="field">
        <label class="label" for="firstName">First Name <span class="required">*</span></label>
        <input
          id="firstName"
          v-model="firstName"
          class="input"
          type="text"
          maxlength="50"
          placeholder="First name"
          required
        />
      </div>

      <div class="field">
        <label class="label" for="lastName">Last Name</label>
        <input
          id="lastName"
          v-model="lastName"
          class="input"
          type="text"
          maxlength="50"
          placeholder="Last name (optional)"
        />
      </div>

      <div class="field">
        <label class="label" for="displayName">Display Name</label>
        <input
          id="displayName"
          v-model="displayName"
          class="input"
          type="text"
          maxlength="50"
          placeholder="Nickname (optional)"
        />
      </div>

      <div class="field">
        <label class="label" for="phoneNumber">Phone Number</label>
        <input
          id="phoneNumber"
          v-model="phoneNumber"
          class="input"
          type="tel"
          placeholder="+41 79 123 45 67 (optional)"
        />
      </div>

      <p v-if="error" class="error-text">
        {{ error }}
      </p>

      <div class="actions">
        <button type="button" class="cancel-btn" @click="emit('close')">Cancel</button>
        <button type="submit" class="submit-btn" :disabled="isLoading">
          {{ isLoading ? 'Saving...' : 'Add Contact' }}
        </button>
      </div>
    </form>
  </BottomSheet>
</template>

<style scoped>
/* ── Form view ── */
.form {
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

.field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-on-surface-variant);
}

.required {
  color: var(--color-error);
}

.input {
  padding: var(--spacing-md);
  border: 1.5px solid var(--color-outline-variant);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-base);
  color: var(--color-on-surface);
  background-color: var(--color-background);
  outline: none;
  transition: border-color 0.2s;
}

.input:focus {
  border-color: var(--color-primary);
}

.error-text {
  color: var(--color-error);
  font-size: var(--font-size-sm);
}

.actions {
  display: flex;
  gap: var(--spacing-md);
  justify-content: flex-end;
}

.cancel-btn {
  padding: var(--spacing-sm) var(--spacing-lg);
  border-radius: 12px;
  border: 1px solid var(--color-outline-variant);
  color: var(--color-on-surface-variant);
  font-size: var(--font-size-base);
  transition: background-color 0.2s;
}

.cancel-btn:hover {
  background-color: var(--color-surface-variant);
}

.submit-btn {
  padding: var(--spacing-sm) var(--spacing-lg);
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  border-radius: 12px;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  transition:
    background-color 0.2s,
    transform 0.15s;
}

.submit-btn:hover:not(:disabled) {
  background-color: var(--color-primary-dark);
  transform: translateY(-1px);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ── Import results view ── */
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
</style>
