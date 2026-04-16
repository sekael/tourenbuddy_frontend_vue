<script setup lang="ts">
import { ref, watch } from 'vue'
import { useAsYouTypePhone } from '@/core/composables/use-as-you-type-phone'

interface Props {
  initialFirstName?: string
  initialLastName?: string
  initialDisplayName?: string
  initialPhoneNumber?: string
  submitLabel?: string
  isLoading?: boolean
}

interface FormData {
  firstName: string
  lastName: string | null
  displayName: string | null
  phoneNumber: string | null
}

const props = withDefaults(defineProps<Props>(), {
  initialFirstName: '',
  initialLastName: '',
  initialDisplayName: '',
  initialPhoneNumber: '',
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
const phoneNumber = ref(props.initialPhoneNumber)
const { formatted: phoneFormatted, onInput: onPhoneInput } = useAsYouTypePhone(phoneNumber)
const error = ref<string | null>(null)

watch(
  () => props.initialFirstName,
  (v) => (firstName.value = v ?? ''),
)
watch(
  () => props.initialLastName,
  (v) => (lastName.value = v ?? ''),
)
watch(
  () => props.initialDisplayName,
  (v) => (displayName.value = v ?? ''),
)
watch(
  () => props.initialPhoneNumber,
  (v) => (phoneNumber.value = v ?? ''),
)

function handleSubmit() {
  error.value = null

  if (!firstName.value.trim()) {
    error.value = 'First name is required'
    return
  }

  emit('submit', {
    firstName: firstName.value.trim(),
    lastName: lastName.value?.trim() || null,
    displayName: displayName.value?.trim() || null,
    phoneNumber: phoneNumber.value?.trim() || null,
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
      />
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
      />
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
      />
    </div>

    <div class="field">
      <label class="label" for="cf-phoneNumber">Phone Number</label>
      <input
        id="cf-phoneNumber"
        :value="phoneFormatted"
        class="input"
        type="tel"
        placeholder="+41 79 012 34 56 (optional)"
        @input="onPhoneInput"
      />
    </div>

    <p v-if="error" class="error-text">
      {{ error }}
    </p>

    <div class="actions">
      <button type="button" class="cancel-btn" @click="emit('cancel')">Cancel</button>
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
