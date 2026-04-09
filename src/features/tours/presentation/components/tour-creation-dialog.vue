<script setup lang="ts">
import type { TourDraft } from '@/features/tours/domain/entities/tour'
import { storeToRefs } from 'pinia'
import { ref } from 'vue'
import ContactChip from '@/features/contacts/presentation/components/contact-chip.vue'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'

const emit = defineEmits<{
  confirm: [draft: TourDraft]
  close: []
}>()

const contactsStore = useContactsStore()
const { contacts } = storeToRefs(contactsStore)

const tourName = ref('')
const plannedDate = ref('')
const selectedPartnerIds = ref<Set<string>>(new Set())

function togglePartner(contactId: string) {
  if (selectedPartnerIds.value.has(contactId)) {
    selectedPartnerIds.value.delete(contactId)
  } else {
    selectedPartnerIds.value.add(contactId)
  }
  // Trigger reactivity
  selectedPartnerIds.value = new Set(selectedPartnerIds.value)
}

function handleConfirm() {
  const draft: TourDraft = {
    name: tourName.value.trim() || null,
    plannedDate: plannedDate.value ? new Date(plannedDate.value) : null,
    partnerIds: Array.from(selectedPartnerIds.value),
  }
  emit('confirm', draft)
}
</script>

<template>
  <div class="dialog-backdrop" @click.self="emit('close')">
    <div class="dialog">
      <div class="header">
        <h2 class="title">New Tour</h2>
        <button class="close-btn" @click="emit('close')">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <form class="form" @submit.prevent="handleConfirm">
        <div class="field">
          <label class="label" for="tourName">Tour Name</label>
          <input
            id="tourName"
            v-model="tourName"
            class="input"
            type="text"
            maxlength="100"
            placeholder="Optional name"
          />
        </div>

        <div class="field">
          <label class="label" for="plannedDate">Planned Date</label>
          <input id="plannedDate" v-model="plannedDate" class="input" type="date" />
        </div>

        <div v-if="contacts.length > 0" class="field">
          <p class="label">Tour Partners</p>
          <div class="chips">
            <ContactChip
              v-for="contact in contacts"
              :key="contact.id"
              :contact="contact"
              :selected="selectedPartnerIds.has(contact.id)"
              @toggle="togglePartner"
            />
          </div>
        </div>

        <div class="actions">
          <button type="button" class="cancel-btn" @click="emit('close')">Cancel</button>
          <button type="submit" class="submit-btn">Save Tour</button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 100;
}

@media (min-width: 600px) {
  .dialog-backdrop {
    align-items: center;
  }
}

.dialog {
  background-color: var(--color-background);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  padding: var(--spacing-xl);
  width: 100%;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  box-shadow: var(--shadow-lg);
}

@media (min-width: 600px) {
  .dialog {
    border-radius: var(--radius-lg);
  }
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
}

.close-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-on-surface-variant);
}

.close-btn:hover {
  background-color: var(--color-surface-variant);
}

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

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) 0;
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

.submit-btn:hover {
  background-color: var(--color-primary-dark);
  transform: translateY(-1px);
}
</style>
