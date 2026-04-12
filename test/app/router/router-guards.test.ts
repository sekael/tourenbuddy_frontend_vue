import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupRouterGuards } from '@/app/router'

const { mockBeforeEach } = vi.hoisted(() => ({
  mockBeforeEach: vi.fn(),
}))

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    createRouter: () => ({
      beforeEach: mockBeforeEach,
    }),
    createWebHistory: vi.fn(),
  }
})

function makeAuthStore(isAuthenticated: boolean) {
  return { isAuthenticated, isLoading: false }
}

function makeProfileStore(firstName: string | null, lastName: string | null) {
  return { profile: { firstName, lastName } }
}

function makeRoute(name: string, meta: Record<string, boolean> = {}) {
  return { name, meta }
}

describe('setupRouterGuards', () => {
  let capturedGuard: (to: ReturnType<typeof makeRoute>) => unknown

  beforeEach(() => {
    vi.clearAllMocks()
    mockBeforeEach.mockImplementation((guard: typeof capturedGuard) => {
      capturedGuard = guard
    })
    localStorage.removeItem('skippedOnboarding')
  })

  function runGuard(
    to: ReturnType<typeof makeRoute>,
    authStore: ReturnType<typeof makeAuthStore>,
    profileStore: ReturnType<typeof makeProfileStore>,
  ) {
    setupRouterGuards(authStore, profileStore)
    return capturedGuard(to)
  }

  it('should redirect unauthenticated user from requiresAuth route to home', () => {
    const result = runGuard(
      makeRoute('map', { requiresAuth: true }),
      makeAuthStore(false),
      makeProfileStore(null, null),
    )
    expect(result).toEqual({ name: 'home' })
  })

  it('should redirect authenticated user away from redirectIfAuth route to map', () => {
    const result = runGuard(
      makeRoute('home', { redirectIfAuth: true }),
      makeAuthStore(true),
      makeProfileStore('Max', 'Doe'),
    )
    expect(result).toEqual({ name: 'map' })
  })

  it('should redirect to onboarding when profile is incomplete and not skipped', () => {
    const result = runGuard(
      makeRoute('map', { requiresAuth: true, requiresCompleteProfile: true }),
      makeAuthStore(true),
      makeProfileStore(null, null),
    )
    expect(result).toEqual({ name: 'onboarding' })
  })

  it('should allow navigation when profile is complete', () => {
    const result = runGuard(
      makeRoute('map', { requiresAuth: true, requiresCompleteProfile: true }),
      makeAuthStore(true),
      makeProfileStore('Max', 'Doe'),
    )
    expect(result).toBeUndefined()
  })

  it('should allow navigation when profile is incomplete but onboarding was skipped', () => {
    localStorage.setItem('skippedOnboarding', 'true')
    const result = runGuard(
      makeRoute('map', { requiresAuth: true, requiresCompleteProfile: true }),
      makeAuthStore(true),
      makeProfileStore(null, null),
    )
    expect(result).toBeUndefined()
  })

  it('should redirect from onboarding to map if profile is already complete', () => {
    const result = runGuard(
      makeRoute('onboarding', { requiresAuth: true }),
      makeAuthStore(true),
      makeProfileStore('Max', 'Doe'),
    )
    expect(result).toEqual({ name: 'map' })
  })
})
