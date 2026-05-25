<script setup lang="ts">
import type { TourAttachment } from '@/features/tours/domain/entities/tour-attachment'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLogger } from '@/core/logging/use-logger'
import { useTourAttachmentsStore } from '@/features/tours/presentation/stores/tour-attachments-store'

const props = defineProps<{
  attachments: TourAttachment[]
  startIndex?: number
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n({ useScope: 'global' })
const store = useTourAttachmentsStore()
const log = useLogger('tour-attachment-viewer')

// ── Navigation ─────────────────────────────────────────────────────────────────
const currentIndex = ref(props.startIndex ?? 0)
const current = computed(() => props.attachments[currentIndex.value])

function prev() {
  if (currentIndex.value > 0)
    currentIndex.value--
}

function next() {
  if (currentIndex.value < props.attachments.length - 1)
    currentIndex.value++
}

// ── Signed URL (view) with expiry retry ────────────────────────────────────────
const viewUrl = ref<string | null>(null)
const loadError = ref(false)
const urlRetried = ref(false)

async function fetchViewUrl() {
  if (!current.value)
    return
  viewUrl.value = null
  loadError.value = false
  urlRetried.value = false
  try {
    viewUrl.value = await store.getViewUrl(current.value.storagePath)
  }
  catch (err) {
    log.error('getViewUrl failed', err)
    loadError.value = true
  }
}

watch(currentIndex, fetchViewUrl, { immediate: true })

async function onImageError() {
  if (urlRetried.value) {
    loadError.value = true
    return
  }
  urlRetried.value = true
  try {
    viewUrl.value = await store.getViewUrl(current.value.storagePath)
  }
  catch {
    loadError.value = true
  }
}

// ── Download ───────────────────────────────────────────────────────────────────
async function downloadCurrent() {
  if (!current.value)
    return
  try {
    const url = await store.getDownloadUrl(current.value.storagePath, current.value.originalFilename)
    const a = document.createElement('a')
    a.href = url
    a.download = current.value.originalFilename
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }
  catch (err) {
    log.error('download failed', err)
  }
}

// ── PDF rendering ──────────────────────────────────────────────────────────────
const pdfCanvas = ref<HTMLCanvasElement | null>(null)
const pdfPage = ref(1)
const pdfTotalPages = ref(1)
const pdfLoading = ref(false)

interface PdfViewport { width: number, height: number }
interface PdfRenderTask { promise: Promise<void> }
interface PdfPage { getViewport: (opts: { scale: number }) => PdfViewport, render: (opts: { canvasContext: CanvasRenderingContext2D, viewport: PdfViewport }) => PdfRenderTask }
interface PdfDocument { numPages: number, getPage: (n: number) => Promise<PdfPage> }

// pdfjs-dist is loaded lazily; typed as interface to avoid bundling the types statically
let pdfDoc: PdfDocument | null = null

async function renderPdf(url: string) {
  pdfLoading.value = true
  pdfPage.value = 1
  try {
    const pdfjsLib = await import('pdfjs-dist')
    // Set worker source via URL — bundled by Vite
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).href

    pdfDoc = await pdfjsLib.getDocument(url).promise as PdfDocument
    pdfTotalPages.value = pdfDoc.numPages
    await renderPage(1)
  }
  catch (err) {
    log.error('PDF render failed', err)
    loadError.value = true
  }
  finally {
    pdfLoading.value = false
  }
}

async function renderPage(pageNum: number) {
  if (!pdfDoc || !pdfCanvas.value)
    return
  const page = await pdfDoc.getPage(pageNum)
  const viewport = page.getViewport({ scale: window.devicePixelRatio || 1 })
  const canvas = pdfCanvas.value
  const ctx = canvas.getContext('2d')!
  canvas.width = viewport.width
  canvas.height = viewport.height
  canvas.style.maxWidth = '100%'
  canvas.style.maxHeight = '100%'
  await page.render({ canvasContext: ctx, viewport }).promise
}

watch([viewUrl, currentIndex], ([url]) => {
  if (url && current.value?.mimeType === 'application/pdf') {
    renderPdf(url)
  }
})

async function pdfPrevPage() {
  if (pdfPage.value <= 1)
    return
  pdfPage.value--
  await renderPage(pdfPage.value)
}

async function pdfNextPage() {
  if (pdfPage.value >= pdfTotalPages.value)
    return
  pdfPage.value++
  await renderPage(pdfPage.value)
}

// ── Swipe ──────────────────────────────────────────────────────────────────────
const touchStartX = ref<number | null>(null)

function onTouchStart(e: TouchEvent) {
  touchStartX.value = e.touches[0].clientX
}

function onTouchEnd(e: TouchEvent) {
  if (touchStartX.value === null)
    return
  const dx = e.changedTouches[0].clientX - touchStartX.value
  touchStartX.value = null
  if (Math.abs(dx) < 40)
    return
  if (dx < 0)
    next()
  else
    prev()
}

// ── Keyboard ───────────────────────────────────────────────────────────────────
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape')
    emit('close')
  if (e.key === 'ArrowRight')
    next()
  if (e.key === 'ArrowLeft')
    prev()
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <div
      class="viewer"
      role="dialog"
      aria-modal="true"
      aria-label="Attachment viewer"
      @touchstart.passive="onTouchStart"
      @touchend.passive="onTouchEnd"
    >
      <!-- Header -->
      <div class="viewer__header">
        <span class="viewer__filename">{{ current?.originalFilename }}</span>
        <div class="viewer__header-actions">
          <button
            type="button"
            class="viewer__icon-btn"
            :aria-label="t('tours.attachments.download')"
            @click="downloadCurrent"
          >
            <span class="material-symbols-outlined" aria-hidden="true">download</span>
          </button>
          <button
            type="button"
            class="viewer__icon-btn"
            aria-label="Close"
            @click="emit('close')"
          >
            <span class="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        </div>
      </div>

      <!-- Content area -->
      <div class="viewer__content">
        <!-- Loading / error states -->
        <div v-if="!viewUrl && !loadError" class="viewer__status">
          <span class="viewer__loading" />
        </div>
        <div v-else-if="loadError" class="viewer__status viewer__status--error">
          <span class="material-symbols-outlined">broken_image</span>
        </div>

        <!-- Image -->
        <img
          v-else-if="current?.mimeType !== 'application/pdf'"
          :src="viewUrl ?? ''"
          :alt="current?.originalFilename"
          class="viewer__image"
          @error="onImageError"
        >

        <!-- PDF -->
        <div v-else class="viewer__pdf-wrap">
          <div v-if="pdfLoading" class="viewer__status">
            <span class="viewer__loading" />
          </div>
          <canvas ref="pdfCanvas" class="viewer__pdf-canvas" />
          <div v-if="pdfTotalPages > 1" class="viewer__pdf-nav">
            <button type="button" class="viewer__icon-btn" :disabled="pdfPage <= 1" @click="pdfPrevPage">
              <span class="material-symbols-outlined" aria-hidden="true">chevron_left</span>
            </button>
            <span class="viewer__pdf-page">
              {{ t('tours.attachments.viewer.page', { page: pdfPage, total: pdfTotalPages }) }}
            </span>
            <button type="button" class="viewer__icon-btn" :disabled="pdfPage >= pdfTotalPages" @click="pdfNextPage">
              <span class="material-symbols-outlined" aria-hidden="true">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      <!-- File navigation arrows -->
      <button
        v-if="currentIndex > 0"
        type="button"
        class="viewer__nav viewer__nav--prev"
        :aria-label="t('tours.attachments.viewer.previous')"
        @click="prev"
      >
        <span class="material-symbols-outlined" aria-hidden="true">chevron_left</span>
      </button>
      <button
        v-if="currentIndex < attachments.length - 1"
        type="button"
        class="viewer__nav viewer__nav--next"
        :aria-label="t('tours.attachments.viewer.next')"
        @click="next"
      >
        <span class="material-symbols-outlined" aria-hidden="true">chevron_right</span>
      </button>

      <!-- Dots indicator -->
      <div v-if="attachments.length > 1" class="viewer__dots" aria-hidden="true">
        <span
          v-for="(_, i) in attachments"
          :key="i"
          class="viewer__dot"
          :class="{ 'viewer__dot--active': i === currentIndex }"
        />
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.viewer {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.93);
  z-index: 100;
  display: flex;
  flex-direction: column;
  color: #fff;
}

.viewer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md) var(--spacing-lg);
  flex-shrink: 0;
  gap: var(--spacing-sm);
}

.viewer__filename {
  font-size: var(--font-size-sm);
  opacity: 0.85;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.viewer__header-actions {
  display: flex;
  gap: var(--spacing-xs);
  flex-shrink: 0;
}

.viewer__icon-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  opacity: 0.85;
  transition:
    opacity 0.15s,
    background-color 0.15s;
}

.viewer__icon-btn:hover:not(:disabled) {
  opacity: 1;
  background: rgba(255, 255, 255, 0.12);
}

.viewer__icon-btn:disabled {
  opacity: 0.3;
}

.viewer__content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
}

.viewer__status {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
}

.viewer__loading {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.viewer__image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.viewer__pdf-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.viewer__pdf-canvas {
  flex: 1;
  min-height: 0;
  object-fit: contain;
}

.viewer__pdf-nav {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) 0;
  flex-shrink: 0;
}

.viewer__pdf-page {
  font-size: var(--font-size-sm);
  opacity: 0.85;
}

.viewer__nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 28px;
  z-index: 2;
  transition: background-color 0.15s;
}

.viewer__nav:hover {
  background: rgba(255, 255, 255, 0.22);
}

.viewer__nav--prev {
  left: var(--spacing-sm);
}
.viewer__nav--next {
  right: var(--spacing-sm);
}

.viewer__dots {
  display: flex;
  justify-content: center;
  gap: 6px;
  padding: var(--spacing-sm);
  flex-shrink: 0;
}

.viewer__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.35);
  transition: background-color 0.15s;
}

.viewer__dot--active {
  background: #fff;
}
</style>
