<script setup lang="ts">
import type { Contact } from '@/features/contacts/domain/entities/contact'
import type { ContactMethod } from '@/features/contacts/domain/entities/contact-method'
import type { NewContactMethod } from '@/features/contacts/domain/repositories/contact-methods-repository'
import { computed, ref, watch } from 'vue'
import { useAsYouTypePhone } from '@/core/composables/use-as-you-type-phone'
import { formatPhoneDisplay } from '@/features/contacts/domain/entities/contact'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'

const props = defineProps<{ contact: Contact }>()
const emit = defineEmits<{ back: [], deleted: [] }>()

const store = useContactsStore()

// ── Name edit state ──────────────────────────────────────────────────────────
const firstName = ref(props.contact.firstName)
const lastName = ref(props.contact.lastName ?? '')
const displayName = ref(props.contact.displayName ?? '')
const nameError = ref<string | null>(null)
const isSavingName = ref(false)

watch(
  () => props.contact,
  (c) => {
    firstName.value = c.firstName
    lastName.value = c.lastName ?? ''
    displayName.value = c.displayName ?? ''
  },
)

async function saveName() {
  nameError.value = null
  if (!firstName.value.trim()) {
    nameError.value = 'First name is required'
    return
  }
  isSavingName.value = true
  try {
    await store.updateContact(props.contact.id, {
      firstName: firstName.value.trim(),
      lastName: lastName.value.trim() || null,
      displayName: displayName.value.trim() || null,
    })
    emit('back')
  }
  catch (err) {
    nameError.value = err instanceof Error ? err.message : 'Failed to save'
  }
  finally {
    isSavingName.value = false
  }
}

// ── Method editing ───────────────────────────────────────────────────────────
interface MethodEditState {
  value: string
  label: string
  saving: boolean
  error: string | null
}

const methodEdits = ref<Record<string, MethodEditState>>({})

// Per-method phone formatter cache. Each phone-method edit row gets its own AsYouType instance.
const phoneFormatterCache = new Map<string, ReturnType<typeof useAsYouTypePhone>>()

function getPhoneFormatter(method: ContactMethod) {
  if (!phoneFormatterCache.has(method.id)) {
    const phoneRef = computed({
      get: () => methodEdits.value[method.id]?.value ?? '',
      set: (v: string) => {
        if (methodEdits.value[method.id])
          methodEdits.value[method.id]!.value = v
      },
    })
    phoneFormatterCache.set(method.id, useAsYouTypePhone(phoneRef))
  }
  return phoneFormatterCache.get(method.id)!
}

function methodDisplayValue(m: ContactMethod): string {
  return m.methodType === 'phone' ? formatPhoneDisplay(m.value) : m.value
}

function getMethodEdit(m: ContactMethod): MethodEditState {
  if (!methodEdits.value[m.id]) {
    methodEdits.value[m.id] = {
      value: methodDisplayValue(m),
      label: m.label ?? '',
      saving: false,
      error: null,
    }
  }
  return methodEdits.value[m.id]!
}

watch(
  () => props.contact.contactMethods,
  (methods) => {
    for (const m of methods) {
      if (!methodEdits.value[m.id]) {
        methodEdits.value[m.id] = {
          value: methodDisplayValue(m),
          label: m.label ?? '',
          saving: false,
          error: null,
        }
      }
    }
  },
  { immediate: true },
)

async function saveMethod(method: ContactMethod) {
  const edit = getMethodEdit(method)
  edit.error = null
  edit.saving = true
  try {
    await store.updateMethodOnContact(props.contact.id, method.id, {
      value: edit.value.trim(),
      label: edit.label.trim() || null,
    })
  }
  catch (err) {
    edit.error = err instanceof Error ? err.message : 'Failed to save'
  }
  finally {
    edit.saving = false
  }
}

async function removeMethod(methodId: string) {
  await store.removeMethodFromContact(props.contact.id, methodId)
  delete methodEdits.value[methodId]
}

// ── Add method ───────────────────────────────────────────────────────────────
const showAddMethod = ref(false)
const newMethodType = ref<'phone' | 'email'>('phone')
const newMethodValue = ref('')
const { formatted: newMethodPhoneFormatted, onInput: onNewMethodPhoneInput }
  = useAsYouTypePhone(newMethodValue)
const newMethodLabel = ref('')
const isAddingMethod = ref(false)
const addMethodError = ref<string | null>(null)

function openAddMethod() {
  showAddMethod.value = true
  newMethodType.value = 'phone'
  newMethodValue.value = ''
  newMethodLabel.value = ''
  addMethodError.value = null
}

function cancelAddMethod() {
  showAddMethod.value = false
}

async function confirmAddMethod() {
  addMethodError.value = null
  if (!newMethodValue.value.trim()) {
    addMethodError.value = 'Value is required'
    return
  }
  isAddingMethod.value = true
  try {
    const method: NewContactMethod = {
      methodType: newMethodType.value,
      value: newMethodValue.value.trim(),
      label: newMethodLabel.value.trim() || null,
      isPrimary:
        props.contact.contactMethods.filter(m => m.methodType === newMethodType.value).length
        === 0,
    }
    await store.addMethodToContact(props.contact.id, method)
    showAddMethod.value = false
  }
  catch (err) {
    addMethodError.value = err instanceof Error ? err.message : 'Failed to add'
  }
  finally {
    isAddingMethod.value = false
  }
}

// ── Delete ───────────────────────────────────────────────────────────────────
const deleteState = ref<'idle' | 'confirm' | 'loading'>('idle')
const deleteError = ref<string | null>(null)

async function confirmDelete() {
  deleteError.value = null
  deleteState.value = 'loading'
  try {
    await store.deleteContact(props.contact.id)
    emit('deleted')
  }
  catch (err) {
    deleteError.value = err instanceof Error ? err.message : 'Failed to delete'
    deleteState.value = 'idle'
  }
}
</script>

<template>
  <div class="detail-view">
    <!-- Header -->
    <div class="detail-header">
      <button type="button" class="back-btn" @click="emit('back')">
        <span class="material-symbols-outlined">arrow_back</span>
      </button>
      <span class="detail-title">Edit Contact</span>
    </div>

    <!-- Name fields -->
    <section class="section">
      <h3 class="section-label">Name</h3>
      <div class="field">
        <label class="label" for="dv-firstName">First Name <span class="required">*</span></label>
        <input
          id="dv-firstName"
          v-model="firstName"
          class="input"
          type="text"
          maxlength="50"
          placeholder="First name"
        />
      </div>
      <div class="field">
        <label class="label" for="dv-lastName">Last Name</label>
        <input
          id="dv-lastName"
          v-model="lastName"
          class="input"
          type="text"
          maxlength="50"
          placeholder="Last name (optional)"
        />
      </div>
      <div class="field">
        <label class="label" for="dv-displayName">Display Name</label>
        <input
          id="dv-displayName"
          v-model="displayName"
          class="input"
          type="text"
          maxlength="50"
          placeholder="Nickname (optional)"
        />
      </div>
      <p v-if="nameError" class="error-text">
        {{ nameError }}
      </p>
      <button type="button" class="save-btn" :disabled="isSavingName" @click="saveName">
        {{ isSavingName ? 'Saving...' : 'Save name' }}
      </button>
    </section>

    <!-- Contact methods -->
    <section class="section">
      <h3 class="section-label">Contact methods</h3>

      <div v-if="contact.contactMethods.length === 0" class="empty-methods">
        No contact methods yet.
      </div>

      <div v-for="method in contact.contactMethods" :key="method.id" class="method-row">
        <div class="method-type-badge">
          <span class="material-symbols-outlined">{{
            method.methodType === 'phone' ? 'phone' : 'mail'
          }}</span>
        </div>
        <div class="method-fields">
          <input
            v-if="method.methodType === 'phone'"
            :value="getPhoneFormatter(method).formatted.value"
            class="input input-sm"
            type="tel"
            placeholder="+41 79 012 34 56"
            @input="getPhoneFormatter(method).onInput"
          />
          <input
            v-else
            v-model="getMethodEdit(method).value"
            class="input input-sm"
            type="email"
            placeholder="Value"
          />
          <input
            v-model="getMethodEdit(method).label"
            class="input input-sm"
            type="text"
            placeholder="Label (optional)"
          />
          <p v-if="getMethodEdit(method).error" class="error-text">
            {{ getMethodEdit(method).error }}
          </p>
        </div>
        <div class="method-actions">
          <button
            type="button"
            class="icon-btn"
            :disabled="getMethodEdit(method).saving"
            @click="saveMethod(method)"
          >
            <span class="material-symbols-outlined">check</span>
          </button>
          <button type="button" class="icon-btn icon-btn--danger" @click="removeMethod(method.id)">
            <span class="material-symbols-outlined">delete</span>
          </button>
        </div>
      </div>

      <!-- Add method form -->
      <div v-if="showAddMethod" class="add-method-form">
        <div class="type-selector">
          <button
            type="button"
            class="type-btn"
            :class="{ 'type-btn--active': newMethodType === 'phone' }"
            @click="newMethodType = 'phone'"
          >
            <span class="material-symbols-outlined">phone</span>
            Phone
          </button>
          <button
            type="button"
            class="type-btn"
            :class="{ 'type-btn--active': newMethodType === 'email' }"
            @click="newMethodType = 'email'"
          >
            <span class="material-symbols-outlined">mail</span>
            Email
          </button>
        </div>
        <input
          v-if="newMethodType === 'phone'"
          :value="newMethodPhoneFormatted"
          class="input"
          type="tel"
          placeholder="+41 79 012 34 56"
          @input="onNewMethodPhoneInput"
        />
        <input
          v-else
          v-model="newMethodValue"
          class="input"
          type="email"
          placeholder="email@example.com"
        />
        <input
          v-model="newMethodLabel"
          class="input"
          type="text"
          placeholder="Label (optional, e.g. Mobile)"
        />
        <p v-if="addMethodError" class="error-text">
          {{ addMethodError }}
        </p>
        <div class="add-method-actions">
          <button type="button" class="cancel-btn" @click="cancelAddMethod">Cancel</button>
          <button
            type="button"
            class="save-btn"
            :disabled="isAddingMethod"
            @click="confirmAddMethod"
          >
            {{ isAddingMethod ? 'Adding...' : 'Add' }}
          </button>
        </div>
      </div>

      <button v-else type="button" class="add-method-btn" @click="openAddMethod">
        <span class="material-symbols-outlined">add</span>
        Add method
      </button>
    </section>

    <!-- Delete -->
    <section class="section section--danger">
      <p v-if="deleteError" class="error-text">
        {{ deleteError }}
      </p>

      <template v-if="deleteState === 'confirm'">
        <p class="delete-confirm-text">Delete this contact?</p>
        <div class="delete-actions">
          <button type="button" class="cancel-btn" @click="deleteState = 'idle'">Cancel</button>
          <button type="button" class="delete-confirm-btn" @click="confirmDelete">Delete</button>
        </div>
      </template>

      <button
        v-else
        type="button"
        class="delete-btn"
        :disabled="deleteState === 'loading'"
        @click="deleteState = 'confirm'"
      >
        <span class="material-symbols-outlined">person_remove</span>
        {{ deleteState === 'loading' ? 'Deleting...' : 'Delete contact' }}
      </button>
    </section>
  </div>
</template>

<style scoped>
.detail-view {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.detail-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-xs);
}

.back-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-on-surface-variant);
  transition: background-color 0.15s;
}

.back-btn:hover {
  background-color: var(--color-surface-variant);
}

.detail-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
}

.section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding-bottom: var(--spacing-md);
  border-bottom: 1px solid var(--color-outline-variant);
}

.section:last-child {
  border-bottom: none;
}

.section-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-on-surface-variant);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.label {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}

.required {
  color: var(--color-error);
}

.input {
  padding: var(--spacing-sm) var(--spacing-md);
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

.input-sm {
  font-size: var(--font-size-sm);
  padding: var(--spacing-xs) var(--spacing-sm);
}

.error-text {
  font-size: var(--font-size-sm);
  color: var(--color-error);
}

.save-btn {
  align-self: flex-end;
  padding: var(--spacing-xs) var(--spacing-lg);
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  border-radius: 10px;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  transition: background-color 0.2s;
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.empty-methods {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}

.method-row {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
}

.method-type-badge {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background-color: var(--color-surface-variant);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 2px;
}

.method-type-badge .material-symbols-outlined {
  font-size: 18px;
  color: var(--color-on-surface-variant);
}

.method-fields {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  min-width: 0;
}

.method-actions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  flex-shrink: 0;
}

.icon-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-on-surface-variant);
  transition: background-color 0.15s;
}

.icon-btn:hover {
  background-color: var(--color-surface-variant);
}

.icon-btn--danger:hover {
  background-color: color-mix(in srgb, var(--color-error) 12%, transparent);
  color: var(--color-error);
}

.icon-btn .material-symbols-outlined {
  font-size: 18px;
}

.add-method-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  transition: opacity 0.15s;
}

.add-method-btn:hover {
  opacity: 0.75;
}

.add-method-btn .material-symbols-outlined {
  font-size: 18px;
}

.add-method-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  background-color: var(--color-surface-variant);
}

.type-selector {
  display: flex;
  gap: var(--spacing-sm);
}

.type-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-md);
  border: 1.5px solid var(--color-outline-variant);
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
  transition: all 0.15s;
}

.type-btn .material-symbols-outlined {
  font-size: 16px;
}

.type-btn--active {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background-color: color-mix(in srgb, var(--color-primary) 8%, transparent);
}

.add-method-actions {
  display: flex;
  gap: var(--spacing-sm);
  justify-content: flex-end;
}

.cancel-btn {
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: 10px;
  border: 1px solid var(--color-outline-variant);
  color: var(--color-on-surface-variant);
  font-size: var(--font-size-sm);
  transition: background-color 0.15s;
}

.cancel-btn:hover {
  background-color: var(--color-surface-variant);
}

.section--danger {
  border-bottom: none;
  padding-top: var(--spacing-sm);
}

.delete-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  border: 1.5px solid var(--color-error);
  color: var(--color-error);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  transition: background-color 0.15s;
}

.delete-btn:hover:not(:disabled) {
  background-color: color-mix(in srgb, var(--color-error) 8%, transparent);
}

.delete-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.delete-btn .material-symbols-outlined {
  font-size: 18px;
}

.delete-confirm-text {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-error);
}

.delete-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.delete-confirm-btn {
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: 10px;
  background-color: var(--color-error);
  color: white;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  transition: opacity 0.15s;
}

.delete-confirm-btn:hover {
  opacity: 0.85;
}
</style>
