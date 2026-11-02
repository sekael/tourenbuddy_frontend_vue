import { createTestingPinia } from '@pinia/testing'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import RoutePlanner from '@/features/map/presentation/components/route-planner.vue'

const { mockGetElevation, mockSuggestTourName } = vi.hoisted(() => ({ mockGetElevation: vi.fn(), mockSuggestTourName: vi.fn() }))
vi.mock('@/features/tours/data/services/swisstopo-elevation-service', () => ({ getElevation: mockGetElevation }))
vi.mock('@/features/tours/data/services/swisstopo-name-service', () => ({ suggestTourName: mockSuggestTourName }))

function fakeMap() {
  const handlers: Record<string, (e: unknown) => void> = {}
  return {
    handlers,
    on: (event: string, fn: (e: unknown) => void) => (handlers[event] = fn),
    off: vi.fn(),
    project: () => ({ x: 0, y: 0, dist: () => 1000 }),
    getBearing: () => 0,
    cameraForBounds: () => undefined,
    easeTo: vi.fn(),
    getCanvas: () => ({ style: {} }),
    getContainer: () => document.createElement('div'),
    getCenter: () => ({ lng: 8, lat: 46 }),
    getZoom: () => 12,
    doubleClickZoom: { disable: vi.fn(), enable: vi.fn() },
    flyTo: vi.fn(),
    jumpTo: vi.fn(),
  }
}

function mountPlanner(props: Record<string, unknown> = {}) {
  const map = fakeMap()
  const wrapper = mount(RoutePlanner, {
    props: { map, initial: { start: null, goal: null, end: null }, step: 'start', title: 'New tour', doneLabel: 'Continue', ...props },
    global: { plugins: [createTestingPinia({ createSpy: vi.fn })], stubs: { Teleport: true } },
  })
  const tap = (lng: number, lat: number) => map.handlers.click!({ point: { x: 0, y: 0 }, lngLat: { lng, lat } })
  return { wrapper, map, tap }
}

const lastPoints = (wrapper: ReturnType<typeof mountPlanner>['wrapper']) => (wrapper.emitted('change')!.at(-1) as [Record<string, { name: string | null } | null>])[0]

describe('routePlanner', () => {
  it('should set no point on a tap the page takes (a marked ski route)', async () => {
    const { wrapper, tap } = mountPlanner({ routeHit: () => true })
    tap(8.1, 46.1)
    await flushPromises()
    expect(lastPoints(wrapper).start).toBeNull()
  })

  it('should not continue without a goal', () => {
    const { wrapper } = mountPlanner()
    expect(wrapper.find('[data-testid=planner-done]').attributes('disabled')).toBeDefined()
  })

  it('should keep the newer place\'s name when the first lookup answers late', async () => {
    let answerFirst: (name: string) => void = () => {}
    mockSuggestTourName.mockReset()
      .mockImplementationOnce(() => new Promise(resolve => (answerFirst = resolve)))
      .mockResolvedValueOnce('Second')
    mockGetElevation.mockResolvedValue(1500)
    const { wrapper, tap } = mountPlanner({ step: 'goal' })

    tap(8.1, 46.1)
    await wrapper.find('[data-testid=planner-step-goal]').trigger('click')
    tap(8.2, 46.2)
    await flushPromises()
    answerFirst('First')
    await flushPromises()

    expect(lastPoints(wrapper).goal).toMatchObject({ name: 'Second', location: { lng: 8.2, lat: 46.2 } })
  })

  it('should make a round trip end where the start is, with its name and height', async () => {
    const start = { location: { lng: 8.1, lat: 46.1 }, name: 'Engelberg', elevation: 1002, loading: false }
    const goal = { location: { lng: 8.2, lat: 46.2 }, name: 'Titlis', elevation: 3238, loading: false }
    const { wrapper } = mountPlanner({ initial: { start, goal, end: null }, step: 'end' })

    await wrapper.find('[data-testid=planner-roundTrip]').trigger('click')

    expect(lastPoints(wrapper).end).toEqual(start)
    expect(wrapper.find('[data-testid=planner-climb]').text()).toContain('2236')
  })

  it('should leave the route step on Escape', async () => {
    const { wrapper } = mountPlanner()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })
})

describe('routePlanner — a handed-over start', () => {
  it('should name a start it was handed unnamed (the last day\'s goal), as a new point', async () => {
    mockSuggestTourName.mockReset().mockResolvedValue('Cabane des Dix')
    mockGetElevation.mockResolvedValue(2928)
    const start = { location: { lng: 7.4, lat: 46.0 }, name: null, elevation: 2928, loading: true }
    const { wrapper } = mountPlanner({ initial: { start, goal: null, end: null }, step: 'goal' })
    await flushPromises()
    expect(lastPoints(wrapper).start).toMatchObject({ name: 'Cabane des Dix', loading: false })
  })
})
