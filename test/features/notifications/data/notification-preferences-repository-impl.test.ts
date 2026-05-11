import { beforeEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '@/core/utils/supabase'

import { NotificationPreferencesRepositoryImpl } from '@/features/notifications/data/repositories/notification-preferences-repository-impl'

vi.mock('@/core/utils/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

const mockFrom = vi.mocked(supabase.from)

describe('notificationPreferencesRepositoryImpl', () => {
  let repo: NotificationPreferencesRepositoryImpl

  beforeEach(() => {
    vi.clearAllMocks()
    repo = new NotificationPreferencesRepositoryImpl()
  })

  it('should return null when profile not found', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as never)

    const result = await repo.getPreferences('user-1')
    expect(result).toBeNull()
  })

  it('should return preferences with defaults parsed', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          notif_push_enabled: true,
          notif_email_enabled: false,
          notif_muted_types: ['friend_requests'],
        },
        error: null,
      }),
    } as never)

    const result = await repo.getPreferences('user-1')
    expect(result).toEqual({
      notifPushEnabled: true,
      notifEmailEnabled: false,
      notifMutedTypes: ['friend_requests'],
    })
  })

  it('should filter unknown muted types on parse', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          notif_push_enabled: true,
          notif_email_enabled: true,
          notif_muted_types: ['friend_requests', 'unknown_future_type'],
        },
        error: null,
      }),
    } as never)

    const result = await repo.getPreferences('user-1')
    expect(result?.notifMutedTypes).toEqual(['friend_requests'])
  })

  it('should throw on supabase error', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
    } as never)

    await expect(repo.getPreferences('user-1')).rejects.toThrow('DB error')
  })

  it('should call update with snake_case fields', async () => {
    const updateFn = vi.fn().mockReturnThis()
    const eqFn = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({ update: updateFn, eq: eqFn } as never)

    await repo.updatePreferences('user-1', {
      notifPushEnabled: false,
      notifEmailEnabled: true,
      notifMutedTypes: [],
    })

    expect(updateFn).toHaveBeenCalledWith({
      notif_push_enabled: false,
      notif_email_enabled: true,
      notif_muted_types: [],
    })
  })
})
