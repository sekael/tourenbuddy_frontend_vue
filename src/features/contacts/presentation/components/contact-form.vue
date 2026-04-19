<script setup lang="ts">
import type { PhoneEntry } from '@/features/contacts/presentation/stores/contacts-store'
import { ref, watch } from 'vue'
import { useAsYouTypePhone } from '@/core/composables/use-as-you-type-phone'

interface PhoneRow {
  value: string
  label: string
  isPrimary: boolean
}

interface Props {
  initialFirstName?: string
  initialLastName?: string
  initialDisplayName?: string
  submitLabel?: string
  isLoading?: boolean
}

interface FormData {
  firstName: string
  lastName: string | null
  displayName: string | null
  phones: PhoneEntry[]
}

const props = withDefaults(defineProps<Props>(), {
  initialFirstName: '',
  initialLastName: '',
  initialDisplayName: '',
  submitLabel: 'Save',
  isLoading: false,
})

const emit = defineEmits<{
  submit: [data: FormData]
  cancel: []
}>()

const firstName = ref(props.initialFirstName)
const lastName = ref(props.initialLastName)
const displayName = ref(props.initialDisplayName)

const phoneRows = ref<PhoneRow[]>([{ value: '', label: '', isPrimary: true }])
const phoneFormatters = ref<ReturnType<typeof useAsYouTypePhone>[]>([])
const error = ref<string | null>(null)

function ensureFormatter(index: number) {
  while (phoneFormatters.value.length <= index) {
    const rowRef = ref(phoneRows.value[phoneFormatters.value.length]?.value ?? '')
    phoneFormatters.value.push(useAsYouTypePhone(rowRef))
  }
}

ensureFormatter(0)

watch(
  () => props.initialFirstName,
  v => (firstName.value = v ?? ''),
)
watch(
  () => props.initialLastName,
  v => (lastName.value = v ?? ''),
)
watch(
  () => props.initialDisplayName,
  v => (displayName.value = v ?? ''),
)

function addPhoneRow() {
  phoneRows.value.push({ value: '', label: '', isPrimary: false })
  const rowRef = ref('')
  phoneFormatters.value.push(useAsYouTypePhone(rowRef))
}

function removePhoneRow(index: number) {
  const wasPrimary = phoneRows.value[index]?.isPrimary
  phoneRows.value.splice(index, 1)
  phoneFormatters.value.splice(index, 1)
  if (wasPrimary && phoneRows.value.length > 0) {
    phoneRows.value[0]!.isPrimary = true
  }
}

function selectPrimary(index: number) {
  phoneRows.value.forEach((row, i) => {
    row.isPrimary = i === index
  })
}

function handlePhoneInput(index: number, event: Event) {
  const input = event.target as HTMLInputElement
  phoneFormatters.value[index]?.onInput(event)
  phoneRows.value[index]!.value = phoneFormatters.value[index]?.formatted.value ?? input.value
}

function handleSubmit() {
  error.value = null

  if (!firstName.value.trim()) {
    error.value = 'First name is required'
    return
  }

  const nonEmpty = phoneRows.value.filter(r => r.value.trim())
  if (nonEmpty.length > 1) {
    const primaryCount = nonEmpty.filter(r => r.isPrimary).length
    if (primaryCount !== 1) {
      error.value = 'Select one primary phone when multiple phones are entered'
      return
    }
  }

  const phones: PhoneEntry[] = nonEmpty.map(row => ({
    value: row.value.trim(),
    label: row.label.trim() || null,
    isPrimary: nonEmpty.length === 1 ? true : row.isPrimary,
  }))

  emit('submit', {
    firstName: firstName.value.trim(),
    lastName: lastName.value?.trim() || null,
    displayName: displayName.value?.trim() || null,
    phones,
  })
}
</script>

<template>
  <form class="form" @submit.prevent="handleSubmit">
    <div class="field">
      <label class="label" for="cf-firstName">First Name <span class="required">*</span></label>
      <input
        id="cf-firstName"
        v-model="firstName"
        class="input"
        type="text"
        maxlength="50"
        placeholder="First name"
        required
      >
    </div>

    <div class="field">
      <label class="label" for="cf-lastName">Last Name</label>
      <input
        id="cf-lastName"
        v-model="lastName"
        class="input"
        type="text"
        maxlength="50"
        placeholder="Last name (optional)"
      >
    </div>

    <div class="field">
      <label class="label" for="cf-displayName">Display Name</label>
      <input
        id="cf-displayName"
        v-model="displayName"
        class="input"
        type="text"
        maxlength="50"
        placeholder="Nickname (optional)"
      >
    </div>

    <div class="phones-section">
      <div class="phones-header">
        <span class="label">Phone Numbers</span>
      </div>

      <div v-for="(row, i) in phoneRows" :key="i" class="phone-row">
        <button
          type="button"
          class="primary-star"
          :class="{ 'primary-star--selected': row.isPrimary }"
          :title="row.isPrimary ? 'Primary phone' : 'Set as primary'"
          @click="selectPrimary(i)"
        >
          <span class="material-symbols-outlined">star</span>
        </button>
        <div class="phone-inputs">
          <input
            :value="phoneFormatters[i]?.formatted.value ?? row.value"
            class="input"
            type="tel"
            placeholder="+41 79 012 34 56 (optional)"
            @input="handlePhoneInput(i, $event)"
          >
          <input
            v-model="row.label"
            class="input input-sm"
            type="text"
            placeholder="Label (e.g. Mobile)"
          >
        </div>
        <button
          v-if="phoneRows.length > 1"
          type="button"
          class="remove-phone-btn"
          title="Remove phone"
          @click="removePhoneRow(i)"
        >
          <span class="material-symbols-outlined">remove_circle_outline</span>
        </button>
      </div>

      <button type="button" class="add-phone-btn" @click="addPhoneRow">
        <span class="material-symbols-outlined">add</span>
        Add phone
      </button>
    </div>

    <p v-if="error" class="error-text">
      {{ error }}
    </p>

    <div class="actions">
      <button type="button" class="cancel-btn" @click="emit('cancel')">
        Cancel
      </button>
      <button type="submit" class="submit-btn" :disabled="isLoading">
        {{ isLoading ? 'Saving...' : submitLabel }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
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

.input-sm {
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: var(--font-size-sm);
}

.phones-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.phones-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.phone-row {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-xs);
}

.primary-star {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-outline-variant);
  flex-shrink: 0;
  margin-top: 10px;
  transition: color 0.15s;
}

.primary-star .material-symbols-outlined {
  font-size: 20px;
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

.phone-inputs {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  min-width: 0;
}

.remove-phone-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-on-surface-variant);
  flex-shrink: 0;
  margin-top: 10px;
  transition: color 0.15s;
}

.remove-phone-btn:hover {
  color: var(--color-error);
}

.remove-phone-btn .material-symbols-outlined {
  font-size: 20px;
}

.add-phone-btn {
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
  align-self: flex-start;
  transition: opacity 0.15s;
}

.add-phone-btn:hover {
  opacity: 0.75;
}

.add-phone-btn .material-symbols-outlined {
  font-size: 18px;
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
