import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DuplicateContactMethodError } from '@/core/exceptions'
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
  value: '+41791234567',
  label: null,
  is_primary: false,
  is_valid: true,
}

describe('contactMethodsRepositoryImpl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('addMethod', () => {
    it('should normalize Swiss national phone before inserting', async () => {
      const { supabase } = await import('@/core/utils/supabase')
      const insertedRow = { ...mockMethod, value: '+41791234567' }
      const mockChain = {
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: insertedRow, error: null })),
        })),
      }
      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn(() => mockChain),
      } as ReturnType<typeof supabase.from>)

      const repo = new ContactMethodsRepositoryImpl()
      const result = await repo.addMethod('c-1', {
        methodType: 'phone',
        value: '0791234567',
        isPrimary: true,
      })

      const insertSpy = vi.mocked(supabase.from).mock.results[0]?.value.insert
      expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({ value: '+41791234567' }))
      expect(result.value).toBe('+41791234567')
    })

    it('should reject invalid phone without calling Supabase', async () => {
      const { supabase } = await import('@/core/utils/supabase')

      const repo = new ContactMethodsRepositoryImpl()
      await expect(
        repo.addMethod('c-1', { methodType: 'phone', value: '123', isPrimary: true }),
      ).rejects.toThrow('Invalid phone number')

      expect(supabase.from).not.toHaveBeenCalled()
    })

    it('23505 on contact_methods_unique_per_contact maps to DuplicateContactMethodError', async () => {
      const { supabase } = await import('@/core/utils/supabase')
      const mockChain = {
        select: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({
              data: null,
              error: {
                code: '23505',
                message: 'duplicate key value violates unique constraint "contact_methods_unique_per_contact"',
              },
            }),
          ),
        })),
      }
      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn(() => mockChain),
      } as ReturnType<typeof supabase.from>)

      const repo = new ContactMethodsRepositoryImpl()
      await expect(
        repo.addMethod('c-1', { methodType: 'phone', value: '+41791234567', isPrimary: true }),
      ).rejects.toThrow(DuplicateContactMethodError)
    })

    it('non-23505 errors pass through unchanged', async () => {
      const { supabase } = await import('@/core/utils/supabase')
      const mockChain = {
        select: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({
              data: null,
              error: { code: '42501', message: 'permission denied' },
            }),
          ),
        })),
      }
      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn(() => mockChain),
      } as ReturnType<typeof supabase.from>)

      const repo = new ContactMethodsRepositoryImpl()
      const err = await repo.addMethod('c-1', { methodType: 'phone', value: '+41791234567', isPrimary: true }).catch(e => e)
      expect(err).not.toBeInstanceOf(DuplicateContactMethodError)
      expect(err.message).toBe('permission denied')
    })

    it('should pass email value through without validation', async () => {
      const { supabase } = await import('@/core/utils/supabase')
      const emailRow = { ...mockMethod, method_type: 'email' as const, value: 'test@example.com' }
      const mockChain = {
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: emailRow, error: null })),
        })),
      }
      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn(() => mockChain),
      } as ReturnType<typeof supabase.from>)

      const repo = new ContactMethodsRepositoryImpl()
      await repo.addMethod('c-1', {
        methodType: 'email',
        value: 'test@example.com',
        isPrimary: false,
      })

      const insertSpy = vi.mocked(supabase.from).mock.results[0]?.value.insert
      expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({ value: 'test@example.com' }))
    })
  })

  describe('updateMethod', () => {
    it('should normalize E.164 phone when methodType is phone', async () => {
      const { supabase } = await import('@/core/utils/supabase')
      const updatedRow = { ...mockMethod, value: '+49301234567' }

      const mockEqChain = {
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: updatedRow, error: null })),
        })),
      }
      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn(() => ({ eq: vi.fn(() => mockEqChain) })),
      } as ReturnType<typeof supabase.from>)

      const repo = new ContactMethodsRepositoryImpl()
      const result = await repo.updateMethod('m-1', {
        methodType: 'phone',
        value: '+49 30 1234567',
      })

      expect(result.value).toBe('+49301234567')
    })

    it('should reject invalid phone when methodType is phone', async () => {
      const { supabase } = await import('@/core/utils/supabase')

      const repo = new ContactMethodsRepositoryImpl()
      await expect(repo.updateMethod('m-1', { methodType: 'phone', value: 'abc' })).rejects.toThrow(
        'Invalid phone number',
      )

      expect(supabase.from).not.toHaveBeenCalled()
    })

    it('should pass value through without validation when methodType is undefined', async () => {
      const { supabase } = await import('@/core/utils/supabase')
      const updatedRow = { ...mockMethod, value: '+41791234567' }

      const mockEqChain = {
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: updatedRow, error: null })),
        })),
      }
      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn(() => ({ eq: vi.fn(() => mockEqChain) })),
      } as ReturnType<typeof supabase.from>)

      const repo = new ContactMethodsRepositoryImpl()
      const result = await repo.updateMethod('m-1', { value: '+41791234567' })

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
      await expect(repo.updateMethod('m-1', { value: '+41791234567' })).rejects.toThrow(
        'Update failed',
      )
    })
  })
})
