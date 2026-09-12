<script setup lang="ts">
import type { PendingUpload } from '@/features/tours/presentation/stores/tour-attachments-store'
import { useI18n } from 'vue-i18n'
import BaseIconButton from '@/core/components/base-icon-button.vue'
import BaseIcon from '@/core/components/base-icon.vue'
import { isOnline } from '@/core/offline/use-online-status'
import { useTourAttachmentsStore } from '@/features/tours/presentation/stores/tour-attachments-store'

const props = defineProps<{ entry: PendingUpload }>()

const { t } = useI18n({ useScope: 'global' })
const store = useTourAttachmentsStore()
</script>

<template>
  <div class="upload-row" :class="{ 'upload-row--failed': props.entry.status === 'failed' }">
    <BaseIcon
      :name="props.entry.status === 'failed' ? 'warning' : 'upload_file'"
      class="upload-row__icon"
    />
    <div class="upload-row__body">
      <span class="upload-row__name">{{ props.entry.filename }}</span>
      <!-- Native <progress>: determinate, accessible, and free of a hand-rolled bar. -->
      <progress
        v-if="props.entry.status === 'uploading'"
        class="upload-row__progress"
        :value="props.entry.progress"
        max="1"
        :aria-label="t('tours.attachments.uploading')"
      />
      <span v-else class="upload-row__failed">{{ t('tours.attachments.uploadFailed') }}</span>
    </div>

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
  </div>
</template>

<style scoped>
.upload-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-md);
  background: var(--color-surface-variant);
  min-height: 40px;
}

.upload-row--failed {
  border-color: var(--color-error);
}

.upload-row__icon {
  color: var(--color-on-surface-variant);
  flex-shrink: 0;
}

.upload-row__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.upload-row__name {
  font-size: var(--font-size-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.upload-row__progress {
  width: 100%;
  height: 4px;
}

.upload-row__failed {
  font-size: var(--font-size-sm);
  color: var(--color-error);
}
</style>
