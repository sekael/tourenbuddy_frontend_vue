<script setup lang="ts">
import type { TourAttachment } from '@/features/tours/domain/entities/tour-attachment';
import { useTourAttachmentsStore } from '@/features/tours/presentation/stores/tour-attachments-store';
import { computed, onMounted, ref, watch } from 'vue';

const props = defineProps<{
  tourId: string
}>()

const emit = defineEmits<{
  openViewer: [attachments: TourAttachment[], startIndex: number]
}>()

const store = useTourAttachmentsStore()

/** Reactive: updates instantly when commitStaged or add() populates the store. */
const attachments = computed<TourAttachment[]>(() => store.attachmentsByTour[props.tourId] ?? [])
const thumbnailUrls = ref<Record<string, string>>({})

onMounted(() => {
  // Populate store if not already loaded (e.g. view-only open without edit)
  if (!store.attachmentsByTour[props.tourId]) {
    store.load(props.tourId)
  }
})

// Fetch thumbnail signed URLs whenever attachment list changes
watch(
  attachments,
  async (list) => {
    for (const att of list) {
      if (thumbnailUrls.value[att.id]) continue
      try {
        const url = await store.getViewUrl(att.storagePath)
        if (att.mimeType === 'application/pdf')
          thumbnailUrls.value[att.id] = await renderPdfThumbnail(url)
        else thumbnailUrls.value[att.id] = url
      } catch {
        // Thumbnail load failure is non-critical
      }
    }
  },
  { immediate: true },
)

interface PdfViewport {
  width: number
  height: number
}
interface PdfPage {
  getViewport: (opts: { scale: number }) => PdfViewport
  render: (opts: { canvasContext: CanvasRenderingContext2D; viewport: PdfViewport }) => {
    promise: Promise<void>
  }
}
interface PdfDocument {
  getPage: (n: number) => Promise<PdfPage>
}

async function renderPdfThumbnail(url: string): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).href

  const doc = (await pdfjsLib.getDocument(url).promise) as unknown as PdfDocument
  const page = await doc.getPage(1)
  const natural = page.getViewport({ scale: 1 })
  const scale = 160 / Math.min(natural.width, natural.height)
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')!
  await page.render({ canvasContext: ctx, viewport }).promise

  return canvas.toDataURL('image/png')
}

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
          v-if="thumbnailUrls[att.id]"
          :src="thumbnailUrls[att.id]"
          :alt="att.originalFilename"
          class="strip__img"
        />
        <span v-else class="material-symbols-outlined strip__pdf-icon" aria-hidden="true">
          {{ att.mimeType === 'application/pdf' ? 'picture_as_pdf' : 'image' }}
        </span>
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
