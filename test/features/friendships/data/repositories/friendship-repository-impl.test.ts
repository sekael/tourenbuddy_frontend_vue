import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FriendshipRepositoryImpl } from '@/features/friendships/data/repositories/friendship-repository-impl'

const mockRpc = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/core/utils/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

function makeDbRequest() {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    from_user_id: '22222222-2222-2222-2222-222222222222',
    to_user_id: '33333333-3333-3333-3333-333333333333',
    status: 'pending',
    created_at: new Date().toISOString(),
    responded_at: null,
  }
}

describe('friendshipRepositoryImpl', () => {
  let repo: FriendshipRepositoryImpl

  beforeEach(() => {
    vi.clearAllMocks()
    repo = new FriendshipRepositoryImpl()
  })

  describe('sendRequest', () => {
    it('should throw with RLS error message when supabase returns policy violation', async () => {
      mockFrom.mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'new row violates row-level security policy' },
            }),
          })),
        })),
      })

      await expect(repo.sendRequest('user-b')).rejects.toThrow(
        'new row violates row-level security policy',
      )
    })

    it('should parse and return request on success', async () => {
      const row = makeDbRequest()
      mockFrom.mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: row, error: null }),
          })),
        })),
      })

      const result = await repo.sendRequest('user-b')
      expect(result.id).toBe('11111111-1111-1111-1111-111111111111')
      expect(result.fromUserId).toBe('22222222-2222-2222-2222-222222222222')
      expect(result.status).toBe('pending')
    })
  })

  describe('accept', () => {
    it('should throw when accept_friend_request RPC returns error', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'permission denied for function' } })

      await expect(repo.accept('req-1')).rejects.toThrow('permission denied for function')
    })

    it('should resolve without error on success', async () => {
      mockRpc.mockResolvedValue({ data: null, error: null })
      await expect(repo.accept('req-1')).resolves.toBeUndefined()
    })
  })

  describe('deny', () => {
    it('should throw when supabase returns error on status update', async () => {
      mockFrom.mockReturnValue({
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: { message: 'permission denied' } }),
        })),
      })

      await expect(repo.deny('req-1')).rejects.toThrow('permission denied')
    })
  })

  describe('findUserByPhone', () => {
    it('should throw when RPC returns error (e.g., caller phone unverified)', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'caller phone not verified' } })

      await expect(repo.findUserByPhone('+41791234567')).rejects.toThrow('caller phone not verified')
    })

    it('should return null when no matching user found', async () => {
      mockRpc.mockResolvedValue({ data: null, error: null })

      const result = await repo.findUserByPhone('+41791234567')
      expect(result).toBeNull()
    })

    it('should return userId when user found', async () => {
      mockRpc.mockResolvedValue({ data: 'user-found-id', error: null })

      const result = await repo.findUserByPhone('+41791234567')
      expect(result).toBe('user-found-id')
    })
  })

  describe('findUsersByPhones', () => {
    it('should throw when RPC returns error', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'RPC error' } })

      await expect(repo.findUsersByPhones(['+41791234567'])).rejects.toThrow('RPC error')
    })

    it('should return empty array for null data', async () => {
      mockRpc.mockResolvedValue({ data: null, error: null })

      const result = await repo.findUsersByPhones(['+41791234567'])
      expect(result).toEqual([])
    })

    it('should map snake_case user_id to camelCase userId', async () => {
      mockRpc.mockResolvedValue({
        data: [{ phone: '+41791234567', user_id: 'user-abc' }],
        error: null,
      })

      const result = await repo.findUsersByPhones(['+41791234567'])
      expect(result).toEqual([{ phone: '+41791234567', userId: 'user-abc' }])
    })
  })
})
