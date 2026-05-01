import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FriendshipRepositoryImpl } from '@/features/friendships/data/repositories/friendship-repository-impl'
import { stubFrom } from '../../_helpers'

const mockRpc = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/core/utils/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

describe('friendshipRepositoryImpl (errors + edges only)', () => {
  let repo: FriendshipRepositoryImpl

  beforeEach(() => {
    vi.clearAllMocks()
    repo = new FriendshipRepositoryImpl()
  })

  describe('sendRequest', () => {
    it('throws RLS message when policy blocks insert', async () => {
      mockFrom.mockReturnValue(
        stubFrom({ error: { message: 'new row violates row-level security policy' } }),
      )
      await expect(repo.sendRequest('user-b')).rejects.toThrow('row-level security')
    })

    it('zod-rejects when DB row is missing required fields (e.g. malformed id)', async () => {
      mockFrom.mockReturnValue(
        stubFrom({
          data: {
            id: 'not-a-uuid',
            from_user_id: 'x',
            to_user_id: 'y',
            status: 'pending',
            created_at: '',
          },
        }),
      )
      await expect(repo.sendRequest('user-b')).rejects.toThrow()
    })
  })

  describe('accept', () => {
    it('throws when accept_friend_request RPC errors (e.g. already accepted)', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'request not pending' } })
      await expect(repo.accept('req-1')).rejects.toThrow('request not pending')
    })
  })

  describe('deny', () => {
    it('throws when caller lacks RLS rights to update', async () => {
      mockFrom.mockReturnValue(stubFrom({ error: { message: 'permission denied' } }))
      await expect(repo.deny('req-1')).rejects.toThrow('permission denied')
    })
  })

  describe('cancel', () => {
    it('throws when sender no longer owns request', async () => {
      mockFrom.mockReturnValue(stubFrom({ error: { message: 'permission denied' } }))
      await expect(repo.cancel('req-1')).rejects.toThrow('permission denied')
    })
  })

  describe('listIncoming / listFriendships', () => {
    it('listIncoming throws on supabase error', async () => {
      mockFrom.mockReturnValue(stubFrom({ error: { message: 'network down' } }))
      await expect(repo.listIncoming()).rejects.toThrow('network down')
    })

    it('listFriendships throws on supabase error', async () => {
      mockFrom.mockReturnValue(stubFrom({ error: { message: 'network down' } }))
      await expect(repo.listFriendships()).rejects.toThrow('network down')
    })
  })

  describe('findUserByPhone', () => {
    it('throws when caller phone is unverified (RPC guard)', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'caller phone not verified' } })
      await expect(repo.findUserByPhone('+41791234567')).rejects.toThrow(
        'caller phone not verified',
      )
    })

    it('returns null when no match (data: null)', async () => {
      mockRpc.mockResolvedValue({ data: null, error: null })
      expect(await repo.findUserByPhone('+41791234567')).toBeNull()
    })
  })

  describe('findUsersByPhones', () => {
    it('short-circuits without RPC call on empty input', async () => {
      const result = await repo.findUsersByPhones([])
      expect(result).toEqual([])
      expect(mockRpc).not.toHaveBeenCalled()
    })

    it('throws when RPC errors', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'RPC error' } })
      await expect(repo.findUsersByPhones(['+41791234567'])).rejects.toThrow('RPC error')
    })

    it('coerces null data to empty array', async () => {
      mockRpc.mockResolvedValue({ data: null, error: null })
      expect(await repo.findUsersByPhones(['+41791234567'])).toEqual([])
    })
  })

  describe('findPhonesByUserIds', () => {
    it('short-circuits without RPC call on empty input', async () => {
      const result = await repo.findPhonesByUserIds([])
      expect(result).toEqual([])
      expect(mockRpc).not.toHaveBeenCalled()
    })

    it('throws when RPC errors', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'RPC error' } })
      await expect(repo.findPhonesByUserIds(['user-a'])).rejects.toThrow('RPC error')
    })
  })

  describe('removeFriendship', () => {
    it('throws when remove_friendship RPC errors (e.g. no such friendship)', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'no friendship found' } })
      await expect(repo.removeFriendship('user-other')).rejects.toThrow('no friendship found')
    })
  })
})
