import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import TourForm from '@/features/tours/presentation/components/tour-form.vue'

const { mockUploadGpx, mockRemoveGpx } = vi.hoisted(() => ({
  mockUploadGpx: vi.fn(),
  mockRemoveGpx: vi.fn(),
}))

vi.mock('@/features/tours/data/services/gpx-storage-service', () => ({
  uploadGpx: mockUploadGpx,
  removeGpx: mockRemoveGpx,
}))

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
  Object.defineProperty(input.element, 'files', { value: { 0: file, length: 1 }, configurable: true })
  await input.trigger('change')
  await nextTick()
}

describe('tourForm', () => {
  describe('disabled prop', () => {
    it('disables the fieldset so inputs and non-picker buttons are inert', async () => {
      const wrapper = mountForm({ disabled: true })
      const fieldset = wrapper.find('fieldset.form-fieldset')
      expect(fieldset.exists()).toBe(true)
      expect(fieldset.attributes('disabled')).toBeDefined()

      // Native <fieldset disabled> disables nested form controls
      const nameInput = wrapper.find('#tf-tourName').element as HTMLInputElement
      expect(nameInput.disabled).toBe(true)

      const submit = wrapper.find('.submit-btn').element as HTMLButtonElement
      expect(submit.disabled).toBe(true)

      const cancel = wrapper.find('.cancel-btn').element as HTMLButtonElement
      expect(cancel.disabled).toBe(true)
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
      const wrapper = mountForm()
      // No initialEndPoint → end-point row collapsed to "Add" button
      const addBtn = wrapper.findAll('button').filter(b => b.text().includes('Add end point'))
      expect(addBtn.length).toBeGreaterThan(0)
      // No point-coords span for end point (only start point "Not set" shown)
      const coords = wrapper.findAll('.point-coords')
      expect(coords.length).toBe(1) // only start point
    })

    it('reveals end-point row when initialEndPoint is provided', () => {
      const wrapper = mountForm({ initialEndPoint: { lng: 7.9, lat: 46.5 } })
      // "Add end point" button should not be present
      const addBtn = wrapper.findAll('button').filter(b => b.text().includes('Add end point'))
      expect(addBtn.length).toBe(0)
      // Remove button present for end point
      const removeBtns = wrapper.findAll('.remove-point-btn')
      expect(removeBtns.length).toBeGreaterThan(0)
    })
  })

  describe('clearing end point also clears metadata', () => {
    it('should include null endPointName and endPointElevation in draft when end point is removed', async () => {
      const wrapper = mountForm({
        initialEndPoint: { lng: 7.9, lat: 46.5 },
        initialEndPointMeta: { name: 'Murren', elevation: 1638 },
      })
      // Remove the end point
      const removeBtn = wrapper.find('.remove-point-btn')
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
      const uploadBtn = wrapper.find('.gpx-upload-btn')
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
      expect(wrapper.find('.gpx-upload-btn').exists()).toBe(false)
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
      const removeBtn = wrapper.find('.gpx-remove-btn')
      await removeBtn.trigger('click')
      await nextTick()

      expect(wrapper.find('.gpx-filled-row').exists()).toBe(false)
      expect(wrapper.find('.gpx-upload-btn').exists()).toBe(true)

      await wrapper.find('#tf-tourName').setValue('Test Tour')
      await wrapper.find('form').trigger('submit.prevent')

      const emitted = wrapper.emitted('submit')
      expect(emitted).toHaveLength(1)
      const [, , gpxRemoved] = emitted![0] as [unknown, unknown, boolean]
      expect(gpxRemoved).toBe(true)
    })

    it('shows gpxError when parseGpxFile throws for invalid GPX', async () => {
      const { GpxParseError } = await import('@/features/tours/data/services/gpx-parser')
      vi.doMock('@/features/tours/data/services/gpx-parser', () => ({
        parseGpxFile: vi.fn().mockRejectedValue(new GpxParseError('bad xml')),
        GpxParseError,
        GpxFileTooLargeError: class GpxFileTooLargeError extends Error {},
      }))

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

  describe('pre-upload mode (preUploadGpx=true)', () => {
    const validGpxContent = `<?xml version="1.0"?><gpx version="1.1"><trk><trkseg><trkpt lat="46.5" lon="8.2"/></trkseg></trk></gpx>`

    beforeEach(() => {
      vi.clearAllMocks()
      mockUploadGpx.mockResolvedValue('user-abc/new-tour-id.gpx')
      mockRemoveGpx.mockResolvedValue(undefined)
    })

    it('should trigger upload and show spinner on valid file pick', async () => {
      const { parseGpxFile } = await import('@/features/tours/data/services/gpx-parser')
      vi.mocked(parseGpxFile).mockResolvedValue(undefined as never)

      const wrapper = mountForm({ preUploadGpx: true })
      const file = new File([validGpxContent], 'track.gpx')

      await pickFile(wrapper, file)

      expect(mockUploadGpx).toHaveBeenCalledWith('user-abc', expect.any(String), file)
      expect(wrapper.find('.gpx-filled-row').exists()).toBe(true)
    })

    it('should disable Save while uploading', async () => {
      const { parseGpxFile } = await import('@/features/tours/data/services/gpx-parser')
      vi.mocked(parseGpxFile).mockResolvedValue(undefined as never)

      let resolveUpload!: () => void
      mockUploadGpx.mockReturnValue(
        new Promise<string>((res) => {
          resolveUpload = () => res('user-abc/id.gpx')
        }),
      )

      const wrapper = mountForm({ preUploadGpx: true })
      const file = new File([validGpxContent], 'track.gpx')

      const pickPromise = pickFile(wrapper, file)
      await nextTick()

      const submitBtn = wrapper.find('.submit-btn').element as HTMLButtonElement
      expect(submitBtn.disabled).toBe(true)

      resolveUpload()
      await pickPromise
      await nextTick()

      expect(submitBtn.disabled).toBe(false)
    })

    it('should delete prior pending object when user picks a replacement file', async () => {
      const { parseGpxFile } = await import('@/features/tours/data/services/gpx-parser')
      vi.mocked(parseGpxFile).mockResolvedValue(undefined as never)

      mockUploadGpx
        .mockResolvedValueOnce('user-abc/first-id.gpx')
        .mockResolvedValueOnce('user-abc/second-id.gpx')

      const wrapper = mountForm({ preUploadGpx: true })

      await pickFile(wrapper, new File([validGpxContent], 'first.gpx'))
      await nextTick()
      expect(mockUploadGpx).toHaveBeenCalledTimes(1)

      await pickFile(wrapper, new File([validGpxContent], 'second.gpx'))
      await nextTick()

      expect(mockRemoveGpx).toHaveBeenCalledWith('user-abc/first-id.gpx')
      expect(mockUploadGpx).toHaveBeenCalledTimes(2)
    })

    it('should delete pending object on cancel', async () => {
      const { parseGpxFile } = await import('@/features/tours/data/services/gpx-parser')
      vi.mocked(parseGpxFile).mockResolvedValue(undefined as never)

      const wrapper = mountForm({ preUploadGpx: true })
      await pickFile(wrapper, new File([validGpxContent], 'track.gpx'))
      await nextTick()

      await wrapper.find('.cancel-btn').trigger('click')

      expect(mockRemoveGpx).toHaveBeenCalledWith('user-abc/new-tour-id.gpx')
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
})
