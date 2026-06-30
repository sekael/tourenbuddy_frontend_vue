<script setup lang="ts">
import type { PhoneEntry } from '@/features/contacts/presentation/stores/contacts-store'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/core/components/base-button.vue'
import BaseIconButton from '@/core/components/base-icon-button.vue'
import BaseIcon from '@/core/components/base-icon.vue'
import BaseTooltip from '@/core/components/base-tooltip.vue'
import { useAsYouTypePhone } from '@/core/composables/use-as-you-type-phone'
import { normalizePhone } from '@/core/utils/phone-normalize'

interface PhoneRow {
  id: string
  value: string
  label: string
  isPrimary: boolean
  error: string | null
}

interface Props {
  initialFirstName?: string
  initialLastName?: string
  initialDisplayName?: string
  submitLabel?: string
  isLoading?: boolean
  /** `<form>` id, so an external Save button can submit via the `form` attribute. */
  formId?: string
  /** Hide the in-form cancel/save row (a full-screen page's top bar provides them). */
  embedded?: boolean
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
  submitLabel: '',
  isLoading: false,
})

const emit = defineEmits<{
  submit: [data: FormData]
  cancel: []
  phoneChange: [phone: string]
}>()

const { t } = useI18n({ useScope: 'global' })

const firstName = ref(props.initialFirstName)
const lastName = ref(props.initialLastName)
const displayName = ref(props.initialDisplayName)

const phoneRows = ref<PhoneRow[]>([
  { id: crypto.randomUUID(), value: '', label: '', isPrimary: true, error: null },
])
const phoneFormatterCache = new Map<string, ReturnType<typeof useAsYouTypePhone>>()
const error = ref<string | null>(null)

function getPhoneFormatter(rowId: string) {
  if (!phoneFormatterCache.has(rowId)) {
    const phoneRef = computed({
      get: () => phoneRows.value.find(r => r.id === rowId)?.value ?? '',
      set: (v: string) => {
        const row = phoneRows.value.find(r => r.id === rowId)
        if (row)
          row.value = v
      },
    })
    phoneFormatterCache.set(rowId, useAsYouTypePhone(phoneRef))
  }
  return phoneFormatterCache.get(rowId)!
}

function handlePhoneInput(rowId: string, event: Event) {
  getPhoneFormatter(rowId).onInput(event)
  const row = phoneRows.value.find(r => r.id === rowId)
  if (row)
    emit('phoneChange', row.value)
}

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
  phoneRows.value.push({
    id: crypto.randomUUID(),
    value: '',
    label: '',
    isPrimary: false,
    error: null,
  })
}

function removePhoneRow(index: number) {
  const row = phoneRows.value[index]
  const wasPrimary = row?.isPrimary
  if (row)
    phoneFormatterCache.delete(row.id)
  phoneRows.value.splice(index, 1)
  if (wasPrimary && phoneRows.value.length > 0) {
    phoneRows.value[0]!.isPrimary = true
  }
}

function selectPrimary(index: number) {
  phoneRows.value.forEach((row, i) => {
    row.isPrimary = i === index
  })
}

function validateAndCollect(): FormData {
  error.value = null

  if (!firstName.value.trim()) {
    error.value = t('contacts.form.firstNameRequired')
    throw new Error(t('contacts.form.firstNameRequired'))
  }

  const nonEmpty = phoneRows.value.filter(r => r.value.trim())

  let hasPhoneError = false
  for (const row of nonEmpty) {
    const result = normalizePhone(row.value.trim())
    if (!result.ok) {
      row.error = t('contacts.form.invalidPhone')
      hasPhoneError = true
    }
    else {
      row.error = null
    }
  }
  if (hasPhoneError)
    throw new Error(t('contacts.form.invalidPhone'))

  if (nonEmpty.length > 1) {
    const primaryCount = nonEmpty.filter(r => r.isPrimary).length
    if (primaryCount !== 1) {
      error.value = t('contacts.form.primaryPhoneRequired')
      throw new Error(t('contacts.form.primaryPhoneRequired'))
    }
  }

  const phones: PhoneEntry[] = nonEmpty.map((row) => {
    const result = normalizePhone(row.value.trim())
    return {
      value: result.ok ? result.e164 : row.value.trim(),
      label: row.label.trim() || null,
      isPrimary: nonEmpty.length === 1 ? true : row.isPrimary,
    }
  })

  return {
    firstName: firstName.value.trim(),
    lastName: lastName.value?.trim() || null,
    displayName: displayName.value?.trim() || null,
    phones,
  }
}

function submit(): void {
  emit('submit', validateAndCollect())
}

defineExpose({ submit, validateAndCollect })
</script>

<template>
  <form :id="props.formId" class="form" @submit.prevent="submit">
    <div class="field">
      <label class="label" for="cf-firstName">{{ t('contacts.form.firstNameLabel') }} <span class="required">*</span></label>
      <input
        id="cf-firstName"
        v-model="firstName"
        class="input"
        type="text"
        maxlength="50"
        :placeholder="t('contacts.form.firstNamePlaceholder')"
        required
      >
    </div>

    <div class="field">
      <label class="label" for="cf-lastName">{{ t('contacts.form.lastNameLabel') }}</label>
      <input
        id="cf-lastName"
        v-model="lastName"
        class="input"
        type="text"
        maxlength="50"
        :placeholder="t('contacts.form.lastNamePlaceholder')"
      >
    </div>

    <div class="field">
      <label class="label" for="cf-displayName">{{ t('contacts.form.displayNameLabel') }}</label>
      <input
        id="cf-displayName"
        v-model="displayName"
        class="input"
        type="text"
        maxlength="50"
        :placeholder="t('contacts.form.displayNamePlaceholder')"
      >
    </div>

    <div class="phones-section">
      <div class="phones-header">
        <span class="label">{{ t('contacts.form.phonesLabel') }}</span>
      </div>

      <div v-for="(row, i) in phoneRows" :key="i" class="phone-row">
        <button
          type="button"
          class="primary-star"
          :class="{ 'primary-star--selected': row.isPrimary }"
          @click="selectPrimary(i)"
        >
          <BaseTooltip
            :text="row.isPrimary
              ? t('contacts.form.primaryPhoneTooltip')
              : t('contacts.form.setAsPrimaryTooltip')"
          >
            <BaseIcon name="star" />
          </BaseTooltip>
        </button>
        <div class="phone-inputs">
          <input
            :value="getPhoneFormatter(row.id).formatted.value"
            class="input"
            :class="{ 'input--error': row.error }"
            type="tel"
            :placeholder="t('contacts.form.phonePlaceholder')"
            @input="handlePhoneInput(row.id, $event)"
          >
          <p v-if="row.error" class="error-text">
            {{ row.error }}
          </p>
          <input
            v-model="row.label"
            class="input input-sm"
            type="text"
            :placeholder="t('contacts.form.labelPlaceholder')"
          >
        </div>
        <BaseIconButton
          v-if="phoneRows.length > 1"
          name="remove_circle_outline"
          :label="t('contacts.form.removePhoneTooltip')"
          size="sm"
          tone="danger"
          class="remove-phone-btn"
          @click="removePhoneRow(i)"
        />
      </div>

      <BaseButton variant="text" size="sm" class="add-phone-btn" @click="addPhoneRow">
        <BaseIcon name="add" />
        {{ t('contacts.form.addPhoneBtn') }}
      </BaseButton>
    </div>

    <p v-if="error" class="error-text">
      {{ error }}
    </p>

    <div v-if="!props.embedded" class="actions">
      <BaseButton type="button" variant="secondary" @click="emit('cancel')">
        {{ t('contacts.shared.cancelBtn') }}
      </BaseButton>
      <BaseButton type="submit" variant="primary" :disabled="isLoading">
        {{ isLoading ? t('contacts.shared.savingBtn') : submitLabel || t('user.shared.saveBtn') }}
      </BaseButton>
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

.input--error {
  border-color: var(--color-error);
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

/* IconButton (sm, danger); only the top-align with the first input row lives here. */
.remove-phone-btn {
  margin-top: 10px;
}

/* Text BaseButton; only its left-align lives here. */
.add-phone-btn {
  align-self: flex-start;
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

/* Cancel/submit use shared BaseButton (secondary/primary). */
</style>
