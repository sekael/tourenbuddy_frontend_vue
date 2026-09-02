import { createTestingPinia } from '@pinia/testing'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { GpxParseError, parseGpxFile } from '@/features/tours/data/services/gpx-parser'
import TourForm from '@/features/tours/presentation/components/tour-form.vue'

const { mockUploadGpx, mockRemoveGpx } = vi.hoisted(() => ({
  mockUploadGpx: vi.fn(),
  mockRemoveGpx: vi.fn(),
}))

vi.mock('@/features/tours/data/services/gpx-storage-service', () => ({
  uploadGpx: mockUploadGpx,
  removeGpx: mockRemoveGpx,
}))

// Spy on parseGpxFile but keep the real error classes for instanceof checks.
vi.mock('@/features/tours/data/services/gpx-parser', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/tours/data/services/gpx-parser')>()
  return { ...actual, parseGpxFile: vi.fn() }
})

vi.mock('@/features/auth/presentation/stores/auth-store', () => ({
  useAuthStore: vi.fn().mockReturnValue({ currentUser: { id: 'user-abc' } }),
}))

function mountForm(props: Record<string, unknown> = {}) {
  return mount(TourForm, {
    props: { submitLabel: 'Save', ...props },
    global: {
      plugins: [
        createTestingPinia({
          createSpy: vi.fn,
          initialState: { contacts: { contacts: [] } },
        }),
      ],
      stubs: { ContactChip: true },
    },
  })
}

async function pickFile(wrapper: ReturnType<typeof mountForm>, file: File) {
  const input = wrapper.find('input[type="file"]')
  Object.defineProperty(input.element, 'files', {
    value: { 0: file, length: 1 },
    configurable: true,
  })
  await input.trigger('change')
  await nextTick()
}

describe('tourForm', () => {
  describe('disabled prop', () => {
    it('renders the fieldset disabled so nested inputs and buttons are inert', () => {
      const wrapper = mountForm({ disabled: true })
      const fieldset = wrapper.find('fieldset.form-fieldset')
      expect(fieldset.exists()).toBe(true)
      // The component's job is to render <fieldset disabled>; native form
      // semantics make every nested control inert. happy-dom doesn't reliably
      // mirror that onto child .disabled props, so assert the mechanism itself.
      expect(fieldset.attributes('disabled')).toBeDefined()
    })

    it('does not emit submit while disabled', async () => {
      const wrapper = mountForm({ disabled: true })
      // Direct handleSubmit via form event (bypassing disabled button click)
      await wrapper.find('form').trigger('submit.prevent')
      expect(wrapper.emitted('submit')).toBeUndefined()
    })

    it('emits submit when not disabled and name is valid', async () => {
      const wrapper = mountForm({ disabled: false })
      const nameInput = wrapper.find('#tf-tourName')
      await nameInput.setValue('My Tour')
      await wrapper.find('form').trigger('submit.prevent')
      expect(wrapper.emitted('submit')).toHaveLength(1)
    })

    it('does not attribute disabled on fieldset when disabled is false', () => {
      const wrapper = mountForm({ disabled: false })
      const fieldset = wrapper.find('fieldset.form-fieldset')
      expect(fieldset.attributes('disabled')).toBeUndefined()
    })
  })

  describe('end-point row conditional rendering', () => {
    it('shows "Add end point" button and hides point inputs when endPoint is null', () => {
      // End-point section only renders once a start point exists.
      const wrapper = mountForm({ initialStartPoint: { lng: 7.8, lat: 46.5 } })
      // No initialEndPoint → end-point row collapsed to "Add" button
      const addBtn = wrapper.findAll('button').filter(b => b.text().includes('addEndPointBtn'))
      expect(addBtn.length).toBeGreaterThan(0)
      // Only the start point shows coordinates; end point is still the "Add" prompt.
      const coords = wrapper.findAll('.point-coords')
      expect(coords.length).toBe(1)
    })

    it('reveals end-point row when initialEndPoint is provided', () => {
      const wrapper = mountForm({
        initialStartPoint: { lng: 7.8, lat: 46.5 },
        initialEndPoint: { lng: 7.9, lat: 46.5 },
      })
      // "Add end point" button should not be present
      const addBtn = wrapper.findAll('button').filter(b => b.text().includes('addEndPointBtn'))
      expect(addBtn.length).toBe(0)
      // Remove button present for end point
      const removeBtns = wrapper.findAll('[data-testid="remove-end-btn"]')
      expect(removeBtns.length).toBeGreaterThan(0)
    })
  })

  describe('clearing end point also clears metadata', () => {
    it('should include null endPointName and endPointElevation in draft when end point is removed', async () => {
      const wrapper = mountForm({
        initialStartPoint: { lng: 7.8, lat: 46.5 },
        initialEndPoint: { lng: 7.9, lat: 46.5 },
        initialEndPointMeta: { name: 'Murren', elevation: 1638 },
      })
      // Remove the end point
      const removeBtn = wrapper.find('[data-testid="remove-end-btn"]')
      await removeBtn.trigger('click')
      await nextTick()

      // Submit with a valid name
      const nameInput = wrapper.find('#tf-tourName')
      await nameInput.setValue('My Tour')
      await wrapper.find('form').trigger('submit.prevent')

      const emitted = wrapper.emitted('submit')
      expect(emitted).toHaveLength(1)
      const draft = (emitted![0] as unknown[])[0] as Record<string, unknown>
      expect(draft.endPoint).toBeNull()
      expect(draft.endPointName).toBeNull()
      expect(draft.endPointElevation).toBeNull()
    })
  })

  describe('gPX section states', () => {
    it('shows upload button in empty state', () => {
      const wrapper = mountForm()
      const uploadBtn = wrapper.find('[data-testid="gpx-upload-btn"]')
      expect(uploadBtn.exists()).toBe(true)
      const filledRow = wrapper.find('.gpx-filled-row')
      expect(filledRow.exists()).toBe(false)
    })

    it('shows filled row when initialDraft has gpxFilepath', () => {
      const wrapper = mountForm({
        initialDraft: {
          name: 'Test',
          plannedDate: null,
          partnerIds: [],
          tourType: null,
          elevation: null,
          gpxFilepath: 'tour-abc.gpx',
          description: null,
          seasons: null,
          startPoint: null,
          endPoint: null,
          startPointName: null,
          startPointElevation: null,
          endPointName: null,
          endPointElevation: null,
          equipment: null,
          notes: null,
        },
      })
      expect(wrapper.find('.gpx-filled-row').exists()).toBe(true)
      expect(wrapper.find('[data-testid="gpx-upload-btn"]').exists()).toBe(false)
    })

    it('emits gpxRemoved=true after remove click', async () => {
      const wrapper = mountForm({
        initialDraft: {
          name: 'Test',
          plannedDate: null,
          partnerIds: [],
          tourType: null,
          elevation: null,
          gpxFilepath: 'tour-abc.gpx',
          description: null,
          seasons: null,
          startPoint: null,
          endPoint: null,
          startPointName: null,
          startPointElevation: null,
          endPointName: null,
          endPointElevation: null,
          equipment: null,
          notes: null,
        },
      })
      const removeBtn = wrapper.find('[data-testid="gpx-remove-btn"]')
      await removeBtn.trigger('click')
      await nextTick()

      expect(wrapper.find('.gpx-filled-row').exists()).toBe(false)
      expect(wrapper.find('[data-testid="gpx-upload-btn"]').exists()).toBe(true)

      await wrapper.find('#tf-tourName').setValue('Test Tour')
      await wrapper.find('form').trigger('submit.prevent')

      const emitted = wrapper.emitted('submit')
      expect(emitted).toHaveLength(1)
      const [, gpxRemoved] = emitted![0] as [unknown, boolean]
      expect(gpxRemoved).toBe(true)
    })

    it('shows gpxError when parseGpxFile throws for invalid GPX', async () => {
      vi.mocked(parseGpxFile).mockRejectedValueOnce(new GpxParseError('bad xml'))

      const wrapper = mountForm()
      const input = wrapper.find('input[type="file"]')
      const file = new File(['bad'], 'bad.gpx')
      Object.defineProperty(input.element, 'files', { value: { 0: file, length: 1 } })
      await input.trigger('change')
      await nextTick()
      await nextTick()
      expect(wrapper.find('.gpx-error').exists()).toBe(true)
    })
  })

  describe('eager upload (always pre-uploads on file pick)', () => {
    const validGpxContent = `<?xml version="1.0"?><gpx version="1.1"><trk><trkseg><trkpt lat="46.5" lon="8.2"/></trkseg></trk></gpx>`

    beforeEach(() => {
      vi.clearAllMocks()
      vi.mocked(parseGpxFile).mockResolvedValue(undefined as never)
      mockUploadGpx.mockResolvedValue('user-abc/new-tour-id.gpx')
      mockRemoveGpx.mockResolvedValue(undefined)
    })

    it('should trigger upload and show spinner on valid file pick', async () => {
      const wrapper = mountForm()
      const file = new File([validGpxContent], 'track.gpx')

      await pickFile(wrapper, file)

      expect(mockUploadGpx).toHaveBeenCalledWith('user-abc', expect.any(String), file)
      expect(wrapper.find('.gpx-filled-row').exists()).toBe(true)
    })

    it('should disable Save while uploading and re-enable after completion', async () => {
      let resolveUpload!: () => void
      mockUploadGpx.mockReturnValue(
        new Promise<string>((res) => {
          resolveUpload = () => res('user-abc/id.gpx')
        }),
      )

      const wrapper = mountForm()
      const file = new File([validGpxContent], 'track.gpx')

      const pickPromise = pickFile(wrapper, file)
      // parseGpxFile is async, so isUploadingGpx flips a microtask later — flush.
      await flushPromises()

      const submitBtn = wrapper.find('[data-testid="submit-btn"]').element as HTMLButtonElement
      expect(submitBtn.disabled).toBe(true)

      resolveUpload()
      await pickPromise
      await flushPromises()

      expect(submitBtn.disabled).toBe(false)
    })

    it('should delete prior pending blob when user picks a replacement file', async () => {
      mockUploadGpx
        .mockResolvedValueOnce('user-abc/first-id.gpx')
        .mockResolvedValueOnce('user-abc/second-id.gpx')

      const wrapper = mountForm()

      await pickFile(wrapper, new File([validGpxContent], 'first.gpx'))
      await nextTick()
      expect(mockUploadGpx).toHaveBeenCalledTimes(1)

      await pickFile(wrapper, new File([validGpxContent], 'second.gpx'))
      await nextTick()

      expect(mockRemoveGpx).toHaveBeenCalledWith('user-abc/first-id.gpx')
      expect(mockUploadGpx).toHaveBeenCalledTimes(2)
    })

    it('should delete pending blob on cancel after upload completes', async () => {
      const wrapper = mountForm()
      await pickFile(wrapper, new File([validGpxContent], 'track.gpx'))
      await nextTick()

      await wrapper.find('[data-testid="cancel-btn"]').trigger('click')

      expect(mockRemoveGpx).toHaveBeenCalledWith('user-abc/new-tour-id.gpx')
    })

    it('should set wasCancelledDuringUpload flag when cancel fires while upload in flight', async () => {
      let resolveUpload!: (key: string) => void
      mockUploadGpx.mockReturnValue(new Promise<string>(res => (resolveUpload = res)))

      const wrapper = mountForm()
      pickFile(wrapper, new File([validGpxContent], 'track.gpx'))
      await nextTick()

      await wrapper.find('[data-testid="cancel-btn"]').trigger('click')

      resolveUpload('user-abc/inflight.gpx')
      await nextTick()
      await nextTick()

      expect(mockRemoveGpx).toHaveBeenCalledWith('user-abc/inflight.gpx')
    })
  })

  describe('initialName prop reactivity', () => {
    it('updates name field when initialName prop changes to a non-null value', async () => {
      const wrapper = mountForm({ initialName: 'Original' })
      await wrapper.setProps({ initialName: 'Updated Name' })
      await nextTick()
      const nameInput = wrapper.find('#tf-tourName').element as HTMLInputElement
      expect(nameInput.value).toBe('Updated Name')
    })

    it('does not overwrite name when initialName prop changes to null', async () => {
      const wrapper = mountForm({ initialName: 'Keep Me' })
      await wrapper.setProps({ initialName: null })
      await nextTick()
      const nameInput = wrapper.find('#tf-tourName').element as HTMLInputElement
      expect(nameInput.value).toBe('Keep Me')
    })
  })

  describe('end date (multi-day span)', () => {
    async function fillAndSubmit(wrapper: ReturnType<typeof mountForm>, start: string, end: string) {
      await wrapper.find('#tf-tourName').setValue('Hut Tour')
      await wrapper.find('#tf-plannedDate').setValue(start)
      await wrapper.find('#tf-endDate').setValue(end)
      await wrapper.find('form').trigger('submit.prevent')
    }

    it('blocks submit and shows an error when the end date is before the start', async () => {
      const wrapper = mountForm()
      await fillAndSubmit(wrapper, '2026-08-25', '2026-08-20')
      expect(wrapper.emitted('submit')).toBeUndefined()
      expect(wrapper.find('#tf-endDate').classes()).toContain('input--error')
    })

    it('clears the end date when the planned date is cleared', async () => {
      const wrapper = mountForm()
      await wrapper.find('#tf-plannedDate').setValue('2026-08-25')
      await wrapper.find('#tf-endDate').setValue('2026-08-27')
      await wrapper.find('#tf-plannedDate').setValue('')
      await nextTick()
      expect((wrapper.find('#tf-endDate').element as HTMLInputElement).value).toBe('')
    })

    it('submits a null endDate when only the planned date is set', async () => {
      const wrapper = mountForm()
      await wrapper.find('#tf-tourName').setValue('Day Hike')
      await wrapper.find('#tf-plannedDate').setValue('2026-08-25')
      await wrapper.find('form').trigger('submit.prevent')
      expect(wrapper.emitted('submit')![0]![0]).toMatchObject({ endDate: null })
    })
  })
})

/** The attachments picker owns the SECOND file input — the first belongs to GPX. */
async function stageFile(wrapper: ReturnType<typeof mountForm>, file: File) {
  const input = wrapper.find('.picker__hidden-input')
  Object.defineProperty(input.element, 'files', { value: { 0: file, length: 1 }, configurable: true })
  await input.trigger('change')
  await nextTick()
}

describe('tourForm — suggest mode attachment cap (D10)', () => {
  const owned = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `att-${i}`,
      tourId: 't1',
      mimeType: 'image/jpeg',
      originalFilename: `own-${i}.jpg`,
      sizeBytes: 10,
      sortOrder: i,
    }))

  function mountSuggest(existing: number) {
    return mount(TourForm, {
      props: { submitLabel: 'Suggest', mode: 'suggest', tourId: 't1', initialName: 'Tour' },
      global: {
        // Real actions: `stage` is the guard under test, and toggling a removal has to
        // move the picker's remaining slots for real.
        plugins: [createTestingPinia({
          createSpy: vi.fn,
          stubActions: false,
          initialState: {
            contacts: { contacts: [] },
            tourAttachments: { attachmentsByTour: { t1: owned(existing) } },
          },
        })],
        stubs: { ContactChip: true },
      },
    })
  }

  it('offers no add button on a full tour — the owner\'s files count against the cap', async () => {
    // The picker used to measure only what the partner staged, so a tour holding five
    // still looked empty and four more adds could be proposed.
    const wrapper = mountSuggest(5)
    await nextTick()

    expect(wrapper.find('[data-testid="picker-limit"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('tours.suggestions.capHintSuggester')
  })

  it('frees a slot as soon as a removal is proposed', async () => {
    const wrapper = mountSuggest(5)
    await nextTick()

    await wrapper.findAll('.removal-row')[0].trigger('click')

    expect(wrapper.find('[data-testid="picker-limit"]').exists()).toBe(false)
  })

  it('blocks submit when un-marking a removal pushes the batch over the limit', async () => {
    const wrapper = mountSuggest(5)
    await nextTick()

    // Make room, take it, then take the room back — the picker can't gate this one.
    await wrapper.findAll('.removal-row')[0].trigger('click')
    await stageFile(wrapper, new File(['x'], 'new.jpg', { type: 'image/jpeg' }))
    await wrapper.findAll('.removal-row')[0].trigger('click')

    expect(wrapper.find('[data-testid="attachment-overflow"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="submit-btn"]').attributes('disabled')).toBeDefined()

    await wrapper.find('form').trigger('submit.prevent')
    expect(wrapper.emitted('submit')).toBeUndefined()
  })
})
