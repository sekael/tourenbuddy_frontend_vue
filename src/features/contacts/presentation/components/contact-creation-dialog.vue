<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { ref } from 'vue'
import BottomSheet from '@/core/components/bottom-sheet.vue'
import { useContactPicker } from '@/features/contacts/presentation/composables/use-contact-picker'
import { useVCardImport } from '@/features/contacts/presentation/composables/use-vcard-import'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'

const emit = defineEmits<{ close: [] }>()

const contactsStore = useContactsStore()
const { contacts } = storeToRefs(contactsStore)

const { isSupported: isContactPickerSupported, pickContacts } = useContactPicker()
const { parseVCardFile } = useVCardImport()

const firstName = ref('')
const lastName = ref('')
const displayName = ref('')
const phoneNumber = ref('')
const error = ref<string | null>(null)
const isLoading = ref(false)
const importMessage = ref<string | null>(null)

const fileInput = ref<HTMLInputElement | null>(null)

function isDuplicate(first: string, last: string | null): boolean {
  return contacts.value.some(
    (c) =>
      c.firstName.toLowerCase() === first.toLowerCase() &&
      (c.lastName ?? '').toLowerCase() === (last ?? '').toLowerCase(),
  )
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

async function handleContactPickerImport() {
  isLoading.value = true
  importMessage.value = null
  try {
    const picked = await pickContacts()
    let imported = 0
    let skipped = 0
    for (const contact of picked) {
      if (isDuplicate(contact.firstName, contact.lastName)) {
        skipped++
        continue
      }
      await contactsStore.addContact(contact.firstName, contact.lastName, null, contact.phoneNumber)
      imported++
    }
    importMessage.value = buildImportMessage(imported, skipped)
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
  importMessage.value = null
  try {
    const parsed = await parseVCardFile(file)
    let imported = 0
    let skipped = 0
    for (const contact of parsed) {
      if (isDuplicate(contact.firstName, contact.lastName)) {
        skipped++
        continue
      }
      await contactsStore.addContact(contact.firstName, contact.lastName, null, contact.phoneNumber)
      imported++
    }
    importMessage.value = buildImportMessage(imported, skipped)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'File import failed'
  } finally {
    isLoading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

function buildImportMessage(imported: number, skipped: number): string {
  const parts: string[] = []
  if (imported > 0) parts.push(`${imported} contact${imported !== 1 ? 's' : ''} imported`)
  if (skipped > 0) parts.push(`${skipped} skipped (already exist)`)
  return parts.join(', ')
}
</script>

<template>
  <BottomSheet title="Add Contact" @close="emit('close')">
    <form class="form" @submit.prevent="handleSubmit">
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

      <p v-if="importMessage" class="import-message">
        {{ importMessage }}
      </p>

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

.import-message {
  font-size: var(--font-size-sm);
  color: var(--color-primary);
  font-weight: var(--font-weight-medium);
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
</style>
