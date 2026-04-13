import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ContactMethodsRepositoryImpl } from '@/features/contacts/data/repositories/contact-methods-repository-impl'

vi.mock('@/core/utils/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

const mockMethod = {
  id: 'm-1',
  contact_id: 'c-1',
  method_type: 'phone' as const,
  value: '+41 79 111 22 33',
  label: null,
  is_primary: false,
}

describe('contactMethodsRepositoryImpl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('updateMethod', () => {
    it('should call Supabase UPDATE and return parsed method', async () => {
      const { supabase } = await import('@/core/utils/supabase')
      const updatedRow = { ...mockMethod, value: '+41 79 999 00 11' }

      const mockEqChain = {
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: updatedRow, error: null })),
        })),
      }
      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn(() => ({ eq: vi.fn(() => mockEqChain) })),
      } as ReturnType<typeof supabase.from>)

      const repo = new ContactMethodsRepositoryImpl()
      const result = await repo.updateMethod('m-1', { value: '+41 79 999 00 11' })

      expect(result.value).toBe('+41 79 999 00 11')
      expect(result.id).toBe('m-1')
    })

    it('should throw when Supabase returns error', async () => {
      const { supabase } = await import('@/core/utils/supabase')
      const mockEqChain = {
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: { message: 'Update failed' } })),
        })),
      }
      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn(() => ({ eq: vi.fn(() => mockEqChain) })),
      } as ReturnType<typeof supabase.from>)

      const repo = new ContactMethodsRepositoryImpl()
      await expect(repo.updateMethod('m-1', { value: 'x' })).rejects.toThrow('Update failed')
    })
  })
})
