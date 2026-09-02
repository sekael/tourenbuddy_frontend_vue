import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTourAttachmentsStore } from '@/features/tours/presentation/stores/tour-attachments-store'

// ── Mocks ──────────────────────────────────────────────────────────────────────
const mockAdd = vi.hoisted(() => vi.fn())
const mockRemove = vi.hoisted(() => vi.fn())
const mockList = vi.hoisted(() => vi.fn().mockResolvedValue([]))

vi.mock('@/features/tours/data/repositories/tour-attachment-repository-impl', () => ({
  SupabaseTourAttachmentRepository: vi.fn().mockImplementation(() => ({
    list: mockList,
    add: mockAdd,
    remove: mockRemove,
    reorder: vi.fn(),
    getViewUrl: vi.fn(),
    getDownloadUrl: vi.fn(),
  })),
}))

vi.mock('@/features/auth/presentation/stores/auth-store', () => ({
  useAuthStore: vi.fn().mockReturnValue({
    currentUser: { id: 'user-123' },
  }),
}))

vi.mock('@/core/logging/use-logger', () => ({
  useLogger: () => ({ error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'tours.attachments.limitRemaining')
        return `Only ${params?.remaining} more allowed; selected ${params?.selected}`
      return key
    },
  }),
}))

// ── Helpers ────────────────────────────────────────────────────────────────────
function makeFile(name: string, type: string, sizeBytes = 1000): File {
  const blob = new Blob([new Uint8Array(sizeBytes)], { type })
  return new File([blob], name, { type })
}

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('useTourAttachmentsStore — validateBatch', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should reject a file with HEIC mime type with dedicated error code', () => {
    const store = useTourAttachmentsStore()
    const heicFile = makeFile('photo.heic', 'image/heic')
    const err = store.validateBatch([heicFile], 0)
    expect(err?.code).toBe('heic_unsupported')
  })

  it('should reject a file with HEIF mime type with dedicated error code', () => {
    const store = useTourAttachmentsStore()
    const heifFile = makeFile('photo.heif', 'image/heif')
    const err = store.validateBatch([heifFile], 0)
    expect(err?.code).toBe('heic_unsupported')
  })

  it('should reject a file with disallowed mime type', () => {
    const store = useTourAttachmentsStore()
    const gifFile = makeFile('anim.gif', 'image/gif')
    const err = store.validateBatch([gifFile], 0)
    expect(err?.code).toBe('invalid_type')
  })

  it('should reject a file exceeding 10 MB', () => {
    const store = useTourAttachmentsStore()
    const bigFile = makeFile('big.jpg', 'image/jpeg', 10_485_761)
    const err = store.validateBatch([bigFile], 0)
    expect(err?.code).toBe('too_large')
  })

  it('should reject entire batch when it would exceed remaining capacity', () => {
    const store = useTourAttachmentsStore()
    // 3 existing + batch of 4 = 7 > 5
    const files = Array.from({ length: 4 }, (_, i) => makeFile(`img${i}.png`, 'image/png'))
    const err = store.validateBatch(files, 3)
    expect(err?.code).toBe('limit_reached')
    expect(err?.remaining).toBe(2) // 5 - 3
    expect(err?.selected).toBe(4)
  })

  it('should reject adding any file when tour is already at limit', () => {
    const store = useTourAttachmentsStore()
    const file = makeFile('img.png', 'image/png')
    const err = store.validateBatch([file], 5)
    expect(err?.code).toBe('limit_reached')
    expect(err?.remaining).toBe(0)
  })

  it('should accept a valid jpeg under 10 MB when capacity exists', () => {
    const store = useTourAttachmentsStore()
    const file = makeFile('photo.jpg', 'image/jpeg', 4_000_000)
    const err = store.validateBatch([file], 0)
    expect(err).toBeNull()
  })

  it('should accept a valid batch that exactly fills remaining capacity', () => {
    const store = useTourAttachmentsStore()
    const files = Array.from({ length: 2 }, (_, i) => makeFile(`img${i}.png`, 'image/png'))
    const err = store.validateBatch(files, 3) // 3 + 2 = 5 OK
    expect(err).toBeNull()
  })
})

describe('useTourAttachmentsStore — stage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should not stage a 6th file — sets error', () => {
    const store = useTourAttachmentsStore()
    const validFiles = Array.from({ length: 5 }, (_, i) => makeFile(`img${i}.png`, 'image/png'))
    store.stage('draft-1', validFiles)
    expect(store.error).toBeNull()

    store.stage('draft-1', [makeFile('extra.png', 'image/png')])
    expect(store.error).not.toBeNull()
  })

  it('should refuse files that fit the staged list but not the tour behind it', () => {
    // Suggest mode (D9): nothing is staged yet, but the owner already holds four — the
    // cap is on the tour's END state, not on the partner's picker.
    const store = useTourAttachmentsStore()

    store.stage('draft-1', [makeFile('a.jpg', 'image/jpeg'), makeFile('b.jpg', 'image/jpeg')], 4)

    expect(store.error).not.toBeNull()
    expect(store.stagedByDraft['draft-1']).toBeUndefined()
  })

  it('should count the base against already-staged files, not instead of them', () => {
    const store = useTourAttachmentsStore()

    store.stage('draft-1', [makeFile('a.jpg', 'image/jpeg')], 3)
    store.stage('draft-1', [makeFile('b.jpg', 'image/jpeg')], 3)
    store.stage('draft-1', [makeFile('c.jpg', 'image/jpeg')], 3)

    expect(store.stagedByDraft['draft-1']).toHaveLength(2)
    expect(store.error).not.toBeNull()
  })

  it('should stage valid files without error', () => {
    const store = useTourAttachmentsStore()
    const files = [makeFile('a.jpg', 'image/jpeg'), makeFile('b.pdf', 'application/pdf')]
    store.stage('draft-1', files)
    expect(store.error).toBeNull()
    expect(store.stagedByDraft['draft-1']).toHaveLength(2)
  })
})

describe('useTourAttachmentsStore — commitStaged', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockAdd.mockReset()
  })

  it('should no-op when staged list is empty', async () => {
    const store = useTourAttachmentsStore()
    await store.commitStaged('draft-empty', 'tour-123')
    expect(mockAdd).not.toHaveBeenCalled()
  })

  it('should upload staged files and clear staging on success', async () => {
    const store = useTourAttachmentsStore()
    const fakeAttachment = { id: 'att-1', tourId: 'tour-123', userId: 'user-123', storagePath: 'path', mimeType: 'image/jpeg', sizeBytes: 1000, originalFilename: 'f.jpg', sortOrder: 0, createdAt: new Date() }
    mockAdd.mockResolvedValue(fakeAttachment)

    store.stage('draft-1', [makeFile('photo.jpg', 'image/jpeg')])
    await store.commitStaged('draft-1', 'tour-123')

    expect(mockAdd).toHaveBeenCalledOnce()
    expect(store.stagedByDraft['draft-1']).toBeUndefined()
    expect(store.attachmentsByTour['tour-123']).toContainEqual(fakeAttachment)
  })
})
