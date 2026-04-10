<script setup lang="ts">
import { ref } from 'vue'
import BottomSheet from '@/core/components/bottom-sheet.vue'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'

const emit = defineEmits<{ close: [] }>()

const contactsStore = useContactsStore()

const firstName = ref('')
const lastName = ref('')
const displayName = ref('')
const error = ref<string | null>(null)
const isLoading = ref(false)

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
    )
    emit('close')
  }
  catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to add contact'
  }
  finally {
    isLoading.value = false
  }
}
</script>

<template>
  <BottomSheet title="Add Contact" @close="emit('close')">
    <form class="form" @submit.prevent="handleSubmit">
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
        >
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
        >
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
        >
      </div>

      <p v-if="error" class="error-text">
        {{ error }}
      </p>

      <div class="actions">
        <button type="button" class="cancel-btn" @click="emit('close')">
          Cancel
        </button>
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
