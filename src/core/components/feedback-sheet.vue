<script setup lang="ts">
import BottomSheet from '@/core/components/bottom-sheet.vue'
import ErrorSnackbar from '@/core/components/error-snackbar.vue'
import { useSnackbar } from '@/core/composables/use-snackbar'
import { FEEDBACK_EMAIL, FEEDBACK_GITHUB_ISSUE_URL } from '@/core/constants/feedback'
import { useLogger } from '@/core/logging/use-logger'

const emit = defineEmits<{ close: [] }>()

const logger = useLogger('feedback-sheet')
const { snackbar, show, dismiss } = useSnackbar()

/** Opens the GitHub bug report issue template in a new tab. Shows an error snackbar if blocked. */
function openIssue() {
  logger.info('Opening GitHub issue URL', FEEDBACK_GITHUB_ISSUE_URL)
  const tab = window.open(FEEDBACK_GITHUB_ISSUE_URL, '_blank', 'noopener,noreferrer')
  if (tab === null) {
    show(`Could not open the GitHub page. Please email us at ${FEEDBACK_EMAIL}`)
  }
  else {
    emit('close')
  }
}
</script>

<template>
  <BottomSheet title="Feedback" @close="emit('close')">
    <div class="feedback-content">
      <button type="button" class="primary-btn" @click="openIssue">Open Issue on GitHub</button>
      <p class="hint">
        No GitHub account? Reach out at
        <a :href="`mailto:${FEEDBACK_EMAIL}`" class="email-link">{{ FEEDBACK_EMAIL }}</a>
      </p>
    </div>
  </BottomSheet>

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
