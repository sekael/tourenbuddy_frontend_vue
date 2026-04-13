import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ContactsRepositoryImpl } from '@/features/contacts/data/repositories/contacts-repository-impl'

const mockSingle = vi.fn()
const mockSelect = vi.fn(() => ({ single: mockSingle }))
const mockUpdate = vi.fn(() => ({ eq: vi.fn(() => ({ select: mockSelect })) }))
const mockDelete = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }))
const mockEq = vi.fn(() => ({ select: mockSelect }))

vi.mock('@/core/utils/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({ order: vi.fn(() => Promise.resolve({ data: [], error: null })) })),
      insert: vi.fn(() => ({ select: mockSelect })),
      update: mockUpdate,
      delete: mockDelete,
      eq: mockEq,
    })),
  },
}))

const mockContact = {
  id: 'c-1',
  user_id: 'u-1',
  first_name: 'Anna',
  last_name: null,
  display_name: null,
  contact_methods: [],
}

describe('contactsRepositoryImpl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('updateContact', () => {
    it('should call Supabase UPDATE and return parsed contact', async () => {
      const { supabase } = await import('@/core/utils/supabase')
      const updatedRow = { ...mockContact, first_name: 'Annika' }

      const mockEqChain = {
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: updatedRow, error: null })),
        })),
      }
      const mockUpdateChain = { eq: vi.fn(() => mockEqChain) }
      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn(() => mockUpdateChain),
      } as ReturnType<typeof supabase.from>)

      const repo = new ContactsRepositoryImpl()
      const result = await repo.updateContact('c-1', { firstName: 'Annika' })

      expect(result.firstName).toBe('Annika')
    })

    it('should throw when Supabase returns error', async () => {
      const { supabase } = await import('@/core/utils/supabase')
      const mockEqChain = {
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: { message: 'Not found' } })),
        })),
      }
      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn(() => ({ eq: vi.fn(() => mockEqChain) })),
      } as ReturnType<typeof supabase.from>)

      const repo = new ContactsRepositoryImpl()
      await expect(repo.updateContact('bad-id', { firstName: 'X' })).rejects.toThrow('Not found')
    })
  })

  describe('deleteContact', () => {
    it('should call Supabase DELETE', async () => {
      const { supabase } = await import('@/core/utils/supabase')
      const mockDeleteFn = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }))
      vi.mocked(supabase.from).mockReturnValue({
        delete: mockDeleteFn,
      } as ReturnType<typeof supabase.from>)

      const repo = new ContactsRepositoryImpl()
      await expect(repo.deleteContact('c-1')).resolves.toBeUndefined()
    })

    it('should throw when Supabase returns error', async () => {
      const { supabase } = await import('@/core/utils/supabase')
      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: { message: 'Delete failed' } })),
        })),
      } as ReturnType<typeof supabase.from>)

      const repo = new ContactsRepositoryImpl()
      await expect(repo.deleteContact('c-1')).rejects.toThrow('Delete failed')
    })
  })
})
