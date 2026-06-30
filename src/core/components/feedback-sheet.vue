<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AdaptiveOverlay from '@/core/components/adaptive-overlay.vue'
import BaseButton from '@/core/components/base-button.vue'
import ErrorSnackbar from '@/core/components/error-snackbar.vue'
import { useSnackbar } from '@/core/composables/use-snackbar'
import {
  BUG_REPORT_GITHUB_ISSUE_URL,
  FEEDBACK_EMAIL,
  FEEDBACK_GITHUB_ISSUE_URL,
} from '@/core/constants/feedback'
import { useLogger } from '@/core/logging/use-logger'

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n({ useScope: 'global' })
const logger = useLogger('feedback-sheet')
const { snackbar, show, dismiss } = useSnackbar()

/** Opens the GitHub bug report issue template in a new tab. Shows an error snackbar if blocked. */
function openFeedbackIssue() {
  logger.info('Opening GitHub issue URL', FEEDBACK_GITHUB_ISSUE_URL)
  const tab = window.open(FEEDBACK_GITHUB_ISSUE_URL, '_blank')
  if (tab === null) {
    show(t('core.feedback.sheet.errorOpening', { email: FEEDBACK_EMAIL }))
  }
  else {
    emit('close')
  }
}

/** Opens the GitHub bug report issue template in a new tab. Shows an error snackbar if blocked. */
function openBugReport() {
  logger.info('Opening GitHub bug report URL', BUG_REPORT_GITHUB_ISSUE_URL)
  const tab = window.open(BUG_REPORT_GITHUB_ISSUE_URL, '_blank')
  if (tab === null) {
    show(t('core.feedback.sheet.errorOpening', { email: FEEDBACK_EMAIL }))
  }
  else {
    emit('close')
  }
}
</script>

<template>
  <AdaptiveOverlay :title="t('core.feedback.sheet.title')" @close="emit('close')">
    <div class="feedback-content">
      <BaseButton variant="primary" @click="openBugReport">
        {{ t('core.feedback.sheet.openBugReport') }}
      </BaseButton>
      <BaseButton variant="text" @click="openFeedbackIssue">
        {{ t('core.feedback.sheet.openIssue') }}
      </BaseButton>
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
