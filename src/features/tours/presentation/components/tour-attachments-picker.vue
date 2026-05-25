<script setup lang="ts">
import type { TourAttachment } from '@/features/tours/domain/entities/tour-attachment'
import { storeToRefs } from 'pinia'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTourAttachmentsStore } from '@/features/tours/presentation/stores/tour-attachments-store'

const props = defineProps<{
  /** tourId for edit-flow; undefined during create-flow (use draftId). */
  tourId?: string
  /** draftId for create-flow staging. */
  draftId?: string
  attachments: TourAttachment[]
}>()

const { t } = useI18n({ useScope: 'global' })
const store = useTourAttachmentsStore()
const { loading, error } = storeToRefs(store)

const fileInput = ref<HTMLInputElement | null>(null)
const confirmDeleteTarget = ref<TourAttachment | null>(null)
const dragFrom = ref<number | null>(null)

function openFilePicker() {
  fileInput.value?.click()
}

async function onFilesSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = '' // reset so same file can be re-selected after rejection

  if (!files.length)
    return

  if (props.draftId) {
    store.stage(props.draftId, files)
  }
  else if (props.tourId) {
    await store.add(props.tourId, files)
  }
}

function requestDelete(attachment: TourAttachment) {
  confirmDeleteTarget.value = attachment
}

async function confirmDelete() {
  const target = confirmDeleteTarget.value
  confirmDeleteTarget.value = null
  if (!target)
    return
  await store.remove(target)
}

function cancelDelete() {
  confirmDeleteTarget.value = null
}

// ── Drag-to-reorder ────────────────────────────────────────────────────────────
function onDragStart(index: number) {
  dragFrom.value = index
}

function onDragOver(event: DragEvent) {
  event.preventDefault()
}

async function onDrop(toIndex: number) {
  const from = dragFrom.value
  dragFrom.value = null
  if (from === null || from === toIndex)
    return
  if (!props.tourId)
    return // reorder only for persisted tours

  const reordered = [...props.attachments]
  const [moved] = reordered.splice(from, 1)
  reordered.splice(toIndex, 0, moved)
  await store.reorder(props.tourId, reordered.map(a => a.id))
}
</script>

<template>
  <div class="picker">
    <!-- Error banner -->
    <p v-if="error" class="picker__error" role="alert">
      {{ error }}
    </p>

    <!-- Attachment list -->
    <ul v-if="attachments.length" class="picker__list">
      <li
        v-for="(attachment, index) in attachments"
        :key="attachment.id"
        class="picker__item"
        draggable="true"
        @dragstart="onDragStart(index)"
        @dragover="onDragOver"
        @drop="onDrop(index)"
      >
        <span class="material-symbols-outlined picker__drag-handle" aria-hidden="true">drag_indicator</span>
        <span class="material-symbols-outlined picker__file-icon" aria-hidden="true">
          {{ attachment.mimeType === 'application/pdf' ? 'picture_as_pdf' : 'image' }}
        </span>
        <span class="picker__filename">{{ attachment.originalFilename }}</span>
        <button
          type="button"
          class="picker__delete-btn"
          :aria-label="t('tours.attachments.delete')"
          @click="requestDelete(attachment)"
        >
          <span class="material-symbols-outlined" aria-hidden="true">delete</span>
        </button>
      </li>
    </ul>

    <!-- Add button -->
    <button
      v-if="attachments.length < 5"
      type="button"
      class="picker__add-btn"
      :disabled="loading"
      @click="openFilePicker"
    >
      <span class="material-symbols-outlined" aria-hidden="true">attach_file</span>
      {{ t('tours.attachments.add') }}
    </button>

    <p v-else class="picker__limit-reached">
      {{ t('tours.attachments.limitReached') }}
    </p>

    <input
      ref="fileInput"
      type="file"
      multiple
      accept="image/png,image/jpeg,application/pdf"
      class="picker__hidden-input"
      @change="onFilesSelected"
    >

    <!-- Delete confirm dialog -->
    <Teleport to="body">
      <div
        v-if="confirmDeleteTarget"
        class="confirm-backdrop"
        role="dialog"
        aria-modal="true"
        :aria-label="t('tours.attachments.deleteConfirm.title')"
        @click.self="cancelDelete"
      >
        <div class="confirm-card">
          <p class="confirm-title">
            {{ t('tours.attachments.deleteConfirm.title') }}
          </p>
          <p class="confirm-body">
            {{ t('tours.attachments.deleteConfirm.body') }}
          </p>
          <div class="confirm-actions">
            <button type="button" class="confirm-cancel" @click="cancelDelete">
              {{ t('tours.infoSheet.cancelBtn') }}
            </button>
            <button type="button" class="confirm-delete" @click="confirmDelete">
              {{ t('tours.attachments.delete') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.picker {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.picker__error {
  color: var(--color-error);
  font-size: var(--font-size-sm);
}

.picker__list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxs);
}

.picker__item {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-md);
  background: var(--color-surface-variant);
  cursor: grab;
}

.picker__drag-handle,
.picker__file-icon {
  color: var(--color-on-surface-variant);
  font-size: 20px;
  flex-shrink: 0;
}

.picker__filename {
  flex: 1;
  font-size: var(--font-size-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.picker__delete-btn {
  color: var(--color-on-surface-variant);
  display: flex;
  align-items: center;
  padding: var(--spacing-xxs);
  border-radius: var(--radius-sm);
  flex-shrink: 0;
  transition: color 0.15s;
}

.picker__delete-btn:hover {
  color: var(--color-error);
}

.picker__add-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  align-self: flex-start;
  padding: var(--spacing-xs) var(--spacing-md);
  border: 1px dashed var(--color-outline-variant);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  color: var(--color-primary);
  transition: background-color 0.15s;
}

.picker__add-btn:hover:not(:disabled) {
  background-color: var(--color-surface-variant);
}

.picker__add-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.picker__limit-reached {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}

.picker__hidden-input {
  display: none;
}

/* Confirm dialog */
.confirm-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 60;
}

.confirm-card {
  background: var(--color-background);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  max-width: 360px;
  width: calc(100% - var(--spacing-xl) * 2);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.confirm-title {
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-lg);
}

.confirm-body {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}

.confirm-actions {
  display: flex;
  gap: var(--spacing-sm);
  justify-content: flex-end;
}

.confirm-cancel {
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
}

.confirm-delete {
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  background: var(--color-error);
  color: var(--color-on-error);
  font-weight: var(--font-weight-medium);
}
</style>
