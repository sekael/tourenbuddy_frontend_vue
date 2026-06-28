<script setup lang="ts">
import type { Contact } from '@/features/contacts/domain/entities/contact'
import type { ContactMethod } from '@/features/contacts/domain/entities/contact-method'
import type { NewContactMethod } from '@/features/contacts/domain/repositories/contact-methods-repository'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/core/components/base-button.vue'
import BaseIconButton from '@/core/components/base-icon-button.vue'
import BaseIcon from '@/core/components/base-icon.vue'
import BaseTooltip from '@/core/components/base-tooltip.vue'
import { useAsYouTypePhone } from '@/core/composables/use-as-you-type-phone'
import { useSnackbar } from '@/core/composables/use-snackbar'
import { normalizePhone } from '@/core/utils/phone-normalize'
import { orderedPhoneMethods } from '@/features/contacts/core/utils/order-phone-methods'
import { formatPhoneDisplay } from '@/features/contacts/domain/entities/contact'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'
import BlockConfirmDialog from '@/features/friendships/presentation/components/block-confirm-dialog.vue'
import { useFriendshipsStore } from '@/features/friendships/presentation/stores/friendships-store'
import { useUserBlocksStore } from '@/features/friendships/presentation/stores/user-blocks-store'

const props = defineProps<{
  contact: Contact
  linkedFriendUserId?: string | null
  /**
   * Rendered inside a full-screen page: hide the in-view header and the
   *  bottom Save/Cancel bar — the page's top app bar supplies both.
   */
  embedded?: boolean
}>()

const emit = defineEmits<{ back: [], deleted: [] }>()

const { t } = useI18n({ useScope: 'global' })

const store = useContactsStore()
const friendshipsStore = useFriendshipsStore()
const { userIdToPhoneMap, friendUserIds } = storeToRefs(friendshipsStore)
const blocksStore = useUserBlocksStore()
const { blockedPhones, blockedUserIds } = storeToRefs(blocksStore)
const snackbar = useSnackbar()

const blockConfirmOpen = ref(false)

const isContactBlocked = computed(() => {
  if (props.linkedFriendUserId && blockedUserIds.value.has(props.linkedFriendUserId))
    return true
  for (const m of props.contact.contactMethods) {
    if (m.methodType !== 'phone')
      continue
    const norm = normalizePhone(m.value)
    const phone = norm.ok ? norm.e164 : m.value
    if (blockedPhones.value.has(phone))
      return true
  }
  return false
})

function openBlockConfirm() {
  blockConfirmOpen.value = true
}

function cancelBlock() {
  blockConfirmOpen.value = false
}

async function handleBlockConfirm(reportReason: string | null) {
  if (!props.linkedFriendUserId)
    return
  blockConfirmOpen.value = false
  try {
    await blocksStore.block(props.linkedFriendUserId)
    snackbar.show(t('blocks.snackbar.blockSuccess'))
    if (reportReason !== null) {
      await blocksStore.report(props.linkedFriendUserId, reportReason)
      snackbar.show(t('blocks.snackbar.reportSuccess'))
    }
  }
  catch {
    snackbar.show(t('blocks.snackbar.sendRequestFailed'))
  }
}

const orderedPhones = computed(() => orderedPhoneMethods(props.contact))
const setPrimaryError = ref<string | null>(null)

const linkedMethodIds = computed<Set<string>>(() => {
  if (!props.linkedFriendUserId)
    return new Set()
  const friendPhone = userIdToPhoneMap.value.get(props.linkedFriendUserId)
  if (!friendPhone)
    return new Set()
  const result = new Set<string>()
  for (const m of props.contact.contactMethods) {
    if (m.methodType !== 'phone')
      continue
    const norm = normalizePhone(m.value)
    const phone = norm.ok ? norm.e164 : m.value
    if (phone === friendPhone)
      result.add(m.id)
  }
  return result
})

// ── View/edit mode ───────────────────────────────────────────────────────────
// Owned via v-model so the parent can keep it stable across a surface swap
// (sheet → full-screen page): when this component is remounted into the page,
// the parent re-supplies `edit`, so it doesn't snap back to `view` and loop.
const mode = defineModel<'view' | 'edit'>('mode', { default: 'view' })
const isSaving = ref(false)
const saveError = ref<string | null>(null)

function enterEditMode() {
  saveError.value = null
  mode.value = 'edit'
}

// cancelEdit is defined after its dependencies (name refs, methodEdits, addMethod refs)

// ── Name edit state ──────────────────────────────────────────────────────────
const firstName = ref(props.contact.firstName)
const lastName = ref(props.contact.lastName ?? '')
const displayName = ref(props.contact.displayName ?? '')
const nameError = ref<string | null>(null)
const isSavingName = ref(false)

watch(
  () => props.contact,
  (c) => {
    if (mode.value === 'view') {
      firstName.value = c.firstName
      lastName.value = c.lastName ?? ''
      displayName.value = c.displayName ?? ''
    }
  },
)

async function saveNameInternal() {
  nameError.value = null
  if (!firstName.value.trim()) {
    nameError.value = t('contacts.detailView.firstNameRequired')
    throw new Error(t('contacts.detailView.firstNameRequired'))
  }
  isSavingName.value = true
  try {
    await store.updateContact(props.contact.id, {
      firstName: firstName.value.trim(),
      lastName: lastName.value.trim() || null,
      displayName: displayName.value.trim() || null,
    })
  }
  catch (err) {
    nameError.value = err instanceof Error ? err.message : 'Failed to save'
    throw err
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
    const updated = props.contact.contactMethods.find(m => m.id === method.id)
    if (updated)
      edit.value = methodDisplayValue(updated)
  }
  catch (err) {
    edit.error = err instanceof Error ? err.message : 'Failed to save'
  }
  finally {
    edit.saving = false
  }
}

interface MethodDeleteConfirm {
  methodId: string
  linkedUserId: string | null
  hasPending: boolean
  hasFriendship: boolean
}
const methodDeleteConfirm = ref<MethodDeleteConfirm | null>(null)
const isRemovingMethod = ref(false)
const removeMethodError = ref<string | null>(null)

async function requestRemoveMethod(method: ContactMethod) {
  removeMethodError.value = null
  if (method.methodType !== 'phone') {
    executeRemoveMethod(method.id)
    return
  }
  const rel = await store.relationshipsForPhone(method.value)
  const hasPending = rel?.hasPending ?? false
  const hasFriendship = rel?.hasFriendship ?? false
  const linkedUserId = rel?.userId ?? (linkedMethodIds.value.has(method.id) ? props.linkedFriendUserId ?? null : null)
  if (!hasPending && !hasFriendship && !linkedMethodIds.value.has(method.id)) {
    executeRemoveMethod(method.id)
    return
  }
  methodDeleteConfirm.value = {
    methodId: method.id,
    linkedUserId,
    hasPending,
    hasFriendship: hasFriendship || linkedMethodIds.value.has(method.id),
  }
}

async function executeRemoveMethod(methodId: string) {
  await store.removeMethodFromContact(props.contact.id, methodId)
  delete methodEdits.value[methodId]
  phoneFormatterCache.delete(methodId)
}

async function confirmRemoveMethod() {
  const pending = methodDeleteConfirm.value
  if (!pending)
    return
  isRemovingMethod.value = true
  removeMethodError.value = null
  try {
    if (pending.hasFriendship && pending.linkedUserId)
      await friendshipsStore.removeFriendship(pending.linkedUserId)
    await executeRemoveMethod(pending.methodId)
    methodDeleteConfirm.value = null
  }
  catch (err) {
    removeMethodError.value = err instanceof Error ? err.message : 'Failed to remove'
  }
  finally {
    isRemovingMethod.value = false
  }
}

async function setPrimaryPhone(method: ContactMethod) {
  if (method.isPrimary)
    return
  setPrimaryError.value = null
  try {
    await store.setPrimaryPhoneOnContact(props.contact.id, method.id)
  }
  catch (err) {
    setPrimaryError.value = err instanceof Error ? err.message : 'Failed to update primary phone'
  }
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
        props.contact.contactMethods.filter(m => m.methodType === newMethodType.value).length
        === 0,
    }
    await store.addMethodToContact(props.contact.id, method)
    showAddMethod.value = false
  }
  catch (err) {
    addMethodError.value = err instanceof Error ? err.message : t('contacts.detailView.addError')
  }
  finally {
    isAddingMethod.value = false
  }
}

// ── Cancel edit (after all its dependencies: name, methodEdits, addMethod refs) ──
function cancelEdit() {
  firstName.value = props.contact.firstName
  lastName.value = props.contact.lastName ?? ''
  displayName.value = props.contact.displayName ?? ''
  nameError.value = null
  for (const m of props.contact.contactMethods) {
    methodEdits.value[m.id] = {
      value: methodDisplayValue(m),
      label: m.label ?? '',
      saving: false,
      error: null,
    }
  }
  showAddMethod.value = false
  newMethodValue.value = ''
  newMethodLabel.value = ''
  addMethodError.value = null
  saveError.value = null
  mode.value = 'view'
}

// ── Save all (form-level) ────────────────────────────────────────────────────
async function saveAll(): Promise<boolean> {
  isSaving.value = true
  saveError.value = null
  try {
    for (const method of props.contact.contactMethods) {
      await saveMethod(method)
    }
    if (showAddMethod.value && newMethodValue.value.trim()) {
      await confirmAddMethod()
    }
    await saveNameInternal()
    const hasMethodError = Object.values(methodEdits.value).some(e => e.error)
    if (hasMethodError || addMethodError.value) {
      saveError.value = t('contacts.detailView.saveFailed')
      return false
    }
    mode.value = 'view'
    return true
  }
  catch (err) {
    saveError.value = err instanceof Error ? err.message : t('contacts.detailView.saveFailed')
    return false
  }
  finally {
    isSaving.value = false
  }
}

// ── Delete ───────────────────────────────────────────────────────────────────
const deleteState = ref<'idle' | 'confirm' | 'loading'>('idle')
const deleteError = ref<string | null>(null)
const contactRelationships = ref<{ hasPending: boolean, hasFriendship: boolean } | null>(null)

async function requestDelete() {
  deleteState.value = 'confirm'
  contactRelationships.value = (await store.relationshipsForContact(props.contact.id)) ?? null
}

async function confirmDelete() {
  deleteError.value = null
  deleteState.value = 'loading'
  try {
    if (props.linkedFriendUserId)
      await friendshipsStore.removeFriendship(props.linkedFriendUserId)
    await store.deleteContact(props.contact.id)
    emit('deleted')
  }
  catch (err) {
    deleteError.value = err instanceof Error ? err.message : 'Failed to delete'
    deleteState.value = 'idle'
  }
}

defineExpose({
  mode,
  isSaving,
  enterEditMode,
  saveAll,
  cancelEdit,
  commitPendingEdits: async () => {
    if (mode.value === 'view')
      return
    const ok = await saveAll()
    if (!ok)
      throw new Error(saveError.value ?? t('contacts.detailView.saveFailed'))
  },
})
</script>

<template>
  <div class="detail-view">
    <!-- Header (suppressed when embedded — the page's top app bar replaces it) -->
    <div v-if="!embedded" class="detail-header">
      <BaseIconButton name="arrow_back" :label="t('core.drawer.back')" size="sm" data-testid="back-btn" @click="emit('back')" />
      <span class="detail-title">{{ t('contacts.detailView.title') }}</span>
      <BaseButton v-if="mode === 'view'" variant="primary-outline" size="sm" data-testid="edit-contact-btn" @click="enterEditMode">
        {{ t('contacts.detailView.editBtn') }}
      </BaseButton>
    </div>

    <!-- Name section -->
    <section class="section">
      <h3 class="section-label">
        {{ t('contacts.detailView.nameSection') }}
        <BaseTooltip v-if="linkedFriendUserId && !isContactBlocked" :text="t('friendships.tooltip')">
          <BaseIcon name="group" class="detail-friend-icon" />
        </BaseTooltip>
        <BaseTooltip v-if="isContactBlocked" :text="t('blocks.tooltip')">
          <BaseIcon name="block" class="detail-blocked-icon" />
        </BaseTooltip>
      </h3>

      <!-- View mode: read-only -->
      <template v-if="mode === 'view'">
        <div class="view-row">
          <span class="view-label">{{ t('contacts.form.firstNameLabel') }}</span>
          <span class="view-value">{{ contact.firstName }}</span>
        </div>
        <div v-if="contact.lastName" class="view-row">
          <span class="view-label">{{ t('contacts.form.lastNameLabel') }}</span>
          <span class="view-value">{{ contact.lastName }}</span>
        </div>
        <div v-if="contact.displayName" class="view-row">
          <span class="view-label">{{ t('contacts.form.displayNameLabel') }}</span>
          <span class="view-value">{{ contact.displayName }}</span>
        </div>
      </template>

      <!-- Edit mode: inputs -->
      <template v-else>
        <div class="field">
          <label class="label" for="dv-firstName">{{ t('contacts.form.firstNameLabel') }}<span class="required">*</span></label>
          <input
            id="dv-firstName"
            v-model="firstName"
            class="input"
            type="text"
            maxlength="50"
            :placeholder="t('contacts.form.firstNamePlaceholder')"
          >
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
          >
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
          >
        </div>
        <p v-if="nameError" class="error-text">
          {{ nameError }}
        </p>
      </template>
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

      <p v-if="removeMethodError" class="error-text">
        {{ removeMethodError }}
      </p>

      <!-- Phone methods: ordered primary-first with star selector. The remove
           confirmation (friendship-/pending-linked phone) expands inline below
           the affected row. Non-phone methods never reach confirm. -->
      <template v-for="method in orderedPhones" :key="method.id">
        <div class="method-row">
          <!-- Primary star: interactive in edit mode, inert in view mode -->
          <button
            v-if="mode === 'edit'"
            type="button"
            class="primary-star"
            :class="{ 'primary-star--selected': method.isPrimary }"
            @click="setPrimaryPhone(method)"
          >
            <BaseTooltip
              :text="method.isPrimary
                ? t('contacts.detailView.primaryPhoneTooltip')
                : t('contacts.detailView.setAsPrimaryTooltip')"
            >
              <BaseIcon name="star" />
            </BaseTooltip>
          </button>
          <span
            v-else
            class="primary-star"
            :class="{ 'primary-star--selected': method.isPrimary }"
          >
            <BaseIcon name="star" />
          </span>

          <div class="method-type-badge">
            <BaseIcon name="phone" />
          </div>

          <!-- View mode: read-only -->
          <div v-if="mode === 'view'" class="method-fields">
            <span class="view-value">{{ methodDisplayValue(method) }}</span>
            <span v-if="method.label" class="view-label-sm">{{ method.label }}</span>
          </div>

          <!-- Edit mode: inputs -->
          <div v-else class="method-fields">
            <p v-if="!method.isValid" class="invalid-phone-hint">
              <BaseIcon name="warning" class="warn-icon" />
              {{ t('contacts.detailView.invalidPhoneHint') }}
            </p>
            <input
              :value="getPhoneFormatter(method).formatted.value"
              class="input input-sm"
              :class="{ 'input--warning': !method.isValid }"
              type="tel"
              :placeholder="t('contacts.detailView.phonePlaceholder')"
              @input="getPhoneFormatter(method).onInput"
            >
            <input
              v-model="getMethodEdit(method).label"
              class="input input-sm"
              type="text"
              :placeholder="t('contacts.detailView.labelPlaceholder')"
            >
            <p v-if="getMethodEdit(method).error" class="error-text">
              {{ getMethodEdit(method).error }}
            </p>
          </div>

          <div v-if="mode === 'edit'" class="method-actions">
            <BaseIconButton
              name="delete"
              :label="t('contacts.detailView.removeBtn')"
              size="sm"
              tone="danger"
              data-testid="remove-method-btn"
              :disabled="methodDeleteConfirm?.methodId === method.id"
              @click="requestRemoveMethod(method)"
            />
          </div>
        </div>

        <div v-if="methodDeleteConfirm?.methodId === method.id" class="method-delete-confirm">
          <p class="delete-confirm-text">
            {{ t('contacts.detailView.removeMethodConfirm') }}
          </p>
          <p
            v-if="methodDeleteConfirm.hasFriendship && methodDeleteConfirm.hasPending"
            class="delete-friend-warning"
          >
            <BaseIcon name="warning" class="warn-icon" />
            {{ t('contacts.detailView.removeMethodFriendAndPendingWarning') }}
          </p>
          <p v-else-if="methodDeleteConfirm.hasFriendship" class="delete-friend-warning">
            <BaseIcon name="warning" class="warn-icon" />
            {{ t('contacts.detailView.removeMethodFriendWarning') }}
          </p>
          <p v-else-if="methodDeleteConfirm.hasPending" class="delete-friend-warning">
            <BaseIcon name="warning" class="warn-icon" />
            {{ t('contacts.detailView.removeMethodPendingWarning') }}
          </p>
          <div class="delete-actions">
            <BaseButton type="button" variant="secondary" size="sm" :disabled="isRemovingMethod" @click="methodDeleteConfirm = null">
              {{ t('contacts.detailView.cancelBtn') }}
            </BaseButton>
            <BaseButton type="button" variant="danger" size="sm" :disabled="isRemovingMethod" @click="confirmRemoveMethod">
              {{ isRemovingMethod ? t('contacts.detailView.removingMethodBtn') : t('contacts.detailView.removeBtn') }}
            </BaseButton>
          </div>
        </div>
      </template>

      <!-- Non-phone methods (email etc.) -->
      <div
        v-for="method in contact.contactMethods.filter((m) => m.methodType !== 'phone')"
        :key="method.id"
        class="method-row"
      >
        <div class="method-type-badge">
          <BaseIcon name="mail" />
        </div>

        <!-- View mode: read-only -->
        <div v-if="mode === 'view'" class="method-fields">
          <span class="view-value">{{ method.value }}</span>
          <span v-if="method.label" class="view-label-sm">{{ method.label }}</span>
        </div>

        <!-- Edit mode: inputs -->
        <div v-else class="method-fields">
          <input
            v-model="getMethodEdit(method).value"
            class="input input-sm"
            type="email"
            :placeholder="t('contacts.detailView.emailPlaceholder')"
          >
          <input
            v-model="getMethodEdit(method).label"
            class="input input-sm"
            type="text"
            :placeholder="t('contacts.detailView.labelPlaceholder')"
          >
          <p v-if="getMethodEdit(method).error" class="error-text">
            {{ getMethodEdit(method).error }}
          </p>
        </div>

        <div v-if="mode === 'edit'" class="method-actions">
          <BaseIconButton
            name="delete"
            :label="t('contacts.detailView.removeBtn')"
            size="sm"
            tone="danger"
            data-testid="remove-method-btn"
            @click="requestRemoveMethod(method)"
          />
        </div>
      </div>

      <!-- Add method form (edit mode only) -->
      <template v-if="mode === 'edit'">
        <div v-if="showAddMethod" class="add-method-form">
          <div class="type-selector">
            <button
              type="button"
              class="type-btn"
              :class="{ 'type-btn--active': newMethodType === 'phone' }"
              @click="newMethodType = 'phone'"
            >
              <BaseIcon name="phone" />
              {{ t('contacts.detailView.phoneTypeBtn') }}
            </button>
            <button
              type="button"
              class="type-btn"
              :class="{ 'type-btn--active': newMethodType === 'email' }"
              @click="newMethodType = 'email'"
            >
              <BaseIcon name="mail" />
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
          >
          <input
            v-else
            v-model="newMethodValue"
            class="input"
            type="email"
            :placeholder="t('contacts.detailView.emailPlaceholder')"
          >
          <input
            v-model="newMethodLabel"
            class="input"
            type="text"
            :placeholder="t('contacts.detailView.labelExamplePlaceholder')"
          >
          <p v-if="addMethodError" class="error-text">
            {{ addMethodError }}
          </p>
          <div class="add-method-actions">
            <BaseButton type="button" variant="secondary" size="sm" @click="cancelAddMethod">
              {{ t('contacts.shared.cancelBtn') }}
            </BaseButton>
            <BaseButton
              type="button"
              variant="primary"
              size="sm"
              :disabled="isAddingMethod"
              @click="confirmAddMethod"
            >
              {{
                isAddingMethod ? t('contacts.detailView.addingBtn') : t('contacts.detailView.addBtn')
              }}
            </BaseButton>
          </div>
        </div>

        <BaseButton v-else variant="text" size="sm" class="add-method-btn" @click="openAddMethod">
          <BaseIcon name="add" />
          {{ t('contacts.detailView.addMethodBtn') }}
        </BaseButton>
      </template>
    </section>

    <!-- Form-level Save / Cancel (edit mode only; suppressed when embedded —
         the page's top app bar supplies Save/Cancel) -->
    <section v-if="mode === 'edit' && !embedded" class="section section--actions">
      <p v-if="saveError" class="error-text">
        {{ saveError }}
      </p>
      <div class="form-actions">
        <BaseButton type="button" variant="secondary" :disabled="isSaving" @click="cancelEdit">
          {{ t('contacts.detailView.cancelBtn') }}
        </BaseButton>
        <BaseButton type="button" variant="primary" :disabled="isSaving" @click="saveAll">
          {{ isSaving ? t('contacts.detailView.savingBtn') : t('contacts.detailView.saveBtn') }}
        </BaseButton>
      </div>
    </section>

    <!-- Danger section -->
    <section class="section section--danger">
      <BlockConfirmDialog
        v-if="blockConfirmOpen && linkedFriendUserId && !isContactBlocked"
        :has-friendship="friendUserIds.has(linkedFriendUserId)"
        @cancel="cancelBlock"
        @confirm="handleBlockConfirm"
      />
      <BaseButton
        v-else-if="linkedFriendUserId && !isContactBlocked"
        variant="danger-outline"
        size="sm"
        @click="openBlockConfirm"
      >
        <BaseIcon name="block" />
        {{ t('blocks.blockAction') }}
      </BaseButton>

      <p v-if="deleteError" class="error-text">
        {{ deleteError }}
      </p>

      <template v-if="deleteState === 'confirm'">
        <p class="delete-confirm-text">
          {{ t('contacts.detailView.deleteConfirm') }}
        </p>
        <p
          v-if="contactRelationships?.hasFriendship && contactRelationships?.hasPending"
          class="delete-friend-warning"
        >
          <BaseIcon name="warning" class="warn-icon" />
          {{ t('contacts.detailView.deleteFriendAndPendingWarning') }}
        </p>
        <p v-else-if="contactRelationships?.hasFriendship || linkedFriendUserId" class="delete-friend-warning">
          <BaseIcon name="warning" class="warn-icon" />
          {{ t('contacts.detailView.deleteFriendWarning') }}
        </p>
        <p v-else-if="contactRelationships?.hasPending" class="delete-friend-warning">
          <BaseIcon name="warning" class="warn-icon" />
          {{ t('contacts.detailView.deletePendingWarning') }}
        </p>
        <div class="delete-actions">
          <BaseButton type="button" variant="secondary" size="sm" data-testid="delete-cancel-btn" @click="deleteState = 'idle'">
            {{ t('contacts.shared.cancelBtn') }}
          </BaseButton>
          <BaseButton type="button" variant="danger" size="sm" data-testid="delete-confirm-btn" @click="confirmDelete">
            {{ t('contacts.detailView.deleteBtn') }}
          </BaseButton>
        </div>
      </template>

      <BaseButton
        v-else
        type="button"
        variant="danger-outline"
        size="sm"
        data-testid="delete-btn"
        :disabled="deleteState === 'loading'"
        @click="requestDelete"
      >
        <BaseIcon name="person_remove" />
        {{
          deleteState === 'loading'
            ? t('contacts.detailView.deletingBtn')
            : t('contacts.detailView.deleteBtn')
        }}
      </BaseButton>
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

.detail-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  flex: 1;
}

.detail-friend-icon {
  font-size: var(--icon-size-md);
  color: var(--color-friend);
}

.detail-blocked-icon {
  font-size: var(--icon-size-md);
  color: var(--color-error);
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
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-on-surface-variant);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.view-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.view-label {
  font-size: var(--font-size-xs, 11px);
  color: var(--color-on-surface-variant);
}

.view-value {
  font-size: var(--font-size-base);
  color: var(--color-on-surface);
}

.view-label-sm {
  font-size: var(--font-size-xs, 11px);
  color: var(--color-on-surface-variant);
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
  border-color: var(--color-warning);
}

.invalid-phone-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--font-size-xs, 11px);
  color: var(--color-warning);
}

.warn-icon {
  font-size: var(--font-size-sm);
}

.error-text {
  font-size: var(--font-size-sm);
  color: var(--color-error);
}

/* save/cancel/delete-confirm now use shared BaseButton. */

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
  border-radius: var(--radius-round);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-outline-variant);
  flex-shrink: 0;
  margin-top: 4px;
  transition: color 0.15s;
}

.primary-star .material-symbols-outlined {
  font-size: var(--icon-size-sm);
  font-variation-settings: 'FILL' 0;
}

.primary-star--selected {
  color: var(--color-primary);
}

.primary-star--selected .material-symbols-outlined {
  font-variation-settings: 'FILL' 1;
}

button.primary-star:hover {
  color: var(--color-primary);
}

.method-type-badge {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-round);
  background-color: var(--color-surface-variant);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 2px;
}

.method-type-badge .material-symbols-outlined {
  font-size: var(--icon-size-sm);
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

.method-delete-confirm {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  border: 1.5px solid var(--color-error);
  background-color: color-mix(in srgb, var(--color-error) 6%, transparent);
}

/* Text BaseButton; only its left-align lives here. */
.add-method-btn {
  align-self: flex-start;
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
  font-size: var(--icon-size-xs);
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

.section--actions {
  border-bottom: 1px solid var(--color-outline-variant);
}

.form-actions {
  display: flex;
  gap: var(--spacing-sm);
  justify-content: flex-end;
}

.section--danger {
  border-bottom: none;
  padding-top: var(--spacing-sm);
}

.delete-confirm-text {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-error);
}

.delete-friend-warning {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}

.delete-friend-warning .warn-icon {
  font-size: var(--icon-size-xs);
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--color-warning);
}

/* Equal-width cancel/confirm (point 7: button groups same size). */
.delete-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-sm);
}
</style>
