import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import BaseIcon from '@/core/components/base-icon.vue'
import { pace } from '@/core/composables/use-pace'
import TrackDrawPanel from '@/features/map/presentation/components/track-draw-panel.vue'

const props = {
  overlays: [],
  network: null,
  byActivity: false,
  issue: null,
  points: 0,
  metrics: { distance: null, ascent: null, descent: null },
  minutes: null,
  profile: null,
  busy: false,
  canUndo: false,
  canRedo: false,
  closed: false,
}

describe('trackDrawPanel', () => {
  it('should open the pace before the first tap and show a pace off the standard on the closed time', async () => {
    const w = mount(TrackDrawPanel, { props })
    expect(w.find('[data-testid="draw-pace"]').exists()).toBe(false)
    await w.find('[data-testid="draw-pace-toggle"]').trigger('click')
    // In the status line's place: the panel keeps its height.
    expect(w.find('[role="status"]').exists()).toBe(false)
    await w.find('[data-testid="draw-pace"] input').setValue('120')
    expect(pace.value).toBe(120)
    await w.find('[data-testid="draw-pace-toggle"]').trigger('click')
    expect(w.find('[data-testid="draw-pace"]').exists()).toBe(false)
    expect(w.find('[data-testid="draw-pace-toggle"]').findComponent(BaseIcon).props('name')).toBe('cruelty_free')
    pace.value = 100
  })
})
