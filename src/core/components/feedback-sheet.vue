<script setup lang="ts">
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
  } else {
    emit('close')
  }
}
</script>

<template>
  <div class="sheet" role="dialog" aria-modal="true" aria-label="Feedback">
    <button type="button" class="primary-btn" @click="openIssue">Open Issue on GitHub</button>
    <p class="hint">
      No GitHub account? Reach out at
      <a :href="`mailto:${FEEDBACK_EMAIL}`" class="email-link">{{ FEEDBACK_EMAIL }}</a>
    </p>
    <button type="button" class="close-btn" @click="emit('close')">Close</button>
  </div>

  <ErrorSnackbar :message="snackbar.message" :visible="snackbar.visible" @dismiss="dismiss" />
</template>

<style scoped>
.sheet {
  width: 100%;
  max-width: 480px;
  background-color: var(--color-surface);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  padding: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  box-shadow: var(--shadow-lg);
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

.close-btn {
  background: none;
  border: none;
  color: var(--color-on-surface-variant);
  cursor: pointer;
  padding: var(--spacing-sm);
  align-self: center;
}
</style>
