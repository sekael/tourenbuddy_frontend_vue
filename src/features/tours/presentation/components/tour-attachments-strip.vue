<script setup lang="ts">
import type { TourAttachment } from '@/features/tours/domain/entities/tour-attachment'
import { onMounted, ref } from 'vue'
import { useTourAttachmentsStore } from '@/features/tours/presentation/stores/tour-attachments-store'

const props = defineProps<{
  tourId: string
}>()

const emit = defineEmits<{
  openViewer: [attachments: TourAttachment[], startIndex: number]
}>()

const store = useTourAttachmentsStore()

const attachments = ref<TourAttachment[]>([])
const thumbnailUrls = ref<Record<string, string>>({})

onMounted(async () => {
  await store.load(props.tourId)
  attachments.value = store.attachmentsByTour[props.tourId] ?? []
  // Load thumbnail URLs for images only
  for (const att of attachments.value) {
    if (att.mimeType !== 'application/pdf') {
      try {
        thumbnailUrls.value[att.id] = await store.getViewUrl(att.storagePath)
      }
      catch {
        // Thumbnail load failure is non-critical
      }
    }
  }
})

function openAt(index: number) {
  emit('openViewer', attachments.value, index)
}
</script>

<template>
  <div v-if="attachments.length" class="strip">
    <button
      v-for="(att, index) in attachments"
      :key="att.id"
      type="button"
      class="strip__item"
      @click="openAt(index)"
    >
      <div class="strip__thumb">
        <img
          v-if="att.mimeType !== 'application/pdf' && thumbnailUrls[att.id]"
          :src="thumbnailUrls[att.id]"
          :alt="att.originalFilename"
          class="strip__img"
        >
        <span v-else class="material-symbols-outlined strip__pdf-icon" aria-hidden="true">picture_as_pdf</span>
      </div>
      <span class="strip__label">{{ att.originalFilename }}</span>
    </button>
  </div>
</template>

<style scoped>
.strip {
  display: flex;
  gap: var(--spacing-sm);
  overflow-x: auto;
  padding: var(--spacing-xs) 0;
  scrollbar-width: thin;
  scrollbar-color: var(--color-outline-variant) transparent;
}

.strip__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xxs);
  flex-shrink: 0;
  width: 80px;
}

.strip__thumb {
  width: 80px;
  height: 80px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-outline-variant);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface-variant);
}

.strip__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.strip__pdf-icon {
  font-size: 40px;
  color: var(--color-on-surface-variant);
}

.strip__label {
  font-size: 10px;
  color: var(--color-on-surface-variant);
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
}
</style>
