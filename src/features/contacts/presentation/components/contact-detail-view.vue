<script setup lang="ts">
import type { Contact } from '@/features/contacts/domain/entities/contact'
import type { ContactMethod } from '@/features/contacts/domain/entities/contact-method'
import type { NewContactMethod } from '@/features/contacts/domain/repositories/contact-methods-repository'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAsYouTypePhone } from '@/core/composables/use-as-you-type-phone'
import { normalizePhone } from '@/core/utils/phone-normalize'
import { orderedPhoneMethods } from '@/features/contacts/core/utils/order-phone-methods'
import { formatPhoneDisplay } from '@/features/contacts/domain/entities/contact'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'

const props = defineProps<{ contact: Contact }>()

const emit = defineEmits<{ back: []; deleted: [] }>()

const { t } = useI18n({ useScope: 'global' })

const store = useContactsStore()

const orderedPhones = computed(() => orderedPhoneMethods(props.contact))
const setPrimaryError = ref<string | null>(null)

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
    nameError.value = t('contacts.detailView.firstNameRequired')
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
  } catch (err) {
    nameError.value = err instanceof Error ? err.message : 'Failed to save'
  } finally {
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
        if (methodEdits.value[method.id]) methodEdits.value[method.id]!.value = v
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

  if (method.methodType === 'phone') {
    const rawValue = edit.value.trim()
    if (rawValue) {
      const result = normalizePhone(rawValue)
      if (!result.ok) {
        edit.error = t('contacts.detailView.invalidPhone')
        return
      }
    }
  }

  edit.saving = true
  try {
    await store.updateMethodOnContact(props.contact.id, method.id, {
      value: edit.value.trim(),
      label: edit.label.trim() || null,
    })
    const updated = props.contact.contactMethods.find((m) => m.id === method.id)
    if (updated) edit.value = methodDisplayValue(updated)
  } catch (err) {
    edit.error = err instanceof Error ? err.message : 'Failed to save'
  } finally {
    edit.saving = false
  }
}

async function removeMethod(methodId: string) {
  await store.removeMethodFromContact(props.contact.id, methodId)
  delete methodEdits.value[methodId]
  phoneFormatterCache.delete(methodId)
}

async function setPrimaryPhone(method: ContactMethod) {
  if (method.isPrimary) return
  setPrimaryError.value = null
  try {
    await store.setPrimaryPhoneOnContact(props.contact.id, method.id)
  } catch (err) {
    setPrimaryError.value = err instanceof Error ? err.message : 'Failed to update primary phone'
  }
}

// ── Add method ───────────────────────────────────────────────────────────────
const showAddMethod = ref(false)
const newMethodType = ref<'phone' | 'email'>('phone')
const newMethodValue = ref('')
const { formatted: newMethodPhoneFormatted, onInput: onNewMethodPhoneInput } =
  useAsYouTypePhone(newMethodValue)
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
    addMethodError.value = t('contacts.detailView.valueRequired')
    return
  }
  if (newMethodType.value === 'phone') {
    const result = normalizePhone(newMethodValue.value.trim())
    if (!result.ok) {
      addMethodError.value = t('contacts.detailView.invalidPhone')
      return
    }
  }
  isAddingMethod.value = true
  try {
    const method: NewContactMethod = {
      methodType: newMethodType.value,
      value: newMethodValue.value.trim(),
      label: newMethodLabel.value.trim() || null,
      isPrimary:
        props.contact.contactMethods.filter((m) => m.methodType === newMethodType.value).length ===
        0,
    }
    await store.addMethodToContact(props.contact.id, method)
    showAddMethod.value = false
  } catch (err) {
    addMethodError.value = err instanceof Error ? err.message : t('contacts.detailView.addError')
  } finally {
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
  } catch (err) {
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
      <span class="detail-title">{{ t('contacts.detailView.title') }}</span>
    </div>

    <!-- Name fields -->
    <section class="section">
      <h3 class="section-label">
        {{ t('contacts.detailView.nameSection') }}
      </h3>
      <div class="field">
        <label class="label" for="dv-firstName">{{ t('contacts.form.firstNameLabel')}}<span class="required">*</span></label>
        <input
          id="dv-firstName"
          v-model="firstName"
          class="input"
          type="text"
          maxlength="50"
          :placeholder="t('contacts.form.firstNamePlaceholder')"
        />
      </div>
      <div class="field">
        <label class="label" for="dv-lastName">{{ t('contacts.form.lastNameLabel') }}</label>
        <input
          id="dv-lastName"
          v-model="lastName"
          class="input"
          type="text"
          maxlength="50"
          :placeholder="t('contacts.form.lastNamePlaceholder')"
        />
      </div>
      <div class="field">
        <label class="label" for="dv-displayName">{{ t('contacts.form.displayNameLabel') }}</label>
        <input
          id="dv-displayName"
          v-model="displayName"
          class="input"
          type="text"
          maxlength="50"
          :placeholder="t('contacts.form.displayNamePlaceholder')"
        />
      </div>
      <p v-if="nameError" class="error-text">
        {{ nameError }}
      </p>
      <button type="button" class="save-btn" :disabled="isSavingName" @click="saveName">
        {{
          isSavingName ? t('contacts.detailView.savingBtn') : t('contacts.detailView.saveNameBtn')
        }}
      </button>
    </section>

    <!-- Contact methods -->
    <section class="section">
      <h3 class="section-label">
        {{ t('contacts.detailView.methodsSection') }}
      </h3>

      <div v-if="contact.contactMethods.length === 0" class="empty-methods">
        {{ t('contacts.detailView.noMethods') }}
      </div>

      <p v-if="setPrimaryError" class="error-text">
        {{ setPrimaryError }}
      </p>

      <!-- Phone methods: ordered primary-first with star selector -->
      <div v-for="method in orderedPhones" :key="method.id" class="method-row">
        <button
          type="button"
          class="primary-star"
          :class="{ 'primary-star--selected': method.isPrimary }"
          :title="
            method.isPrimary
              ? t('contacts.detailView.primaryPhoneTooltip')
              : t('contacts.detailView.setAsPrimaryTooltip')
          "
          @click="setPrimaryPhone(method)"
        >
          <span class="material-symbols-outlined">star</span>
        </button>
        <div class="method-type-badge">
          <span class="material-symbols-outlined">phone</span>
        </div>
        <div class="method-fields">
          <p v-if="!method.isValid" class="invalid-phone-hint">
            <span class="material-symbols-outlined warn-icon">warning</span>
            {{ t('contacts.detailView.invalidPhoneHint') }}
          </p>
          <input
            :value="getPhoneFormatter(method).formatted.value"
            class="input input-sm"
            :class="{ 'input--warning': !method.isValid }"
            type="tel"
            :placeholder="t('contacts.detailView.phonePlaceholder')"
            @input="getPhoneFormatter(method).onInput"
          />
          <input
            v-model="getMethodEdit(method).label"
            class="input input-sm"
            type="text"
            :placeholder="t('contacts.detailView.labelPlaceholder')"
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

      <!-- Non-phone methods (email etc.) -->
      <div
        v-for="method in contact.contactMethods.filter((m) => m.methodType !== 'phone')"
        :key="method.id"
        class="method-row"
      >
        <div class="method-type-badge">
          <span class="material-symbols-outlined">mail</span>
        </div>
        <div class="method-fields">
          <input
            v-model="getMethodEdit(method).value"
            class="input input-sm"
            type="email"
            :placeholder="t('contacts.detailView.emailPlaceholder')"
          />
          <input
            v-model="getMethodEdit(method).label"
            class="input input-sm"
            type="text"
            :placeholder="t('contacts.detailView.labelPlaceholder')"
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
            {{ t('contacts.detailView.phoneTypeBtn') }}
          </button>
          <button
            type="button"
            class="type-btn"
            :class="{ 'type-btn--active': newMethodType === 'email' }"
            @click="newMethodType = 'email'"
          >
            <span class="material-symbols-outlined">mail</span>
            {{ t('contacts.detailView.emailTypeBtn') }}
          </button>
        </div>
        <input
          v-if="newMethodType === 'phone'"
          :value="newMethodPhoneFormatted"
          class="input"
          type="tel"
          :placeholder="t('contacts.detailView.phonePlaceholder')"
          @input="onNewMethodPhoneInput"
        />
        <input
          v-else
          v-model="newMethodValue"
          class="input"
          type="email"
          :placeholder="t('contacts.detailView.emailPlaceholder')"
        />
        <input
          v-model="newMethodLabel"
          class="input"
          type="text"
          :placeholder="t('contacts.detailView.labelExamplePlaceholder')"
        />
        <p v-if="addMethodError" class="error-text">
          {{ addMethodError }}
        </p>
        <div class="add-method-actions">
          <button type="button" class="cancel-btn" @click="cancelAddMethod">
            {{ t('contacts.shared.cancelBtn') }}
          </button>
          <button
            type="button"
            class="save-btn"
            :disabled="isAddingMethod"
            @click="confirmAddMethod"
          >
            {{
              isAddingMethod ? t('contacts.detailView.addingBtn') : t('contacts.detailView.addBtn')
            }}
          </button>
        </div>
      </div>

      <button v-else type="button" class="add-method-btn" @click="openAddMethod">
        <span class="material-symbols-outlined">add</span>
        {{ t('contacts.detailView.addMethodBtn') }}
      </button>
    </section>

    <!-- Delete -->
    <section class="section section--danger">
      <p v-if="deleteError" class="error-text">
        {{ deleteError }}
      </p>

      <template v-if="deleteState === 'confirm'">
        <p class="delete-confirm-text">
          {{ t('contacts.detailView.deleteConfirm') }}
        </p>
        <div class="delete-actions">
          <button type="button" class="cancel-btn" @click="deleteState = 'idle'">
            {{ t('contacts.shared.cancelBtn') }}
          </button>
          <button type="button" class="delete-confirm-btn" @click="confirmDelete">
            {{ t('contacts.detailView.deleteBtn') }}
          </button>
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
        {{
          deleteState === 'loading'
            ? t('contacts.detailView.deletingBtn')
            : t('contacts.detailView.deleteBtn')
        }}
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

.input--warning {
  border-color: var(--color-warning, #f59e0b);
}

.invalid-phone-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--font-size-xs, 11px);
  color: var(--color-warning, #f59e0b);
}

.warn-icon {
  font-size: 14px;
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

.primary-star {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-outline-variant);
  flex-shrink: 0;
  margin-top: 4px;
  transition: color 0.15s;
}

.primary-star .material-symbols-outlined {
  font-size: 18px;
  font-variation-settings: 'FILL' 0;
}

.primary-star--selected {
  color: var(--color-primary);
}

.primary-star--selected .material-symbols-outlined {
  font-variation-settings: 'FILL' 1;
}

.primary-star:hover {
  color: var(--color-primary);
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
