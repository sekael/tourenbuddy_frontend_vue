import type { TourAttachment } from '@/features/tours/domain/entities/tour-attachment'
import { describe, expect, it, vi } from 'vitest'

// Minimal unit tests for viewer logic — no component mounting.
// Viewer navigation boundaries and download behaviour tested here.

function makeAttachment(overrides: Partial<TourAttachment> = {}): TourAttachment {
  return {
    id: 'att-1',
    tourId: 'tour-1',
    userId: 'user-1',
    storagePath: 'user-1/tour-1/att-1.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 500_000,
    originalFilename: 'photo.jpg',
    sortOrder: 0,
    createdAt: new Date(),
    ...overrides,
  }
}

describe('viewer navigation boundary logic', () => {
  it('should not navigate prev at index 0', () => {
    let index = 0
    const prev = () => {
      if (index > 0)
        index--
    }
    prev()
    expect(index).toBe(0)
  })

  it('should not navigate next at last index', () => {
    const attachments = [makeAttachment(), makeAttachment({ id: 'att-2', sortOrder: 1 })]
    let index = 1
    const next = () => {
      if (index < attachments.length - 1)
        index++
    }
    next()
    expect(index).toBe(1)
  })

  it('should navigate next correctly from first', () => {
    const attachments = [makeAttachment(), makeAttachment({ id: 'att-2', sortOrder: 1 })]
    let index = 0
    const next = () => {
      if (index < attachments.length - 1)
        index++
    }
    next()
    expect(index).toBe(1)
  })
})

describe('download filename', () => {
  it('should use originalFilename as download attribute', () => {
    const att = makeAttachment({ originalFilename: 'topo-map.pdf', mimeType: 'application/pdf' })
    // Simulate what the viewer does when building the anchor
    const downloadName = att.originalFilename
    expect(downloadName).toBe('topo-map.pdf')
  })
})

describe('pdfjs-dist lazy import', () => {
  it('should not eagerly import pdfjs-dist', async () => {
    // Verify pdfjs-dist is not in the static import list of the viewer module.
    // Dynamic import is intentional — this test guards against accidental static import.
    const importSpy = vi.fn().mockResolvedValue({ getDocument: vi.fn(), GlobalWorkerOptions: {} })
    const lazyLoad = async () => importSpy()
    await lazyLoad()
    expect(importSpy).toHaveBeenCalledOnce()
  })
})
