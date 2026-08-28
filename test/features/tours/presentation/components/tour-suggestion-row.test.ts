import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import TourSuggestionRow from '@/features/tours/presentation/components/tour-suggestion-row.vue'

function makeSuggestion(overrides: Record<string, unknown> = {}) {
  return {
    id: 's1',
    tourId: 't1',
    ownerId: 'owner-1',
    suggesterId: 'friend-1',
    batchId: 'b1',
    field: 'name',
    value: 'Gfroren Hora Nordwand',
    baseValue: 'Gfroren Hora',
    currentValue: 'Gfroren Hora',
    targetId: null,
    status: 'pending',
    isStale: false,
    createdAt: new Date('2026-08-01'),
    resolvedAt: null,
    suggesterFirstName: 'Jakob',
    suggesterLastName: null,
    ...overrides,
  } as never
}

function mountRow(props: Record<string, unknown>) {
  return mount(TourSuggestionRow, {
    props: { mode: 'owner', ...props } as never,
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn, stubActions: false })],
      stubs: {
        BaseIcon: { props: ['name'], template: '<i :data-icon="name" />' },
        BaseButton: {
          props: ['disabled'],
          template: '<button :disabled="disabled"><slot /></button>',
        },
      },
    },
  })
}

describe('tourSuggestionRow', () => {
  it('renders three columns when the owner has edited the field since (stale, D4)', () => {
    // Accepting a stale suggestion is allowed — but only ever with the divergence on
    // screen, so it reads as a deliberate overwrite of the owner's own newer value.
    const wrapper = mountRow({
      suggestion: makeSuggestion({ isStale: true, currentValue: 'Renamed by me' }),
    })

    expect(wrapper.findAll('.value-col')).toHaveLength(3)
    expect(wrapper.text()).toContain('Renamed by me')
    expect(wrapper.find('.stale-badge').exists()).toBe(true)
  })

  it('renders two columns for a clean suggestion', () => {
    const wrapper = mountRow({ suggestion: makeSuggestion() })

    expect(wrapper.findAll('.value-col')).toHaveLength(2)
    expect(wrapper.find('.stale-badge').exists()).toBe(false)
  })

  it('disables accept with a hint when an attachment_add would breach the cap (D10)', () => {
    const wrapper = mountRow({
      suggestion: makeSuggestion({ field: 'attachment_add', value: { originalFilename: 'x.jpg' } }),
      capFull: true,
    })

    expect(wrapper.find('[data-testid="accept-btn"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('.cap-hint').exists()).toBe(true)
    // Declining is still possible — the cap is about applying, not about deciding.
    expect(wrapper.find('[data-testid="decline-btn"]').attributes('disabled')).toBeUndefined()
  })

  it('does not block a non-attachment field on a full tour', () => {
    const wrapper = mountRow({ suggestion: makeSuggestion(), capFull: true })

    expect(wrapper.find('[data-testid="accept-btn"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('.cap-hint').exists()).toBe(false)
  })

  it('offers the author withdraw only — never accept or decline', () => {
    const wrapper = mountRow({ suggestion: makeSuggestion(), mode: 'author' })

    expect(wrapper.find('[data-testid="accept-btn"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="decline-btn"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="withdraw-btn"]').exists()).toBe(true)
  })

  it('offers no action at all on a resolved row — resolution is final', () => {
    const wrapper = mountRow({
      suggestion: makeSuggestion({ status: 'declined', resolvedAt: new Date('2026-08-02') }),
    })

    expect(wrapper.find('.row-actions').exists()).toBe(false)
    expect(wrapper.find('.status-badge').exists()).toBe(true)
  })

  it('renders a cleared field as an em dash, not as empty', () => {
    // "Remove the description" is a real suggestion (D1); a blank cell would read as
    // "no suggestion here".
    const wrapper = mountRow({
      suggestion: makeSuggestion({ field: 'description', value: null, baseValue: 'North face' }),
    })

    expect(wrapper.find('.value--new').text()).toBe('tours.suggestions.emptyValue')
  })

  it('renders a dates suggestion as one span, never two disconnected fields', () => {
    const wrapper = mountRow({
      suggestion: makeSuggestion({
        field: 'dates',
        value: { plannedDate: '2026-02-01', endDate: '2026-02-03' },
        baseValue: { plannedDate: '2026-02-01', endDate: null },
      }),
    })

    expect(wrapper.find('.value--new').text()).toContain('–')
  })
})
