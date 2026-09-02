<script setup lang="ts">
import type { TourAttachment } from '@/features/tours/domain/entities/tour-attachment'
import { storeToRefs } from 'pinia'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/core/components/base-button.vue'
import BaseIconButton from '@/core/components/base-icon-button.vue'
import BaseIcon from '@/core/components/base-icon.vue'
import { isOnline } from '@/core/offline/use-online-status'
import { MAX_ATTACHMENTS_PER_TOUR } from '@/features/tours/data/models/tour-attachment'
import { useTourAttachmentsStore } from '@/features/tours/presentation/stores/tour-attachments-store'

const props = defineProps<{
  /** tourId for edit-flow; undefined during create-flow (use draftId). */
  tourId?: string
  /** draftId for create-flow staging. */
  draftId?: string
  attachments: TourAttachment[]
  /**
   * Files the tour already holds that these ones ADD to — suggest mode, where `attachments`
   * lists only what the partner staged while the owner's own files still count against the
   * cap. Defaults to 0 (create/edit, where `attachments` is the whole list).
   */
  baseCount?: number
  /** Replaces the generic "limit reached" line when the caller can say something better. */
  limitLabel?: string
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
    store.stage(props.draftId, files, props.baseCount ?? 0)
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
function onDragStart(index: number, event: DragEvent) {
  dragFrom.value = index
  if (event.dataTransfer)
    event.dataTransfer.effectAllowed = 'move'
}

function onDragOver(event: DragEvent) {
  event.preventDefault()
  if (event.dataTransfer)
    event.dataTransfer.dropEffect = 'move'
}

async function onDrop(toIndex: number) {
  const from = dragFrom.value
  dragFrom.value = null
  if (from === null || from === toIndex)
    return

  if (props.draftId) {
    store.stageReorder(props.draftId, from, toIndex)
  }
  else if (props.tourId) {
    const reordered = [...props.attachments]
    const [moved] = reordered.splice(from, 1)
    reordered.splice(toIndex, 0, moved)
    await store.reorder(props.tourId, reordered.map(a => a.id))
  }
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
        :class="{ 'picker__item--confirm': confirmDeleteTarget?.id === attachment.id }"
        :draggable="confirmDeleteTarget === null"
        @dragstart="onDragStart(index, $event)"
        @dragover="onDragOver"
        @drop="onDrop(index)"
      >
        <!-- Inline delete confirm state -->
        <template v-if="confirmDeleteTarget?.id === attachment.id">
          <div class="picker__confirm-actions">
            <BaseButton variant="secondary" size="sm" @click="cancelDelete">
              {{ t('tours.infoSheet.cancelBtn') }}
            </BaseButton>
            <BaseButton variant="danger" size="sm" @click="confirmDelete">
              {{ t('tours.attachments.delete') }}
            </BaseButton>
          </div>
        </template>

        <!-- Normal state -->
        <template v-else>
          <BaseIcon name="drag_indicator" class="picker__drag-handle" />
          <BaseIcon
            :name="attachment.mimeType === 'application/pdf' ? 'picture_as_pdf' : 'image'"
            class="picker__file-icon"
          />
          <span class="picker__filename">{{ attachment.originalFilename }}</span>
          <BaseIconButton
            name="delete"
            :label="t('tours.attachments.delete')"
            shape="square"
            size="sm"
            tone="danger"
            @click="requestDelete(attachment)"
          />
        </template>
      </li>
    </ul>

    <!-- Add button / upload spinner. Attachments are online-only (DC10): while offline
         the control is disabled and replaced by a hint — reading existing ones is unaffected. -->
    <div class="picker__add-row">
      <p v-if="!isOnline" class="picker__limit-reached">
        <BaseIcon name="cloud_off" size="sm" />
        {{ t('offlineSync.attachmentsOnlineOnly') }}
      </p>
      <span v-else-if="loading" class="picker__spinner" />
      <BaseButton
        v-else-if="attachments.length + (baseCount ?? 0) < MAX_ATTACHMENTS_PER_TOUR"
        type="button"
        variant="secondary"
        size="sm"
        @click="openFilePicker"
      >
        <BaseIcon name="attach_file" />
        {{ t('tours.attachments.add') }}
      </BaseButton>
      <p v-else class="picker__limit-reached" data-testid="picker-limit">
        {{ limitLabel ?? t('tours.attachments.limitReached') }}
      </p>
    </div>

    <input
      ref="fileInput"
      type="file"
      multiple
      accept="image/png,image/jpeg,application/pdf"
      class="picker__hidden-input"
      @change="onFilesSelected"
    >
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
  min-height: 40px;
}

.picker__item--confirm {
  cursor: default;
  border-color: var(--color-error);
  justify-content: center;
}

.picker__drag-handle,
.picker__file-icon {
  color: var(--color-on-surface-variant);
  flex-shrink: 0;
}

.picker__filename {
  flex: 1;
  font-size: var(--font-size-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.picker__add-row {
  display: flex;
  align-items: center;
  min-height: 36px;
}

.picker__limit-reached {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}

.picker__spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-outline-variant);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: picker-spin 0.7s linear infinite;
  flex-shrink: 0;
}

@keyframes picker-spin {
  to {
    transform: rotate(360deg);
  }
}

.picker__hidden-input {
  display: none;
}

/* Inline delete confirm — centered in the row via .picker__item--confirm. */
.picker__confirm-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-xs);
}
</style>
