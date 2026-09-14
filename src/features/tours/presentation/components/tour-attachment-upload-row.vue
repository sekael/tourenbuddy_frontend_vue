<script setup lang="ts">
import type { PendingUpload } from '@/features/tours/presentation/stores/tour-attachments-store'
import { useI18n } from 'vue-i18n'
import BaseIconButton from '@/core/components/base-icon-button.vue'
import { isOnline } from '@/core/offline/use-online-status'
import UploadTile from '@/features/tours/presentation/components/upload-tile.vue'
import { useTourAttachmentsStore } from '@/features/tours/presentation/stores/tour-attachments-store'

const props = defineProps<{ entry: PendingUpload }>()

const { t } = useI18n({ useScope: 'global' })
const store = useTourAttachmentsStore()
</script>

<template>
  <UploadTile
    :icon="props.entry.status === 'failed' ? 'warning' : 'upload_file'"
    :filename="props.entry.filename"
    :progress="props.entry.status === 'uploading' ? props.entry.progress : null"
    :progress-label="t('tours.attachments.uploading')"
    :failed="props.entry.status === 'failed'"
  >
    <template #status>
      <span v-if="props.entry.status === 'failed'" class="upload-row__failed">
        {{ t('tours.attachments.uploadFailed') }}
      </span>
    </template>

    <BaseIconButton
      v-if="props.entry.status === 'uploading'"
      name="close"
      :label="t('tours.attachments.cancelUpload')"
      shape="square"
      size="sm"
      data-testid="upload-cancel"
      @click="props.entry.cancel()"
    />
    <template v-else>
      <!-- Offline: disabled, never queued — attachment upload stays online-only (DC10). -->
      <BaseIconButton
        name="replay"
        :label="t('tours.attachments.retryUpload')"
        shape="square"
        size="sm"
        :disabled="!isOnline"
        data-testid="upload-retry"
        @click="store.retryUpload(props.entry.id)"
      />
      <BaseIconButton
        name="delete"
        :label="t('tours.attachments.dismissUpload')"
        shape="square"
        size="sm"
        tone="danger"
        data-testid="upload-dismiss"
        @click="store.dismissUpload(props.entry.id)"
      />
    </template>
  </UploadTile>
</template>

<style scoped>
.upload-row__failed {
  font-size: var(--font-size-sm);
  color: var(--color-error);
}
</style>
