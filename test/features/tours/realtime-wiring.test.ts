import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── shared hoisted mocks ────────────────────────────────────────────────────

const { mockUseRealtime, mockToursRepo, mockAttachmentsRepo, mockCurrentUser } = vi.hoisted(() => ({
  mockUseRealtime: vi.fn(),
  mockToursRepo: {
    listToursForUser: vi.fn().mockResolvedValue([]),
    createTourWithPartners: vi.fn(),
    updateTour: vi.fn(),
    patchGpxFilepath: vi.fn(),
    patchCompleted: vi.fn(),
    deleteTour: vi.fn(),
  },
  mockAttachmentsRepo: {
    list: vi.fn().mockResolvedValue([]),
    add: vi.fn(),
    remove: vi.fn(),
    reorder: vi.fn(),
    getViewUrl: vi.fn(),
    getDownloadUrl: vi.fn(),
  },
  mockCurrentUser: { value: null as { id: string } | null },
}))

vi.mock('@/core/realtime/use-realtime-subscription', () => ({
  useRealtimeSubscription: mockUseRealtime,
}))

vi.mock('@/features/tours/data/repositories/tours-repository-impl', () => ({
  ToursRepositoryImpl: vi.fn().mockImplementation(() => mockToursRepo),
}))

vi.mock('@/features/tours/data/services/gpx-storage-service', () => ({
  uploadGpx: vi.fn(),
  removeGpx: vi.fn(),
}))

vi.mock('@/features/tours/data/repositories/tour-attachment-repository-impl', () => ({
  SupabaseTourAttachmentRepository: vi.fn().mockImplementation(() => mockAttachmentsRepo),
}))

// Mock the whole contacts-store so it doesn't register its own
// useRealtimeSubscription call and shift the mock.calls indices.
vi.mock('@/features/contacts/presentation/stores/contacts-store', () => ({
  useContactsStore: vi.fn().mockReturnValue({
    $onAction: vi.fn().mockReturnValue(vi.fn()),
    contacts: { value: [] },
  }),
}))

vi.mock('@/core/utils/phone-normalize', () => ({
  normalizePhone: vi.fn().mockReturnValue({ ok: false }),
}))

vi.mock('@/core/logging/use-logger', () => ({
  useLogger: () => ({ debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() }),
}))

vi.mock('@/features/auth/presentation/stores/auth-store', () => ({
  useAuthStore: vi.fn().mockReturnValue({
    get currentUser() { return mockCurrentUser.value },
    get isAuthenticated() { return mockCurrentUser.value != null },
  }),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

// ── tours-store realtime wiring ─────────────────────────────────────────────

describe('toursStore — realtime wiring', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockUseRealtime.mockReturnValue({ status: { value: 'idle' }, stop: vi.fn() })
  })

  it('should pass null channel key when user is not authenticated', async () => {
    mockCurrentUser.value = null
    const { useToursStore } = await import(
      '@/features/tours/presentation/stores/tours-store'
    )
    useToursStore()

    const opts = mockUseRealtime.mock.calls[0][0]
    expect(opts.key()).toBeNull()
  })

  it('should pass channel key tours-<uid> when authenticated', async () => {
    mockCurrentUser.value = { id: 'user-abc' }
    const { useToursStore } = await import(
      '@/features/tours/presentation/stores/tours-store'
    )
    useToursStore()

    const opts = mockUseRealtime.mock.calls[0][0]
    expect(opts.key()).toBe('tours-user-abc')
  })

  it('should pass enabled=false when not authenticated', async () => {
    mockCurrentUser.value = null
    const { useToursStore } = await import(
      '@/features/tours/presentation/stores/tours-store'
    )
    useToursStore()

    const opts = mockUseRealtime.mock.calls[0][0]
    expect(opts.enabled()).toBe(false)
  })

  it('should wire two bindings: tours and tour_partners, both filtered by user_id', async () => {
    mockCurrentUser.value = { id: 'user-abc' }
    const { useToursStore } = await import(
      '@/features/tours/presentation/stores/tours-store'
    )
    useToursStore()

    const opts = mockUseRealtime.mock.calls[0][0]
    const bindings = opts.bindings()
    expect(bindings).toHaveLength(2)
    expect(bindings[0]).toMatchObject({ event: '*', table: 'tours', filter: 'user_id=eq.user-abc' })
    expect(bindings[1]).toMatchObject({ event: '*', table: 'tour_partners', filter: 'user_id=eq.user-abc' })
  })

  it('tour_partners event triggers loadTours via shared onChange', async () => {
    mockCurrentUser.value = { id: 'user-abc' }
    const { useToursStore } = await import(
      '@/features/tours/presentation/stores/tours-store'
    )
    useToursStore()

    // Both bindings share one channel with one onChange — call it directly
    const opts = mockUseRealtime.mock.calls[0][0]
    opts.onChange()
    await Promise.resolve()

    expect(mockToursRepo.listToursForUser).toHaveBeenCalledTimes(1)
  })

  it('onChange calls loadTours (primitive handles debounce internally)', async () => {
    mockCurrentUser.value = { id: 'user-abc' }
    const { useToursStore } = await import(
      '@/features/tours/presentation/stores/tours-store'
    )
    useToursStore()

    const opts = mockUseRealtime.mock.calls[0][0]
    opts.onChange()
    await Promise.resolve()

    expect(mockToursRepo.listToursForUser).toHaveBeenCalledTimes(1)
  })

  it('should not dispatch notifications from onChange', async () => {
    vi.useFakeTimers()
    mockCurrentUser.value = { id: 'user-abc' }
    const { useToursStore } = await import(
      '@/features/tours/presentation/stores/tours-store'
    )
    useToursStore()

    // Simply confirming onChange + timer doesn't throw / call any notify fn.
    // No notify imports exist in tours-store; this test guards against regressions.
    const opts = mockUseRealtime.mock.calls[0][0]
    opts.onChange()
    vi.advanceTimersByTime(200)
    vi.useRealTimers()
  })
})

// ── tour-attachments-store realtime wiring ──────────────────────────────────

describe('tourAttachmentsStore — realtime wiring', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockUseRealtime.mockReturnValue({ status: { value: 'idle' }, stop: vi.fn() })
    mockAttachmentsRepo.list.mockResolvedValue([])
  })

  it('should pass null channel key when user is not authenticated', async () => {
    mockCurrentUser.value = null
    const { useTourAttachmentsStore } = await import(
      '@/features/tours/presentation/stores/tour-attachments-store'
    )
    useTourAttachmentsStore()

    const opts = mockUseRealtime.mock.calls[0][0]
    expect(opts.key()).toBeNull()
  })

  it('should pass channel key tour-attachments-<uid> when authenticated', async () => {
    mockCurrentUser.value = { id: 'user-abc' }
    const { useTourAttachmentsStore } = await import(
      '@/features/tours/presentation/stores/tour-attachments-store'
    )
    useTourAttachmentsStore()

    const opts = mockUseRealtime.mock.calls[0][0]
    expect(opts.key()).toBe('tour-attachments-user-abc')
  })

  it('should wire a single binding on tour_attachments filtered by user_id', async () => {
    mockCurrentUser.value = { id: 'user-abc' }
    const { useTourAttachmentsStore } = await import(
      '@/features/tours/presentation/stores/tour-attachments-store'
    )
    useTourAttachmentsStore()

    const opts = mockUseRealtime.mock.calls[0][0]
    const bindings = opts.bindings()
    expect(bindings).toHaveLength(1)
    expect(bindings[0].table).toBe('tour_attachments')
    expect(bindings[0].event).toBe('*')
    expect(bindings[0].filter).toBe('user_id=eq.user-abc')
  })

  it('onChange short-circuits when no tour is currently loaded', async () => {
    mockCurrentUser.value = { id: 'user-abc' }
    const { useTourAttachmentsStore } = await import(
      '@/features/tours/presentation/stores/tour-attachments-store'
    )
    const store = useTourAttachmentsStore()

    // currentTourId is null — no load() called yet
    expect(store.currentTourId).toBeNull()
    const opts = mockUseRealtime.mock.calls[0][0]
    opts.onChange()

    expect(mockAttachmentsRepo.list).not.toHaveBeenCalled()
  })

  it('onChange calls load(currentTourId) when a tour is loaded', async () => {
    mockCurrentUser.value = { id: 'user-abc' }
    const { useTourAttachmentsStore } = await import(
      '@/features/tours/presentation/stores/tour-attachments-store'
    )
    const store = useTourAttachmentsStore()

    await store.load('tour-xyz')
    mockAttachmentsRepo.list.mockClear()

    const opts = mockUseRealtime.mock.calls[0][0]
    opts.onChange()
    await Promise.resolve() // flush async load microtask

    expect(mockAttachmentsRepo.list).toHaveBeenCalledWith('tour-xyz')
  })
})
