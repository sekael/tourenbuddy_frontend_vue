<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AdaptiveOverlay from '@/core/components/adaptive-overlay.vue'
import ErrorSnackbar from '@/core/components/error-snackbar.vue'
import { useSnackbar } from '@/core/composables/use-snackbar'
import { FEEDBACK_EMAIL, FEEDBACK_GITHUB_ISSUE_URL } from '@/core/constants/feedback'
import { useLogger } from '@/core/logging/use-logger'

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n({ useScope: 'global' })
const logger = useLogger('feedback-sheet')
const { snackbar, show, dismiss } = useSnackbar()

/** Opens the GitHub bug report issue template in a new tab. Shows an error snackbar if blocked. */
function openIssue() {
  logger.info('Opening GitHub issue URL', FEEDBACK_GITHUB_ISSUE_URL)
  const tab = window.open(FEEDBACK_GITHUB_ISSUE_URL, '_blank', 'noopener,noreferrer')
  if (tab === null) {
    show(t('core.feedback.sheet.errorOpening', { email: FEEDBACK_EMAIL }))
  } else {
    emit('close')
  }
}
</script>

<template>
  <AdaptiveOverlay :title="t('core.feedback.sheet.title')" @close="emit('close')">
    <div class="feedback-content">
      <button type="button" class="primary-btn" @click="openIssue">
        {{ t('core.feedback.sheet.openIssue') }}
      </button>
      <p class="hint">
        {{ t('core.feedback.sheet.noGitHub') }}
        <a :href="`mailto:${FEEDBACK_EMAIL}`" class="email-link">{{ FEEDBACK_EMAIL }}</a>
      </p>
    </div>
  </AdaptiveOverlay>

  <ErrorSnackbar :message="snackbar.message" :visible="snackbar.visible" @dismiss="dismiss" />
</template>

<style scoped>
.feedback-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.primary-btn {
  width: 100%;
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-md);
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: filter 0.15s;
}

.primary-btn:hover {
  filter: brightness(1.05);
}

.hint {
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
  margin: 0;
}

.email-link {
  color: var(--color-primary);
}
</style>
