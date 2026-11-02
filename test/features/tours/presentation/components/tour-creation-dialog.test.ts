import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import TourCreationDialog from '@/features/tours/presentation/components/tour-creation-dialog.vue'

const forms: { collect: ReturnType<typeof vi.fn>, discard: ReturnType<typeof vi.fn> }[] = []
const TourFormStub = {
  name: 'TourForm',
  template: '<button data-testid="stub-submit" @click="$emit(\'submit\')" />',
  props: ['formId', 'idPrefix', 'currentGoal', 'initialDraft', 'pick', 'drawnTrack', 'disabled', 'stages', 'submitLabel', 'embedded', 'allowGoalEdit'],
  emits: ['submit', 'cancel'],
  setup(_: unknown, { expose }: { expose: (api: object) => void }) {
    const api = { collect: vi.fn(), discard: vi.fn(), submitBlocked: false, tourName: 'Stage', plannedDate: '' }
    forms.push(api)
    expose(api)
    return {}
  },
}

const stage = (key: string) => ({ key, goal: { lng: 8, lat: 46 }, seed: null, picks: null, drawnTrack: null })

function mountDialog(mapState: Record<string, unknown> = {}) {
  forms.length = 0
  return mount(TourCreationDialog, {
    props: { stages: [stage('a'), stage('b')], active: 0, title: 'New tour' },
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn, initialState: { map: { isPickingLocation: false, ...mapState } } })],
      stubs: { TourForm: TourFormStub, FullScreenPage: { template: '<div><slot /><slot name="page-action" /></div>', emits: ['close'] } },
    },
  })
}

describe('tourCreationDialog — stages', () => {
  it('should save nothing and bring the stage that can\'t be saved to the front', async () => {
    const wrapper = mountDialog()
    forms[0]!.collect.mockReturnValue({ draft: { name: 'Day 1' }, preUploadedTourId: null, draftId: 'd1' })
    forms[1]!.collect.mockReturnValue(null)

    await wrapper.find('[data-testid=stub-submit]').trigger('click')

    expect(wrapper.emitted('confirm')).toBeUndefined()
    expect(wrapper.emitted('select')).toEqual([[1]])
  })

  it('should not save while a point is being set on the map', async () => {
    const wrapper = mountDialog({ isPickingLocation: true })
    await wrapper.find('[data-testid=stub-submit]').trigger('click')
    expect(forms[0]!.collect).not.toHaveBeenCalled()
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })

  it('should ask before discarding a planned tour, and keep everything when the user goes on', async () => {
    const wrapper = mountDialog()
    await wrapper.findComponent(TourFormStub).vm.$emit('cancel')
    expect(wrapper.emitted('close')).toBeUndefined()

    await wrapper.find('[data-testid=discard-keep]').trigger('click')
    expect(wrapper.find('[data-testid=discard-confirm]').exists()).toBe(false)
    expect(forms.every(f => f.discard.mock.calls.length === 0)).toBe(true)
  })

  it('should discard every stage\'s uploads once confirmed', async () => {
    const wrapper = mountDialog()
    await wrapper.findComponent(TourFormStub).vm.$emit('cancel')
    await wrapper.find('[data-testid=discard-confirm-btn]').trigger('click')
    expect(forms.map(f => f.discard.mock.calls.length)).toEqual([1, 1])
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('should say which day of a split span is still missing and plan it', async () => {
    const wrapper = mountDialog()
    await wrapper.setProps({ dayOffset: 0, dayCount: 3 })
    expect(wrapper.find('[data-testid=missing-day]').text()).toContain('tours.creation.dayMissing')
    await wrapper.find('[data-testid=plan-missing-day]').trigger('click')
    expect(wrapper.emitted('nextDay')).toHaveLength(1)

    await wrapper.setProps({ stages: [stage('a'), stage('b'), stage('c')] })
    expect(wrapper.find('[data-testid=missing-day]').exists()).toBe(false)
  })
})
