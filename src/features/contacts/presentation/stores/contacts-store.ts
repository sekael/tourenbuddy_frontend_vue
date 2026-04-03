import type { Contact } from '@/features/contacts/domain/entities/contact'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useLogger } from '@/core/logging/use-logger'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
import { ContactsRepositoryImpl } from '@/features/contacts/data/repositories/contacts-repository-impl'

const repository = new ContactsRepositoryImpl()

export const useContactsStore = defineStore('contacts', () => {
  const logger = useLogger('ContactsStore')
  const authStore = useAuthStore()

  const contacts = ref<Contact[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function loadContacts() {
    if (!authStore.isAuthenticated)
      return

    isLoading.value = true
    error.value = null

    try {
      contacts.value = await repository.fetchContacts()
    }
    catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load contacts'
      error.value = message
      logger.error('Failed to load contacts', err)
    }
    finally {
      isLoading.value = false
    }
  }

  async function addContact(
    firstName: string,
    lastName?: string | null,
    displayName?: string | null,
  ) {
    const userId = authStore.currentUser?.id
    if (!userId)
      return

    const contact = await repository.createContact({
      userId,
      firstName: firstName.trim(),
      lastName: lastName?.trim() || null,
      displayName: displayName?.trim() || null,
    })

    contacts.value = [...contacts.value, contact].sort((a, b) =>
      a.firstName.localeCompare(b.firstName),
    )
  }

  function clear() {
    contacts.value = []
    error.value = null
  }

  return { contacts, isLoading, error, loadContacts, addContact, clear }
})
