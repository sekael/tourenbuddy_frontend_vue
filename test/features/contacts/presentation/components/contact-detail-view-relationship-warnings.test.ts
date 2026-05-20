import { createTestingPinia } from '@pinia/testing'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ContactDetailView from '@/features/contacts/presentation/components/contact-detail-view.vue'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'

vi.mock('@/core/logging/use-logger', () => ({
  useLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }),
}))
vi.mock('@/features/auth/presentation/stores/auth-store', () => ({
  useAuthStore: vi.fn().mockReturnValue({ currentUser: null, isAuthenticated: false }),
}))
vi.mock('@/features/contacts/data/repositories/contacts-repository-impl', () => ({
  ContactsRepositoryImpl: vi.fn().mockImplementation(() => ({
    fetchContacts: vi.fn().mockResolvedValue([]),
    createContact: vi.fn(),
    updateContact: vi.fn(),
    deleteContact: vi.fn(),
  })),
}))
vi.mock('@/features/contacts/data/repositories/contact-methods-repository-impl', () => ({
  ContactMethodsRepositoryImpl: vi.fn().mockImplementation(() => ({
    addMethod: vi.fn(),
    removeMethod: vi.fn().mockResolvedValue(undefined),
    updateMethod: vi.fn(),
    setPrimaryPhone: vi.fn().mockResolvedValue([]),
  })),
}))
vi.mock('@/features/friendships/data/repositories/friendship-repository-impl', () => ({
  FriendshipRepositoryImpl: vi.fn().mockImplementation(() => ({
    sendRequest: vi.fn(),
    accept: vi.fn(),
    deny: vi.fn(),
    cancel: vi.fn(),
    listIncoming: vi.fn().mockResolvedValue([]),
    listFriendships: vi.fn().mockResolvedValue([]),
    findUserByPhone: vi.fn().mockResolvedValue(null),
    findUsersByPhones: vi.fn().mockResolvedValue([]),
    findPhonesByUserIds: vi.fn().mockResolvedValue([]),
    getNamesByUserIds: vi.fn().mockResolvedValue([]),
    removeFriendship: vi.fn(),
  })),
}))

const mockContact = {
  id: 'c-1',
  userId: 'u-1',
  firstName: 'Anna',
  lastName: null,
  displayName: null,
  contactMethods: [
    {
      id: 'm-1',
      contactId: 'c-1',
      methodType: 'phone' as const,
      value: '+41791112233',
      label: null,
      isPrimary: true,
      isValid: true,
    },
  ],
}

function mountDetail(relationshipsResult: { hasPending: boolean, hasFriendship: boolean }) {
  const wrapper = mount(ContactDetailView, {
    props: { contact: mockContact, linkedFriendUserId: null },
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn, stubActions: false })],
    },
  })
  const store = useContactsStore()
  vi.spyOn(store, 'relationshipsForContact').mockResolvedValue(relationshipsResult)
  return wrapper
}

describe('contact-detail-view — relationship warnings on delete confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should show no relationship warning when no pending or friendship', async () => {
    const wrapper = mountDetail({ hasPending: false, hasFriendship: false })
    await wrapper.find('.delete-btn').trigger('click')
    await flushPromises()

    expect(wrapper.find('.delete-confirm-text').exists()).toBe(true)
    expect(wrapper.find('.delete-friend-warning').exists()).toBe(false)
  })

  it('should show friendship warning when only friendship exists', async () => {
    const wrapper = mountDetail({ hasPending: false, hasFriendship: true })
    await wrapper.find('.delete-btn').trigger('click')
    await flushPromises()

    expect(wrapper.find('.delete-friend-warning').exists()).toBe(true)
    expect(wrapper.find('.delete-friend-warning').text()).toContain('contacts.detailView.deleteFriendWarning')
  })

  it('should show pending warning when only pending request exists', async () => {
    const wrapper = mountDetail({ hasPending: true, hasFriendship: false })
    await wrapper.find('.delete-btn').trigger('click')
    await flushPromises()

    expect(wrapper.find('.delete-friend-warning').exists()).toBe(true)
    expect(wrapper.find('.delete-friend-warning').text()).toContain('contacts.detailView.deletePendingWarning')
  })

  it('should show combined warning when both exist', async () => {
    const wrapper = mountDetail({ hasPending: true, hasFriendship: true })
    await wrapper.find('.delete-btn').trigger('click')
    await flushPromises()

    expect(wrapper.find('.delete-friend-warning').exists()).toBe(true)
    expect(wrapper.find('.delete-friend-warning').text()).toContain('contacts.detailView.deleteFriendAndPendingWarning')
  })
})

describe('contact-detail-view — relationship warnings on phone method delete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  async function mountAndTriggerMethodDelete(
    phoneRelResult: { hasPending: boolean, hasFriendship: boolean, userId: string | null },
  ) {
    const wrapper = mount(ContactDetailView, {
      props: { contact: mockContact, linkedFriendUserId: null },
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn, stubActions: false })],
      },
    })
    const store = useContactsStore()
    vi.spyOn(store, 'relationshipsForPhone').mockResolvedValue(phoneRelResult)
    // Enter edit mode
    await wrapper.find('.edit-btn').trigger('click')
    // Click delete icon on the phone method
    await wrapper.find('.icon-btn--danger').trigger('click')
    await flushPromises()
    return wrapper
  }

  it('should show no warning when no relationships', async () => {
    const wrapper = await mountAndTriggerMethodDelete({ hasPending: false, hasFriendship: false, userId: null })
    expect(wrapper.find('.method-delete-confirm').exists()).toBe(false)
  })

  it('should show friendship warning when only friendship', async () => {
    const wrapper = await mountAndTriggerMethodDelete({ hasPending: false, hasFriendship: true, userId: 'user-x' })
    expect(wrapper.find('.method-delete-confirm').exists()).toBe(true)
    expect(wrapper.find('.delete-friend-warning').text()).toContain('contacts.detailView.removeMethodFriendWarning')
  })

  it('should show pending warning when only pending request', async () => {
    const wrapper = await mountAndTriggerMethodDelete({ hasPending: true, hasFriendship: false, userId: 'user-x' })
    expect(wrapper.find('.method-delete-confirm').exists()).toBe(true)
    expect(wrapper.find('.delete-friend-warning').text()).toContain('contacts.detailView.removeMethodPendingWarning')
  })

  it('should show combined warning when both exist', async () => {
    const wrapper = await mountAndTriggerMethodDelete({ hasPending: true, hasFriendship: true, userId: 'user-x' })
    expect(wrapper.find('.method-delete-confirm').exists()).toBe(true)
    expect(wrapper.find('.delete-friend-warning').text()).toContain('contacts.detailView.removeMethodFriendAndPendingWarning')
  })
})
